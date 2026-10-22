# Implantação no Kubernetes (Minikube)

Migração da aplicação Fight Club para um cluster Kubernetes local.
Todos os componentes executam dentro do cluster: nada roda solto na máquina.

## Arquitetura no cluster

```
Navegador
    |
    v
Service sono-frontend (NodePort 30080)
    |
    +--> Pods sono-frontend (2 réplicas, Next.js :3000)
              |  rewrite /api/* definido em next.config.ts
              v
         Service sono-backend (ClusterIP :3001)
              |
              +--> Pods sono-backend (3 réplicas, Next.js API :3001)
                        |
                        v
                   Service postgres (ClusterIP :5432)
                        |
                        +--> Pod postgres (PostgreSQL 17)
                                  |
                                  v
                             PVC postgres-data (1Gi)
```

| Recurso | Nome | Tipo | Função |
|---|---|---|---|
| ConfigMap | `sono-config` | — | Configuração não sensível do backend |
| Secret | `sono-secrets` | Opaque | Credenciais do banco, AUTH_SECRET e admin |
| PersistentVolumeClaim | `postgres-data` | RWO 1Gi | Disco do PostgreSQL |
| Deployment | `postgres` | 1 réplica | Banco de dados |
| Service | `postgres` | ClusterIP | Acesso interno ao banco |
| Job | `sono-migrate` | — | Roda as migrations do Prisma uma única vez |
| Deployment | `sono-backend` | 3 réplicas | API |
| Service | `sono-backend` | ClusterIP | Balanceamento entre os pods da API |
| Deployment | `sono-frontend` | 2 réplicas | Interface web |
| Service | `sono-frontend` | NodePort 30080 | Único ponto de entrada externo |

## Pré-requisitos

- Docker
- kubectl
- Minikube

No Windows, tudo dentro do WSL2 (Ubuntu).

## 1. Subir o cluster

```bash
minikube start --driver=docker --cpus=2 --memory=4096
kubectl get nodes
```

## 2. Construir as imagens

Os dois repositórios precisam estar clonados lado a lado:

```
fightclub/
├── backend/
└── frontend/
```

```bash
cd backend
docker build -t sono-backend:latest .

cd ../frontend
docker build -t sono-frontend:latest .
```

> Para que o mapa do Google funcione, o frontend precisa da chave no momento
> do build (variáveis `NEXT_PUBLIC_*` são embutidas na compilação):
> `docker build -t sono-frontend:latest --build-arg NEXT_PUBLIC_GOOGLE_MAPS_KEY="sua_chave" .`

## 3. Carregar as imagens no Minikube

As imagens não estão em nenhum registro público. Elas são construídas
localmente e injetadas no cluster:

```bash
minikube image load sono-backend:latest
minikube image load sono-frontend:latest
minikube image ls | grep sono
```

Os Deployments usam `imagePullPolicy: Never`, então o cluster nunca tenta
baixar essas imagens da internet — usa só o que foi carregado.

**Toda vez que reconstruir uma imagem, carregue de novo.**

## 4. Aplicar os manifestos

```bash
cd backend
kubectl apply -f k8s/
kubectl get pods -w
```

Os arquivos são numerados porque `kubectl apply -f` numa pasta segue a ordem
alfabética: ConfigMap e Secret entram antes de quem depende deles.

Ordem esperada na subida:

1. `postgres` fica `Running`
2. `sono-migrate` roda as migrations e vira `Completed`
3. `sono-backend` (3 pods) e `sono-frontend` (2 pods) ficam `Running`

Para conferir as migrations:

```bash
kubectl logs job/sono-migrate
```

## 5. Acessar a aplicação

```bash
minikube service sono-frontend --url
```

No WSL2, para abrir no navegador do Windows:

```bash
kubectl port-forward service/sono-frontend 3000:80
```

e acesse `http://localhost:3000`.

Área administrativa em `/admin/login`, com o usuário criado pelo seed
(definido em `k8s/02-secret.yaml`).

## 6. Verificação

```bash
kubectl get pods -o wide
kubectl get services
kubectl get deployments
kubectl get configmap,secret,pvc
```

### Balanceamento de carga

A rota `/api/health` devolve o nome do pod que respondeu:

```bash
kubectl run curl-test --rm -it --image=curlimages/curl --restart=Never -- \
  sh -c 'for i in $(seq 1 10); do curl -s http://sono-backend:3001/api/health; echo; done'
```

Os nomes alternam entre os três pods do backend.

### Recriação automática de Pod

```bash
kubectl get pods
kubectl delete pod <nome-de-um-pod-do-backend>
kubectl get pods -w
```

Quem recria não é o Deployment diretamente, e sim o ReplicaSet que ele
gerencia: o estado desejado é 3 réplicas, então ao detectar 2 ele cria outra.

## Decisões de projeto

**Por que o Postgres tem 1 réplica.** O volume é `ReadWriteOnce`: duas
réplicas disputariam o mesmo disco. A alta disponibilidade exigida está
demonstrada no backend (3 réplicas) e no frontend (2 réplicas).

**Por que as migrations estão num Job.** Com 3 réplicas de backend, se cada
pod rodasse `prisma migrate deploy` na subida, três processos alterariam o
schema ao mesmo tempo. O Job roda uma vez só, e um `initContainer` em cada
pod do backend espera o Postgres responder antes de subir.

**Por que o frontend não recebe `NEXT_PUBLIC_BACKEND_URL`.** No código,
`const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? ""`. Vazia, o
navegador chama `/api/...` no próprio domínio do frontend, e o servidor Next
repassa para `http://sono-backend:3001` pelo rewrite — comunicação interna
entre pods. Se a variável fosse preenchida com o nome do Service, o
**navegador** tentaria resolver `sono-backend`, que só existe no DNS do
cluster, e a aplicação quebraria.

**Por que só o frontend é NodePort.** Backend e banco são ClusterIP, isto é,
acessíveis apenas de dentro do cluster. O frontend é o único ponto de entrada.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `ErrImagePull` / `ImagePullBackOff` | A imagem não foi carregada. Refaça o `minikube image load` e confira com `minikube image ls \| grep sono`. |
| Backend em `CrashLoopBackOff` | `kubectl logs <pod>`. Normalmente `DATABASE_URL` errada no Secret. |
| `sono-migrate` falhou | `kubectl logs job/sono-migrate`. Para repetir: `kubectl delete job sono-migrate && kubectl apply -f k8s/04-migrate-job.yaml` |
| Postgres não inicializa | PVC sujo de uma tentativa anterior: `kubectl delete -f k8s/03-postgres.yaml && kubectl delete pvc postgres-data && kubectl apply -f k8s/03-postgres.yaml` |
| Recomeçar do zero | `minikube delete && minikube start --driver=docker --cpus=2 --memory=4096` e refazer os `image load`. |
