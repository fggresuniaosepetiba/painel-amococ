# FASE 3 — EXPORT DO INDEXEDDB + IMPORT IDEMPOTENTE NO POSTGRES

> **Status:** ESPECIFICAÇÃO — não implementada.
> Complementa `prompts/002-fase-1-api-prisma.md` (Fase 1) e a Fase 2 (CRUD + seed).
> Referência de regras: `prompts/003-regras-negocio.md` (em especial §4, §12, §15, §17).

---

## Objetivo

Migrar os dados reais que vivem no IndexedDB do navegador (`amococ_db`) para o
PostgreSQL, sem perda e sem duplicação: exportar da base local e importar na API
de forma **idempotente** (rodar 2x não duplica nada).

Pré-requisito: Fase 2 concluída (endpoints de CRUD + `POST /api/system/seed` existem).

---

## 1. EXPORTAÇÃO (única mudança no `apps/web/` desta fase)

- Novo botão **"Exportar backup (JSON)"** em Configurações → Sistema (permissão
  `settings.view`, SUPERADMIN mantido como hoje).
- Implementação: `systemService.exportBackup()` usando os repositories existentes
  (`getAll` das 6 tabelas) + download de `amococ-backup-AAAA-MM-DD.json`:
  ```json
  { "version": 1, "exportedAt": "ISO", "users": [], "members": [], "cards": [],
    "settings": {}, "audit": [], "usedIdentifiers": [] }
  ```
- Nenhuma outra mudança no frontend. Sem alterar login, telas ou estilos.

## 2. IMPORTAÇÃO — `POST /api/system/import`

Body = o JSON do backup. Resposta 200 com resumo + erros por item:
```json
{ "status": "ok", "data": {
    "imported": { "users": 1, "members": 4, "cards": 2, "audit": 9, "usedIdentifiers": 8 },
    "errors": [{ "entity": "member", "id": "...", "code": "MEMBERSHIP_NUMBER_TAKEN" }] } }
```

Semântica por entidade (sempre pela chave natural, nunca duplicando):

| Entidade | Chave | Comportamento |
|---|---|---|
| `users` | `id` (fallback `login`) | upsert: preserva `salt`/`passwordHash` **legados (SHA-256)** e força `mustChangePassword: true` em todos (Fase 5 faz upgrade transparente p/ bcrypt) |
| `members` | `id` | upsert; matrícula/código em conflito com **outro** id → erro `MEMBERSHIP_NUMBER_TAKEN`/`CARD_CODE_TAKEN` no item (não aborta o resto) |
| `usedIdentifiers` | `value` | `register` idempotente (primeiro registro vence) — **é o que impede reuso pós-import** |
| `cards` | `cardCode` + `memberId` | mesma semântica de reemissão da Fase 2 (mesmo vínculo substitui, outro → `CARD_CODE_TAKEN`) |
| `settings` | `"general"` | substitui (put) |
| `audit` | `id` | insere pulando ids já existentes |

Ordem de importação: users → settings → members → usedIdentifiers → cards → audit.
Rerun com o mesmo arquivo → `imported` tudo zero, `errors` vazio.

## 3. REGRAS PRESERVADAS

- `usedIdentifiers` importados integralmente: matrículas/códigos de excluídos **nunca voltam**.
- Auditoria preservada com ids, datas e autores originais (história não é reescrita).
- Senhas: hashes SHA-256 continuam verificáveis **só no frontend** até a Fase 4; ninguém
  é forçado a trocar senha na importação (`mustChangePassword: true` vale a partir da Fase 5).

## O QUE NÃO FAZER

- **NÃO** trocar os repositories do frontend (Fase 4) nem autenticação server-side (Fase 5).
- **NÃO** "converter" hashes SHA-256 para bcrypt sem a senha em texto puro (impossível) —
  o upgrade é no login da Fase 5.
- **NÃO** apagar/zerar o IndexedDB do usuário (o backup continua lá; a troca vem na Fase 4).
- **NÃO** rodar `git commit` / `git push` sem pedido.

## CRITÉRIOS DE ACEITAÇÃO

1. Export gera JSON válido com as 6 tabelas.
2. `seed` zerado + import → contagens iguais às do backup (users/members/cards/audit/used = backup).
3. Re-import do mesmo arquivo → zero inserções, zero erros.
4. `GET /api/used-identifiers/check?value=<matrícula importada>` → `used: true`.
5. Login no frontend (IndexedDB) continua funcionando após a importação (nada muda p/ o usuário).
6. Testes da API da Fase 2 seguem verdes + novos testes do import (idempotência, conflitos).
7. `apps/web/` com diff mínimo (só exportação); `docs/` atualizado (report + changelog).

## VALIDAÇÃO (AO EXECUTAR)

1. `docker compose up -d` → `POST /api/system/factory-reset` (base limpa).
2. Exportar backup do navegador (base demo de desenvolvimento).
3. `POST /api/system/import` → conferir resumo; repetir → zeros.
4. `pnpm --filter @amococ/api test` verde.
5. `docker compose down` ao final.

## RELATÓRIO (AO EXECUTAR)

Endpoint criado, semântica por entidade, resultado do import de teste (contagens),
idempotência comprovada, decisão de senhas legadas, problemas e próxima fase (Fase 4).

---

## REGRA FINAL

Execução só mediante pedido explícito: 1) botão de export no web; 2) `POST
/api/system/import` idempotente; 3) testes; 4) validar; 5) relatório. Nada além disso.
