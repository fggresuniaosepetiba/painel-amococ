# PAINEL AMOCOC — Sistema Administrativo

Painel administrativo profissional da **AMOCOC — Associação de Moradores do Conjunto Otacílio Câmara**.

Versão 1.0 — **front-end completo e funcional com persistência local**, construída para ser testada e aprovada pelo Presidente antes da implementação do backend real.

---

## 1. Objetivo

Oferecer gestão de:

- Login, autenticação, autorização, usuários e permissões
- Dashboard com dados reais
- Associados com **matrícula automática imutável**
- **Código de carteirinha** automático, único e imutável
- Geração de carteirinha com **assinatura oficial automática**
- Download da carteirinha em **PNG em alta resolução**
- Configurações (associação, carteirinha, assinatura, segurança, sistema)
- Auditoria completa de ações
- Persistência local real (sobrevive a reload, fechamento e reabertura do navegador)

---

## 2. Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | React 18 + TypeScript |
| Build | Vite |
| Estilos | Tailwind CSS + design system próprio |
| Ícones | Lucide React |
| Rotas | React Router v6 (rotas protegidas) |
| Formulários | React Hook Form + Zod |
| Persistência | IndexedDB via Dexie |
| Exportação PNG | html-to-image |
| Fonte | Inter (local, via @fontsource) |

---

### Estrutura do repositório (monorepo pnpm — Fase 0)

O projeto é um monorepo com pnpm workspaces (configurado em `pnpm-workspace.yaml`):

```text
painel-amococ/
├── apps/web/           # frontend atual (React + Vite) → build em apps/web/dist
├── packages/shared/    # contratos compartilhados: tipos e permissões de domínio
├── scripts/            # bateria de testes Playwright (rodam da raiz)
├── package.json        # scripts raiz: pnpm dev / build / typecheck / test
├── pnpm-workspace.yaml # definição dos workspaces
├── tsconfig.base.json  # opções TypeScript comuns (strict)
└── vercel.json         # build do monorepo + fallback SPA no Vercel
```

O backend (Express/PostgreSQL) foi criado em `apps/api` na Fase 1 — hoje expõe **somente** `GET /api/health`. A persistência do frontend continua 100% em IndexedDB até a Fase 4.

---

## Backend local (Fase 1 — API + PostgreSQL)

Pré-requisito: Docker rodando. Copie as variáveis e suba o banco:

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d
pnpm db:migrate
pnpm dev:api
```

- API em `http://localhost:3000` · health em `GET /api/health` (`200 connected` / `503 disconnected` sem banco).
- Frontend segue em `pnpm dev` (`http://localhost:5173`) e **não consome a API** nesta fase.
- Produção (Neon): trocar **apenas** a `DATABASE_URL` no ambiente e rodar `pnpm --filter @amococ/api db:deploy`.

---

## 3. Instalação e execução

```bash
cd C:\painel-amococ

pnpm install

pnpm dev
```

Abra o navegador em `http://localhost:5173`.

Build de produção:

```bash
pnpm build     # gera apps/web/dist
pnpm preview   # serve o build
```

> **Deploy (ação manual sua):** suba o conteúdo da pasta `apps/web/dist/` no servidor/hospedagem estática. O cliente recebe o sistema em **estado de primeira utilização** (§13): SuperAdmin `amococ`/`123` + assinatura oficial já cadastrada e **sem nenhum associado, identificador utilizado, carteirinha ou dado de demonstração**. Verifique antes com `node scripts/verify-deploy-clean.mjs`. **No Vercel**, o `vercel.json` da raiz já aponta `installCommand`/`buildCommand`/`outputDirectory` para o monorepo (`apps/web/dist`) e mantém o fallback SPA (deep links como `https://painel-amococ.vercel.app/login` e o F5 em qualquer tela **não dão 404**); há cópias de segurança em `apps/web/vercel.json` (caso o *Root Directory* do projeto seja ajustado para `apps/web`) e em `apps/web/public/vercel.json` (deploy manual do dist).

> A aplicação roda **100% local**, sem domínio, sem hospedagem e sem backend remoto.

