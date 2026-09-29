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
