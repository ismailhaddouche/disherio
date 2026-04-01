#!/bin/bash
# DisherIO Monitoring Stack Startup Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  DisherIO Monitoring Stack${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}❌ Please edit .env and set your GRAFANA_ADMIN_PASSWORD before continuing.${NC}"
    exit 1
fi

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    echo -n "Waiting for $name..."
    while ! curl -s -o /dev/null "$url" && [ $attempt -le $max_attempts ]; do
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""

    if [ $attempt -le $max_attempts ]; then
        echo -e "${GREEN}✅ $name is ready${NC}"
        return 0
    else
        echo -e "${RED}❌ $name failed to start${NC}"
        return 1
    fi
}

# Parse arguments
MODE=${1:-all}

if [ "$MODE" == "all" ]; then
    echo -e "${BLUE}🚀 Starting full stack with monitoring...${NC}"
    docker-compose up -d
elif [ "$MODE" == "monitoring" ]; then
    echo -e "${BLUE}🚀 Starting monitoring stack only...${NC}"
    docker-compose up -d prometheus grafana alertmanager mongo-exporter redis-exporter node-exporter
elif [ "$MODE" == "stop" ]; then
    echo -e "${BLUE}🛑 Stopping monitoring services...${NC}"
    docker-compose stop prometheus grafana alertmanager mongo-exporter redis-exporter node-exporter
    exit 0
elif [ "$MODE" == "logs" ]; then
    docker-compose logs -f prometheus grafana alertmanager
    exit 0
else
    echo "Usage: $0 [all|monitoring|stop|logs]"
    echo "  all       - Start full stack with monitoring (default)"
    echo "  monitoring - Start only monitoring services"
    echo "  stop      - Stop monitoring services"
    echo "  logs      - View monitoring logs"
    exit 1
fi

echo ""
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
echo ""

# Wait for services
wait_for_service "http://localhost:9090/-/healthy" "Prometheus"
wait_for_service "http://localhost:3001/api/health" "Grafana"
wait_for_service "http://localhost:9093/-/healthy" "Alertmanager"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Monitoring Stack Ready!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}📊 Grafana:${NC}       http://localhost:3001"
echo -e "${BLUE}📈 Prometheus:${NC}    http://localhost:9090"
echo -e "${BLUE}🚨 Alertmanager:${NC}  http://localhost:9093"
echo ""
echo -e "${YELLOW}Default Grafana credentials:${NC}"
echo -e "  Username: ${BLUE}admin${NC}"
echo -e "  Password: ${BLUE}(from .env file)${NC}"
echo ""
echo -e "${YELLOW}Available Dashboards:${NC}"
echo -e "  • DisherIO - System Overview"
echo -e "  • DisherIO - Backend Metrics"
echo -e "  • DisherIO - MongoDB Metrics"
echo ""
echo -e "${GREEN}Happy Monitoring! 🎉${NC}"
