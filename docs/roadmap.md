# Roadmap — migração para backend

- [x] **Fase 0** — Monorepo pnpm (concluída antes)
- [x] **Fase 1** — API + PostgreSQL + health (`docs/reports/001-fase-1-api-prisma.md`)
- [x] **Fase 2** — CRUD + geração server-side + seed/reset (`docs/reports/002-fase-2-api-negocio.md`)
- [x] **Fase 3** — Export do IndexedDB + import idempotente (spec `prompts/004-fase-3-importacao.md`, `docs/reports/003-fase-3-importacao.md`)
- [x] **Fase 4** — Frontend consome a API via `ApiRepositories`; Dexie removido (spec `prompts/005-fase-4-frontend-api.md`, `docs/reports/004-fase-4-frontend-api.md`)
- [x] **Fase 5** — Auth JWT (ADR-005/017) + bcrypt (ADR-004) + autorização por endpoint
  (SUPERADMIN bypass, 18 permissões) + auditoria server-side + rate-limit sem
  lockout (spec `prompts/006-fase-5-auth.md`, `docs/reports/005-fase-5-auth.md`)
- [ ] **Fase 6** — CI (GitHub Actions), Docker de produção, deploy da API
  (deploy manual concluído: API Render + Neon + web Vercel, ver
  `docs/reports/006-deploy-producao.md`; pendente CI/Docker/`render.yaml` +
  mover `db:deploy` para Pre-Deploy Command)
