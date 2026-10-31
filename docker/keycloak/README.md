# Local Keycloak

Keycloak the panel signs in to during development ([ADR 0023](../../docs/adr/0023-keycloak-authentication.md)).
The shared Keycloaks (pre-production, production) never accept a `localhost` redirect URI, so a
panel running on a developer's machine always signs in here.

`make up` (and `make start`) run it on <http://localhost:8080>; `dyingstar-realm.json` is
imported at every start, nothing is kept between restarts. Admin console:
<http://localhost:8080/admin> (`admin` / `devpass`).

**Everything here is for local development only**: secrets and passwords are public, never reuse
them anywhere else.

## Test users

The password is the user name.

| User | Roles | Panel |
|------|-------|-------|
| `devplayer` | `player` | signs in, then "access denied" |
| `dev-reader` | `persistence:read` | opens, read only |
| `dev-editor` | `persistence:read`, `persistence:write` | opens |
| `dev-moderator` | `moderator` (realm) | "access denied" until the `social` moderation is built |
| `dev-admin` | `admin` (realm), `persistence:*`, `social:corporation:write`, `social:politics:write`, `economie:wallet:read`, `economie:politics:read`, `economie:corporation:manage`, `economie:politics:manage`, `economie:wallet:credit`, `economie:wallet:debit`, `economie:money:issue`, `mission:read`, `mission:write`, `inventory:read` | opens; manages organisations, reads wallets, sets economic settings, runs tax assessments, moves and issues money, reads and cancels missions and names their places |
| `ynotna` | `admin` (realm), `persistence:*`, `social:*:write`, `economie:*:read`, `economie:corporation:manage`, `economie:politics:manage`, `economie:wallet:credit`, `economie:wallet:debit`, `economie:money:issue`, `mission:read`, `mission:write`, `inventory:read` | opens, manages organisations, reads wallets, sets economic settings, moves and issues money, reads and cancels missions and names their places; its id `19dd218f-9cbd-484f-9a3b-cff5285eaa93` is the maintainer's `player` in pre-production persistence, so its sheet links to a real item |
| `player-kira`, `-orin`, `-mara`, `-silas`, `-juno`, `-tess`, `-dax`, `-pell` | `player` | "access denied"; test players for `social`, fixed ids (see below) |

What each role allows is the interim matrix of `packages/schemas/src/permissions.ts` (ADR 0023,
undecided cells allowed while the panel is in test): `persistence:read` browses and runs the
checks, `persistence:write` and `persistence:delete` do everything on persistence; the
moderation roles open nothing of it.

## Where the realm comes from

