# Changelog — 004 — Fase 4: frontend consome a API

- API: `POST /api/users/:id/verify` temporário (`@deprecated`, sai na Fase 5).
- Web: `lib/apiClient` + 6 `Api*Repository`; composition root trocado;
  12 telas migradas de Dexie para services; auditoria fonte única no servidor.
- Removidos: `db/`, `repositories/indexeddb/`, `seedService`,
  `utils/password`, deps `dexie`/`dexie-react-hooks`.
- Validação: API **50/50**; web contra a API **6/6 · 7/7 · 43 · 22/22 · 8/8**;
  typecheck + build verdes.
- Docs: ADR-014/015/016, `reports/004-fase-4-frontend-api.md`, roadmap atualizado.
