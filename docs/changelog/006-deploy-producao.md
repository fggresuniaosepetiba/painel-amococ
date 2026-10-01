# Changelog — Deploy em produção e resiliência da API

- API no ar (Render + Neon + web Vercel); login `amococ/123` verificado de
  ponta a ponta (seed 200, login 200 com JWT, dashboard sem erros de console).
- Erro inesperado nunca mais derruba o processo: `toApiError` total (500
  `INTERNAL_ERROR` JSON) + log sempre, inclusive em produção (ADR-022).
- `trust proxy` de 1 hop atrás do Render: fim do
  `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`, rate-limit por IP real (ADR-023).
- Deploy: `pnpm db:deploy` no Build Command (Pre-Deploy indisponível no plano;
  mover quando possível) — Neon recebe as 7 tabelas + `sessions`.
- Testes: API 191/191 (regressão de resiliência + trust proxy); typecheck limpo.
