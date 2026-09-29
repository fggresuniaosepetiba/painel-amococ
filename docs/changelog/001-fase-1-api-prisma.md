# Changelog — 001 — Fase 1: API Express + Prisma + PostgreSQL

- Criado `apps/api` (`@amococ/api`): Express 4 + Prisma 6 + Vitest/Supertest, N-Layer adaptada.
- Único endpoint: `GET /api/health` (200 `connected` / 503 `disconnected`, 404 JSON p/ rotas inexistentes).
- Schema Prisma com 6 modelos espelhando o Dexie; migration `20260929212001_init`.
- `docker-compose.yml` na raiz (postgres:16-alpine, `amococ-postgres`); `.env.example` commitado, `.env` ignorado.
- Monorepo: scripts `dev:api, build:api, db:migrate, db:studio`; `onlyBuiltDependencies` += prisma/client/engines.
- Docs criados (`docs/`, padrão Lucrai): base + `reports/001-fase-1-api-prisma.md`.
- Validações verdes: typecheck (3 pkgs), testes API 3/3, build web, bateria web completa
  (security 6/6, members 7/7, order, features 43, e2e 22/22, deploy-clean 8/8).
- Detalhes: `docs/reports/001-fase-1-api-prisma.md`.