---

## 4. Credencial inicial

Quando o banco local está vazio, o sistema cria automaticamente o primeiro usuário:

| Campo | Valor |
| --- | --- |
| **Login** | `amococ` |
| **Senha** | `123` |
| **Role** | SUPERADMIN |

A senha pode (e deve) ser alterada pelo SuperAdmin em:

**Configurações → Segurança → Alterar minha senha**

---

## 5. Persistência local

- Banco: **IndexedDB**, database `amococ_db` (Dexie, schema na **versão 2**)
- Tabelas: `users`, `members`, `cards`, `settings`, `audit`, `usedIdentifiers`
- Índices únicos em `login`, `membershipNumber` e `cardCode`
- `usedIdentifiers` (v2): reserva **permanente** de matrículas e códigos já emitidos — sobrevive à exclusão definitiva do associado e garante que nenhum identificador usado volte a ser gerado
- Os dados permanecem após recarregar a página, fechar o navegador e reiniciar o computador

> Para "zerar" o sistema, use **Configurações → Sistema → Limpar base de dados** (Somente SUPERADMIN): apaga todos os dados locais e restaura o estado de **primeira utilização** — usuário `amococ` / `123`, configurações padrão e (em produção) a assinatura oficial. **Os dados de demonstração NÃO voltam** — "LIMPAR" zera de verdade, em qualquer ambiente — e a sessão é encerrada. Alternativa técnica: apague o banco `amococ_db` pelo DevTools (Application → IndexedDB).

---

## 6. Arquitetura (preparada para backend)

```
React (components/pages)
        ↓
   services  (regras de negócio, autorização, auditoria)
        ↓
 repositories (interfaces)
        ↓
 IndexedDb*Repository  →  futuro: Api*Repository
        ↓
   IndexedDB / futuro backend + banco de dados
```

- A UI **nunca** acessa o IndexedDB diretamente para escrita — tudo passa pelos services.
- Cada repositório implementa uma interface (`MembersRepository`, `UsersRepository`, `CardsRepository`, `SettingsRepository`, `AuditRepository`, `UsedIdentifiersRepository`) em `src/repositories/types.ts`.
- Para migrar para backend, basta criar implementações `Api*Repository` e trocar as instâncias em `src/repositories/index.ts` (composition root). **Nenhum componente precisa mudar.**

### Serviços

| Service | Responsabilidade |
| --- | --- |
| `authService` | login, sessão, logout, alteração de senha |
| `authorizationService` | permissões granulares (camada única) |
| `membershipNumberService` | regra da matrícula (isolada) |
| `membershipCardCodeService` | regra do código da carteirinha + anti-colisão |
| `memberService` | ciclo de vida do associado (criar, editar, inativar, reativar, excluir) com imutabilidades |
| `userService` | usuários, papéis, permissões, reset de senha |
| `settingsService` | configurações gerais |
| `signatureService` | assinatura oficial do Presidente |
| `cardGenerationService` | fluxo de geração + exportação PNG |
| `auditService` | registro de auditoria (nunca grava senhas) |
| `imageService` | validação/redimensionamento/recorte de imagens |
| `cepService` | consulta de CEP (ViaCEP) |
| `systemService` | manutenção do banco local (limpeza/restauração de fábrica) |
| `usedIdentifiersService` | reserva permanente de identificadores (nunca reutilizados, mesmo após exclusão) |
| `sessionGuard` | **guarda de sessão (LGPD)**: logout automático após 15 minutos de inatividade |

---

## 7. Regras de matrícula

- Gerada **automaticamente** (sequencial de 6 dígitos: `000001`, `000002`…)
- **Única, pessoal e imutável**
- Não pode ser editada pelo formulário (campo bloqueado com cadeado)
- **Nunca é reutilizada** — nem por outro associado, nem após a exclusão definitiva do titular (fica registrada para sempre em `usedIdentifiers`)
- Permanece associada ao associado **mesmo após inativação**
- Toda a regra está isolada em `src/services/membershipNumberService.ts`

## 8. Regras do código da carteirinha

