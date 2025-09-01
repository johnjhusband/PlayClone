export class CodeGenerator {
    generate(actions: any[]): string {
        if (actions.length === 0) {
            return '// No actions recorded';
        }

        const lines: string[] = [
            "import { PlayClone } from 'playclone';",
            "",
            "async function runAutomation() {",
            "    const pc = new PlayClone({",
            "        browser: 'chromium',",
            "        headless: false",
            "    });",
            "",
            "    try {",
            "        await pc.launch();",
            ""
        ];

        for (const action of actions) {
            lines.push(this.generateActionCode(action));
        }

        lines.push(
            "    } catch (error) {",
            "        console.error('Automation failed:', error);",
            "    } finally {",
            "        await pc.close();",
            "    }",
            "}",
            "",
            "runAutomation();"
        );

        return lines.join('\n');
    }

    private generateActionCode(action: any): string {
        const indent = '        ';
        
        switch (action.type) {
            case 'navigate':
                return `${indent}await pc.navigate('${action.url}');`;
            
            case 'click':
                return `${indent}await pc.click('${this.escapeString(action.selector)}');`;
            
            case 'fill':
                return `${indent}await pc.fill('${this.escapeString(action.selector)}', '${this.escapeString(action.value)}');`;
            
            case 'select':
                return `${indent}await pc.select('${this.escapeString(action.selector)}', '${this.escapeString(action.value)}');`;
            
            case 'check':
                return `${indent}await pc.check('${this.escapeString(action.selector)}');`;
            
            case 'hover':
                return `${indent}await pc.hover('${this.escapeString(action.selector)}');`;
            
            case 'screenshot':
                return `${indent}await pc.screenshot();`;
            
            case 'getText':
                return `${indent}const text = await pc.getText('${this.escapeString(action.selector)}');`;
            
            case 'wait':
                return `${indent}await pc.wait(${action.value});`;
            
            default:
                return `${indent}// Unknown action: ${action.type}`;
        }
    }

    private escapeString(str: string): string {
        if (!str) return '';
        return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
    }

    generateTypeScript(actions: any[]): string {
        if (actions.length === 0) {
            return '// No actions recorded';
        }

        const lines: string[] = [
            "import { PlayClone } from 'playclone';",
            "",
            "async function runAutomation(): Promise<void> {",
            "    const pc = new PlayClone({",
            "        browser: 'chromium',",
            "        headless: false",
            "    });",
            "",
            "    try {",
            "        await pc.launch();",
            ""
        ];

        for (const action of actions) {
            lines.push(this.generateActionCode(action));
        }

        lines.push(
            "    } catch (error) {",
            "        console.error('Automation failed:', error);",
            "    } finally {",
            "        await pc.close();",
            "    }",
            "}",
            "",
            "runAutomation();"
        );

        return lines.join('\n');
    }

    generatePython(actions: any[]): string {
        if (actions.length === 0) {
            return '# No actions recorded';
        }

        const lines: string[] = [
            "from playclone import PlayClone",
            "",
            "async def run_automation():",
            "    pc = PlayClone({",
            "        'browser': 'chromium',",
            "        'headless': False",
            "    })",
            "",
            "    try:",
            "        await pc.launch()",
            ""
        ];

        for (const action of actions) {
            lines.push(this.generatePythonActionCode(action));
        }

        lines.push(
            "    except Exception as error:",
            "        print(f'Automation failed: {error}')",
            "    finally:",
            "        await pc.close()",
            "",
            "import asyncio",
            "asyncio.run(run_automation())"
        );

        return lines.join('\n');
    }

    private generatePythonActionCode(action: any): string {
        const indent = '        ';
        
        switch (action.type) {
            case 'navigate':
                return `${indent}await pc.navigate('${action.url}')`;
            
            case 'click':
                return `${indent}await pc.click('${this.escapeString(action.selector)}')`;
            
            case 'fill':
                return `${indent}await pc.fill('${this.escapeString(action.selector)}', '${this.escapeString(action.value)}')`;
            
            default:
                return `${indent}# Unknown action: ${action.type}`;
        }
    }
}