# FASE 0 — TRANSFORMAÇÃO DO PAINEL AMOCOC PARA MONOREPO

> **Status:** ESPECIFICAÇÃO — não implementada.
> Criar este arquivo **NÃO** significa executar a Fase 0.
> Documento de planejamento da evolução arquitetural do Painel AMOCOC.

---

## Objetivo

Transformar o projeto atual em um monorepo profissional utilizando pnpm workspaces, preservando integralmente o comportamento atual do sistema.

A aplicação atual está funcionando em produção e possui uma arquitetura front-end-only com persistência local em IndexedDB.

A migração para backend será incremental.

Nesta fase NÃO devemos implementar backend funcional, PostgreSQL ou substituir o IndexedDB.

O objetivo desta fase é somente preparar estruturalmente o projeto para as próximas etapas.

---

## ARQUITETURA ALVO

A estrutura inicial desejada é:

```text
painel-amococ/

├── apps/
│   └── web/
│       └── frontend atual
│
├── packages/
│   └── shared/
│
├── scripts/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
└── demais arquivos de configuração necessários
```

O backend será criado em uma fase posterior.

A pasta `apps/api` NÃO deve ser implementada nesta fase.

---

## 1. PRESERVAR O FRONTEND ATUAL

O frontend existente deverá posteriormente ser movido para:

`apps/web/`

Preservando:

- React
- TypeScript
- Vite
- Tailwind
- Radix
- CVA
- Lucide
- React Router
- React Hook Form
- Zod
- Dexie
- dexie-react-hooks
- html-to-image
- ViaCEP
- componentes
- páginas
- services
- repositories
- testes
- scripts
- assets
- logo
- assinatura
- configuração da Vercel

O comportamento da aplicação deve permanecer equivalente ao atual.

---

## 2. PNPM WORKSPACE

Criar configuração de pnpm workspace.

O workspace deverá utilizar inicialmente:

```yaml
apps/*
packages/*
```

O projeto deverá possuir scripts de raiz para permitir operações como:

- `pnpm dev`
- `pnpm build`
- `pnpm test`
- `pnpm typecheck`

Os scripts devem executar comandos reais dos respectivos workspaces.

Não criar scripts artificiais ou placeholders que não funcionem.

---

## 3. PACKAGE DO FRONTEND

O frontend deverá possuir:

`apps/web/package.json`

com suas próprias:

- dependencies
- devDependencies
- scripts

As dependências deverão ser organizadas corretamente entre raiz, web e packages.

---

## 4. PACKAGE SHARED

Criar:

`packages/shared/`

Esse pacote será utilizado futuramente para contratos compartilhados entre frontend e backend.

Inicialmente avaliar cuidadosamente o que pode ser movido para ele.

**Possíveis candidatos:**

- tipos puros
- enums
- schemas Zod
- permissões
- contratos de domínio
- futuros contratos de API

**Não colocar em `shared`:**

- React
- componentes visuais
- IndexedDB
- Dexie
- código específico de browser
- código específico de Node
- Express
- secrets
- infraestrutura

Não mover código automaticamente apenas para preencher o pacote.

---

## 5. TYPESCRIPT

Criar:

`tsconfig.base.json`

na raiz.

Os projetos deverão utilizar essa configuração base quando apropriado.

Preservar:

- strict
- noImplicitAny
- regras importantes existentes
- compatibilidade com o build atual

Não relaxar o TypeScript para facilitar a migração.

---

## 6. VITE

O Vite deverá continuar funcionando dentro de:

`apps/web/`

O frontend deverá continuar podendo ser executado localmente.

---

## 7. VERCEL

Preservar a capacidade de deploy atual.

Analisar o `vercel.json` existente e adaptá-lo para a nova estrutura somente quando a implementação da Fase 0 for executada.

As rewrites da SPA não podem ser quebradas.

---

## 8. TESTES

Os testes existentes devem ser preservados.

Entre eles:

- `test-security`
- `verify-deploy-clean`
- `test-members`
- `e2e-test`
- `verify-order`
- `verify-features`

Na execução futura da Fase 0, os caminhos deverão ser ajustados apenas quando necessário devido à mudança de diretórios.

Não reescrever os testes sem necessidade.

Não desabilitar testes para fazer o build passar.

---

## 9. SERVICES E REPOSITORIES

Preservar a arquitetura atual:

```text
UI
↓
services
↓
repositories
↓
IndexedDB
```

A arquitetura futura será:

```text
UI
↓
services
↓
repositories
↓
API
↓
PostgreSQL
```

Mas a substituição NÃO ocorrerá nesta fase.

Preservar especialmente:

`src/repositories/index.ts`

como composition root e ponto central para futura substituição dos repositories IndexedDB por ApiRepositories.

---

## 10. REGRAS DE NEGÓCIO

Preservar integralmente as regras existentes.

Especialmente:

### Associados

- associados ATIVOS não podem ser excluídos
- somente INATIVOS podem ser excluídos
- reativação preserva identidade
- exclusão é permanente

### Matrícula

- 6 dígitos
- imutável
- única
- nunca reutilizada
- baseada em members + usedIdentifiers

### Código da carteirinha

Formato:

`AMOCOC-#####-XXXX`

Regras:

