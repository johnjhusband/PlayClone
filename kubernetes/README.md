# PlayClone Kubernetes Deployment

This directory contains Kubernetes manifests and Helm charts for deploying PlayClone as a distributed browser farm.

## Architecture

PlayClone on Kubernetes consists of:

- **Farm Deployment**: Manages and coordinates browser workers (3-20 replicas)
- **Worker StatefulSet**: Runs browser instances (5-50 replicas)
- **Load Balancer**: Distributes requests across farm instances
- **Auto-scaling**: Automatically scales based on CPU/memory usage
- **Persistent Storage**: For browser cache and session data

## Quick Start

### Using kubectl

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Deploy configuration
kubectl apply -f configmap.yaml

# Deploy services
kubectl apply -f service.yaml

# Deploy farm and workers
kubectl apply -f deployment.yaml

# Set up auto-scaling
kubectl apply -f hpa.yaml

# Configure ingress (optional)
kubectl apply -f ingress.yaml
```

### Using Helm

```bash
# Add the PlayClone Helm repository (when published)
helm repo add playclone https://charts.playclone.io
helm repo update

# Install with default values
helm install playclone playclone/playclone -n playclone --create-namespace

# Install with custom values
helm install playclone playclone/playclone \
  -n playclone \
  --create-namespace \
  --set config.authentication.secret=my-secret \
  --set ingress.hosts[0].host=my-domain.com
```

### Local Development with Helm

```bash
# From the helm/playclone directory
helm install playclone . -n playclone --create-namespace

# Upgrade after changes
helm upgrade playclone . -n playclone

# Uninstall
helm uninstall playclone -n playclone
```

## Configuration

### Environment Variables

Key configuration options via ConfigMap:

- `PLAYCLONE_PORT`: Farm server port (default: 8080)
- `PLAYCLONE_HEADLESS`: Run browsers in headless mode (default: true)
- `PLAYCLONE_MAX_SESSIONS_PER_WORKER`: Max browser sessions per worker (default: 10)
- `PLAYCLONE_HEALTH_CHECK_INTERVAL`: Health check interval in ms (default: 30000)
- `PLAYCLONE_SESSION_TIMEOUT`: Session timeout in ms (default: 300000)
- `PLAYCLONE_LOAD_BALANCING_STRATEGY`: Strategy for load balancing (default: least-connections)
  - Options: round-robin, least-connections, random, weighted
- `PLAYCLONE_AUTH_TYPE`: Authentication type (default: none)
  - Options: none, token, basic
- `PLAYCLONE_AUTH_SECRET`: Authentication secret for token/basic auth

### Resource Requirements

Minimum requirements per pod:

**Farm Pod:**
- CPU: 500m
- Memory: 512Mi

**Worker Pod:**
- CPU: 1000m
- Memory: 1Gi

Recommended limits:

**Farm Pod:**
- CPU: 2000m
- Memory: 2Gi

**Worker Pod:**
- CPU: 4000m
- Memory: 4Gi

### Storage

Each worker pod requires persistent storage for:
- Browser cache: 10Gi
- Browser data: 20Gi

### Scaling

Auto-scaling is configured with:

**Farm Deployment:**
- Min replicas: 3
- Max replicas: 20
- Scale up at 70% CPU or 80% memory
- Scale down gradually to prevent disruption

**Worker StatefulSet:**
- Min replicas: 5
- Max replicas: 50
- Scale up at 60% CPU or 75% memory
- Slower scale down to preserve sessions

## Monitoring

### Health Checks

All pods have configured health checks:

**Liveness Probe:**
- Endpoint: `/api/status` (farm) or `/health` (worker)
- Initial delay: 30s
- Period: 10s
- Failure threshold: 3

**Readiness Probe:**
- Endpoint: `/api/status` (farm) or `/ready` (worker)
- Initial delay: 10-15s
- Period: 5s
- Failure threshold: 3

### Metrics

Metrics are exposed on port 9090 at `/metrics` endpoint.

For Prometheus integration:
```yaml
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s
```

### Logs

View logs for debugging:

```bash
# Farm logs
kubectl logs -n playclone -l component=farm

# Worker logs
kubectl logs -n playclone -l component=worker

# Specific pod logs
kubectl logs -n playclone playclone-farm-xxxxx

# Follow logs
kubectl logs -n playclone -l component=farm -f
```

## Security

### Network Policies

Implement network policies for production:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: playclone-network-policy
  namespace: playclone
spec:
  podSelector:
    matchLabels:
      app: playclone
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
```

### Pod Security

Pods run with security context:
- Non-root user (UID 1000)
- Read-only root filesystem (where possible)
- Dropped capabilities

### Authentication

For production, enable authentication:

```bash
# Generate a secure token
export AUTH_TOKEN=$(openssl rand -hex 32)

# Update ConfigMap
kubectl create secret generic playclone-auth \
  -n playclone \
  --from-literal=token=$AUTH_TOKEN

# Reference in deployment
env:
- name: PLAYCLONE_AUTH_TYPE
  value: "token"
- name: PLAYCLONE_AUTH_SECRET
  valueFrom:
    secretKeyRef:
      name: playclone-auth
      key: token
```

## Troubleshooting

### Common Issues

1. **Pods not starting:**
   ```bash
   kubectl describe pod -n playclone <pod-name>
   kubectl logs -n playclone <pod-name> --previous
   ```

2. **Browser crashes:**
   - Increase memory limits
   - Check for resource contention
   - Review crash dumps in `/app/browser-data/crashes`

3. **Session timeouts:**
   - Increase `PLAYCLONE_SESSION_TIMEOUT`
   - Check network connectivity between pods
   - Verify persistent storage is working

4. **Slow performance:**
   - Scale up workers
   - Check CPU/memory usage
   - Review load balancing strategy

### Debug Mode

Enable debug logging:

```bash
kubectl set env deployment/playclone-farm \
  -n playclone \
  PLAYCLONE_LOG_LEVEL=debug
```

### Port Forwarding

Access the farm locally:

```bash
# Forward farm API
kubectl port-forward -n playclone svc/playclone-farm 8080:80

# Access at http://localhost:8080
```

## Production Checklist

Before deploying to production:

- [ ] Change authentication secret
- [ ] Configure proper ingress hostname
- [ ] Set up TLS certificates
- [ ] Configure resource limits based on load
- [ ] Enable monitoring and alerting
- [ ] Set up backup for persistent volumes
- [ ] Configure network policies
- [ ] Review security settings
- [ ] Test auto-scaling behavior
- [ ] Document operational procedures

## Advanced Configuration

### Multi-Region Deployment

For global distribution:

1. Deploy farms in multiple regions
2. Use GeoDNS for routing
3. Configure cross-region worker discovery
4. Set up global load balancing

### High Availability

For maximum availability:

1. Increase minimum replicas
2. Configure pod disruption budgets
3. Use multiple availability zones
4. Set up database replication (if using Redis)

### Performance Tuning

Optimize for your workload:

1. Adjust `maxSessionsPerWorker` based on browser usage
2. Tune resource requests/limits
3. Configure connection pooling
4. Optimize Docker image with specific browser versions

## Support

For issues and questions:
- GitHub Issues: https://github.com/johnjhusband/PlayClone/issues
- Documentation: https://docs.playclone.io
- Community: https://discord.gg/playclone