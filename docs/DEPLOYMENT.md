# Enterprise Node.js Webservice - Deployment Guide

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker registry access
- Domain name (for ingress)

## Local Development

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api-gateway

# Stop all services
docker-compose down

# Clean volumes
docker-compose down -v
```

### Manual Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Start PostgreSQL, MongoDB, Redis, RabbitMQ manually

# Run database migrations
psql -U postgres -d enterprise_db -f src/shared/database/migrations/001_initial_schema.sql

# Start in development mode
npm run dev
```

## Production Deployment

### 1. Build Docker Image

```bash
# Build image
docker build -t your-registry/enterprise-api:latest .

# Push to registry
docker push your-registry/enterprise-api:latest
```

### 2. Kubernetes Deployment

#### Create Secrets

**Never commit real secrets!** Use one of these methods:

**Method 1: kubectl create secret**
```bash
kubectl create secret generic postgres-secret \
  --from-literal=username=postgres \
  --from-literal=password=YOUR_STRONG_PASSWORD

kubectl create secret generic mongo-secret \
  --from-literal=uri=mongodb://YOUR_MONGO_URI

kubectl create secret generic rabbitmq-secret \
  --from-literal=url=amqp://YOUR_RABBITMQ_URL

kubectl create secret generic jwt-secret \
  --from-literal=secret=YOUR_JWT_SECRET \
  --from-literal=refresh_secret=YOUR_REFRESH_SECRET

kubectl create secret generic encryption-secret \
  --from-literal=key=YOUR_32_CHARACTER_ENCRYPTION_KEY
```

**Method 2: AWS Secrets Manager (recommended)**
```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets

# Create SecretStore pointing to AWS
kubectl apply -f k8s/external-secrets/secretstore.yaml

# Reference secrets
kubectl apply -f k8s/external-secrets/external-secret.yaml
```

#### Deploy Application

```bash
# Apply ConfigMaps
kubectl apply -f k8s/configmaps/

# Apply Deployments
kubectl apply -f k8s/deployments/

# Apply Services
kubectl apply -f k8s/services/

# Verify deployment
kubectl get pods
kubectl get services

# Check logs
kubectl logs -f deployment/api-gateway
```

#### Setup Ingress (optional)

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Apply ingress
kubectl apply -f k8s/ingress/ingress.yaml
```

### 3. Database Setup

```bash
# Port-forward to PostgreSQL
kubectl port-forward svc/postgres 5432:5432

# Run migrations
psql -h localhost -U postgres -d enterprise_db -f src/shared/database/migrations/001_initial_schema.sql
```

### 4. Verify Deployment

```bash
# Check all pods are running
kubectl get pods

# Check services
kubectl get services

# Get external IP (for LoadBalancer)
kubectl get svc api-gateway

# Test health endpoint
curl http://EXTERNAL_IP/health

# Check metrics
curl http://EXTERNAL_IP/metrics
```

## Monitoring Setup

### Prometheus

```bash
# Install Prometheus with Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack

# Port-forward to access
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090
```

### Grafana

```bash
# Access Grafana (installed with Prometheus stack)
kubectl port-forward svc/prometheus-grafana 3000:80

# Default credentials: admin/prom-operator
```

## Scaling

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment api-gateway --replicas=5

# Verify
kubectl get pods
```

### Auto-scaling (HPA already configured)

```bash
# Check HPA status
kubectl get hpa

# View metrics
kubectl top pods
```

## Troubleshooting

### Check Pod Logs

```bash
# View logs
kubectl logs deployment/api-gateway

# Follow logs
kubectl logs -f deployment/api-gateway

# Previous container logs
kubectl logs --previous deployment/api-gateway
```

### Debug Pod

```bash
# Exec into pod
kubectl exec -it deployment/api-gateway -- sh

# Check environment variables
kubectl exec deployment/api-gateway -- env

# Test connectivity to dependencies
kubectl exec deployment/api-gateway -- ping postgres
```

### Common Issues

**Pods not starting:**
```bash
# Check events
kubectl describe pod POD_NAME

# Check resource limits
kubectl top nodes
```

**Database connection failed:**
```bash
# Verify service DNS
kubectl exec deployment/api-gateway -- nslookup postgres

# Check secret
kubectl get secret postgres-secret -o yaml
```

**Image pull errors:**
```bash
# Check image name
kubectl describe pod POD_NAME

# Create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=YOUR_REGISTRY \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_PASSWORD
```

## Rollback

```bash
# View rollout history
kubectl rollout history deployment/api-gateway

# Rollback to previous version
kubectl rollout undo deployment/api-gateway

# Rollback to specific revision
kubectl rollout undo deployment/api-gateway --to-revision=2
```

## Cleanup

```bash
# Delete all resources
kubectl delete -f k8s/

# Or delete namespace
kubectl delete namespace YOUR_NAMESPACE
```

## Cloud-Specific Deployment

### AWS (EKS)

```bash
# Create cluster
eksctl create cluster --name enterprise-cluster --region us-east-1

# Update kubeconfig
aws eks update-kubeconfig --name enterprise-cluster --region us-east-1

# Deploy
kubectl apply -f k8s/
```

### GCP (GKE)

```bash
# Create cluster
gcloud container clusters create enterprise-cluster \
  --zone us-central1-a \
  --num-nodes 3

# Get credentials
gcloud container clusters get-credentials enterprise-cluster

# Deploy
kubectl apply -f k8s/
```

### Azure (AKS)

```bash
# Create cluster
az aks create --resource-group myResourceGroup \
  --name enterprise-cluster \
  --node-count 3

# Get credentials
az aks get-credentials --resource-group myResourceGroup --name enterprise-cluster

# Deploy
kubectl apply -f k8s/
```

## Performance Tuning

### Node.js Options

```yaml
# In deployment.yaml, add to container args:
args:
  - --max-old-space-size=4096
  - --max-http-header-size=16384
```

### Database Connection Pooling

Adjust in `.env`:
```env
POSTGRES_POOL_MIN=5
POSTGRES_POOL_MAX=20
MONGO_POOL_SIZE=20
```

### Redis Memory

```bash
# Set maxmemory in Redis
kubectl exec deployment/redis -- redis-cli config set maxmemory 2gb
kubectl exec deployment/redis -- redis-cli config set maxmemory-policy allkeys-lru
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable HTTPS/TLS
- [ ] Configure network policies
- [ ] Enable pod security policies
- [ ] Use namespace isolation
- [ ] Configure RBAC
- [ ] Scan images for vulnerabilities
- [ ] Enable audit logging
- [ ] Configure backups

## Backup & Recovery

### Database Backups

```bash
# PostgreSQL backup
kubectl exec deployment/postgres -- pg_dump -U postgres enterprise_db > backup.sql

# MongoDB backup
kubectl exec deployment/mongodb -- mongodump --out /backup

# Schedule with CronJob (create k8s/cronjobs/backup.yaml)
```

### Restore

```bash
# Restore PostgreSQL
kubectl exec -i deployment/postgres -- psql -U postgres enterprise_db < backup.sql

# Restore MongoDB
kubectl exec -i deployment/mongodb -- mongorestore /backup
```