- único
- imutável
- nunca reutilizado
- alfabeto atual
- geração criptograficamente segura
- retry conforme implementação existente

### Carteirinha

- 600×378 lógico
- pixelRatio 3
- PNG
- assinatura oficial obrigatória
- sem QR Code
- sem integração WhatsApp

### SUPERADMIN

- bypass das permissões conforme comportamento atual

### Auditoria

Preservar o comportamento existente.

### Factory Reset

Preservar o comportamento atual nesta fase.

---

## 11. BANCO DE DADOS

Nesta fase:

- NÃO implementar PostgreSQL.
- NÃO instalar Prisma.
- NÃO criar migrations.
- NÃO substituir IndexedDB.

A futura arquitetura utilizará:

**PostgreSQL + Prisma**

mas isso será implementado em uma fase posterior.

---

## 12. BACKEND

Nesta fase:

- NÃO implementar Express.
- NÃO criar API funcional.
- NÃO criar autenticação server-side.
- NÃO criar middleware de autorização.

A futura API será:

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL

---

## 13. SEGURANÇA

Os problemas atuais de segurança são conhecidos.

Entre eles:

- autenticação client-side
- SHA-256 + salt
- permissões client-side
- factory reset sem proteção no service
- auditoria client-side
- dados sensíveis disponíveis no frontend

Esses problemas serão tratados durante a migração para backend.

A Fase 0 não deve criar falsas correções apenas no frontend.

---

## 14. PRINCÍPIO DA MIGRAÇÃO

A migração deverá ser incremental.

Estratégia planejada:

```text
FASE 0
Monorepo sem alteração funcional
        ↓
FASE 1
API Express + PostgreSQL + Prisma
        ↓
FASE 2
API implementando os contratos existentes dos repositories
        ↓
FASE 3
Exportação do IndexedDB + importação idempotente
        ↓
FASE 4
Frontend utilizando API
        ↓
FASE 5
Autenticação, autorização e auditoria server-side
        ↓
FASE 6
Testes, CI/CD, Docker e deploy
```

Nenhuma fase posterior deve ser executada automaticamente durante a Fase 0.

---

## 15. CRITÉRIOS DE ACEITAÇÃO DA FASE 0

Quando esta especificação for executada posteriormente:

1. O projeto deverá instalar com pnpm.
2. O frontend deverá iniciar.
3. O frontend deverá fazer build.
4. TypeScript deverá passar.
5. IndexedDB deverá continuar sendo utilizado.
6. Login deverá continuar funcionando.
7. Associados deverão continuar funcionando.
8. Carteirinhas deverão continuar funcionando.
9. Usuários deverão continuar funcionando.
10. Configurações deverão continuar funcionando.
11. Auditoria deverá continuar funcionando.
12. Factory reset deverá continuar funcionando.
13. Testes existentes deverão continuar executáveis.
14. Deploy da Vercel não deverá ser quebrado.
15. Não deverá haver perda de dados causada pela migração estrutural.

---

## 16. VALIDAÇÃO FUTURA

Após executar a Fase 0, deverão ser executados:

- instalação das dependências
- typecheck
- build
- testes existentes relevantes

Qualquer falha causada pela migração deverá ser corrigida.

Testes não devem ser ignorados ou desabilitados.

---

## 17. RELATÓRIO FUTURO

Quando a Fase 0 for executada, o agente deverá informar:

- Estrutura antes
- Estrutura depois
- Arquivos movidos
- Arquivos criados
- Arquivos alterados
- Dependências alteradas
- Scripts alterados
- Testes executados
- Resultado do typecheck
- Resultado do build
- Problemas encontrados
- Problemas deliberadamente não corrigidos
- Próxima fase recomendada

---

## CONTEXTO ARQUITETURAL ATUAL

O projeto atualmente possui uma arquitetura:

```text
UI
↓
services
↓
repositories
↓
IndexedDB
```

Existe um composition root em:

`src/repositories/index.ts`

que foi projetado como ponto de troca para futuras implementações de repositories baseadas em API.

Existem atualmente acessos diretos ao Dexie em algumas páginas e services. Esses pontos deverão ser tratados durante fases posteriores da migração, e não devem ser arbitrariamente reescritos durante a criação desta especificação.

A aplicação possui regras importantes relacionadas a:

- associados ativos/inativos
- matrículas
- códigos de carteirinha
- identificadores permanentes
- usuários
- permissões
- assinatura oficial
- geração de carteirinhas
- auditoria
- factory reset

Essas regras são consideradas parte essencial do domínio e não devem ser perdidas durante a migração.

---

## REGRA FINAL

Este documento é uma **ESPECIFICAÇÃO**.

Criar este arquivo **NÃO** significa executar a Fase 0.

Uma execução futura da Fase 0 deverá fazer somente:

1. criar a estrutura de monorepo conforme a ARQUITETURA ALVO;
2. mover o frontend para `apps/web/` preservando tudo;
3. criar `packages/shared/` avaliando cuidadosamente o que mover;
4. ajustar scripts, caminhos de testes e configuração da Vercel apenas quando necessário;
5. validar conforme os CRITÉRIOS DE ACEITAÇÃO e a VALIDAÇÃO FUTURA;
6. emitir o RELATÓRIO FUTURO.

Nenhuma outra alteração além do escopo desta fase.