Padrão: **`AMOCOC-00001-A8ZK`** (prefixo + sequencial de 5 dígitos + sufixo alfanumérico)

- Único, gerado automaticamente, exibido bloqueado
- **Nunca editado nem reutilizado** — inclusive após a exclusão definitiva do titular (reserva permanente `usedIdentifiers`)
- Unicidade garantida por **índice único no banco** + **checagem de colisão** (associados existentes **e** identificadores já reservados) com regeneração do sufixo
- Alfabeto sem caracteres ambíguos (sem I, O, 0, 1)
- Permanece vinculado ao associado inativo; códigos históricos nunca são apagados
- Toda a regra está isolada em `src/services/membershipCardCodeService.ts`

### Identificadores (não confundir)

| Identificador | Exemplo | Natureza |
| --- | --- | --- |
| ID interno | UUID | chave técnica |
| Matrícula | `000001` | administrativa, imutável |
| Código da carteirinha | `AMOCOC-00001-A8ZK` | documento, imutável |

---

## 9. Assinatura oficial

- Cadastrada em **Configurações → Assinatura** (upload PNG/JPG/JPEG, transparência preservada)
- **Fluxo em rascunho**: enviar a imagem → a **prévia da carteirinha aparece na hora** na mesma página → arrastar/redimensionar a assinatura na prévia → clicar em **Salvar assinatura**. Enquanto não salvar, **nada é aplicado** (nem a imagem, nem a posição — sair da página descarta o rascunho)
- Selo de estado: `RASCUNHO — NÃO SALVO` / `ASSINATURA CONFIGURADA` / `ASSINATURA NÃO CONFIGURADA`
- O arquivo é **recortado automaticamente** (fundo branco/transparente removido) para a tinta ficar encostada na linha de assinatura mesmo com muito espaço em branco no arquivo enviado
- Posição padrão: colada na linha de assinatura, à direita; botão "Restaurar posição padrão" volta ao padrão; dentro da carteirinha gerada a assinatura **não** pode ser editada
- **Sem assinatura salva, a geração é bloqueada** com mensagem amigável e atalho "Ir para Configurações"

---

## 10. Usuários e permissões

- Roles: `SUPERADMIN` (acesso total, ignorado pelas permissões), `ADMINISTRADOR`, `COLABORADOR`
- Status `ATIVO`/`INATIVO` — usuário inativo **não consegue logar**
- Permissões granulares (18), gerenciadas em **Usuários → Permissões**:

```
dashboard.view
members.view | members.create | members.edit | members.inactivate
members.reactivate | members.delete
cards.view | cards.generate | cards.download
users.view | users.create | users.edit | users.inactivate | users.permissions
settings.view | settings.edit
audit.view
```

- A autorização é validada em **rotas, componentes e services** (`authorizationService`) — não apenas escondendo botões.
- Para **excluir** um associado são necessárias **duas condições**: a permissão `members.delete` **e** o associado estar **INATIVO**. A regra de status é validada no service e **prevalece sobre a permissão**.

---

## 11. Auditoria

Eventos registrados: `LOGIN`, `LOGOUT`, `MEMBER_CREATED`, `MEMBER_UPDATED`, `MEMBER_INACTIVATED`, `MEMBER_REACTIVATED`, `MEMBER_DELETED`, `CARD_GENERATED`, `CARD_DOWNLOADED`, `USER_CREATED`, `USER_UPDATED`, `USER_INACTIVATED`, `USER_REACTIVATED`, `PERMISSION_CHANGED`, `SETTINGS_UPDATED`, `SIGNATURE_UPDATED`, `PASSWORD_CHANGED`, `SYSTEM_FACTORY_RESET`.

Cada registro guarda: usuário, data/hora, ação, entidade, ID e detalhes.

> **Senhas nunca são registradas em auditoria.**

---

## 12. Geração e download de PNG

Fluxo:

```
Associado → Gerar Carteirinha → validar dados → matrícula → código
→ foto → assinatura oficial → renderizar → preview → baixar PNG
```

