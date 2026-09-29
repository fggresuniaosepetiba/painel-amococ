# FASE 1 — API EXPRESS + PRISMA + POSTGRESQL (ESTRUTURA E INFRAESTRUTURA)

> **Status:** ESPECIFICAÇÃO — não implementada.
> Criar este arquivo **NÃO** significa executar a Fase 1.
> Documento de planejamento da evolução arquitetural do Painel AMOCOC.
> Complementa `prompts/001-migracao-monorepo.md` (Fase 0 — concluída).

---

## Objetivo

Criar em `apps/api` a estrutura da API (Node.js + Express + TypeScript + Prisma + PostgreSQL),
com banco de dados **híbrido**:

- **Desenvolvimento local:** PostgreSQL em **Docker** (docker-compose).
- **Produção:** **Neon** (PostgreSQL serverless), conectando apenas pela troca de `DATABASE_URL`.

Esta fase é **somente infraestrutura**. A API não terá endpoints de negócio — apenas
estrutura, conexão com o banco e um endpoint de health. As regras de negócio da API
vêm na **Fase 2** (implementar os contratos dos repositories existentes).

O frontend **não será alterado**: ele continua 100% IndexedDB até a Fase 4.

---

## ARQUITETURA ALVO DESTA FASE

```text
painel-amococ/
├── apps/
│   ├── web/          # inalterado (Fase 0)
│   └── api/          # NOVO — Express + Prisma
│       ├── src/
│       │   ├── server.ts        # bootstrap do Express
│       │   ├── app.ts           # app Express (rotas, middlewares, CORS)
│       │   ├── routes/health.ts # GET /api/health (única rota da fase)
│       │   └── lib/prisma.ts    # instância única do PrismaClient
│       ├── prisma/
│       │   └── schema.prisma    # schema inicial (espelha tabelas do Dexie)
│       ├── docker-compose.yml   # PostgreSQL local (ver nota abaixo)
│       ├── .env.example         # template de variáveis (commitado)
│       ├── package.json         # @amococ/api
│       └── tsconfig.json
├── docker-compose.yml           # definido na raiz (ver §4)
├── pnpm-workspace.yaml          # inalterado (apps/* já cobre apps/api)
└── (demais arquivos da Fase 0)
```

> **Nota:** o `docker-compose.yml` será criado **na raiz do repositório**
> (não dentro de `apps/api`), por ser infraestrutura do projeto inteiro.

---

## 1. PACKAGE `apps/api`

Criar `apps/api/package.json`:

- `name`: `@amococ/api`
- `private: true`, `type: "module"` (ESM, consistente com o monorepo)
- scripts reais:
  - `dev`: watch do servidor via `tsx` (`tsx watch src/server.ts`)
  - `build`: `tsc -p tsconfig.json` (gerar JS em `dist/`)
  - `start`: `node dist/server.js`
  - `typecheck`: `tsc -p tsconfig.json --noEmit`
  - `db:generate`: `prisma generate`
  - `db:migrate`: `prisma migrate dev` (ambiente local)
  - `db:deploy`: `prisma migrate deploy` (produção/CI)
  - `db:studio`: `prisma studio`
- dependências: `express`, `cors`, `@prisma/client`
- devDependencies: `prisma`, `tsx`, `typescript`, `@types/node`, `@types/express`, `@types/cors`

Versões: últimas estáveis na data da execução. Nada de bibliotecas extras sem necessidade
(sem ORM além do Prisma, sem bibliotecas de log decorativas, sem Swagger nesta fase).

## 2. EXPRESS — SOMENTE HEALTH

- Servidor na **porta 3000** (`API_PORT`, default 3000).
- `GET /api/health` respondendo JSON no formato:
  ```json
  { "status": "ok", "service": "amococ-api", "database": "connected" }
  ```
  Consultando o banco via Prisma (`SELECT 1`/`findMany` limitado) para provar a conexão.
  Se o banco estiver inacessível: **503** com `{ "status": "degraded", "database": "disconnected" }`.
- Middleware de erro centralizado (resposta JSON com status 500, sem vazar stacktrace em produção).
- `GET` de rota inexistente → 404 JSON.
- **Nenhum outro endpoint.** Sem CRUD, sem auth, sem rotas de usuário/associado nesta fase.

## 3. PRISMA — SCHEMA INICIAL

- `prisma/schema.prisma` com `provider = "postgresql"` e
  `url = env("DATABASE_URL")`.
