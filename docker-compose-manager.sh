#!/bin/bash

# PlayClone Docker Compose Manager Script
# Helps manage different Docker Compose environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_PROJECT_NAME="playclone"
DEFAULT_ENV="development"

# Function to print colored output
print_color() {
    printf "${2}${1}${NC}\n"
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_color "Docker is not installed. Please install Docker first." "$RED"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_color "Docker Compose is not installed. Please install Docker Compose first." "$RED"
        exit 1
    fi
}

# Function to load environment file
load_env() {
    local env_file="${1:-.env}"
    if [ -f "$env_file" ]; then
        export $(cat "$env_file" | grep -v '^#' | xargs)
        print_color "Loaded environment from $env_file" "$GREEN"
    else
        print_color "Environment file $env_file not found. Using defaults." "$YELLOW"
    fi
}

# Function to start services
start_services() {
    local env="${1:-$DEFAULT_ENV}"
    local compose_file=""
    
    case "$env" in
        development|dev)
            compose_file="docker-compose.yml"
            ;;
        test)
            compose_file="docker-compose.test.yml"
            ;;
        production|prod)
            compose_file="docker-compose.prod.yml"
            ;;
        *)
            print_color "Unknown environment: $env" "$RED"
            exit 1
            ;;
    esac
    
    print_color "Starting PlayClone in $env environment..." "$BLUE"
    
    # Load environment variables
    load_env ".env.$env"
    
    # Start services
    docker-compose -f "$compose_file" -p "$COMPOSE_PROJECT_NAME-$env" up -d
    
    print_color "PlayClone services started successfully!" "$GREEN"
    
    # Show service status
    docker-compose -f "$compose_file" -p "$COMPOSE_PROJECT_NAME-$env" ps
}

# Function to stop services
stop_services() {
    local env="${1:-$DEFAULT_ENV}"
    local compose_file=""
    
    case "$env" in
        development|dev)
            compose_file="docker-compose.yml"
            ;;
        test)
            compose_file="docker-compose.test.yml"
            ;;
        production|prod)
            compose_file="docker-compose.prod.yml"
            ;;
    esac
    
    print_color "Stopping PlayClone services in $env environment..." "$YELLOW"
    docker-compose -f "$compose_file" -p "$COMPOSE_PROJECT_NAME-$env" down
    print_color "Services stopped." "$GREEN"
}

# Function to restart services
restart_services() {
    stop_services "$1"
    sleep 2
    start_services "$1"
}

# Function to view logs
view_logs() {
    local env="${1:-$DEFAULT_ENV}"
    local service="${2:-}"
    local compose_file=""
    
    case "$env" in
        development|dev)
            compose_file="docker-compose.yml"
            ;;
        test)
            compose_file="docker-compose.test.yml"
            ;;
        production|prod)
            compose_file="docker-compose.prod.yml"
            ;;
    esac
    
    if [ -z "$service" ]; then
        docker-compose -f "$compose_file" -p "$COMPOSE_PROJECT_NAME-$env" logs -f
    else
        docker-compose -f "$compose_file" -p "$COMPOSE_PROJECT_NAME-$env" logs -f "$service"
    fi
}

# Function to run tests
run_tests() {
    print_color "Running PlayClone tests..." "$BLUE"
    
    # Start test environment
    docker-compose -f docker-compose.test.yml -p "$COMPOSE_PROJECT_NAME-test" up --abort-on-container-exit --exit-code-from test-runner
    
    # Clean up
    docker-compose -f docker-compose.test.yml -p "$COMPOSE_PROJECT_NAME-test" down
    
    print_color "Tests completed!" "$GREEN"
}

# Function to build images
build_images() {
    local env="${1:-$DEFAULT_ENV}"
    
    print_color "Building PlayClone Docker images..." "$BLUE"
    
    # Build main Dockerfile
    docker build -t playclone:latest .
    
    # Build browser pool image
    docker build -f Dockerfile.browserPool -t playclone-browser-pool:latest .
    
    # Build test image if needed
    if [ "$env" = "test" ]; then
        docker build -f Dockerfile.test -t playclone-test:latest .
    fi
    
    print_color "Images built successfully!" "$GREEN"
}