- Resolução: renderização lógica 600×378 px exportada com `pixelRatio: 3` (≈ 1800×1134 px)
- Nome do arquivo: `AMOCOC-00001-A8ZK-NOME-DO-ASSOCIADO.png` (caracteres invalidos removidos)
- Diálogo de resultado: a carteirinha aparece **inteira** e a área **rola para cima e para baixo** quando o espaço não basta; o botão **Visualizar** amplia (1,25×) e ativa a **mãozinha** — arraste para mover a carteirinha ampliada e role para percorrer (dica na tela); **Reduzir** volta ao normal. O mesmo vale ao visualizar carteirinhas já emitidas em Carteirinhas → Visualizar
- Não existe integração com WhatsApp: o usuário baixa o PNG e envia manualmente

---

## 13. Seed (primeira execução)

Quando o banco está vazio, o sistema nasce em **estado de primeira utilização** — é exatamente o que o cliente recebe no deploy de produção:

- SuperAdmin `amococ` / `123`
- Configurações padrão
- **Assinatura oficial já cadastrada** (somente em produção): o asset `public/assets/images/assinatura-leo.png` é aplicado automaticamente com o mesmo processamento do envio pela tela (`resizeSignature` 700 px preservando transparência). O presidente não precisa importar nada — e pode **trocar, arrastar/reposicionar ou remover** em Configurações → Assinatura
- **Nada mais**: nenhum associado, nenhum identificador (matrícula/código) utilizado, nenhuma carteirinha emitida e nenhum registro fictício de auditoria — a primeira matrícula real será `000001` e o Dashboard nasce zerado

Somente em **desenvolvimento** (`import.meta.env.DEV`), o seed também cria os dados de demonstração usados pelas suítes de teste e revisão visual:

- Associados fictícios: **João da Silva, Maria Oliveira, Carlos Santos, Ana Souza** (ativos e inativos)
- Códigos de exemplo: `AMOCOC-00001-A8ZK`, `AMOCOC-00002-Q7LP`, `AMOCOC-00003-M4XT`, `AMOCOC-00004-X9PL`
- Carteirinhas e registros de auditoria de demonstração
- Assinatura oficial nasce **vazia** em desenvolvimento (os testes cobrem o bloqueio de geração e o fluxo de envio pela tela)
- O botão **LIMPAR** (Configurações → Sistema) restaura somente o estado base em qualquer ambiente — a demonstração **não é recriada**

---

## 14. Segurança local (limitações)

Esta versão usa **persistência e autenticação locais** para prototipagem:

- Senhas armazenadas com hash SHA-256 + salt por usuário (nunca em texto puro)
- **REGRA OBRIGATÓRIA (LGPD) — sessão por aba (`sessionStorage`): fechar a aba encerra a sessão** e a próxima abertura exige login novamente. Sessões antigas em `localStorage` são descartadas no boot.
- **REGRA OBRIGATÓRIA (LGPD) — 15 minutos de inatividade → logout automático**: qualquer atividade (mouse, ponteiro, teclado, rolagem ou toque) reinicia a contagem; ao expirar, o sistema registra `LOGOUT` na auditoria, encerra a sessão e exibe na tela de login o aviso **"Sessão encerrada por inatividade."** explicando o limite de 15 minutos. Abas em segundo plano são avaliadas imediatamente ao voltarem a ficar visíveis (`visibilitychange`), mesmo com timers reduzidos pelo navegador.
- Teto absoluto de 7 dias por sessão (expiração máxima, mesmo com atividade contínua)
- Inputs validados (Zod) e dados sanitizados; sem `dangerouslySetInnerHTML`
- Senhas não exibidas, não espalhadas nem registradas em auditoria

**A versão de produção terá backend com autenticação e autorização validadas no servidor** (hash forte — Argon2/bcrypt — e sessões/JWT controlados pelo servidor).

---

## 15. Não implementado (fase atual)

Financeiro, mensalidades, cobranças, pagamentos, inadimplência, WhatsApp/QR Code/validação pública, backend remoto, banco remoto, domínio e hospedagem — apenas a arquitetura está preparada para expansões futuras.

---

## 16. Rotas

