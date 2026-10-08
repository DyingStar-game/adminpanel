# =============================================================================
# DyingStar Admin - Makefile
# =============================================================================

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

EXECUTOR := docker compose

# if podman is available, use it instead of docker
ifneq (, $(shell which podman 2>/dev/null))
$(info ❗❗ Using podman for compose commands❗❗)
EXECUTOR := podman compose
endif

COMPOSE := $(EXECUTOR) -f docker/docker-compose.yml

# `K8S=1`: sign in to the back team's minikube Keycloak instead of the local one, see
# docker/docker-compose.k8s.yml. Their stack must be running (minikube + `minikube tunnel`).
ifeq ($(K8S),1)
export MINIKUBE_IP := $(shell minikube ip 2>/dev/null)
export TRAEFIK_NODE_PORT := $(shell kubectl get svc traefik -n traefik -o jsonpath='{.spec.ports[?(@.port==80)].nodePort}' 2>/dev/null)
COMPOSE += -f docker/docker-compose.k8s.yml
endif

DEV_SERVICE := dev
APP_SERVICE := app
IMAGE ?= dyingstar-admin:local

# `make pnpm <args>`: the words after `pnpm` are pnpm arguments, not make targets.
# They get a no-op rule so make does not try to build them; any other unknown target
# still fails with make's usual "No rule to make target" error.
# Arguments starting with `-` are read by make itself: pass them with ARGS="...".
ifeq (pnpm,$(firstword $(MAKECMDGOALS)))
PNPM_WORDS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
PNPM_ARGS := $(strip $(PNPM_WORDS) $(ARGS))
$(foreach word,$(PNPM_WORDS),$(eval $(subst :,\:,$(word)):;@:))
else
PNPM_ARGS := $(ARGS)
endif

# Run pnpm (pinned by `packageManager`) inside the dev container.
PNPM := $(COMPOSE) exec $(DEV_SERVICE) pnpm

# =============================================================================
# CP/PO/Others Profile - Simple testing
# =============================================================================

.PHONY: start
start: .env.local ## Start the complete application (install, build, start) for testing
	@echo "$(CYAN)🚀 Starting DyingStar Admin for testing...$(RESET)"
	@echo "$(YELLOW)This will install dependencies, build, and start the application$(RESET)"
	@echo "$(YELLOW)Admin: http://localhost:3000$(RESET)"
	@$(COMPOSE) up $(APP_SERVICE)

.PHONY: stop
stop: ## Stop all running services
	@echo "$(CYAN)🛑 Stopping all services...$(RESET)"
	@$(COMPOSE) down

# =============================================================================
# Dev Profile - Development commands
# =============================================================================

.PHONY: up
up: .env.local ## Start the dev container (no app running)
	@echo "$(CYAN)🔧 Starting development environment...$(RESET)"
	@$(COMPOSE) up $(DEV_SERVICE) -d
	@echo "$(GREEN)✅ Development environment ready!$(RESET)"
	@echo "$(YELLOW)Use 'make install' then 'make pnpm dev'$(RESET)"
	@echo "$(YELLOW)Web (Vite): http://localhost:5173 · BFF: http://localhost:3000$(RESET)"
ifeq ($(K8S),1)
	@echo "$(YELLOW)Keycloak: http://auth.dyingstar.local (back team's minikube; test users: docker/keycloak/README.md)$(RESET)"
else
	@echo "$(YELLOW)Keycloak: http://localhost:8080 (test users: docker/keycloak/README.md)$(RESET)"
endif

.PHONY: down
down: ## Stop development environment
	@echo "$(CYAN)🛑 Stopping development environment...$(RESET)"
	@$(COMPOSE) down

.PHONY: install
install: ## Install dependencies in the dev container
	@echo "$(CYAN)📦 Installing dependencies...$(RESET)"
	@$(PNPM) install

# Generic pnpm command runner
.PHONY: pnpm
pnpm: ## Run any pnpm command (usage: make pnpm test, make pnpm add zod ARGS="--filter @dyingstar-admin/web")
	@if [ -z "$(PNPM_ARGS)" ]; then \
		echo "$(RED)❌ Please provide a pnpm command. Usage: make pnpm <command>$(RESET)"; \
		echo "$(YELLOW)Examples: make pnpm dev, make pnpm test, make pnpm lint$(RESET)"; \
		exit 1; \
	fi
	@echo "$(CYAN)📦 Running: pnpm $(PNPM_ARGS)$(RESET)"
	@$(PNPM) $(PNPM_ARGS)

