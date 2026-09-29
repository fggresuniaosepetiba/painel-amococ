# Decisões de arquitetura (ADRs)

## ADR-001 — N-Layer adaptada em vez da estrutura plana da spec

A spec 002 previa 4 arquivos (`server, app, routes/health, lib/prisma`). Optou-se por camadas
finas (`config, middlewares, modules/<dominio>`) com o mesmo comportamento, para a Fase 2
(members, users, cards…) entrar sem reestruturação. Aprovado pelo usuário.

## ADR-002 — IDs `String` + `Setting.data Json` no Prisma

Preserva compatibilidade com IDs string e ISO do frontend/IndexedDB, facilitando o import
idempotente da Fase 3. `Setting` usa coluna `Json` por ser registro único (`"general"`).

## ADR-003 — Vitest + Supertest para testes da API

Vitest (unitários) + Supertest (integração HTTP). Fase 1 com Prisma mockado; Fase 2+ com
banco de teste isolado. Aprovado pelo usuário.

## ADR-004 — bcrypt (cost 12) para hash de senhas (Fase 5)

Spec 003 aceita bcrypt/argon2; bcrypt escolhido pela familiaridade da equipe. Camada
`passwordHasher` isolada permite migrar para argon2id sem tocar nos services.

## ADR-005 — JWT access 15 min + refresh opaco rotativo (Fase 5)

Access curto espelha o idle LGPD de 15 min; refresh gravado no Postgres permite revogação
(logout/lockout). Frontend segue guardando sessão só em `sessionStorage`.

## ADR-006 — Parar o Postgres nativo; manter `5432:5432` da spec

A máquina tinha um PostgreSQL 17 nativo ocupando a porta do host. Optou-se por pará-lo
(`net stop postgresql-x64-17`, com UAC) em vez de mudar a porta. Atenção: serviço em modo
`Automatic` volta no reboot — repetir o `net stop` ou reconsiderar a porta.

## ADR-007 — CI/CD adiada para a Fase 6

Não existe CI no repo (sem `.github/`). Conforme a spec 002, nada de CI/CD na Fase 1.
Na Fase 6: GitHub Actions com typecheck, testes API, build web e bateria Playwright.

## ADR-008 — bcryptjs (não bcrypt nativo) na Fase 2

Mesmo algoritmo bcrypt, implementação pure-JS: evita toolchain de compilação nativa no
Windows com pnpm. Atrás da interface `passwordHasher` — troca futura sem tocar services.

## ADR-009 — zod na API para validação de entrada

Mesma lib do frontend; valida os mesmos contratos (nome, CPF, data ISO, telefones,
permissões). Erros viram 400 `VALIDATION_ERROR`.

## ADR-010 — `actor` opcional no corpo (auditoria sem auth)

Sem autenticação até a Fase 5, endpoints aceitam `actor: {id, name}` opcional SOMENTE
para atribuição de auditoria (ausente → "sistema"). Nenhuma checagem de permissão é
feita — e nenhum endpoint finge autorizar. Fase 5 substitui por JWT.

## ADR-011 — Banco isolado `amococ_test` + suíte serializada

Integração usa `TEST_DATABASE_URL` (criação + `migrate deploy` no globalSetup) e
`singleFork` no Vitest: arquivos serializados, reset entre testes. Nunca toca no
banco de desenvolvimento.

## ADR-012 — `@amococ/shared` só como tipo na API

O shared não é compilado; import runtime quebraria `node dist/`. Só `import type`
(verificado por `src/test/shared-imports.test.ts`). Listas runtime (18 permissões,
18 eventos) são espelhos documentados — replicar mudanças do shared.