```
/login
/dashboard
/associados
/associados/novo
/associados/:id
/associados/:id/editar
/carteirinhas
/usuarios
/usuarios/permissoes
/configuracoes/associacao
/configuracoes/carteirinha
/configuracoes/assinatura
/configuracoes/seguranca
/configuracoes/sistema
/auditoria
```

Todas as rotas internas exigem login; cada área exige a permissão correspondente.

## 17. Testes e verificação (opcional)

Com o servidor de desenvolvimento rodando (`pnpm dev`, outra janela), as 5 suítes principais rodam de uma vez com **`pnpm test`** (e o deploy limpo com **`pnpm test:deploy`**, após `pnpm build`). Individualmente:

```bash
# Suíte E2E completa (22 verificações de aceite via Playwright)
node scripts/e2e-test.mjs

# Ordenação das listas por aba (ativos/inativos) e coluna "Tamanho"
node scripts/verify-order.mjs

# 7 testes OBRIGATÓRIOS do ciclo de vida do associado: nasce ATIVO e
# aparece só em ATIVOS; exclusão de ATIVO bloqueada (UI + serviço, com a
# mensagem exata); inativar move entre as abas; reativar preserva
# matrícula/código; exclusão definitiva com modal + digitação do nome;
# identificadores excluídos nunca reutilizados; auditoria dos 3 eventos
node scripts/test-members.mjs

# 6 testes OBRIGATÓRIOS de segurança de sessão (LGPD): regra de 15 min
# registrada; sessão vive só em sessionStorage (nunca localStorage);
# reload mantém a sessão; fechar a aba exige novo login; atividade
# reinicia a contagem; inatividade → logout automático + aviso no /login
node scripts/test-security.mjs

# Deploy limpo (auto-contido: usa o build em apps/web/dist, sobe o `vite preview`
# na 4173 se necessário e verifica a PRIMEIRA UTILIZAÇÃO do cliente)
# — zero associados/identificadores/carteirinhas/auditoria, SuperAdmin
# + assinatura oficial prontos, abas (0)/(0) e screenshot de revisão
node scripts/verify-deploy-clean.mjs

# Recursos do formulário e da carteirinha (máscaras, CEP com bloqueio,
# data, WhatsApp, rascunho+prévia de assinatura, rolagem/mãozinha do
# diálogo de geração, limpeza da base) — 43 verificações
node scripts/verify-features.mjs

# Medições de layout da carteirinha (sobreposições, assinatura na linha)
node scripts/measure-card.mjs

# Captura as screenshots de revisão visual em scripts/shots/
node scripts/screenshots.mjs

# Screenshot do fluxo de rascunho + prévia arrastável (Configurações → Assinatura)
node scripts/shot-preview.mjs

# Screenshots do diálogo de geração: normal e ampliado com a mãozinha (pan)
node scripts/shot-dialog.mjs

# Screenshots da tela ASSOCIADOS: abas ATIVOS/INATIVOS e modal de exclusão
node scripts/shot-members.mjs
```

A suíte E2E cobre o checklist manual: login, dashboard, matrícula/código automáticos e imutáveis, bloqueio de geração sem assinatura, upload da assinatura, geração e download do PNG, usuários, permissões, bloqueio de login de usuário inativo, auditoria, troca de senha e persistência após reload (incluindo a separação por status: inativado só aparece na aba INATIVOS). Cada execução usa um banco IndexedDB efêmero (contexto novo do Playwright), então o estado da aplicação no navegador normal não é afetado.

## 18. Formulário de associado (recursos)

