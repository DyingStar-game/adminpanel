# Skaffold integration — DyingStar Admin

The DyingStar game stack is deployed from **[`../kubernetes`](../../kubernetes)** — see [KUBERNETES.md](./KUBERNETES.md) for ports, realms, and DNS.

The admin panel is a **separate BFF + SPA** that must run in the same namespace so it can reach cluster services.

## Namespace and DNS

| Kubernetes Service | Port(s) | Role |
|--------------------|---------|------|
| `service-persistence` | 3001 HTTP, 9100 WS | Items API + player WS |
| `service-resourcesdynamic` | 3001 HTTP, 9200 WS | Dynamic Horizon mesh |
| `horizon` | 7040 (NodePort dev) | Horizon game server |
| `godotserver` | (chart) | Godot dedicated server |
| `keycloak` | 8080 | Auth |
| `livekit` | 7880 | Voice |

Short DNS from the same namespace: `http://service-persistence:3001`, `http://service-resourcesdynamic:3001`.

## Backend env in cluster

Deploy the admin backend with `PERSISTENCE_URL` (formerly `SERVERS`) and `RESOURCES_DYNAMIC_*` pointing to the table above (see `packages/backend/.env.example`).

The BFF calls **service-resourcesdynamic** to count active Horizon instances per game server:

- Env: `RESOURCES_DYNAMIC_HORIZONS_PATH` (default `/api/servers/{serverId}/horizons/active`)
- Align this path with the real resourcesDynamic API in `../services/resourcesDynamic`

## Adding a Skaffold module (kubernetes repo)

Append to `kubernetes/skaffold.yaml`:

```yaml
---
apiVersion: skaffold/v4beta11
kind: Config
metadata:
  name: dyingstar-admin
build:
  local:
    push: false
    useBuildkit: true
  artifacts:
    - image: dyingstar-admin-backend
      context: ../adminpanel/packages/backend
      docker:
        dockerfile: Dockerfile
    - image: dyingstar-admin-frontend
      context: ../adminpanel/packages/frontend
      docker:
        dockerfile: Dockerfile
deploy:
  helm:
    releases:
      - name: dyingstar-admin
        chartPath: ../adminpanel/deploy/helm/dyingstar-admin
        namespace: dyingstar-dev-local
        createNamespace: true
        valuesFiles:
          - ../adminpanel/deploy/helm/dyingstar-admin/values-dev-local.yaml
portForward:
  - resourceType: Service
    resourceName: dyingstar-admin-frontend
    namespace: dyingstar-dev-local
    port: 80
    localPort: 5173
  - resourceType: Service
    resourceName: dyingstar-admin-backend
    namespace: dyingstar-dev-local
    port: 3000
    localPort: 3000
```

Run:

```bash
skaffold dev -m dyingstar-admin,horizon,service-persistence,service-resourcesdynamic
```

Or add `dyingstar-admin` to `./dev.sh` / `dev-local.conf` in the kubernetes repo.

## Local dev without Skaffold

```bash
cd adminpanel
pnpm dev
```

Use port-forwarding to cluster services or the mock persistence URL for offline UI work.
