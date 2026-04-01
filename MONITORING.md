# DisherIO Monitoring Guide

This guide covers the complete monitoring setup for DisherIO using Prometheus and Grafana.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Services](#services)
- [Dashboards](#dashboards)
- [Alerts](#alerts)
- [Metrics](#metrics)
- [Troubleshooting](#troubleshooting)

---

## Overview

DisherIO monitoring stack includes:

- **Prometheus**: Time-series metrics collection
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notification
- **MongoDB Exporter**: MongoDB metrics
- **Redis Exporter**: Redis metrics
- **Node Exporter**: System-level metrics

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Backend API   │────▶│  Prometheus  │────▶│     Grafana     │
│   (prom-client) │     │   (9090)     │     │    (3001)       │
└─────────────────┘     └──────────────┘     └─────────────────┘
         │                       │                      │
         ▼                       ▼                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  MongoDB Exporter│────▶│ Alertmanager │     │  Alert Channels │
│    (9216)       │     │   (9093)     │     │ (Email/Slack)   │
└─────────────────┘     └──────────────┘     └─────────────────┘
         │
┌─────────────────┐
│  Redis Exporter │
│    (9121)       │
└─────────────────┘
```

## Quick Start

### 1. Configure Environment

Add monitoring credentials to your `.env` file:

```bash
# Required: Grafana credentials
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Optional: Slack webhook for alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 2. Start the Stack

**Option A: Full stack with monitoring:**
```bash
docker-compose up -d
```

**Option B: Production stack only:**
```bash
docker-compose up -d mongo redis backend frontend caddy
```

**Option C: Monitoring only:**
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### 3. Access Services

| Service | URL | Default Credentials |
|---------|-----|-------------------|
| Grafana | http://localhost:3001 | admin / (from .env) |
| Prometheus | http://localhost:9090 | - |
| Alertmanager | http://localhost:9093 | - |
| Backend Metrics | http://localhost:3000/metrics | - |

---

## Services

### Prometheus (Port 9090)

Prometheus collects metrics from all services every 15 seconds.

**Key Features:**
- 15-day data retention
- Automatic service discovery
- Alert rule evaluation
- Web UI for querying metrics

**Example Queries:**
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active orders
sum(active_orders)
```

### Grafana (Port 3001)

Grafana provides visualization dashboards for all metrics.

**Default Dashboards:**
- **System Overview**: High-level system health
- **Backend Metrics**: Detailed API metrics
- **MongoDB Metrics**: Database performance

**Configuration:**
- Auto-provisioned dashboards
- Prometheus datasource pre-configured
- Persistent storage for custom dashboards

### Alertmanager (Port 9093)

Routes alerts to notification channels.

**Default Channels:**
- Email (admin@disherio.local)
- Slack (if webhook configured)

**Alert Severity Levels:**
- **Critical**: Immediate notification, repeats every 30m
- **Warning**: Less frequent, repeats every 2h

---

## Dashboards

### 1. System Overview (`disherio-overview`)

Service health status and key metrics.

**Panels:**
| Panel | Description |
|-------|-------------|
| Service Status | Up/Down status for all services |
| Requests/sec | Total HTTP request rate |
| Response Latency | p50, p95, p99 latency percentiles |
| Error Rates | 4xx and 5xx error rates |
| System Resources | CPU and Memory usage |
| Business Metrics | Orders/min, active orders, sessions |

**Use Cases:**
- Quick health check
- Incident response overview
- Daily monitoring

### 2. Backend Metrics (`disherio-backend`)

Detailed Node.js application metrics.

**Panels:**
| Panel | Description |
|-------|-------------|
| Request Rate | Requests per second |
| Success Rate | Percentage of 2xx responses |
| Error Rates | 4xx and 5xx breakdown |
| Latency | p50, p95, p99 percentiles |
| Routes | Request volume by route |
| Latency by Route | Slowest endpoints |
| Errors Breakdown | Error distribution |
| Memory Usage | Heap and RSS memory |
| Event Loop | Event loop lag and handles |

**Use Cases:**
- Performance tuning
- Debugging slow requests
- Error analysis

### 3. MongoDB Metrics (`disherio-mongodb`)

Database performance and health.

**Panels:**
| Panel | Description |
|-------|-------------|
| Active Connections | Current connection count |
| Connection Usage % | Pool utilization |
| Operations/sec | Read/write/command rates |
| Operation Latency | Query performance |
| Memory Usage | Resident and virtual memory |
| Storage Size | Data and index sizes |

**Use Cases:**
- Database optimization
- Connection pool tuning
- Capacity planning

---

## Alerts

### Critical Alerts (Immediate)

| Alert | Condition | Action |
|-------|-----------|--------|
| ServiceDown | Backend down for 1m | Check service logs |
| HighErrorRate | Error rate > 5% for 2m | Investigate errors |
| HighLatencyP95 | p95 latency > 500ms for 3m | Performance analysis |
| HighMemoryUsage | Memory > 80% for 5m | Scale or optimize |
| MongoDBConnectionSaturation | Connections > 80% capacity | Increase pool size |

### Warning Alerts (2h repeat)

| Alert | Condition | Action |
|-------|-----------|--------|
| HighClientErrorRate | 4xx rate > 10% for 5m | Check client requests |
| HighLatencyP99 | p99 latency > 1s for 2m | Review slow queries |
| MongoDBHighConnections | Connections > 100 for 5m | Monitor closely |
| RedisHighMemoryUsage | Redis memory > 80% for 5m | Cache optimization |
| SlowRequests | p50 latency > 200ms for 5m | Performance review |

### Business Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| LowOrderRate | Orders/min unusually low | Business check |
| HighOrderFailureRate | > 5% orders failing | Critical issue |

---

## Metrics

### HTTP Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, route, status |
| `http_request_duration_seconds` | Histogram | Request duration distribution |
| `http_request_size_bytes` | Histogram | Request body size |
| `http_response_size_bytes` | Histogram | Response body size |

### Business Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `orders_created_total` | Counter | Total orders created |
| `orders_completed_total` | Counter | Total orders completed |
| `orders_cancelled_total` | Counter | Total orders cancelled |
| `orders_failed_total` | Counter | Total order failures |
| `active_orders` | Gauge | Currently active orders |
| `order_processing_duration_seconds` | Histogram | Order processing time |

### Authentication Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `auth_attempts_total` | Counter | Login attempts by type and status |
| `active_sessions` | Gauge | Active user sessions |

### Cache Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `cache_operations_total` | Counter | Cache get/set/delete operations |
| `cache_operation_duration_seconds` | Histogram | Cache operation latency |

### Database Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `db_query_duration_seconds` | Histogram | MongoDB query duration |
| `db_connections_active` | Gauge | Active DB connections |

### WebSocket Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `websocket_connections_total` | Counter | Total WS connections |
| `websocket_connections_active` | Gauge | Active WS connections |
| `websocket_messages_total` | Counter | Messages sent/received |

---

## Troubleshooting

### Common Issues

#### 1. Prometheus Targets Down

**Symptom**: Targets show as "DOWN" in Prometheus UI

**Solutions:**
```bash
# Check if backend is healthy
curl http://localhost:3000/health

# Check if metrics endpoint is accessible
curl http://localhost:3000/metrics

# Restart specific exporter
docker-compose restart mongo-exporter
```

#### 2. No Data in Grafana

**Symptom**: Empty dashboards

**Solutions:**
```bash
# Verify Prometheus is scraping
curl http://localhost:9090/api/v1/targets

# Check Grafana datasource
curl http://localhost:3001/api/datasources

# Restart Grafana
docker-compose restart grafana
```

#### 3. Alerts Not Firing

**Symptom**: No alerts in Alertmanager

**Solutions:**
```bash
# Check Prometheus alerts
curl http://localhost:9090/api/v1/alerts

# Verify Alertmanager is configured
curl http://localhost:9093/api/v1/status

# Check alert rules
promtool check rules monitoring/prometheus/rules/*.yml
```

#### 4. High Memory Usage

**Symptom**: Prometheus or Grafana using too much memory

**Solutions:**
```bash
# Check retention settings
docker-compose logs prometheus

# Limit memory usage
docker-compose exec prometheus sh -c "ps aux | grep prometheus"

# Adjust retention in docker-compose.yml
# --storage.tsdb.retention.time=7d
```

### Useful Commands

```bash
# View all service logs
docker-compose logs -f prometheus grafana alertmanager

# Check metrics endpoint
curl -s http://localhost:3000/metrics | head

# Query Prometheus directly
curl 'http://localhost:9090/api/v1/query?query=up'

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload

# Export Grafana dashboard
curl http://localhost:3001/api/dashboards/db/disherio-overview

# Reset Grafana password
docker-compose exec grafana grafana-cli admin reset-admin-password newpassword
```

### Log Locations

| Service | Logs |
|---------|------|
| Prometheus | `docker-compose logs prometheus` |
| Grafana | `docker-compose logs grafana` |
| Alertmanager | `docker-compose logs alertmanager` |
| Backend | `docker-compose logs backend` |

---

## Maintenance

### Regular Tasks

**Daily:**
- Check System Overview dashboard
- Review any firing alerts

**Weekly:**
- Review Backend Metrics for performance trends
- Check MongoDB connection usage
- Analyze error rates

**Monthly:**
- Review dashboard performance (query times)
- Clean up old Grafana snapshots
- Update alert thresholds if needed

### Backup

```bash
# Backup Grafana dashboards
curl http://localhost:3001/api/search | jq

# Backup Prometheus data
docker-compose exec prometheus tar czf /tmp/prometheus-backup.tar.gz /prometheus

# Backup Alertmanager state
docker-compose exec alertmanager tar czf /tmp/alertmanager-backup.tar.gz /alertmanager
```

### Performance Tuning

**Prometheus:**
- Reduce scrape interval for high-cardinality metrics
- Use recording rules for complex queries
- Adjust retention based on disk space

**Grafana:**
- Enable query caching
- Use streaming for high-frequency data
- Optimize dashboard refresh intervals

---

## Security

### Access Control

1. **Change default passwords** in `.env`
2. **Use reverse proxy** (Caddy) for external access
3. **Enable HTTPS** for Grafana
4. **Restrict Prometheus** to internal network

### Network Security

```yaml
# In docker-compose.yml, ensure:
networks:
  disherio_net:
    internal: true  # For monitoring services
```

### Data Protection

- Metrics don't contain PII by design
- Business metrics use restaurant_id, not names
- Alert messages avoid sensitive data

---

## Customization

### Adding Custom Metrics

```typescript
// In your code
import { register } from 'prom-client';

const myMetric = new promClient.Counter({
  name: 'my_custom_metric_total',
  help: 'Description',
  labelNames: ['label1'],
  registers: [register]
});

// Use it
myMetric.inc({ label1: 'value' });
```

### Adding Dashboards

1. Create dashboard in Grafana UI
2. Export as JSON
3. Save to `monitoring/grafana/dashboards/`
4. Restart Grafana

### Custom Alerts

Add to `monitoring/prometheus/rules/custom.yml`:

```yaml
groups:
  - name: custom_alerts
    rules:
      - alert: MyCustomAlert
        expr: my_metric > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Custom alert fired"
          description: "Value is {{ $value }}"
```

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review service logs
3. Check Prometheus/Grafana documentation
4. Create an issue in the project repository

## References

- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [Prometheus Node Exporter](https://github.com/prometheus/node_exporter)
- [MongoDB Exporter](https://github.com/percona/mongodb_exporter)
- [Redis Exporter](https://github.com/oliver006/redis_exporter)
