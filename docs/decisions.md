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

## ADR-013 — Semântica do import (Fase 3)
Upsert por chave natural (users: id→login; members: id; cards: cardCode+memberId;
audit: id via `skipDuplicates`; settings: put; usedIdentifiers: register idempotente).
Rerun = zero inserções. Itens em conflito vão para `errors` sem abortar. Hashes
legados preservados + `mustChangePassword: true` em todo usuário importado (upgrade
bcrypt na Fase 5). A criação de membro já registra a reserva na mesma transação —
o loop de `usedIdentifiers` só complementa.

## ADR-014 — `/verify` temporário (Fase 4, remover na Fase 5)

`POST /api/users/:id/verify` (`{password}` → `{ok}`, sem dizer o motivo) existe
só porque o login ainda é client-side e a API nunca expõe `salt`/`passwordHash`.
Uso exclusivo do `authService`; marcado `@deprecated`. No sucesso, carimba
`lastLoginAt` (o login atualizava via `users.update` — sem endpoint dedicado,
o carimbo vive no `/verify`). Remoção obrigatória quando o login passar a JWT.

## ADR-015 — Auditoria tem fonte única: o servidor (Fase 4)

Com os repositories HTTP, manter os `auditService.log` client-side duplicaria
toda ação (servidor já registra com textos exatos). Removidos do cliente:
memberService (5), userService (6), saveGeneratedCard (CARD_GENERATED) e telas
de settings (4). Mantidos no cliente só os eventos sem contraparte servidora:
LOGIN, LOGOUT, CARD_DOWNLOADED (download lê o PNG local; servidor só tem
`registerDownload` — não usado pelo fluxo atual).

## ADR-016 — Senhas em texto plano até o repository (Fase 4)
`userService.create/resetPassword` e `authService.changeOwnPassword` passam a
senha em texto plano ao repository (HTTPS/localhost); hash bcrypt só no
servidor. `UsersRepository.create` recebe `NewUserInput` (sem id/hash) e
`update` aceita `newPassword` (roteado a `/reset-password`) — o roteamento por
formato do patch (`status`→`/status`, `permissions`→`/permissions`) está
documentado no código. `ApiSettingsRepository.save` grava só as fatias mudadas
(1 escrita = 1 auditoria); os 3 PATCHs levam os 3 blocos porque o
`settingsSaveSchema` os exige (servidor grava só a fatia do endpoint).

## ADR-017 — Sessões JWT + refresh opaco (Fase 5)

Access JWT HS256 de 15 min (claims `sub`, `name`, `role`, `permissions`;
espelha o idle LGPD), stateless — revogação acontece via refresh. Refresh
opaco (48 bytes aleatórios, 7 dias): no banco vive só o SHA-256
(`Session.refreshHash` único). Rotação a cada uso; reuso de refresh
revogado = possível roubo → revoga TODAS as sessões do usuário. Logout
aceita o refresh no corpo (cobre access expirado e idle); access restante
vale até 15 min (tradeoff documentado do ADR-005). Segredo em `JWT_SECRET`
(fallback dev documentado no `.env.example`).

## ADR-018 — Matriz de autorização server-side (Fase 5)

`requireAuth` (Bearer) + `requirePermission(...nomes, semântica OR)` +
`requireSuperAdmin`, espelho exato do `authorizationService` (SUPERADMIN
bypass total §6.1). Matriz: members/cards/users/settings por ação (§6, §10),
`GET /api/audit` → `audit.view`, `POST /api/audit` → só autenticado
(CARD_DOWNLOADED client-side, sem contraparte servidora), used-identifiers
consulta → `members.view` OU `members.create`, registro → `members.create`,
`POST /api/system/seed` público (boot pré-login; `demo` ignorado em
produção), factory-reset → só SUPERADMIN (mesmo gate da tela), import →
`settings.edit`. Token carrega permissões (revogação vale no próximo login;
`/me` devolve o usuário atualizado).

## ADR-019 — Rate-limit sem lockout (Fase 5, §7.7)

`express-rate-limit` no `POST /api/auth/login`: 20 tentativas/15 min por IP
(`LOGIN_RATE_LIMIT_MAX` configurável; pulado em `NODE_ENV=test` salvo
override — a suíte faz dezenas de logins do mesmo IP). Lockout por usuário
**avaliado e descartado** (sem bloqueio: evita negação de serviço contra
logins conhecidos). 429 com `RATE_LIMITED`, sem indicar campo.

## ADR-020 — Remoções da Fase 5 (fim dos débitos)

Removidos: `actor` de todos os corpos (ator vem do JWT via `reqUser`;
services mantêm o parâmetro, agora alimentado pelo token), `POST
/api/users/:id/verify` + `verifyPassword` (débito ADR-014), logs
client-side de LOGIN/LOGOUT (servidor registra; evita duplicatas —
ADR-015), chamada separada de `updateSecurity` na troca de senha (o
endpoint carimba `lastPasswordChangeAt`). INATIVO no login recebe a
**mesma** mensagem §14 (spec 006, anti-enumeração) — o e2e foi atualizado
de `"está inativo"` para a mensagem única. `verify-deploy-clean.mjs`
migrado da era IndexedDB (lendo `amococ_db` inexistente) para a era API
(prep via factory-reset + asserts HTTP/UI).

## ADR-021 — Infra local: Postgres nativo × Docker (Fase 5)

A máquina voltou com o PostgreSQL 17 nativo ocupando a 5432 e o shell sem
elevação p/ `net stop` (ADR-006 previa). Fallback sem mudar a spec:
`docker-compose.yml` aceita `POSTGRES_HOST_PORT` (default 5432) e o
ambiente local usa 5433 (só `.env`, gitignored). `CORS_ORIGINS` passa a
incluir `http://localhost:4173` (preview do build, usado pelo
`test:deploy`). Para voltar ao padrão: `net stop postgresql-x64-17`
(elevado) + `POSTGRES_HOST_PORT` fora + `.env` na 5432.

## ADR-022 — Erro inesperado nunca derruba o processo (incidente 502 em prod)

`toApiError()` relançava erros não-domínio dentro do `catch` dos 8
controllers. Em handler async do Express 4 isso vira rejeição não tratada e
o Node (15+) **mata o processo inteiro**: qualquer `POST` que batia no banco
(login/seed/refresh) retornava 502 vazio do proxy e derrubava todas as rotas
até o restart — mascarando a causa real (no caso, P2021: Neon vazio, ver
`docs/reports/006-deploy-producao.md`). Decisão: `toApiError` é total —
desconhecido vira 500 `INTERNAL_ERROR` JSON — e o erro original é sempre
registrado com `console.error`, **inclusive em produção** (antes, o
`errorHandler` só logava fora de prod, deixando o diagnóstico cego).
Cobertura: `resilience.integration.test.ts` (banco quebrado → 500, nunca
hang/crash).

## ADR-023 — `trust proxy` de 1 hop atrás do Render

Sem `app.set("trust proxy", 1)`, o `express-rate-limit` registra
`ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` e todo o tráfego compartilha um único
balde de rate-limit (IP do proxy, não do cliente). `1` = confia só no hop
mais próximo (o proxy do Render, que anexa o IP real do cliente). Cobertura:
assert de `app.get("trust proxy")` em `resilience.integration.test.ts`.
