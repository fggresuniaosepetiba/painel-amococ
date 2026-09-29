# FASE 4 — FRONTEND CONSOME A API

> **Status:** ESPECIFICAÇÃO — não implementada.
> Pré-requisitos: Fases 2 e 3 concluídas.
> Referência de regras: `prompts/003-regras-negocio.md` (em especial §2, §14, §16, §17).

---

## Objetivo

Trocar a persistência do frontend de IndexedDB para a API, no ponto de troca já
previsto (`apps/web/src/repositories/index.ts`), **sem mudar nenhum componente**:
os services dependem só das interfaces e continuam iguais.

---

## 1. CLIENT HTTP — `apps/web/src/lib/apiClient.ts` (novo)

- Wrapper de `fetch` com `baseURL = import.meta.env.VITE_API_URL` (default
  `http://localhost:3000`), JSON, timeout e tradução de erros:
  `{status:"error",code,message}` → `Error` com `code` preservado (para mensagens exatas §14).
- Na Fase 4, inclui o `actor` da sessão atual (usuário logado) em toda mutação —
  compatível com o `actor` opcional da API (ADR-010). Tokens entram na Fase 5.

## 2. `Api*Repository` — `apps/web/src/repositories/api/` (novo)

Uma classe por interface existente, mesma assinatura e semântica:

| Classe | Base |
|---|---|
| `ApiUsersRepository` | `GET/POST /api/users`, `PATCH`, `/status`, `/permissions`, `/reset-password` |
| `ApiMembersRepository` | CRUD + `/inactivate`, `/reactivate`, `preview-next`, `isTaken` via `/used-identifiers/check` |
| `ApiCardsRepository` | `GET`, `POST /api/cards`, `/downloaded`, `deleteByMemberId` (via exclusão do membro) |
| `ApiSettingsRepository` | `GET`, `PATCH /association|card|security`, `PUT /signature` |
| `ApiAuditRepository` | `GET`, `POST` (fire-and-forget como hoje) |
| `ApiUsedIdentifiersRepository` | `GET`, `/check`, `POST` |

- `nextMembershipNumber()` → `GET /api/members/preview-next` (geração sai do navegador).
- Geração de `cardCode` no navegador é **removida do fluxo**: o POST cria e devolve
  os identificadores (o service já ignora os do formulário).
- PNG da carteirinha continua renderizado no navegador (`html-to-image`) e enviado
  como `pngDataUrl` no `POST /api/cards`; download lê o registro da API.

## 3. PONTO DELICADO — LOGIN (endpoint temporário)

`authService.login` verificava o hash **no navegador**, mas a API (Fase 2) nunca
expõe `salt`/`passwordHash`. Para o login continuar funcionando sem antecipar a Fase 5:

- Criar `POST /api/users/:id/verify` (`{password}` → `{ok: true|false}`, sem dizer o motivo).
- Uso **exclusivo** do `authService`; marcado `@deprecated` com remoção obrigatória na Fase 5.
- Sessão continua 100% client-side (`sessionStorage`, idle 15 min) — inalterada.

## 4. COMPOSITION ROOT E LIMPEZA

- `repositories/index.ts` passa a instanciar os `Api*` (troca em um arquivo).
- Após a bateria verde: **remover** `repositories/indexeddb/`, a dependência `dexie` e
  `dexie-react-hooks` (espelho do que o Lucrai fez nas sprints 9–11).
- Dev: `VITE_API_URL` + proxy `/api → localhost:3000` no `vite.config.ts` (opcional,
  fallback quando a env falta). Produção: URL da API via env (deploy real na Fase 6).

## O QUE NÃO FAZER

- **NÃO** mudar telas, rotas, permissões client-side, sessão ou mensagens (tudo igual p/ o usuário).
- **NÃO** implementar JWT/refresh (Fase 5) — o `/verify` temporário é o limite.
- **NÃO** regenerar PNG no servidor (render continua no navegador).
- **NÃO** rodar `git commit` / `git push` sem pedido.

## CRITÉRIOS DE ACEITAÇÃO

1. `pnpm typecheck` verde (web + api + shared).
2. **Bateria do web 100% verde contra a API** (security 6/6 · members 7/7 · order ·
   features 43 · e2e 22/22 · deploy-clean 8/8 — nada desabilitado), com demo semeado via API.
3. Mensagens do §14 verificadas ponta a ponta (excluir ATIVO, assinatura, login inválido*).
   \* login inválido ainda client-side nesta fase.
4. Dexie removido do `package.json` e sem imports em `src/`.
5. `docs/` atualizado (report + changelog + decisions com a remoção do `/verify` pendente).

## VALIDAÇÃO (AO EXECUTAR)

1. `docker compose up -d` → `factory-reset` → `seed {demo: true}` via API.
2. `pnpm dev:api` + `pnpm dev` → `pnpm test` + `pnpm test:deploy`.
3. Conferir `usedIdentifiers` preservados e reuso impossível via API.
4. `docker compose down` ao final.

## RELATÓRIO (AO EXECUTAR)

Arquivos criados/removidos, mapeamento interface→endpoint, débito técnico `/verify`,
resultado da bateria contra a API, problemas e próxima fase (Fase 5).

---

## REGRA FINAL

Execução só mediante pedido explícito: 1) `apiClient` + 6 `ApiRepositories`; 2) endpoint
temporário `/verify`; 3) troca no composition root; 4) bateria verde + remoção do Dexie;
5) relatório. Nada além disso.
