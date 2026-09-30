# Painel AMOCOC — Contexto do projeto

Painel administrativo da **AMOCOC — Associação de Moradores do Conjunto Otacílio Câmara**.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind (`apps/web`) |
| Contratos | Tipos e permissões de domínio (`packages/shared`) |
| Backend | Node.js + Express + Prisma + PostgreSQL (`apps/api`, desde a Fase 1) |
| Banco local | PostgreSQL 16 via Docker Compose |
| Banco produção | Neon (troca só a `DATABASE_URL`) |
| Testes web | Playwright em `.mjs` (`scripts/`, `pnpm test` / `pnpm test:deploy`) |
| Testes API | Vitest + Supertest (`apps/api`, `pnpm --filter @amococ/api test`) |

## Persistência por fase

- **Até a Fase 3:** frontend 100% IndexedDB (Dexie, `amococ_db`). A API não é consumida pelo web.
- **Fase 4:** frontend passa a consumir a API (troca em `apps/web/src/repositories/index.ts`).
- **Fase 5:** autenticação JWT + autorização server-side; frontend por token
  (`apps/web/src/lib/apiClient.ts` + `services/authService.ts`).

## Fases da migração

| Fase | Escopo | Estado |
|---|---|---|
| 0 | Monorepo pnpm | Concluída |
| 1 | API + banco + `GET /api/health` | Concluída (`docs/reports/001-fase-1-api-prisma.md`) |
| 2 | CRUD + geração server-side de matrícula/código + seed | Concluída (`docs/reports/002-fase-2-api-negocio.md`) |
| 3 | Export IndexedDB + import idempotente | Concluída (`docs/reports/003-fase-3-importacao.md`) |
| 4 | Frontend consome a API; Dexie removido | Concluída (`docs/reports/004-fase-4-frontend-api.md`) |
| 5 | Auth JWT + bcrypt + autorização + auditoria server-side | Concluída (`docs/reports/005-fase-5-auth.md`) |
| 6 | Testes, CI/CD (GitHub Actions), Docker de produção, deploy da API | Futura |

## Regras de documentação

Toda alteração atualiza ou cria o doc correspondente — código sem doc não fecha a tarefa.
Mudanças pontuais entram em `docs/changelog/`; execuções de fase/sprint entram em
`docs/reports/NNN-titulo.md` (numerado, espelho do padrão do projeto Lucrai).

## Referências

- Specs: `prompts/001-migracao-monorepo.md`, `prompts/002-fase-1-api-prisma.md`
- Regras de negócio (invioláveis): `prompts/003-regras-negocio.md`
- Arquitetura do backend: `docs/backend-architecture.md`
- Decisões (ADRs): `docs/decisions.md`
