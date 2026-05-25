# Kubernetes environment — DyingStar platform

Authoritative stack definition: **[`../kubernetes`](../../kubernetes)** (DyingStar Helm charts + Skaffold).

Admin panel runs in namespace **`dyingstar-dev-local`** (local dev) alongside game services so the BFF can use in-cluster DNS.

## Environments (from kubernetes README)

| Environment | Namespace | Deploy |
|-------------|-----------|--------|
| Production | `dyingstar-prod` | `repository_dispatch` / manual Helm |
| Preprod | `dyingstar-preprod` | same |
| Dev shared | `dyingstar-dev-shared` | PostGIS, shared infra |
| **Dev local** | **`dyingstar-dev-local`** | **Skaffold + minikube** |

## Service matrix (dev-local)

Helm **release names** = Kubernetes **Service** DNS names in the namespace.

| Skaffold module | K8s Service | Ports | Admin BFF (`SERVERS` / env) |
|---------------|-------------|-------|-----------------------------|
| `service-persistence` | `service-persistence` | **3001** HTTP (`http`), **9100** WS (`ws`) | `persistenceUrl`, `wsUrl` |
| `service-resourcesdynamic` | `service-resourcesdynamic` | **3001** HTTP, **9200** WS | `resourcesDynamicUrl`, `RESOURCES_DYNAMIC_*` |
| `horizon` | `horizon` | **7040** (NodePort via minikube IP externally) | `horizonUrl` (in-cluster: `http://horizon:7040`) |
| `godotserver` | `godotserver` | **8980** (headless — all pod IPs) | optional `godotserverUrl` |
| `keycloak` | `keycloak` | **8080** HTTP, NodePort **30180** (dev) | `KEYCLOAK_BASE_URL`, realm **`dyingstar`** |
| `livekit` | `livekit` | **7880** | not used by admin (Horizon dependency) |

### Persistence (important)

From kubernetes **Service Details**:

- **HTTP 3001** — REST/items API (admin CRUD uses this).
- **WebSocket 9100** — Rust WS layer (player presence / game protocol).

Do **not** point `persistenceUrl` at port 9100.

### Horizon (player client)

Clients connect with `ws://<minikube-ip>:7040` (see `client.ini` in DyingStar repo).  
Inside the cluster, Horizon still listens on service port **7040**.

### Resources dynamic (mesh)

Orchestrates dynamic Horizon instances. Admin panel reads active instance count via:

- `RESOURCES_DYNAMIC_URL=http://service-resourcesdynamic:3001`
- `RESOURCES_DYNAMIC_HORIZONS_PATH` — **must match** the HTTP API in `../services/resourcesDynamic` (confirm with that repo; kubernetes README marks this scenario as TODO).

### Keycloak (dev-local)

- In-cluster: `http://keycloak:8080`
- Realm: **`dyingstar`** (not `dyingstar-sandbox`)
- Discord callback (dev): `http://<minikube-ip>:30180/realms/dyingstar/broker/discord/endpoint`

## Configured game servers

| Id | Display name | Environment | Public URL |
|----|--------------|-------------|------------|
| `universe` | Universe | production | `https://server.dyingstar-game.space` |
| `universe-testing` | Universe Testing | testing | `https://dyingstar-game.com` |

Template: `packages/backend/config/servers.example.json`. The BFF must run in the namespace of the stack you target, or use full in-cluster FQDNs in `persistenceUrl`.

### Example `SERVERS` entry (dyingstar-dev-local)

```json
{
  "id": "universe-testing",
  "name": "Universe Testing",
  "environment": "testing",
  "url": "https://dyingstar-game.com",
  "persistenceUrl": "http://service-persistence:3001",
  "wsUrl": "ws://service-persistence:9100",
  "keycloakRealm": "dyingstar",
  "resourcesDynamicUrl": "http://service-resourcesdynamic:3001",
  "horizonUrl": "http://horizon:7040",
  "godotserverUrl": "http://godotserver:8980"
}
```

## Skaffold quick start (game stack)

From `kubernetes/`:

```bash
minikube start --disk-size=150g --extra-config=apiserver.service-node-port-range=1024-65535
cp dev-local.conf.example dev-local.conf
./dev.sh
# or: skaffold dev -m horizon,service-persistence,service-resourcesdynamic,keycloak,livekit,service-persistence
```

Add admin panel: see [SKAFFOLD.md](./SKAFFOLD.md).

## Sibling source repos (build context)

| Chart | Repo path (from kubernetes/) |
|-------|------------------------------|
| godotserver | `../DyingStar` |
| horizon | `../horizonserver` |
| service-resourcesdynamic | `../services/resourcesDynamic` |
| keycloak | `../services/keycloak` |
| livekit | `../services/livekit` |
| service-persistence | `../services/persistence` |

## Admin panel checklist

- [ ] Backend deployed in `dyingstar-dev-local` (or port-forward to cluster DNS)
- [ ] `SERVERS` uses in-cluster hostnames above
- [ ] `keycloakRealm` = `dyingstar` for dev-local
- [ ] `RESOURCES_DYNAMIC_HORIZONS_PATH` aligned with resourcesDynamic OpenAPI
- [ ] Skaffold module `dyingstar-admin` added (optional)

## Related docs

- [SKAFFOLD.md](./SKAFFOLD.md) — admin Skaffold snippet
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — BFF architecture
- [../../kubernetes/README.md](../../kubernetes/README.md) — full platform runbook