.PHONY: check
check: ## Format, then lint, typecheck, test and check formatting (run before every commit)
	@echo "$(CYAN)🔎 Format, lint, typecheck, test, format check...$(RESET)"
	@$(PNPM) format
	@$(PNPM) lint
	@$(PNPM) typecheck
	@$(PNPM) test
	@$(PNPM) format:check
	@echo "$(GREEN)✅ All checks passed$(RESET)"

.PHONY: definitions-update
definitions-update: ## Update the bundled type definitions (fallback.json) from GitHub
	@echo "$(CYAN)📥 Updating type definitions from GitHub...$(RESET)"
	@$(PNPM) --filter @dyingstar-admin/bff definitions:update

.PHONY: image
image: ## Build the production image (docker/Dockerfile.prod), tag with IMAGE=...
	@echo "$(CYAN)🐳 Building production image $(IMAGE)...$(RESET)"
	@$(EXECUTOR:compose=) build -f docker/Dockerfile.prod -t $(IMAGE) .

# =============================================================================
# Utility commands
# =============================================================================

.PHONY: logs
logs: ## Show logs for all services
	@$(COMPOSE) logs -f

.PHONY: logs-app
logs-app: ## Show logs for app service only
	@$(COMPOSE) logs -f $(APP_SERVICE)

.PHONY: logs-dev
logs-dev: ## Show logs for dev service only
	@$(COMPOSE) logs -f $(DEV_SERVICE)

.PHONY: shell
shell: ## Open shell in dev container
	@echo "$(CYAN)🐚 Opening shell in dev container...$(RESET)"
	@$(COMPOSE) exec $(DEV_SERVICE) sh

.PHONY: status
status: ## Show status of all services
	@echo "$(CYAN)📊 Service Status:$(RESET)"
	@$(COMPOSE) ps

.PHONY: clean-volumes
clean-volumes: ## Remove all volumes (WARNING: This will delete all data!)
	@echo "$(RED)⚠️  This will delete all Docker volumes and data!$(RESET)"
	@read -p "Are you sure? (y/N) " answer; \
	if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ]; then \
		$(COMPOSE) down -v; \
		echo "$(GREEN)✅ Volumes cleaned$(RESET)"; \
	else \
		echo "$(YELLOW)Cancelled$(RESET)"; \
	fi

# Create the local env file from the sample on first run.
.env.local:
	@cp .env.sample .env.local
	@echo "$(YELLOW)Created .env.local from .env.sample — edit it to configure game servers$(RESET)"

# =============================================================================
# Help
# =============================================================================

.PHONY: help
help: ## Show this help message
	@echo "$(CYAN)DyingStar Admin - Available Commands:$(RESET)"
	@echo ""
	@echo "$(YELLOW)CP/PO/Others Profile (Simple Testing):$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "^  .{5}(start|stop) "
	@echo ""
	@echo "$(YELLOW)Dev Profile (Development):$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "^  .{5}(up|down|install|pnpm|check|image) "
	@echo ""
	@echo "$(YELLOW)Utilities:$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "^  .{5}(logs|logs-app|logs-dev|shell|status|clean-volumes) "
	@echo ""
	@echo "$(YELLOW)Examples:$(RESET)"
	@echo "  $(CYAN)make start$(RESET)           # Start app for testing (CP/PO/Others)"
	@echo "  $(CYAN)make up$(RESET)              # Start dev environment (Dev)"
	@echo "  $(CYAN)make install$(RESET)         # Install dependencies"
	@echo "  $(CYAN)make pnpm dev$(RESET)        # Start Vite + BFF dev servers"
	@echo "  $(CYAN)make check$(RESET)           # Every check before a commit"
	@echo "  $(CYAN)make pnpm test$(RESET)       # Run all tests"
	@echo "  $(CYAN)make pnpm lint$(RESET)       # Lint the workspace"

# Default target
.DEFAULT_GOAL := help
