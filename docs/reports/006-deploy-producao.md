# Relatório — Deploy em produção: incidente 502 e ida ao ar

Decisões: ADR-022, ADR-023. Fase 5 em `docs/reports/005-fase-5-auth.md`.

## Topologia

- API: `https://painel-amococ-api.onrender.com` (plano free; Root `apps/api`;
  Build `pnpm install && pnpm db:generate && pnpm db:deploy && pnpm build`;
  Start `node dist/server.js`; `NODE_VERSION=22`, `NODE_ENV=production`).
- Banco: Neon com string **pooled** (`?sslmode=require`).
- Web: `https://painel-amococ.vercel.app` (`VITE_API_URL` = URL da API).
- Env prod: `CORS_ORIGINS=https://painel-amococ.vercel.app` (sem barra final),
  `JWT_SECRET` forte só no dashboard (nunca commitado).

## Linha do tempo do incidente (QA: "não entra")

1. **CORS com barra final**: `CORS_ORIGINS` com `/` no fim → preflight reprovado
   no navegador ("Erro de CORS" no console + `Não foi possível entrar agora...`).
   Fix: remover a barra; preflight passou a responder 204 com `ACAO` correto.
2. **502 em todo POST de banco**: `POST /login|/seed|/refresh` → 502 vazio
   (edge, sem `x-powered-by`) e o serviço caía junto (health 200 → login →
   health 502). GETs/404/JSON inválido sobreviviam. Causa dupla:
   - **Neon vazio**: migrations nunca aplicadas no Render (Build Command não
     tinha `db:deploy`; Pre-Deploy indisponível no plano) → `P2021: The table
     'public.users' does not exist` no primeiro `findUnique` (log do Render).
   - **Crash mascarador**: `toApiError()` relançava o P2021 dentro do `catch`
     (ADR-022) → rejeição não tratada → Node morto → 502 até o restart.
   O Chrome rotula falha de rede em requisição CORS como "erro de CORS", o que
   despistou o diagnóstico para config em vez de processo morto.
3. **Fix em duas camadas**: `toApiError` total + log sempre em prod (PR #6,
   commit `1faff0f`) → login passou a responder 500 `INTERNAL_ERROR` com o
   processo vivo, revelando o P2021; `pnpm db:deploy` no Build Command +
   Manual Deploy → 7 tabelas + `sessions` criadas.

## Verificação ponta a ponta (pós-deploy)

- `POST /api/system/seed` → 200 `{"seeded":true,"demo":false}`.
- `POST /api/auth/login` (`amococ/123`) → 200 com `accessToken` (JWT 15 min),
  `refreshToken` opaco, `expiresIn: 900`; health 200 após (sem crash).
- Playwright no Vercel: login → `/dashboard` ("Boa noite, Administrador",
  auditoria com os LOGINs, toast "Bem-vindo!"), **0 erros de console**.

## Pendências (Fase 6)

- Mover `db:deploy` do Build para **Pre-Deploy Command** quando o plano permitir
  (slot correto: migração antes do start, sem misturar com compilação).
- `render.yaml` + CI + smoke de produção.
