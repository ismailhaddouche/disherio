#!/bin/bash
# ============================================
# DisherIO - Resource Usage Monitor
# Verifica que los containers respeten los límites de recursos
# Alerta si el uso supera el 80% de los límites
# ============================================

set -e

# Colores para output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Umbral de alerta (80%)
ALERT_THRESHOLD=80

# Containers a monitorear
CONTAINERS=("disherio_mongo" "disherio_backend" "disherio_frontend" "disherio_caddy")

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

# Convierte memoria a MB para comparación
convert_to_mb() {
    local value=$1
    local unit=${value: -1}
    local num=${value%?}
    
    case $unit in
        G|g) echo "$(echo "$num * 1024" | bc | cut -d. -f1)" ;;
        M|m) echo "$num" ;;
        K|k) echo "$(echo "$num / 1024" | bc | cut -d. -f1)" ;;
        *) echo "$num" ;;  # Asume MB si no hay unidad
    esac
}

# Obtiene el límite de memoria del container desde docker inspect
get_memory_limit() {
    local container=$1
    local limit_bytes=$(docker inspect --format='{{.HostConfig.Memory}}' "$container" 2>/dev/null || echo "0")
    
    if [ "$limit_bytes" = "0" ] || [ -z "$limit_bytes" ]; then
        echo "unlimited"
        return
    fi
    
    # Convertir bytes a MB
    echo "$(echo "$limit_bytes / 1024 / 1024" | bc)"
}

# Obtiene el límite de CPU del container
get_cpu_limit() {
    local container=$1
    local cpu_quota=$(docker inspect --format='{{.HostConfig.CpuQuota}}' "$container" 2>/dev/null || echo "0")
    local cpu_period=$(docker inspect --format='{{.HostConfig.CpuPeriod}}' "$container" 2>/dev/null || echo "100000")
    
    if [ "$cpu_quota" = "0" ] || [ -z "$cpu_quota" ]; then
        echo "unlimited"
        return
    fi
    
    # Calcular límite de CPU
    echo "scale=2; $cpu_quota / $cpu_period" | bc
}

# Verifica el uso de recursos de un container
check_container_resources() {
    local container=$1
    local alerts=()
    
    print_container_header "$container"
    
    # Verificar si el container está corriendo
    if ! docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        echo -e "${YELLOW}⚠️  Container no está corriendo${NC}"
        return 1
    fi
    
    # Obtener estadísticas del container
    local stats=$(docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}" "$container" 2>/dev/null || echo "")
    
    if [ -z "$stats" ]; then
        echo -e "${YELLOW}⚠️  No se pudieron obtener estadísticas${NC}"
        return 1
    fi
    
    # Parsear estadísticas
    local cpu_usage=$(echo "$stats" | cut -d'|' -f1 | tr -d '%')
    local mem_usage_raw=$(echo "$stats" | cut -d'|' -f2)
    local mem_usage=$(echo "$stats" | cut -d'|' -f3 | tr -d '%')
    
    # Obtener límites configurados
    local mem_limit=$(get_memory_limit "$container")
    local cpu_limit=$(get_cpu_limit "$container")
    
    # Mostrar información
    echo "  CPU Usage:    ${cpu_usage}%"
    if [ "$cpu_limit" != "unlimited" ]; then
        echo "  CPU Limit:    ${cpu_limit} cores"
        local cpu_usage_relative=$(echo "scale=2; ($cpu_usage / ($cpu_limit * 100)) * 100" | bc 2>/dev/null || echo "0")
        echo "  CPU % of Lim: ${cpu_usage_relative}%"
        
        # Verificar alerta de CPU
        if (( $(echo "$cpu_usage_relative > $ALERT_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
            alerts+=("⚠️  CPU usage (${cpu_usage}%) exceeds ${ALERT_THRESHOLD}% of limit (${cpu_limit} cores)")
        fi
    else
        echo "  CPU Limit:    unlimited"
    fi
    
    echo ""
    echo "  Memory Usage: ${mem_usage_raw}"
    echo "  Memory %:     ${mem_usage}%"
    if [ "$mem_limit" != "unlimited" ]; then
        echo "  Memory Limit: ${mem_limit}MB"
        
        # Verificar alerta de Memoria
        if (( $(echo "$mem_usage > $ALERT_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
            alerts+=("⚠️  Memory usage (${mem_usage}%) exceeds ${ALERT_THRESHOLD}% of limit (${mem_limit}MB)")
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
        echo -e "  ${GREEN}✓ Resource usage within normal limits${NC}"
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
    
    for container in "${CONTAINERS[@]}"; do
        total_containers=$((total_containers + 1))
        
        if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
            running_containers=$((running_containers + 1))
            local stats=$(docker stats --no-stream --format "{{.CPUPerc}}|{{.MemPerc}}" "$container" 2>/dev/null || echo "0%|0%")
            local cpu=$(echo "$stats" | cut -d'|' -f1)
            local mem=$(echo "$stats" | cut -d'|' -f2)
            
            # Verificar si hay alerta
            local cpu_num=$(echo "$cpu" | tr -d '%')
            local mem_num=$(echo "$mem" | tr -d '%')
            local status="${GREEN}OK${NC}"
            
            if (( $(echo "$cpu_num > $ALERT_THRESHOLD" | bc -l 2>/dev/null || echo "0") )) || \
               (( $(echo "$mem_num > $ALERT_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
                status="${RED}ALERT${NC}"
                alert_containers=$((alert_containers + 1))
            fi
            
            printf "%-20s %-12s %-12s %-12b\n" "$container" "$cpu" "$mem" "$status"
        else
            printf "%-20s %-12s %-12s %-12b\n" "$container" "-" "-" "${YELLOW}STOPPED${NC}"
        fi
    done
    
    echo ""
    echo -e "Containers: ${BOLD}$running_containers/$total_containers${NC} running"
    echo -e "Alerts: ${BOLD}$alert_containers${NC} containers exceeding ${ALERT_THRESHOLD}% threshold"
}

# Modo de monitoreo continuo
watch_mode() {
    local interval=${1:-30}
    
    echo ""
    echo -e "${BOLD}Modo de monitoreo continuo (intervalo: ${interval}s)${NC}"
    echo -e "Presione Ctrl+C para salir"
    echo ""
    
    while true; do
        clear
        print_header
        
        for container in "${CONTAINERS[@]}"; do
            check_container_resources "$container"
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
    -c, --container NOMBRE   Verificar solo un container específico
    -h, --help               Mostrar esta ayuda

Ejemplos:
    $0                       Verificar todos los containers una vez
    $0 -w                    Monitoreo continuo cada 30 segundos
    $0 -w 60                 Monitoreo continuo cada 60 segundos
    $0 -c disherio_mongo     Verificar solo MongoDB
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
    
    # Verificar que Docker está disponible
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker no está instalado o no está en el PATH${NC}"
        exit 1
    fi
    
    # Verificar que bc está disponible
    if ! command -v bc &> /dev/null; then
        echo -e "${YELLOW}Advertencia: 'bc' no está instalado. Algunas funciones pueden no funcionar correctamente.${NC}"
    fi
    
    if [ "$watch_interval" -gt 0 ]; then
        watch_mode "$watch_interval"
    else
        print_header
        
        if [ -n "$single_container" ]; then
            check_container_resources "$single_container"
        else
            for container in "${CONTAINERS[@]}"; do
                check_container_resources "$container"
                echo ""
            done
            
            show_summary
        fi
    fi
}

main "$@"
