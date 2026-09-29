# Arquitetura do backend (`apps/api`)

N-Layer adaptada em camadas finas — mesmo contrato da spec 002 (só health na Fase 1),
organizada para receber os domínios da Fase 2 sem reestruturação.

```text
apps/api/src/
├── server.ts                  # bootstrap (único lugar com listen)
├── app.ts                     # createApp(): CORS, JSON, rotas, 404, erro
├── config/env.ts              # única camada que lê process.env
├── lib/prisma.ts              # singleton PrismaClient (cache global p/ watch)
├── middlewares/               # notFound (404 JSON), errorHandler (500 JSON)
└── modules/<dominio>/         # health.routes → health.controller → health.service
```

## Regras das camadas

- `*.routes.ts` só mapeia HTTP → controller.
- `*.controller.ts` só traduz resultado do serviço em status/body HTTP.
- `*.service.ts` só contém lógica de acesso a dados (Prisma injetável p/ teste).
- `config/` é o único lugar que toca `process.env`.
- `createApp()` sem `listen` permite testes HTTP sem subir porta.

## Convenções

- ESM (`type: module`, imports com extensão `.js`, `module/moduleResolution: NodeNext`).
- `strict` herdado de `tsconfig.base.json` — nunca relaxar.
- Erros: JSON `{ status: "error", message }`, sem stacktrace em produção.
- Testes: Vitest + Supertest, Prisma mockado (`vi.mock`) na Fase 1; banco isolado da Fase 2 em diante.
- Scripts: `dev` (tsx watch + `--env-file`), `build` (tsc → `dist/`), `start` (`node dist/server.js`),
  `test`, `db:generate/migrate/deploy/studio`.
