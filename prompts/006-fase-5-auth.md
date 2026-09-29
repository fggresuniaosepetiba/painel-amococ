# FASE 5 — AUTENTICAÇÃO, AUTORIZAÇÃO E AUDITORIA SERVER-SIDE

> **Status:** ESPECIFICAÇÃO — não implementada.
> Pré-requisitos: Fases 2–4 concluídas (inclui remoção do `/verify` temporário).
> Referência de regras: `prompts/003-regras-negocio.md` (em especial §6, §7, §11, §14, §15, §17).
> Decisões já tomadas: ADRs 004 (bcrypt), 005 (JWT 15 min + refresh rotativo), 010 (fim do `actor` no corpo).

---

## Objetivo

Fechar as falhas de segurança conhecidas do client-side (§15): senhas com hash forte,
permissões validadas no servidor em todo endpoint, auditoria confiável e sessões
controladas pelo servidor — mantendo as regras LGPD do frontend (só `sessionStorage`,
fecha-aba = logout, idle 15 min).

---

## 1. SESSÕES — novo modelo `Session` (migration)

```prisma
model Session {
  id          String    @id           // id da sessão (refresh opaco = random)
  userId      String                  // FK lógica → User.id
  refreshHash String    @unique       // SHA-256 do refresh token (nunca o token puro)
  expiresAt   DateTime                // expiração absoluta do refresh (ex.: 7 dias)
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
  @@map("sessions")
}
```

## 2. ENDPOINTS — `POST/GET /api/auth/*`

| Endpoint | Regras |
|---|---|
| `POST /api/auth/login` `{login, password}` | 401 único §14 sem distinguir campo; INATIVO → mesma mensagem; **dual-verify**: bcrypt, fallback SHA-256 legado (`salt:password`) com **upgrade transparente** p/ bcrypt no sucesso; atualiza `lastLoginAt`; auditoria `LOGIN`; retorna `{accessToken (JWT 15 min: `sub`, `role`, `permissions`), refreshToken, user: PublicUser}` |
| `POST /api/auth/refresh` `{refreshToken}` | Rotação: revoga o atual e emite par novo; **reuso detectado → revoga todas as sessões do usuário** (proteção anti-roubo) |
| `POST /api/auth/logout` (auth) | Revoga o refresh; auditoria `LOGOUT` |
| `GET /api/auth/me` (auth) | `PublicUser` atual |
| `POST /api/auth/change-password` (auth) `{currentPassword, newPassword}` | Valida a atual (mensagem exata §14); bcrypt; `mustChangePassword: false`; `security.lastPasswordChangeAt = agora`; auditoria `PASSWORD_CHANGED` |

## 3. AUTORIZAÇÃO — middlewares

- `requireAuth`: valida o JWT (401 padronizado; 401 no frontend = logout + aviso).
- `requirePermission(...nomes)`: **SUPERADMIN bypass** (espelho exato de
  `authorizationService`); demais precisam da permissão — nomes exatos das 18.
- Aplicados em **todos** os `/api/*` (exceto health, login, refresh).
- Remover: `actor` do corpo (some do token) e `POST /api/users/:id/verify` (débito da Fase 4).

## 4. RATE-LIMIT (sem lockout)

- `express-rate-limit` no `/auth/login` (ex.: 20 tentativas/15 min por IP) — dep nova,
  justificada. Sem bloqueio por usuário (decisão: "avaliar" do §7 vira rate-limit;
  lockout **não** implementado — registrar na decisão).
- Nunca vazar stacktrace; nunca indicar qual campo errou.

## 5. FRONTEND (parte desta fase)

- Token **só em `sessionStorage`** (nunca `localStorage`); header `Authorization: Bearer`.
- Guarda de idle 15 min mantida + 401 da API → logout + aviso no `/login`.
- Remover `utils/password.ts` (SHA-256) e resíduos client-side de auth.

## O QUE NÃO FAZER

- **NÃO** mudar as 18 permissões, os 18 eventos ou as mensagens do §14.
- **NÃO** persistir token em `localStorage`, cookie permanente ou URL.
- **NÃO** criar MFA/SSO/recuperação por e-mail (fora de escopo, §18).
- **NÃO** rodar `git commit` / `git push` sem pedido.

## CRITÉRIOS DE ACEITAÇÃO

1. Matriz das 18 permissões testada (com e sem cada uma) + bypass SUPERADMIN.
2. Access expira em 15 min; refresh rotaciona; reuso revoga tudo.
3. Login legado (hash SHA-256 importado) funciona 1x e vira bcrypt.
4. INATIVO não autentica; falha = mensagem única §14.
5. `LOGIN`/`LOGOUT` auditados no servidor; `actor` removido dos corpos.
6. Bateria do web verde com auth por token; testes novos da API (auth, rotação, rate-limit).
7. `docs/` atualizado (report + changelog + decisions: lockout avaliado e descartado).

## VALIDAÇÃO (AO EXECUTAR)

1. Migration da `Session` aplicada (`migrate dev` local).
2. Testes API verdes (incl. matriz de permissões e reuso de refresh).
3. `pnpm test` + `pnpm test:deploy` verdes contra a API com login por token.
4. `docker compose down` ao final.

## RELATÓRIO (AO EXECUTAR)

Modelos/endpoints, middlewares e matriz aplicada, upgrade legado, rate-limit,
remoções (actor, /verify, SHA-256), resultados e próxima fase (Fase 6).

---

## REGRA FINAL

Execução só mediante pedido explícito: 1) modelo `Session` + migration; 2) 5 endpoints
de auth; 3) middlewares em todas as rotas; 4) rate-limit; 5) frontend com token em
sessionStorage; 6) testes + bateria; 7) relatório. Nada além disso.
