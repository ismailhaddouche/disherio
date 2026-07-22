#!/bin/bash
# ============================================
# DisherIO - Resource Usage Monitor
# Verifies that containers respect their resource limits.
# Warns when usage exceeds 80% of a limit.
# ============================================

set -e

# Resolve the compose project directory: the script lives in scripts/, the
# project root is one level up. docker compose resolves the project itself
# (name derived from the directory), so no hard-coded project name is needed.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DC="docker compose --project-directory \"$ROOT_DIR\" --file \"$ROOT_DIR/docker-compose.yml\""

# Output colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Umbral de alerta (80%)
ALERT_THRESHOLD=80

# Use bc when available and fall back to awk otherwise.
BC_AVAILABLE=false
if command -v bc &> /dev/null; then
    BC_AVAILABLE=true
fi

# Portable numeric comparison using awk when bc is unavailable.
num_gt() {
    # Devuelve 0 (true) si $1 > $2, 1 (false) en caso contrario
    if $BC_AVAILABLE; then
        (( $(echo "$1 > $2" | bc -l 2>/dev/null || echo "0") ))
    else
        awk "BEGIN { exit !($1 > $2) }"
    fi
}

# Portable division.
num_div() {
    # Print $1 / $2 with two decimal places.
    if $BC_AVAILABLE; then
        echo "scale=2; $1 / $2" | bc
    else
        awk "BEGIN { printf \"%.2f\", $1 / $2 }"
    fi
}

# Portable multiplication.
num_mul() {
    if $BC_AVAILABLE; then
        echo "scale=2; $1 * $2" | bc
    else
        awk "BEGIN { printf \"%.2f\", $1 * $2 }"
    fi
}

# Services to monitor (compose service names, NOT container names). Compose
# names containers <project>-<service>-N, which depends on the project name,
# so resolving by service name is the only stable approach.
SERVICES=("mongo" "redis" "backend" "frontend" "caddy")

# Resolve the running container for a compose service. Returns the container
# id (empty when the service is not running). docker compose ps -q prints the
# id of the running container for that service only.
resolve_container() {
    local service=$1
    local id
    id=$(eval "$DC ps -q '$service' 2>/dev/null" | head -n 1)
    echo "$id"
}

# ============================================
# Funciones
# ============================================

print_header() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  DisherIO - Resource Usage Monitor${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
}

print_container_header() {
    local container=$1
    echo -e "${BOLD}----------------------------------------${NC}"
    echo -e "${BOLD}Container: $container${NC}"
    echo -e "${BOLD}----------------------------------------${NC}"
}

# Convert memory to MB for comparison.
convert_to_mb() {
    local value=$1
    local unit=${value: -1}
    local num=${value%?}

    case $unit in
        G|g) num_mul "$num" 1024 | cut -d. -f1 ;;
        M|m) echo "$num" ;;
        K|k) num_div "$num" 1024 | cut -d. -f1 ;;
        *) echo "$num" ;;  # Asume MB si no hay unidad
    esac
}

# Read the container memory limit from docker inspect.
get_memory_limit() {
    local container=$1
    local limit_bytes=$(docker inspect --format='{{.HostConfig.Memory}}' "$container" 2>/dev/null || echo "0")

    if [ "$limit_bytes" = "0" ] || [ -z "$limit_bytes" ]; then
        echo "unlimited"
        return
    fi

    # Convertir bytes a MB
    num_div "$limit_bytes" 1048576
}

# Read the container CPU limit.
get_cpu_limit() {
    local container=$1
    local cpu_quota=$(docker inspect --format='{{.HostConfig.CpuQuota}}' "$container" 2>/dev/null || echo "0")
    local cpu_period=$(docker inspect --format='{{.HostConfig.CpuPeriod}}' "$container" 2>/dev/null || echo "100000")

    if [ "$cpu_quota" = "0" ] || [ -z "$cpu_quota" ]; then
        echo "unlimited"
        return
    fi

    # Calculate the CPU limit.
    num_div "$cpu_quota" "$cpu_period"
}