- **Modelos espelhando as 6 tabelas do Dexie** (fonte: `apps/web/src/db/database.ts`):
  - `User` (usuários/permissões)
  - `Member` (associados — matrícula de 6 dígitos e código `AMOCOC-#####-XXXX` como campos
    **únicos** no banco; a garantia de imutabilidade/não-reuso será implementada na Fase 2)
  - `UsedIdentifier` (identificadores já utilizados — unique composto)
  - `MembershipCard` (carteirinhas geradas)
  - `AuditLog` (auditoria)
  - `Setting` (configurações)
- Campos equivalentes aos do Dexie (tipos apropriados: `String`, `DateTime`, `Boolean`,
  `Decimal` quando fizer sentido). **Sem regras de negócio** no schema além de `@unique`
  onde o domínio já exige unicidade.
- **Sem seed de dados nesta fase** (o seed de produção/factory reset é assunto da Fase 2).
- A migration inicial (`001_init`) será criada e aplicada no banco local via
  `prisma migrate dev` durante a validação — e **commitada** (diretório `prisma/migrations/`
  versionado).

## 4. BANCO HÍBRIDO: DOCKER LOCAL + NEON EM PRODUÇÃO

### 4.1 Docker (local)

Criar `docker-compose.yml` **na raiz**:

- serviço `postgres` com `postgres:16-alpine`
- porta `5432:5432`
- usuário/senha/database locais (`amococ`/`amococ_dev`/`amococ`) definidos **no `.env`**
  (não hardcoded no compose — usar `${VAR}` com defaults locais seguros)
- named volume para persistência dos dados
- `container_name` fixo (ex.: `amococ-postgres`) e `restart: unless-stopped`

### 4.2 Variáveis de ambiente

- `apps/api/.env.example` — **commitado**, com:
  ```
  # Desenvolvimento local (Docker)
  DATABASE_URL="postgresql://amococ:amococ_dev@localhost:5432/amococ?schema=public"
  API_PORT=3000
  CORS_ORIGINS="http://localhost:5173"
  # Produção (Neon) — trocar APENAS o DATABASE_URL:
  # DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx.aws.neon.tech/neondb?sslmode=require"
  ```
- `apps/api/.env` — **gitignored** (adicionar `.env` ao `.gitignore` da raiz se não cobrir;
  o padrão `.env` sem `/` cobre qualquer nível — confirmar na execução).
- Nenhum segredo real commitado. A string do Neon (quando existir) vive só em `.env` local
  e nas variáveis de ambiente do servidor de produção — **nunca no repositório**.

### 4.3 Troca local → Neon

A troca para produção é **somente** a variável `DATABASE_URL` (12-factor). Não deve haver
nenhum branch de código `if (produção)`. Documentar no README o passo a passo:
`docker compose up -d` → `pnpm db:migrate` (local) · em produção: `DATABASE_URL` do Neon
no ambiente → `pnpm db:deploy`.

### 4.4 pnpm 11 (aprendido na Fase 0)

O Prisma possui scripts de build (download de engines). Se o pnpm bloqueá-los
(`ERR_PNPM_IGNORED_BUILDS`), adicionar `prisma` e `@prisma/client` em
`onlyBuiltDependencies` no `pnpm-workspace.yaml` — mesmo padrão usado para `esbuild`.

## 5. INTEGRAÇÃO COM O MONOREPO

- `pnpm-workspace.yaml` **inalterado** (`apps/*` já cobre `apps/api`).
- `tsconfig.json` do api **estende `../../tsconfig.base.json`** (strict mantido — não relaxar),
  com `types: ["node"]`, `module`/`moduleResolution` compatíveis com ESM Node + `tsx`.
- Scripts novos na **raiz** (todos reais):
  - `dev:api` → `pnpm --filter @amococ/api dev`
  - `build:api` → `pnpm --filter @amococ/api build`
  - `db:migrate` → `pnpm --filter @amococ/api db:migrate`
  - `db:studio` → `pnpm --filter @amococ/api db:studio`
- `pnpm typecheck` (recursivo) passa a cobrir `apps/api` automaticamente.
- Scripts existentes (`dev`, `build`, `test`, `test:deploy`) **não mudam de comportamento**.

## 6. CORS E FLUXO DE DESENVOLVIMENTO

