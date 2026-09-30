# Relatório — Fase 5: auth JWT, autorização e auditoria server-side

Spec: `prompts/006-fase-5-auth.md`. Regras: `prompts/003-regras-negocio.md`
(§6, §7, §11, §14, §15, §17). Decisões: ADR-017–021.

## Modelos/endpoints

- Migration `20260930133538_add_sessions`: `Session` (`refreshHash` único,
  `expiresAt` ~7 dias, `revokedAt`).
- `POST /api/auth/login` `{login, password}` → 401 único §14 (inexistente,
  errada e INATIVO idênticos); dual-verify bcrypt + legado SHA-256
  (`salt:password`) com upgrade transparente; carimba `lastLoginAt`;
  auditoria `LOGIN` (`Login realizado por <login>`); retorna
  `{accessToken (15 min), refreshToken, user: PublicUser}`.
- `POST /api/auth/refresh`: rotaciona; reuso revoga tudo; expirado/
  desconhecido/usuário removido ou inativado → 401.
- `POST /api/auth/logout` `{refreshToken}` (sem exigir access): revoga +
  `LOGOUT` (`Sessão encerrada por <login>`); idempotente.
- `GET /api/auth/me` e `POST /api/auth/change-password`
  `{currentPassword, newPassword}` (senha atual errada → 401 com mensagem
  exata §14; bcrypt + `mustChangePassword: false` + carimbo
  `security.lastPasswordChangeAt` + `PASSWORD_CHANGED` sem vazar a senha).

## Middlewares e matriz aplicada

`requireAuth` + `requirePermission` (OR) + `requireSuperAdmin` em todos os
`/api/*` (exceto health, login, refresh, seed público, logout por refresh).
Matriz §6/§10/§11 (ver ADR-018); 403 `FORBIDDEN`. Rate-limit no login
(20/15 min por IP; teste via `LOGIN_RATE_LIMIT_MAX`); lockout descartado.

## Upgrade legado e remoções

Login com hash SHA-256 importado funciona 1x e vira bcrypt. Removidos:
`actor` dos corpos, `/verify`, LOGIN/LOGOUT client-side, `updateSecurity`
separado na troca de senha. e2e atualizado (INATIVO → mensagem única).
`verify-deploy-clean.mjs` migrado para a era API (8/8).

## Resultados

- API: **188/188** (auth 13, matriz 125, demais 50).
- Web contra a API: security **6/6**, members **7/7**, order OK, features
  **43/43**, e2e **22/22**, deploy-clean **8/8**.
- Build web 611 KB; typechecks API + web verdes.

## Próxima fase

Fase 6 — CI (GitHub Actions), Docker de produção, deploy da API.
Limitação conhecida: permissões estritas por endpoint exigem os combos das
telas (ex.: `/usuarios/permissoes` pressupõe leitura de usuários).
