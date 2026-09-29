# Report 001 — Fase 1: API Express + Prisma + PostgreSQL

Branch: `feat/backend-api`. Escopo: somente infraestrutura (spec `prompts/002-fase-1-api-prisma.md`).

## Estrutura criada

- `apps/api/src/`: `server.ts` · `app.ts` (`createApp()`) · `config/env.ts` · `lib/prisma.ts`
  (singleton) · `middlewares/errorHandler.ts + notFound.ts` ·
  `modules/health/health.{routes,controller,service}.ts` · `health.test.ts`.
- `apps/api/prisma/schema.prisma` — 6 modelos (`User, Member, UsedIdentifier, MembershipCard,
  AuditLog, Setting`), IDs `String`, `Setting.data Json` (ADR-002); migration
  `20260929212001_init` aplicada e versionada (7 tabelas com `_prisma_migrations`).
- `docker-compose.yml` (raiz), `apps/api/.env.example` (commitado), `apps/api/.env` (gitignored).
- Ajustes: `.gitignore` += `.env`; `pnpm-workspace.yaml` += prisma/client/engines em
  `onlyBuiltDependencies`; raiz += `dev:api, build:api, db:migrate, db:studio`; README += seção backend.

## Validação

| Critério | Resultado |
|---|---|
| `pnpm install` (4 workspaces) | Verde (Prisma 6.19.3) |
| `pnpm typecheck` (api + shared + web, strict) | Verde |
| Testes API (Vitest + Supertest, Prisma mockado) | 3/3 |
| `pnpm build` web | Verde |
| Bateria web completa | security 6/6 · members 7/7 · order ✅ · features 43 ✅ · e2e 22/22 · deploy-clean 8/8 |
| `docker compose up` + `pnpm db:migrate` | Verde |
| `GET /api/health` real | 200 `{"status":"ok","service":"amococ-api","database":"connected"}` |
| Rota inexistente | 404 `{"status":"error","message":"Rota não encontrada."}` |
| Banco parado | 503 (corpo `disconnected` coberto no teste mockado) |
| `apps/web/` e `vercel.json` intactos | Confirmado via `git status` |

## Problemas e soluções

1. Postgres 17 nativo ocupava a 5432 → parado via UAC (ADR-006; volta no reboot).
2. `@prisma/engines` bloqueado pelo pnpm 11 → `onlyBuiltDependencies`.
3. `migrate dev` interativo → `--name init`.
4. Playwright sem browsers → instalado Chromium 153 (ambiente).
5. `tsx --env-file=.env` confirmado — sem lib extra de dotenv.

## Deixado para fases posteriores

Fase 2: CRUD, geração server-side, seed/factory reset. Fase 5: JWT + bcrypt + autorização
(ADRs 004/005). Fase 6: CI/CD. Frontend intocado até a Fase 4.
