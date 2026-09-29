# Report 002 — Fase 2: regras de negócio no servidor

Branch: `feat/fase-2-api-negocio` (a partir de `feat/backend-api`).

## Escopo (003 §16)

CRUD seguindo os contratos de `repositories/` + matrícula/código gerados no servidor
(CSPRNG) + seed/factory reset. Sem auth/autorização (Fase 5); frontend intocado (Fase 4).

## Endpoints criados

- `GET/POST /api/members` · `GET/PATCH/DELETE /api/members/:id` ·
  `POST /api/members/:id/inactivate|reactivate` · `GET /api/members/preview-next` (+ `?status=`)
- `GET/POST /api/users` · `GET/PATCH /api/users/:id` · `POST /api/users/:id/status` ·
  `PUT /api/users/:id/permissions` · `POST /api/users/:id/reset-password` (sempre PublicUser)
- `GET/POST /api/cards` (+ `?memberId=`) · `GET /api/cards/:id` · `POST /api/cards/:id/downloaded`
- `GET /api/settings` · `PATCH /api/settings/association|card|security` · `PUT /api/settings/signature`
- `GET/POST /api/audit` (+ `?action=&limit=`)
- `GET/POST /api/used-identifiers` · `GET /api/used-identifiers/check?value=`
- `POST /api/system/seed` (`{demo}`) · `POST /api/system/factory-reset`

## Regras preservadas (textos e semântica idênticos ao frontend)

Matrícula 6 díg. = max(membros ∪ reserva)+1, imutável, nunca reutilizada; código
`AMOCOC-#####-XXXX` CSPRNG 50+50 tentativas → `CARD_CODE_GENERATION_FAILED`; reserva
idempotente e inapagável; só INATIVOS excluem (422 com mensagem exata §14); reativação
preserva identidade; exclusão remove carteirinhas e mantém reserva + auditoria;
assinatura obrigatória (422 título+corpo exatos); reemissão mesmo vínculo substitui;
`LOGIN_ALREADY_EXISTS`, sem auto-inativação; `PASSWORD_CHANGED` com texto exato;
`USER_CREATED…SYSTEM_FACTORY_RESET` com mesmos details; seed base/demo e LIMPAR.

## Arquitetura

`modules/<dominio>/{*.repository,*.service,*.controller,*.routes}` + `shared/`
(api-error, actor, audit, db, ids, validation, request-db) + `domain/`
(identifiers, permissions, audit-actions, default-settings). Erros: `{status,code,message}`
(+`title` na assinatura). `express.json({limit:"10mb"})`. Sem migration nova (schema Fase 1 cobre).

## Validação

| Critério | Resultado |
|---|---|
| Testes API | **45/45** (11 unit + 20 service + 6 HTTP + settings/system/cards + health + guarda de build) |
| `pnpm typecheck` (3 pkgs) | Verde |
| Build API (`tsc`) + smoke `node dist/` | Verde (`preview-next → 000001`) |
| Build web | Verde; `apps/web/` e `vercel.json` intactos |

## Problemas e soluções

1. `moduleResolution NodeNext` quebrava imports do shared → api voltou a `bundler`
   (só `import type`, com teste-guarda).
2. Testes paralelos dividindo um banco → `singleFork` + reset entre testes.
3. Minha expectativa errada na regex de validação (`I` é válido; só geração evita) → teste corrigido.

## Deixado para depois

Autorização por endpoint + JWT + login (Fase 5); `ApiRepositories` no web (Fase 4);
import idempotente do IndexedDB (Fase 3); CI (Fase 6).