# Function to scale services
scale_services() {
    local service="$1"
    local replicas="$2"
    local env="${3:-production}"
    
    if [ -z "$service" ] || [ -z "$replicas" ]; then
        print_color "Usage: $0 scale <service> <replicas> [environment]" "$RED"
        exit 1
    fi
    
    print_color "Scaling $service to $replicas replicas..." "$BLUE"
    docker-compose -f docker-compose.prod.yml -p "$COMPOSE_PROJECT_NAME-$env" up -d --scale "$service=$replicas"
    print_color "Scaling completed!" "$GREEN"
}

# Function to show health status
health_check() {
    local env="${1:-$DEFAULT_ENV}"
    local compose_file=""
    
    case "$env" in
        development|dev)
            compose_file="docker-compose.yml"
            ;;
        production|prod)
            compose_file="docker-compose.prod.yml"
            ;;
        *)
            compose_file="docker-compose.yml"
            ;;
    esac
    
    print_color "Checking health status of PlayClone services..." "$BLUE"
    
    # Get container IDs
    container_ids=$(docker-compose -f "$compose_file" -p "$COMPOSE_PROJECT_NAME-$env" ps -q)
    
    if [ -z "$container_ids" ]; then
        print_color "No running containers found." "$YELLOW"
        return
    fi
    
    # Check health for each container
    for container in $container_ids; do
        name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/\///')
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no health check")
        status=$(docker inspect --format='{{.State.Status}}' "$container")
        
        if [ "$health" = "healthy" ]; then
            print_color "✓ $name: $status (healthy)" "$GREEN"
        elif [ "$health" = "unhealthy" ]; then
            print_color "✗ $name: $status (unhealthy)" "$RED"
        else
            print_color "- $name: $status" "$YELLOW"
        fi
    done
}

# Function to backup data
backup_data() {
    local backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
    
    print_color "Creating backup in $backup_dir..." "$BLUE"
    mkdir -p "$backup_dir"
    
    # Backup volumes
    docker run --rm \
        -v playclone_playclone-data:/data/playclone \
        -v playclone_redis-data:/data/redis \
        -v "$PWD/$backup_dir":/backup \
        alpine tar czf /backup/backup.tar.gz /data
    
    print_color "Backup completed: $backup_dir/backup.tar.gz" "$GREEN"
}

# Function to restore data
restore_data() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        print_color "Backup file not found: $backup_file" "$RED"
        exit 1
    fi
    
    print_color "Restoring from $backup_file..." "$YELLOW"
    print_color "WARNING: This will overwrite existing data. Continue? (y/N)" "$RED"
    read -r confirm
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_color "Restore cancelled." "$YELLOW"
        exit 0
    fi
    
    # Restore volumes
    docker run --rm \
        -v playclone_playclone-data:/data/playclone \
        -v playclone_redis-data:/data/redis \
        -v "$PWD/$backup_file":/backup/backup.tar.gz \
        alpine tar xzf /backup/backup.tar.gz -C /
    
    print_color "Restore completed!" "$GREEN"
}

# Function to show usage
show_usage() {
    cat << EOF
PlayClone Docker Compose Manager

Usage: $0 <command> [options]

Commands:
    start [environment]        Start services (dev/test/prod)
    stop [environment]         Stop services
    restart [environment]      Restart services
    logs [environment] [service]  View logs
    test                       Run tests
    build [environment]        Build Docker images
    scale <service> <replicas> Scale a service
    health [environment]       Check health status
    backup                     Backup data volumes
    restore <backup_file>      Restore from backup
    help                       Show this help message

Environments:
    dev/development (default)
    test
    prod/production

Examples:
    $0 start dev               Start development environment
    $0 logs prod playclone     View production playclone logs
    $0 scale browser-node 10   Scale browser nodes to 10 replicas
    $0 backup                  Create a backup of all data

EOF
}

# Main script logic
check_docker

case "${1:-help}" in
    start)
        start_services "${2:-$DEFAULT_ENV}"
        ;;
    stop)
        stop_services "${2:-$DEFAULT_ENV}"
        ;;
    restart)
        restart_services "${2:-$DEFAULT_ENV}"
        ;;
    logs)
        view_logs "$2" "$3"
        ;;
    test)
        run_tests
        ;;
    build)
        build_images "${2:-$DEFAULT_ENV}"
        ;;
    scale)
        scale_services "$2" "$3" "${4:-production}"
        ;;
    health)
        health_check "${2:-$DEFAULT_ENV}"
        ;;
    backup)
        backup_data
        ;;
    restore)
        restore_data "$2"
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_color "Unknown command: $1" "$RED"
        show_usage
        exit 1
        ;;
esac