# PlayClone Docker Deployment Guide

## Overview

PlayClone provides comprehensive Docker support for development, testing, and production deployments. This guide covers all Docker deployment scenarios.

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Compose Configurations](#docker-compose-configurations)
- [Environment Configuration](#environment-configuration)
- [Docker Images](#docker-images)
- [Deployment Scenarios](#deployment-scenarios)
- [Management Script](#management-script)
- [Scaling and High Availability](#scaling-and-high-availability)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ installed
- At least 4GB RAM available
- 10GB free disk space

### Basic Deployment

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/PlayClone.git
cd PlayClone
```

2. **Copy environment template:**
```bash
cp .env.docker.example .env
```

3. **Start services:**
```bash
./docker-compose-manager.sh start dev
```

4. **Verify deployment:**
```bash
./docker-compose-manager.sh health dev
```

## Docker Compose Configurations

### Development Environment (`docker-compose.yml`)

The default configuration for local development:

- **Services:** PlayClone API, Redis, Browser Pool, Optional Monitoring
- **Features:** Hot reload, Debug mode, Visible browsers option
- **Ports:** 3000 (API), 6379 (Redis), 9090 (Prometheus), 3002 (Grafana)
- **Usage:** `docker-compose up`

### Test Environment (`docker-compose.test.yml`)

Optimized for running automated tests:

- **Services:** Test Runner, Redis Test, Browser Test Nodes
- **Features:** Parallel testing, Coverage reports, Multiple browser support
- **Profiles:** integration, performance, security
- **Usage:** `docker-compose -f docker-compose.test.yml up`

### Production Environment (`docker-compose.prod.yml`)

High-availability production configuration:

- **Services:** Load Balancer, API Replicas, Browser Farm, Redis HA, Monitoring
- **Features:** Auto-scaling, SSL/TLS, Health checks, Backup automation
- **HA Setup:** Redis Sentinel, Multiple replicas, Traefik load balancing
- **Usage:** `docker-compose -f docker-compose.prod.yml up`

## Environment Configuration

### Essential Variables

```bash
# Core Settings
NODE_ENV=production
PLAYCLONE_HEADLESS=true
PLAYCLONE_MAX_SESSIONS=50

# Security
JWT_SECRET=your-secret-key-minimum-32-chars
API_KEY=your-api-key

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your-redis-password

# Monitoring
GRAFANA_PASSWORD=admin-password
```

### Environment Files

- `.env.development` - Development settings
- `.env.test` - Test environment settings
- `.env.production` - Production settings
- `.env.docker.example` - Template with all options

## Docker Images

### Main Application Image

```dockerfile
# Build
docker build -t playclone:latest .

# Run standalone
docker run -p 3000:3000 playclone:latest
```

### Browser Pool Image

```dockerfile
# Build browser pool
docker build -f Dockerfile.browserPool -t playclone-browser:latest .

# Run with custom pool size
docker run -e POOL_SIZE=10 playclone-browser:latest
```

### Test Image

```dockerfile
# Build test image
docker build -f Dockerfile.test -t playclone-test:latest .

# Run tests
docker run playclone-test:latest npm test
```

## Deployment Scenarios

### Local Development

```bash
# Start development environment
./docker-compose-manager.sh start dev

# View logs
./docker-compose-manager.sh logs dev

# Stop services
./docker-compose-manager.sh stop dev
```

### CI/CD Testing

```bash
# Run full test suite
./docker-compose-manager.sh test

# Run specific test profile
docker-compose -f docker-compose.test.yml --profile integration up

# Performance testing
docker-compose -f docker-compose.test.yml --profile performance up
```

### Production Deployment

```bash
# Build production images
./docker-compose-manager.sh build prod

# Deploy with scaling
./docker-compose-manager.sh start prod
./docker-compose-manager.sh scale browser-node 5

# Monitor health
./docker-compose-manager.sh health prod
```

## Management Script

The `docker-compose-manager.sh` script provides easy management:

### Available Commands

```bash
# Start services
./docker-compose-manager.sh start [dev|test|prod]

# Stop services
./docker-compose-manager.sh stop [dev|test|prod]

# Restart services
./docker-compose-manager.sh restart [dev|test|prod]

# View logs
./docker-compose-manager.sh logs [environment] [service]

# Run tests
./docker-compose-manager.sh test

# Build images
./docker-compose-manager.sh build [environment]

# Scale services
./docker-compose-manager.sh scale <service> <replicas>

# Health check
./docker-compose-manager.sh health [environment]

# Backup data
./docker-compose-manager.sh backup

# Restore from backup
./docker-compose-manager.sh restore <backup_file>
```

## Scaling and High Availability

### Horizontal Scaling

```bash
# Scale API instances
docker-compose -f docker-compose.prod.yml up -d --scale playclone=5

# Scale browser nodes
docker-compose -f docker-compose.prod.yml up -d --scale browser-node=10
```

### Load Balancing

Production setup includes Traefik for automatic load balancing:

```yaml
# Traefik automatically discovers and balances services
labels:
  - "traefik.enable=true"
  - "traefik.http.services.playclone.loadbalancer.sticky=true"
```

### Redis High Availability

Production includes Redis Sentinel for automatic failover:

```bash
# Redis master-replica setup with Sentinel
# Automatic failover in case of master failure
redis-master (primary)
├── redis-replica-1 (backup)
├── redis-replica-2 (backup)
└── redis-sentinel (3 instances for quorum)
```

## Monitoring and Logging

### Prometheus Metrics

```bash
# Access Prometheus
http://localhost:9090

# Available metrics:
- playclone_sessions_active
- playclone_browser_pool_size
- playclone_request_duration
- playclone_error_rate
```

### Grafana Dashboards

```bash
# Access Grafana
http://localhost:3002
# Default: admin/admin

# Pre-configured dashboards:
- PlayClone Overview
- Browser Performance
- Redis Metrics
- System Resources
```

### Log Aggregation

Production setup includes Loki and Promtail:

```bash
# View aggregated logs in Grafana
# Loki datasource pre-configured
# Search logs across all services
```

## Backup and Recovery

### Automated Backups

```bash
# Manual backup
./docker-compose-manager.sh backup

# Scheduled backups (production)
# Configured via BACKUP_SCHEDULE env var
# Default: Daily at 2 AM
```

### Restore Process

```bash
# Restore from backup
./docker-compose-manager.sh restore backups/20240101_020000/backup.tar.gz

# Verify restoration
./docker-compose-manager.sh health prod
```

### S3 Backup (Production)

```bash
# Configure S3 backup
S3_BACKUP_BUCKET=playclone-backups
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

## Security Considerations

### Network Isolation

```yaml
# Separate networks for different concerns
networks:
  frontend:    # Public facing
  backend:     # Internal services
  monitoring:  # Metrics and logs
```

### Secret Management

```bash
# Use Docker secrets in production
echo "password" | docker secret create redis_password -

# Reference in compose file
secrets:
  - redis_password
```

### Security Scanning

```bash
# Run security scan
docker-compose -f docker-compose.test.yml --profile security up

# Scan specific image
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image playclone:latest
```

## Troubleshooting

### Common Issues

#### 1. Browser Pool Connection Issues

```bash
# Check browser pool health
docker logs playclone-browser-pool

# Restart browser pool
docker-compose restart browser-pool
```

#### 2. Redis Connection Failed

```bash
# Check Redis status
docker exec playclone-redis redis-cli ping

# View Redis logs
docker logs playclone-redis
```

#### 3. Out of Memory

```bash
# Check resource usage
docker stats

# Increase limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G
```

#### 4. Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Change port in .env
PLAYCLONE_PORT=3001
```

### Debug Mode

```bash
# Enable debug logging
PLAYCLONE_DEBUG=true
LOG_LEVEL=debug

# View detailed logs
docker-compose logs -f playclone
```

### Health Checks

```bash
# Manual health check
curl http://localhost:3000/health

# Check all services
./docker-compose-manager.sh health
```

## Performance Tuning

### Browser Pool Optimization

```bash
# Optimize pool size based on resources
POOL_SIZE=10              # Number of browser instances
MAX_PAGES_PER_BROWSER=20  # Pages per browser
BROWSER_TIMEOUT=60000     # Timeout in ms
```

### Redis Optimization

```bash
# Redis performance settings
redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

### Resource Limits

```yaml
# Set appropriate resource limits
resources:
  limits:
    cpus: '4'
    memory: 4G
  reservations:
    cpus: '2'
    memory: 2G
```

## Best Practices

1. **Use specific image tags in production**
   ```yaml
   image: playclone:1.1.0  # Not 'latest'
   ```

2. **Implement health checks**
   ```yaml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
     interval: 30s
   ```

3. **Use volume mounts for persistent data**
   ```yaml
   volumes:
     - playclone-data:/app/data
   ```

4. **Implement proper logging**
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

5. **Regular backups**
   ```bash
   # Automate daily backups
   0 2 * * * /opt/playclone/docker-compose-manager.sh backup
   ```

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/PlayClone/issues
- Documentation: https://github.com/yourusername/PlayClone/docs
- Docker Hub: https://hub.docker.com/r/yourusername/playclone