# Check resource usage for one container (resolved by compose service name).
check_container_resources() {
    local service=$1
    local container
    container=$(resolve_container "$service")
    local alerts=()

    print_container_header "$service"

    # Check whether the container is running.
    if [ -z "$container" ] || ! docker ps --format "{{.ID}}" | grep -q "^${container}$"; then
        echo -e "${YELLOW}[WARN]  Container no está corriendo${NC}"
        return 1
    fi

    # Read container statistics.
    local stats=$(docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}" "$container" 2>/dev/null || echo "")

    if [ -z "$stats" ]; then
        echo -e "${YELLOW}[WARN]  No se pudieron obtener estadísticas${NC}"
        return 1
    fi

    # Parse statistics.
    local cpu_usage=$(echo "$stats" | cut -d'|' -f1 | tr -d '%')
    local mem_usage_raw=$(echo "$stats" | cut -d'|' -f2)
    local mem_usage=$(echo "$stats" | cut -d'|' -f3 | tr -d '%')

    # Read configured limits.
    local mem_limit=$(get_memory_limit "$container")
    local cpu_limit=$(get_cpu_limit "$container")

    # Display resource information.
    echo "  CPU Usage:    ${cpu_usage}%"
    if [ "$cpu_limit" != "unlimited" ]; then
        echo "  CPU Limit:    ${cpu_limit} cores"
        local cpu_usage_relative=$(awk "BEGIN { printf \"%.2f\", ($cpu_usage / ($cpu_limit * 100)) * 100 }" 2>/dev/null || echo "0")
        echo "  CPU % of Lim: ${cpu_usage_relative}%"

        # Check the CPU warning threshold.
        if num_gt "$cpu_usage_relative" "$ALERT_THRESHOLD"; then
            alerts+=("[WARN]  CPU usage (${cpu_usage}%) exceeds ${ALERT_THRESHOLD}% of limit (${cpu_limit} cores)")
        fi
    else
        echo "  CPU Limit:    unlimited"
    fi

    echo ""
    echo "  Memory Usage: ${mem_usage_raw}"
    echo "  Memory %:     ${mem_usage}%"
    if [ "$mem_limit" != "unlimited" ]; then
        echo "  Memory Limit: ${mem_limit}MB"

        # Check the memory warning threshold.
        if num_gt "$mem_usage" "$ALERT_THRESHOLD"; then
            alerts+=("[WARN]  Memory usage (${mem_usage}%) exceeds ${ALERT_THRESHOLD}% of limit (${mem_limit}MB)")
        fi
    else
        echo "  Memory Limit: unlimited"
    fi

    # Mostrar alertas
    if [ ${#alerts[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}${BOLD}  ALERTAS:${NC}"
        for alert in "${alerts[@]}"; do
            echo -e "    ${RED}$alert${NC}"
        done
        return 2
    else
        echo ""
        echo -e "  ${GREEN}[OK] Resource usage within normal limits${NC}"
        return 0
    fi
}

# Muestra resumen de todos los containers
show_summary() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}           RESUMEN${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""

    printf "%-20s %-12s %-12s %-12s\n" "CONTAINER" "CPU %" "MEM %" "STATUS"
    echo "-----------------------------------------------------------------"

    local total_containers=0
    local running_containers=0
    local alert_containers=0

    for service in "${SERVICES[@]}"; do
        total_containers=$((total_containers + 1))

        local container
        container=$(resolve_container "$service")
        if [ -n "$container" ] && docker ps --format "{{.ID}}" | grep -q "^${container}$"; then
            running_containers=$((running_containers + 1))
            local stats=$(docker stats --no-stream --format "{{.CPUPerc}}|{{.MemPerc}}" "$container" 2>/dev/null || echo "0%|0%")
            local cpu=$(echo "$stats" | cut -d'|' -f1)
            local mem=$(echo "$stats" | cut -d'|' -f2)

            # Check whether any warning was raised.
            local cpu_num=$(echo "$cpu" | tr -d '%')
            local mem_num=$(echo "$mem" | tr -d '%')
            local status="${GREEN}OK${NC}"

            if num_gt "$cpu_num" "$ALERT_THRESHOLD" || num_gt "$mem_num" "$ALERT_THRESHOLD"; then
                status="${RED}ALERT${NC}"
                alert_containers=$((alert_containers + 1))
            fi

            printf "%-20s %-12s %-12s %-12b\n" "$service" "$cpu" "$mem" "$status"
        else
            printf "%-20s %-12s %-12s %-12b\n" "$service" "-" "-" "${YELLOW}STOPPED${NC}"
        fi
    done

    echo ""
    echo -e "Containers: ${BOLD}$running_containers/$total_containers${NC} running"
    echo -e "Alerts: ${BOLD}$alert_containers${NC} containers exceeding ${ALERT_THRESHOLD}% threshold"
}

# Continuous monitoring mode.
watch_mode() {
    local interval=${1:-30}

    echo ""
    echo -e "${BOLD}Modo de monitoreo continuo (intervalo: ${interval}s)${NC}"
    echo -e "Presione Ctrl+C para salir"
    echo ""

    while true; do
        clear
        print_header

        for service in "${SERVICES[@]}"; do
            check_container_resources "$service"
            echo ""
        done

        show_summary

        echo ""
        echo -e "${BOLD}Próxima actualización en ${interval} segundos...${NC}"
        sleep "$interval"
    done
}

# Muestra ayuda
show_help() {
    cat << EOF
Uso: $0 [opciones]

Opciones:
    -w, --watch [segundos]   Modo de monitoreo continuo (default: 30s)
    -t, --threshold N        Umbral de alerta en porcentaje (default: 80)
    -c, --container NOMBRE   Verificar solo un servicio específico (mongo, redis, backend, frontend, caddy)
    -h, --help               Mostrar esta ayuda

Ejemplos:
    $0                       Verificar todos los containers una vez
    $0 -w                    Monitoreo continuo cada 30 segundos
    $0 -w 60                 Monitoreo continuo cada 60 segundos
    $0 -c mongo            Verificar solo MongoDB
    $0 -t 90                 Usar umbral de 90% para alertas

EOF
}

# ============================================
# Main
# ============================================

main() {
    local watch_interval=0
    local single_container=""

    # Parsear argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            -w|--watch)
                watch_interval="${2:-30}"
                if [[ "$watch_interval" =~ ^[0-9]+$ ]]; then
                    shift 2
                else
                    watch_interval=30
                    shift
                fi
                ;;
            -t|--threshold)
                ALERT_THRESHOLD="${2:-80}"
                shift 2
                ;;
            -c|--container)
                single_container="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Opción desconocida: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Check that Docker is available.
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker no está instalado o no está en el PATH${NC}"
        exit 1
    fi

    # Check for bc; awk remains the fallback.
    if ! $BC_AVAILABLE; then
        echo -e "${YELLOW}Nota: 'bc' no está instalado — usando 'awk' como fallback.${NC}"
    fi

    if [ "$watch_interval" -gt 0 ]; then
        watch_mode "$watch_interval"
    else
        print_header

        if [ -n "$single_container" ]; then
            check_container_resources "$single_container"
        else
            for service in "${SERVICES[@]}"; do
                check_container_resources "$service"
                echo ""
            done

            show_summary
        fi
    fi
}

main "$@"
