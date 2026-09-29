# Roadmap — migração para backend

- [x] **Fase 0** — Monorepo pnpm (concluída antes)
- [x] **Fase 1** — API + PostgreSQL + health (`docs/reports/001-fase-1-api-prisma.md`)
- [ ] **Fase 2** — CRUD pelos contratos de `repositories/` + geração server-side de
  matrícula/código (CSPRNG) + `usedIdentifiers` transacional + seed `amococ/123` + factory reset
- [ ] **Fase 3** — Export do IndexedDB + import idempotente (spec ainda não escrita)
- [ ] **Fase 4** — Frontend consome a API via `ApiRepositories` (spec ainda não escrita)
- [ ] **Fase 5** — Auth JWT (ADR-005) + bcrypt (ADR-004) + autorização por endpoint
  (SUPERADMIN bypass, 18 permissões) + auditoria server-side + rate-limit/lockout
- [ ] **Fase 6** — CI (GitHub Actions), Docker de produção, deploy da API