`dyingstar-realm.json` is the back team's dev-local realm,
[`kubernetes` › `keycloak-managed/dev/04-realm-import.yaml`](https://github.com/DyingStar-game/kubernetes/blob/main/keycloak-managed/dev/04-realm-import.yaml)
(`spec.realm`, converted to JSON on 2026-10-08), with these additions:

- the client **`dyingstar-admin`**: confidential, authorization code + PKCE S256, secret
  `dyingstar-admin-local`, redirect URIs `http://localhost:5173/auth/callback` and
  `http://localhost:3000/auth/callback`, a mapper putting its client roles in the access token
  (`resource_access.dyingstar-admin.roles`: the realm's `roles` scope only maps realm roles);
- its client roles `persistence:read`, `persistence:write`, `persistence:delete` (draft names),
  and `social:corporation:write`, `social:politics:write`, `economie:wallet:read`,
  `economie:politics:read`, `economie:corporation:read`, `economie:corporation:manage`,
  `economie:politics:manage`, `economie:wallet:credit`, `economie:wallet:debit`,
  `economie:money:issue`, `mission:read`, `mission:write`, `inventory:read`, `social:notify:write`,
  `social:player:write`, `inventory:poi:manage` (the capability roles of the services' READMEs,
  held by people, ADR 0023);
- the realm roles `admin` and `supervisor`, checked by `social` but missing from the back
  team's realms;
- the users `dev-reader`, `dev-editor`, `dev-moderator`, `dev-admin`, and `ynotna` with a fixed
  id (a real pre-production player);
- the test players `player-*`, with fixed ids so their links survive the stack's resets.

The `svc-*` clients keep no secret (the back team's operator sets them): Keycloak generates
one at each start, and their service account roles are not assigned.

When the back team changes their dev realm, convert `spec.realm` again and re-apply the
additions above.

## The panel in the back team's minikube Keycloak

The client `dyingstar-admin` (with the redirect URIs of `localhost:5173`, `localhost:3000` and
`admin.dyingstar.local`), its client roles and the realm roles `admin` and `supervisor` are in the
back team's `kubernetes` repository (`keycloak-managed/dev/`), with the client's secret
`dyingstar-admin-dev-secret` (the one decided for the dev environment, maintainer 2026-10-23),
which `docker-compose.k8s.yml` hands the BFF; our compose Keycloak keeps `dyingstar-admin-local`.
Since `kubernetes` #48 (2026-10-31), the realm's bootstrap job
(`keycloak-managed/dev/07-role-bootstrap-job.yaml`) also creates the test accounts at each
ArgoCD sync: `dev-reader`, `dev-editor`, `dev-moderator`, `dev-admin` and the `player-*` (fixed
ids, password = user name), and re-asserts their `dyingstar-admin` client roles (add only).
**`ynotna` is not there** (the account of a real person): on minikube, sign in as `dev-admin`.

`k8s-partial-import.json` is now only for a realm older than #48: Realm settings › Action ›
Partial import on `http://auth.dyingstar.local/admin` (realm `dyingstar`), "Skip" if a resource
exists. Regenerate it whenever `dyingstar-realm.json` changes. A new client role of the panel
goes into `kubernetes` (`06-service-clients.yaml` and the bootstrap job's list), not only here.

Then `make up K8S=1` (their stack running, `minikube tunnel` on) recreates the dev container on
minikube's network and points the BFF at `http://auth.dyingstar.local/realms/dyingstar`
(`docker/docker-compose.k8s.yml`); `make up` goes back to the local Keycloak.

### Organisation management on minikube

`make up K8S=1` reads `svc-admin`'s secret from the cluster (`svc-admin-client-secret`, key
`secret`) and hands it to the BFF (`SVC_ADMIN_CLIENT_SECRET`), never written to a file. The
back team's `svc-admin` holds `social:corporation:write` and `social:politics:write`; people
need the same roles on `dyingstar-admin` (above) and a moderation role to open the section.

## Test players in minikube's `social`

The back team's stack recreates `social`'s database with everything else. Once the realm holds
the `player-*` users (above), `make seed-social` (container started with
`make up K8S=1`) signs each player in through the realm's public `dyingstar-dev` client, which
registers them in `social` (the staff accounts `dev-moderator` and `dev-admin` too: without a profile, `social` refuses their reputation changes), then fills it: profiles, friendships (one request left pending),
organisations (a country and its commune, three corporations, one the subsidiary of another), open reports against `player-dax` and `player-pell` (and one back), a warning and a mute on
`player-dax` by `dev-moderator`, a 72 h suspension on `player-pell` by `dev-admin`. Run it again
after every reset; on a filled database it skips what exists. `make reset-social` goes back to
the start: it empties `social`'s database (`docker/minikube/service-reset.sql`, the SQL of
`social`'s own `reset-db.mjs`), restarts the service, which recreates its tables, then seeds.
`make reset-mission` does the same for `mission` (its missions come back on the seed's POIs). The data lives in
`packages/contracts/scripts/seed-social.ts`.

## Services rejecting every token in minikube (`401 Invalid token`)

The back team's services read Keycloak's keys at `http://auth.dyingstar.local/…/certs` (no
`OIDC_JWKS_URL` in their `values-dev`, lot 2 question 5), so the pods must resolve
`auth.dyingstar.local` to Traefik. On **native Linux** (the maintainer's setup since
2026-10-31) they do: the cluster's DNS forwards unknown names to the host, whose `/etc/hosts`
maps them to Traefik's external IP. Check:

```sh
kubectl exec deploy/service-social -n dyingstar -- node -e "fetch('http://auth.dyingstar.local/realms/dyingstar/protocol/openid-connect/certs').then(r=>console.log(r.status))"
```

answers `200`. With **WSL + Docker Desktop** it did not: the host's resolver read the Windows
hosts file (`127.0.0.1`, the pod itself). The workaround then was a CoreDNS line mapping these
names to Traefik's ClusterIP, lost when minikube is recreated:

```sh
TIP=$(kubectl get svc traefik -n traefik -o jsonpath='{.spec.clusterIP}')
kubectl -n kube-system get configmap coredns -o json | python3 -c '
import json, sys
cm, line = json.load(sys.stdin), sys.argv[1] + " auth.dyingstar.local services.dyingstar.local"
cf = cm["data"]["Corefile"]
if "auth.dyingstar.local" not in cf:
    cf = cf.replace("host.minikube.internal\n", "host.minikube.internal\n       " + line + "\n", 1)
cm["data"]["Corefile"] = cf
json.dump(cm, sys.stdout)' "$TIP" | kubectl replace -f -
kubectl -n kube-system rollout restart deployment coredns
```

## After the back team's stack is recreated

Their realm comes back with the panel's client and test accounts (above); the services'
databases come back empty. Sign in again to the panel, then `make seed-social` (it registers the
players in `social` and refills `social`, `economie` and `mission`) and `make seed-simulation`.
If `make seed-social` stops on `Keycloak refused dev-moderator (400 … Invalid user
credentials)`, the bootstrap job has not run yet: wait for ArgoCD's sync of `keycloak`.
