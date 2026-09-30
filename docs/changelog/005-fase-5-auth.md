# Changelog — Fase 5: autenticação, autorização e auditoria server-side

- Auth JWT (access 15 min + refresh opaco rotativo de 7 dias) com
  dual-verify (bcrypt + legado SHA-256 com upgrade transparente).
- Autorização server-side em todos os endpoints (matriz §6, SUPERADMIN
  bypass); rate-limit no login (20/15 min por IP), sem lockout.
- LOGIN/LOGOUT auditados no servidor; `actor` e `/verify` removidos.
- Frontend por token (sessionStorage, Bearer, refresh silencioso,
  401 → logout + aviso); INATIVO com mensagem única §14.
- Testes: API 188/188; bateria web verde (6/6, 7/7, order, 43/43,
  e2e 22/22, deploy-clean 8/8).
