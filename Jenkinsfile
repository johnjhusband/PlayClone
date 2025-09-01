// Jenkins Pipeline for PlayClone
// Comprehensive CI/CD pipeline with parallel execution

@Library('shared-pipeline-library') _

pipeline {
    agent {
        label 'nodejs-20'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 1, unit: 'HOURS')
        disableConcurrentBuilds()
        skipDefaultCheckout()
    }

    environment {
        NODE_VERSION = '20'
        DOCKER_REGISTRY = credentials('docker-registry')
        NPM_TOKEN = credentials('npm-token')
        GITHUB_TOKEN = credentials('github-token')
        SLACK_WEBHOOK = credentials('slack-webhook')
        SONAR_TOKEN = credentials('sonar-token')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH = sh(
                        script: "git rev-parse --abbrev-ref HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }

        stage('Prepare') {
            steps {
                sh '''
                    echo "Node version: $(node --version)"
                    echo "NPM version: $(npm --version)"
                    npm ci
                    npx playwright install-deps
                    npx playwright install chromium firefox webkit
                '''
            }
        }

        stage('Quality Gates') {
            parallel {
                stage('Lint') {
                    steps {
                        sh 'npm run lint'
                    }
                }

                stage('Type Check') {
                    steps {
                        sh 'npm run typecheck'
                    }
                }

                stage('Security Audit') {
                    steps {
                        sh 'npm audit --audit-level=high || true'
                        recordIssues(
                            enabledForFailure: false,
                            tool: npmAudit()
                        )
                    }
                }

                stage('License Check') {
                    steps {
                        sh 'npx license-checker --production --summary'
                    }
                }
            }
        }

        stage('Testing') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'npm run test:unit -- --coverage'
                        junit 'test-results/junit.xml'
                        publishCoverage(
                            adapters: [coberturaAdapter('coverage/cobertura-coverage.xml')],
                            sourceFileResolver: sourceDirectories('src')
                        )
                    }
                }

                stage('Integration Tests') {
                    agent {
                        docker {
                            image 'mcr.microsoft.com/playwright:v1.40.0-focal'
                            args '--network jenkins-network'
                        }
                    }
                    steps {
                        sh '''
                            docker run -d --name redis-test --network jenkins-network redis:7-alpine
                            export REDIS_URL=redis://redis-test:6379
                            npm run test:integration
                            docker stop redis-test && docker rm redis-test
                        '''
                        archiveArtifacts artifacts: 'test-results/**/*', allowEmptyArchive: true
                    }
                }

                stage('Browser Tests') {
                    matrix {
                        axes {
                            axis {
                                name 'BROWSER'
                                values 'chromium', 'firefox', 'webkit'
                            }
                        }
                        stages {
                            stage('Browser Test') {
                                steps {
                                    sh "npm run test:browser -- --browser=${BROWSER}"
                                    archiveArtifacts artifacts: "test-results/${BROWSER}/**/*", allowEmptyArchive: true
                                }
                            }
                        }
                    }
                }

                stage('Performance Tests') {
                    when {
                        anyOf {
                            branch 'main'
                            branch 'develop'
                        }
                    }
                    steps {
                        sh 'npm run test:performance'
                        publishPerformanceReport(
                            parsers: [
                                [$class: 'JMeterParser', glob: 'performance-results/*.jtl']
                            ],
                            errorFailedThreshold: 5,
                            errorUnstableThreshold: 1
                        )
                    }
                }
            }
        }

        stage('SonarQube Analysis') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        npx sonar-scanner \
                            -Dsonar.projectKey=playclone \
                            -Dsonar.sources=src \
                            -Dsonar.tests=tests \
                            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                            -Dsonar.testExecutionReportPaths=test-results/sonar-report.xml
                    '''
                }
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build') {
            parallel {
                stage('Build Application') {
                    steps {
                        sh '''
                            npm run build
                            npm pack
                        '''
                        archiveArtifacts artifacts: 'dist/**/*,playclone-*.tgz', fingerprint: true
                    }
                }

                stage('Build Docker Image') {
                    when {
                        anyOf {
                            branch 'main'
                            branch 'develop'
                            tag pattern: "v\\d+\\.\\d+\\.\\d+", comparator: "REGEXP"
                        }
                    }
                    steps {
                        script {
                            docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-credentials') {
                                def image = docker.build("playclone:${env.GIT_COMMIT_SHORT}")
                                image.push()
                                if (env.BRANCH_NAME == 'main') {
                                    image.push('latest')
                                }
                                if (env.BRANCH_NAME == 'develop') {
                                    image.push('develop')
                                }
                                if (env.TAG_NAME) {
                                    image.push(env.TAG_NAME)
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Security Scanning') {
            parallel {
                stage('Container Scan') {
                    when {
                        anyOf {
                            branch 'main'
                            branch 'develop'
                        }
                    }
                    steps {
                        sh """
                            docker run --rm \
                                -v /var/run/docker.sock:/var/run/docker.sock \
                                aquasec/trivy image \
                                --severity HIGH,CRITICAL \
                                --exit-code 0 \
                                --format json \
                                --output trivy-report.json \
                                ${DOCKER_REGISTRY}/playclone:${env.GIT_COMMIT_SHORT}
                        """
                        archiveArtifacts artifacts: 'trivy-report.json'
                    }
                }

                stage('SAST Scan') {
                    steps {
                        sh '''
                            docker run --rm \
                                -v "${PWD}:/src" \
                                returntocorp/semgrep \
                                --config=auto \
                                --json \
                                --output=/src/sast-report.json \
                                /src
                        '''
                        archiveArtifacts artifacts: 'sast-report.json'
                    }
                }

                stage('Dependency Check') {
                    steps {
                        dependencyCheck(
                            additionalArguments: '''
                                --scan . 
                                --format JSON 
                                --format HTML
                                --prettyPrint
                            ''',
                            odcInstallation: 'dependency-check'
                        )
                        dependencyCheckPublisher pattern: 'dependency-check-report.json'
                    }
                }
            }
        }

        stage('Deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            parallel {
                stage('Deploy to Staging') {
                    when {
                        branch 'develop'
                    }
                    steps {
                        script {
                            input message: 'Deploy to Staging?', ok: 'Deploy'
                        }
                        sh '''
                            echo "Deploying to staging environment"
                            # Add staging deployment commands here
                        '''
                    }
                }

                stage('Deploy to Production') {
                    when {
                        branch 'main'
                    }
                    steps {
                        script {
                            input message: 'Deploy to Production?', ok: 'Deploy'
                        }
                        sh '''
                            echo "Deploying to production environment"
                            # Add production deployment commands here
                        '''
                    }
                }
            }
        }

        stage('Release') {
            when {
                tag pattern: "v\\d+\\.\\d+\\.\\d+", comparator: "REGEXP"
            }
            parallel {
                stage('NPM Publish') {
                    steps {
                        sh '''
                            echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
                            npm publish playclone-*.tgz
                        '''
                    }
                }

                stage('GitHub Release') {
                    steps {
                        script {
                            def releaseNotes = readFile('CHANGELOG.md')
                            githubRelease(
                                token: env.GITHUB_TOKEN,
                                repository: 'playclone',
                                tagName: env.TAG_NAME,
                                name: "PlayClone ${env.TAG_NAME}",
                                body: releaseNotes,
                                assets: ['playclone-*.tgz', 'dist/**/*']
                            )
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            cleanWs()
            sh 'docker system prune -f || true'
        }

        success {
            slackSend(
                channel: '#ci-cd',
                color: 'good',
                message: "✅ Build Success: ${env.JOB_NAME} - ${env.BUILD_NUMBER} (<${env.BUILD_URL}|Open>)"
            )
        }

        failure {
            slackSend(
                channel: '#ci-cd',
                color: 'danger',
                message: "❌ Build Failed: ${env.JOB_NAME} - ${env.BUILD_NUMBER} (<${env.BUILD_URL}|Open>)"
            )
        }

        unstable {
            slackSend(
                channel: '#ci-cd',
                color: 'warning',
                message: "⚠️ Build Unstable: ${env.JOB_NAME} - ${env.BUILD_NUMBER} (<${env.BUILD_URL}|Open>)"
            )
        }
    }
}