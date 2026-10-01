# 0002. No authentication on the admin panel

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Project-wide

## Context

The admin panel is deployed **only inside the environment where the game server runs**
(same Kubernetes namespace, see `ARCHITECTURE.md`). It is not exposed publicly.

## Options considered

1. **Keycloak login (OIDC) in front of the panel** — strong, but adds setup and coupling for
   an internal tool that is never reachable from outside.
2. **No application-level authentication; rely on network isolation** — simplest; access
   control is the environment's responsibility (cluster access, port-forward, VPN…).

## Decision

We will not implement authentication in the admin panel. Access is restricted by deployment:
the panel is reachable only from inside its environment.

## Consequences

- Deployment docs must state that the panel **must not** be exposed through a public Ingress.
- No user identity: activity log entries keep the generic actor `admin`.
- Destructive actions still need UI safeguards (confirmation), especially on `production`.
- To revisit if the panel is ever exposed outside its environment.
