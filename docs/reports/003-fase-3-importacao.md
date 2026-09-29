# Report 003 — Fase 3: export IndexedDB + import idempotente

Branch: `feat/fase-3-importacao`. Escopo: spec `prompts/004-fase-3-importacao.md`.

## Mudanças

- **Web (diff mínimo, 2 arquivos):** `systemService.exportBackup()` (lê as 6 tabelas
  via repositories, baixa `amococ-backup-AAAA-MM-DD.json` v1, retorna contagens) +
  card "Exportar backup" em Configurações → Sistema (gate `settings.view`, sem tocar
  em login, telas ou estilos).
- **API:** `POST /api/system/import` (upsert por chave natural, `errors` por item,
  `INVALID_BACKUP` 400). Sem migration nova.

## Validação real ponta a ponta (navegador → API)

Base demo de DEV exportada via UI (1 usuário, 4 associados, 2 carteirinhas,
8 auditoria, 8 identificadores) após `factory-reset` na API:

| Passo | Resultado |
|---|---|
| Import 1 | `members 4, cards 2, audit 8` (users/settings já existiam do reset → pulados), zero erros |
| Import 2 (rerun) | tudo zero, zero erros |
| `used-identifiers/check?value=000001` | `used: true` |
| História | ids e datas originais preservados; hash legado preservado + `mustChangePassword: true` |

## Validação técnica

Testes API **49/49** (4 novos do import: contagens, idempotência, conflito
`MEMBERSHIP_NUMBER_TAKEN`, backup inválido); `pnpm typecheck` (3 pkgs) verde;
`pnpm build` web verde. Login do frontend inalterado (IndexedDB segue ativo).

## Deixado para depois

Troca dos repositories (Fase 4); upgrade bcrypt no login (Fase 5); CI (Fase 6).
