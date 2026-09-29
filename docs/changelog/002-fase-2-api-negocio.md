# Changelog — 002 — Fase 2: regras de negócio no servidor

- 7 módulos (`members, users, cards, settings, audit, used-identifiers, system`) com
  repository (Prisma) + service (regras) + controller + routes; geração server-side de
  matrícula/código (CSPRNG); seed base/demo + factory reset.
- Deps: `zod`, `bcryptjs` (+types), `@amococ/shared` (só tipos — teste-guarda).
- Infra de teste: banco `amococ_test` isolado, suíte serializada; **45/45 verdes**.
- Erros padronizados `{status,code,message}`; `actor` opcional p/ auditoria (auth na Fase 5).
- Typecheck (3 pkgs), build API + smoke `node dist/`, build web — tudo verde; web intacto.
- Docs: ADRs 008–012, `reports/002-fase-2-api-negocio.md`, roadmap atualizado.