- **CEP com autocompletar** — ao sair do campo com 8 dígitos, o endereço (logradouro, bairro, cidade, estado) é consultado na API pública **ViaCEP** e preenchido automaticamente, e esses campos vêm **bloqueados (read-only)** com selo "Bloqueado (ViaCEP)" — apenas **Número** e **Complemento** permanecem editáveis. Alterar o CEP destrava os campos novamente. Se o CEP não for encontrado ou a consulta falhar (sem internet, timeout), um aviso aparece e todos os campos permanecem editáveis para digitação manual. A consulta de CEP é a única chamada externa da aplicação e requer conexão com a internet.
- **Data de nascimento** — máscara `dd/mm/aaaa` com apenas dígitos: o ano trava em exatamente 4 posições e o backspace apaga dígito a dígito (ex.: `1998` → apagar o `8` → `1997`). O valor é validado como data real e armazenado em ISO (`yyyy-mm-dd`) **sem conversão de fuso** — a exibição em detalhe e carteirinha usa o dia correto (ex.: `05/02/1997` nunca vira `04/02/1997`).
- **WhatsApp** — máscara com ponto após o 9 no celular: `(21) 9.7493-4685`. Fixos mantêm `(00) 0000-0000`. A **carteirinha exibe o WhatsApp** (não o telefone), com fallback para o telefone quando não houver WhatsApp; o toggle correspondente em Configurações → Carteirinha se chama "Exibir WhatsApp".
- **Carteirinha** — assinatura oficial inserida automaticamente, recortada do fundo, maior e ancorada sobre a linha de assinatura; o código da carteirinha com selo de validade vive no rodapé-esquerdo. Tamanho e posição da assinatura são definidos arrastando na prévia de **Configurações → Assinatura** (coordenadas em px lógicos 600×378, persistidas em `cardSettings.signaturePlacement`; `null` = posição padrão) e só valem depois de **Salvar assinatura**.

---

## 19. Ciclo de vida dos associados (ATIVOS / INATIVOS)

A tela **Associados** possui duas abas reais, com contadores dinâmicos calculados a partir dos dados:

| Aba | Ações disponíveis |
| --- | --- |
| **ATIVOS** | Visualizar, Editar, Gerar carteirinha, Baixar carteirinha, **Inativar** — **não existe exclusão** |
| **INATIVOS** | Visualizar, **Reativar**, **Excluir** (permissão `members.delete`) |

- A busca (nome, matrícula, código, CPF, telefone, cidade) filtra **somente dentro da aba selecionada**; a aba INATIVOS exibe as colunas **Cadastro** e **Inativação**.
- **Inativar** — confirmação obrigatória: "Você deseja inativar este associado?" + "O associado será movido para a lista de inativos. Seus dados, matrícula e código de carteirinha serão preservados e ele poderá ser reativado posteriormente." → toast **"Associado inativado com sucesso."** O registro recebe `inactivatedAt` e nada é apagado.
- **Reativar** — "Reativar associado?" + "O associado voltará para a lista de ativos e continuará utilizando a mesma matrícula e o mesmo código de carteirinha." → toast **"Associado reativado com sucesso."** Mesmo ID, mesma matrícula, mesmo código, todo o histórico; **nenhuma carteirinha nova é gerada**.
- **Excluir** — permitido **somente** para status INATIVO e exige a permissão `members.delete`. O modal exibe "Esta ação é definitiva.", "O associado precisa estar inativo para ser excluído." e "A matrícula e o código da carteirinha utilizados por este associado nunca poderão ser reutilizados.", e o botão **EXCLUIR DEFINITIVAMENTE** só habilita após **digitar o nome exato do associado**. Toast final: **"Associado excluído definitivamente."**
- Tentativa de excluir um ATIVO é bloqueada na **camada de serviço** (`memberService.delete`), com a mensagem exata: **"Associados ativos não podem ser excluídos. Inative o associado primeiro."** — a regra de status prevalece sobre a permissão e a interface nem oferece o botão para ativos.
- Após a exclusão, a matrícula e o código **nunca voltam a ser gerados**: permanecem para sempre em `usedIdentifiers` (a próxima matrícula pula o valor excluído) e a exclusão remove também as carteirinhas do titular (o histórico permanece na auditoria `CARD_GENERATED`/`MEMBER_DELETED`). Excluídos não contam em nenhum indicador do Dashboard.
- Auditoria do fluxo: `MEMBER_INACTIVATED`, `MEMBER_REACTIVATED` e `MEMBER_DELETED`, sempre com responsável, data/hora, ID, nome, matrícula e código (nunca senhas).
- Os 7 testes obrigatórios do fluxo ficam em `node scripts/test-members.mjs`.
