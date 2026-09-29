# Report 004 — Fase 4: frontend consome a API

Branch: `feat/fase-4-frontend-api`. Escopo: spec `prompts/005-fase-4-frontend-api.md`.

## Mudanças

- **API (5 arquivos):** `POST /api/users/:id/verify` temporário (`@deprecated`,
  remoção obrigatória na Fase 5) + teste (senha certa/errada/id inexistente).
- **Web — novos:** `lib/apiClient.ts` (fetch, envelope→`ApiError` com `code`,
  `actor` da sessão via provider do `AuthProvider`, timeout 60s) + 6
  `repositories/api/*` (mesmas interfaces; geração de matrícula/código e
  reemissão de carteirinha no servidor; `deleteByMemberId` sem efeito —
  cascata no `DELETE /members/:id`).
- **Web — adaptados (mínimo):** `userService` (senhas em texto plano, sem
  auditoria dupla), `authService` (login/changeOwnPassword via `/verify`),
  `memberService` −5 logs, `cardGenerationService` −1 log, 4 telas de
  settings −4 logs, `systemService` (reset/seed/export via API),
  `AuthProvider` (boot semeia via API + injeta `actor`).
- **Web — 12 telas migradas de `db`+`useLiveQuery` para services + refetch
  explícito** (dashboard, associados ×2, carteirinhas, auditoria, usuários,
  permissões, 5 settings).
- **Removidos:** `db/`, `repositories/indexeddb/`, `seedService`,
  `utils/password`, `dexie` + `dexie-react-hooks` (bundle 714→610 KB).

## Validação

| Critério | Resultado |
|---|---|
| API (vitest) | **50/50** (1 novo do `/verify`) |
| Web contra a API | security **6/6**, members **7/7**, order OK, features **43/43**, e2e **22/22**, deploy-clean **8/8** |
| `pnpm typecheck` (3 pkgs) + `pnpm build` | verdes |
| §14 ponta a ponta | excluir ATIVO, assinatura, login inválido (via UI) |

Bugs achados e corrigidos: `verify` comparava com o salt (3 args); roteamento
de `update` com carimbos (`inactivatedAt`); PATCHs de settings exigem corpo
aninhado + 3 blocos (`settingsSaveSchema`). CEP/ViaCEP falhou 2× por timing
de rede (flake externo, passou no retry sem mudança de código).

## Débito técnico (→ Fase 5)

`POST /api/users/:id/verify` deve ser removido quando o login passar a JWT
(ADR-014). Sessão segue client-side (`sessionStorage`, idle 15 min).
