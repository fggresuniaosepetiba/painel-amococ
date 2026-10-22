# AGENTS.md — Painel AMOCOC

## Artefatos de sessão

- **Nunca commitar `.playwright-mcp/`** — screenshots, snapshots e logs do
  Playwright MCP são artefatos de sessão locais e já estão no `.gitignore`.
  Se aparecerem como untracked, ignore-os (não force `git add -f`).

## Commits

- Mensagens em inglês no padrão conventional commits (`feat:`, `fix:`,
  `docs:`, `style:`, `refactor:`, `chore:`); corpo opcional em inglês.
- Mudanças de código e mudanças de documentação vão em commits separados.
- Nunca commitar, fazer push ou reescrever histórico sem pedido explícito.

## Documentação

- Docs em português (`docs/decisions.md` com ADRs, `docs/changelog/`,
  `docs/roadmap.md` e `docs/reports/`).
- Decisões de arquitetura relevantes viram um ADR novo em `docs/decisions.md`
  e um changelog em `docs/changelog/NNN-titulo.md`.

## Validação antes de concluir uma tarefa

- `pnpm -r typecheck`
- `pnpm --filter @amococ/api test` (exige o Postgres: `docker start amococ-postgres`, porta 5433)
- `pnpm build` quando houver mudança no frontend
