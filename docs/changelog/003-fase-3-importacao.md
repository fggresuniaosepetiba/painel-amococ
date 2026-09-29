# Changelog — 003 — Fase 3: export + import idempotente

- Web: `systemService.exportBackup()` + botão "Exportar backup (JSON)" em
  Configurações → Sistema (gate `settings.view`).
- API: `POST /api/system/import` (backup v1, upsert por chave natural, erros por item).
- Validação real: backup do navegador importado (4 membros, 2 cards, 8 auditoria),
  rerun zerado, reserva confirmada.
- Testes API **49/49**; typecheck + build verdes.
- Docs: ADR-013, `reports/003-fase-3-importacao.md`, roadmap atualizado.
