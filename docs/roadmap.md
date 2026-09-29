# Roadmap — migração para backend

- [x] **Fase 0** — Monorepo pnpm (concluída antes)
- [x] **Fase 1** — API + PostgreSQL + health (`docs/reports/001-fase-1-api-prisma.md`)
- [x] **Fase 2** — CRUD + geração server-side + seed/reset (`docs/reports/002-fase-2-api-negocio.md`)
- [ ] **Fase 3** — Export do IndexedDB + import idempotente (spec `prompts/004-fase-3-importacao.md`)
- [ ] **Fase 4** — Frontend consome a API via `ApiRepositories` (spec `prompts/005-fase-4-frontend-api.md`)
- [ ] **Fase 5** — Auth JWT (ADR-005) + bcrypt (ADR-004) + autorização por endpoint
  (SUPERADMIN bypass, 18 permissões) + auditoria server-side + rate-limit/lockout
  (spec `prompts/006-fase-5-auth.md`)
- [ ] **Fase 5** — Auth JWT (ADR-005) + bcrypt (ADR-004) + autorização por endpoint
  (SUPERADMIN bypass, 18 permissões) + auditoria server-side + rate-limit/lockout
- [ ] **Fase 6** — CI (GitHub Actions), Docker de produção, deploy da API