- CORS restrito a `CORS_ORIGINS` (default `http://localhost:5173`) — sem `origin: "*"`.
- Fluxo local: `docker compose up -d` + `pnpm dev:api` (3000) + `pnpm dev` (5173).
- **O web NÃO passa a consumir a API nesta fase** (sem proxy no Vite, sem mudança de
  repositories). A conexão frontend↔API começa só na Fase 4.

---

## O QUE NÃO FAZER (LIMITES DA FASE 1)

- **NÃO** criar endpoints de negócio (CRUD de associados/usuários/etc) — Fase 2.
- **NÃO** criar autenticação, JWT, sessions, middleware de autorização — Fase 5.
- **NÃO** popular dados, criar seed de produção, lógica de factory reset — Fase 2.
- **NÃO** alterar nenhum arquivo em `apps/web/` (comportamento 100% preservado).
- **NÃO** tocar em `apps/web/src/repositories/` nem substituir o IndexedDB — Fase 4.
- **NÃO** alterar `vercel.json` nem o deploy atual (a API **não** será implantada
  na Vercel nesta fase).
- **NÃO** criar CI/CD, Dockerfile de produção ou deploy da API — Fase 6.
- **NÃO** alterar regras de negócio ou mensagens do frontend.
- **NÃO** rodar `git commit` / `git push` — somente quando o usuário pedir.

## PRÉ-REQUISITOS

- **Docker** instalado e rodando na máquina (verificar **antes** de começar; se não houver,
  **reportar e perguntar** ao usuário antes de propor alternativa — não instalar nada por conta).
- Conta no **Neon não é necessária nesta fase** (só documentação da troca; criação real
  fica para perto da Fase 4).
- Node.js e pnpm já prontos (Fase 0).

---

## CRITÉRIOS DE ACEITAÇÃO DA FASE 1

1. `pnpm install` instala o workspace inteiro (web + shared + api).
2. `pnpm typecheck` verde nos 3 projetos (strict preservado).
3. `pnpm build` do web continua verde; **bateria de testes do web 100% verde**
   (security 6/6 · members 7/7 · order · features 43 · e2e 22/22 · deploy-clean 8/8).
4. `docker compose up -d` sobe o PostgreSQL local.
5. `pnpm db:migrate` cria a migration inicial sem erro.
6. `pnpm dev:api` sobe na 3000 e `GET /api/health` responde
   `{"status":"ok","database":"connected"}`.
7. Parar o banco (ou apontar URL inválida) → health responde 503 `disconnected`.
8. A troca para Neon exige **apenas** trocar `DATABASE_URL` (validado documentalmente).
9. Nenhum segredo commitado; `.env` gitignored; `.env.example` commitado.
10. `prisma/migrations/` commitado.
11. Nenhum arquivo de `apps/web/` alterado (git deve mostrar `apps/web` limpo).
12. Deploy da Vercel intacto (nenhuma mudança em `vercel.json`).

## VALIDAÇÃO FUTURA (AO EXECUTAR)

1. `pnpm install`
2. `pnpm typecheck`
3. `pnpm build` + bateria de testes web (nada desabilitado)
4. `docker compose up -d` → conferir `docker compose ps`
5. `pnpm db:migrate` → conferir `prisma/migrations/` criado
6. `pnpm dev:api` → `curl`/fetch no `/api/health` (200) e em rota inexistente (404)
7. Teste do caminho degradado (503)
8. `docker compose down` ao final

Qualquer falha causada pela execução deve ser corrigida. Testes não devem ser
ignorados ou desabilitados.

## RELATÓRIO FUTURO (AO EXECUTAR)

- Estrutura criada
- Arquivos criados / alterados
- Dependências e scripts adicionados
- Schema Prisma e migration gerados
- Comandos executados e resultados (install, typecheck, build, testes, compose, migrate, health)
- Problemas encontrados e corrigidos
- Problemas deliberadamente deixados para fases posteriores
- Pré-parada: confirmação de que o frontend permaneceu intocado e IndexedDB ativo
- Próxima fase recomendada (Fase 2)

---

## REGRA FINAL

Este documento é uma **ESPECIFICAÇÃO**. Criar este arquivo **NÃO** significa executar
a Fase 1. A execução só ocorre mediante pedido explícito do usuário, e fará somente:

1. criar `apps/api` com Express + Prisma conforme §1–§3;
2. criar o setup híbrido Docker/Neon conforme §4;
3. integrar ao monorepo conforme §5;
4. validar conforme CRITÉRIOS e VALIDAÇÃO;
5. emitir o RELATÓRIO.

Nenhuma outra alteração além do escopo desta fase.
