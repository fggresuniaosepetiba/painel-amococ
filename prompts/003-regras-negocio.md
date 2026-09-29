# REGRAS DE NEGÓCIO — ESPECIFICAÇÃO COMPLETA DO PAINEL AMOCOC

> **Status:** DOCUMENTO DE REFERÊNCIA — regras extraídas do código-fonte em produção.
> **Público:** implementador do backend (o sócio), para as Fases 1 a 5 da migração.
> **Relação:** `001-migracao-monorepo.md` (Fase 0 — concluída) · `002-fase-1-api-prisma.md` (Fase 1 — API/estrutura) · **003 (este — as regras em si)**.
>
> Este documento descreve **o que o sistema faz hoje**. Toda regra listada aqui é
> considerada parte essencial do domínio e **não pode ser perdida, alterada ou
> "simplificada"** na migração para backend. Onde a regra deve passar a valer
> (servidor vs navegador) está indicado em §16.

---

## 0. COMO USAR ESTE DOCUMENTO

1. Leia primeiro o `002` (Fase 1) — é por onde se começa (estrutura do banco).
2. Use este `003` como **lista de verdades** durante toda a implementação do backend.
3. Ao implementar cada área, confira o **§14 (mensagens exatas)** e o **§17 (checklist inviolável)**.
4. O código-fonte é a autoridade máxima em caso de dúvida — §19 mapeia onde cada regra vive.

---

## 1. VISÃO GERAL

Painel administrativo da **AMOCOC — Associação de Moradores do Conjunto Otacílio Câmara**.

Funcionalidades: login/autorização · dashboard com dados reais · associados com matrícula
imutável · carteirinha com código único e assinatura oficial · usuários e permissões ·
configurações · auditoria completa · persistência local (IndexedDB).

**Credencial inicial:** login `amococ` / senha `123` (SUPERADMIN).

---

## 2. ARQUITETURA ATUAL E ALVO

**Hoje (em produção):**
```text
UI → services → repositories (composition root: apps/web/src/repositories/index.ts)
                     ↓
                IndexedDB (Dexie — amococ_db)
```

**Alvo (após Fase 4):**
```text
UI → services → repositories (ApiRepositories) → API → PostgreSQL
```

O ponto de troca já existe: `apps/web/src/repositories/index.ts`. Enquanto a Fase 4 não
ocorre, **o sistema continua 100% IndexedDB** — nenhum cliente consome a API antes disso.

---

## 3. ENTIDADES (MODELO DE DADOS)

Espelhar exatamente em `prisma/schema.prisma` (Fase 1). Fonte:
`packages/shared/src/types.ts` + `apps/web/src/db/database.ts` (Dexie v1+v2 — 6 tabelas).

| Entidade | Tabela | Campos essenciais |
|---|---|---|
| **User** | `users` | id, name, login, email, role, status, permissions[], salt, passwordHash, mustChangePassword, createdAt, updatedAt, lastLoginAt |
| **Member** | `members` | id, **membershipNumber** (6 díg., único), **cardCode** (único), fullName, cpf, birthDate (ISO), phone, whatsapp, cep, address, addressNumber, complement, district, city, state, photoDataUrl, notes, status, inactivatedAt, createdAt, updatedAt |
| **MembershipCardRecord** | `cards` | id, memberId, cardCode, membershipNumber, memberName, generatedAt, generatedByUserId, generatedByName, pngDataUrl, fileSizeBytes |
| **UsedIdentifier** | `usedIdentifiers` | **value (PK única)**, type (`membershipNumber`\|`cardCode`), usedAt, memberId, memberName |
| **AuditLog** | `auditLogs` | id, createdAt, userId (null permitido), userName, action, entity, entityId, details |
| **AppSettings** | `settings` | id fixo `"general"` → association{name, acronym, address, phone, email, information, customLogoDataUrl}, card{title, footerText, showCpf, showBirthDate, showPhone, showAddress, showIssueDate, signaturePlacement}, signature{presidentName, presidentTitle, imageDataUrl, mimeType, updatedAt}, security{lastPasswordChangeAt}, updatedAt |

Observações:
- `PublicUser` = User **sem** `salt`/`passwordHash` — credenciais **nunca** saem da API
  (nem hoje o frontend deveria expô-las).
- Datas em string ISO (`yyyy-mm-dd` para datas, ISO 8601 completo para data/hora).

---

## 4. ⚠️ REGRA CRÍTICA — IDENTIFICADORES PERMANENTES

Esta é a regra **mais importante** do sistema inteiro.

### 4.1 Matrícula (`membershipNumber`)

- Formato: **6 dígitos**, zero à esquerda — `/^\d{6}$/` — ex.: `000001`.
- Gerada automaticamente: `próxima = max(membros existentes ∪ usedIdentifiers[type=membershipNumber]) + 1`.
- **Imutável:** nunca editável depois de criada (o formulário de edição mostra travada).
- **Única:** checagem em `isMembershipNumberTaken` → erro `MEMBERSHIP_NUMBER_TAKEN`.
- **Nunca reutilizada:** a matrícula de um associado **excluído definitivamente** continua
  contando como usada para sempre (ver §4.3).

### 4.2 Código da carteirinha (`cardCode`)

- Formato: **`AMOCOC-00001-A8ZK`** → `AMOCOC` + **sequencial de 5 dígitos** (últimos 5
  dígitos da matrícula: `membershipNumber.slice(-5)`) + sufixo alfanumérico.
- Sufixo: 4 caracteres do alfabeto **`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`**
  (sem `I`, `O`, `0`, `1` — sem caracteres ambíguos).
- Geração: **criptograficamente segura** (`crypto.getRandomValues` — nunca `Math.random`).
- Colisão: checa `isCardCodeTaken` (membros + usedIdentifiers) com até **50 tentativas**;
  se colidir, estende o sufixo para **6 caracteres**; se ainda assim falhar →
  erro `CARD_CODE_GENERATION_FAILED`.
- Validação de formato: `/^AMOCOC-\d{5}-[A-Z2-9]{4,6}$/`.
- **Único, imutável, nunca reutilizado** — permanece vinculado ao associado mesmo
  inativo, e **sobrevive à exclusão definitiva** via `usedIdentifiers`.

### 4.3 `usedIdentifiers` — a reserva permanente

- Tabela de **nunca apagar**. Cada matrícula e cada código já emitidos ficam registrados
  para sempre (valor, tipo, data, associado da época).
- A criação do associado registra **os dois identificadores na mesma transação** em que o
  membro é criado.
- Exclusão definitiva do associado **não remove** nada de `usedIdentifiers`.
- **No backend:** isto vira restrição de banco (UNIQUE) + lógica de geração no servidor.
  É **obrigatório** implementar geração de matrícula/código no servidor na Fase 2
  (hoje é client-side — falha de segurança conhecida, §15).

---

## 5. CICLO DE VIDA DO ASSOCIADO

```text
criação → ATIVO (inactivatedAt: null)
ATIVO   → visualizar · editar · inativar          ✗ NÃO pode excluir
INATIVO → visualizar · reativar · excluir         ✓ exclusão somente de inativos
inativar  → status=INATIVO + inactivatedAt=agora   (move para aba INATIVOS)
reativar  → status=ATIVO + inactivatedAt=null      (PRESERVA id, matrícula e código)
excluir   → PERMANENTE — modal de confirmação digitando o NOME do associado
```

- Um associado **nasce ATIVO**.
- Exclusão de ATIVO é bloqueada **também no service** (não só na UI) — a regra vale
  mesmo que a interface seja contornada. Mensagem exata em §14.
- A exclusão é **definitiva**: não existe "lixeira"/restauração.
- Listas: abas separadas **ATIVOS** (ordem alfabética) e **INATIVOS**; a ordenação e a
  coluna "Tamanho" têm comportamento verificado por teste (`verify-order.mjs`).

---

## 6. USUÁRIOS, PAPÉIS E PERMISSÕES

### 6.1 Papéis (`role`)

| Papel | Observação |
|---|---|
| `SUPERADMIN` | **Bypass total** — ignora a matriz de permissões, acessa tudo |
| `ADMINISTRADOR` | Permissões concedidas individualmente |
| `COLABORADOR` | Permissões concedidas individualmente |

`status` do usuário: `ATIVO` | `INATIVO`. **Usuário INATIVO não autentica**
(`authService` exige `status === "ATIVO"`).

### 6.2 As 18 permissões (6 grupos)

Fonte: `packages/shared/src/permissions.ts` (`ALL_PERMISSIONS`).

| Grupo | Permissões |
|---|---|
| Dashboard | `dashboard.view` |
| Associados | `members.view` · `members.create` · `members.edit` · `members.inactivate` · `members.reactivate` · `members.delete` |
| Carteirinhas | `cards.view` · `cards.generate` · `cards.download` |
| Usuários | `users.view` · `users.create` · `users.edit` · `users.inactivate` · `users.permissions` |
| Configurações | `settings.view` · `settings.edit` |
| Auditoria | `audit.view` |

- Permissões ficam no **array do usuário** (`User.permissions`).
- A autorização hoje é **100% client-side** (hooks/guards) — na Fase 5 passa a ser
  **validada no servidor** em todo endpoint (não basta esconder botões).
- Troca de permissão gera auditoria `PERMISSION_CHANGED`.

### 6.3 Criação e senhas

- Na criação, o administrador define a **senha inicial** (`initialPassword`); é hashada
  (hoje SHA-256 + salt individual — ver §15) e `mustChangePassword: false`.
- O administrador pode **redefinir** senha de qualquer usuário → auditoria
  `PASSWORD_CHANGED` (details: `Senha redefinida pelo administrador para "<login>"`).
- Troca de senha própria valida a senha atual (mensagem exata em §14).

---

## 7. AUTENTICAÇÃO E SESSÃO (LGPD)

Regras **obrigatórias** a reproduzir no backend (Fase 5):

1. Sessão vive **somente em `sessionStorage`** — fechar a aba = logout imediato.
   **Nunca** persistir token/sessão em `localStorage`.
2. **Inatividade de 15 minutos** (`IDLE_TIMEOUT_MINUTES = 15`, checagem a cada 1s)
   encerra a sessão automaticamente; qualquer atividade reinicia a contagem.
3. Ao expirar por inatividade, um aviso é exibido na tela de login (flag gravada para a tela).
4. `LOGIN` e `LOGOUT` geram eventos de auditoria.
5. Falha de autenticação → mensagem única (§14), **sem** dizer qual dos dois campos errou.
6. `SessionInfo`: userId, issuedAt, expiresAt.
7. Hoje **não existe bloqueio por tentativas de login** — na Fase 5, avaliar rate-limit/
   lockout no servidor (decisão de implementação, não quebra de regra existente).

---

## 8. CARTEIRINHA

### 8.1 Especificações técnicas (invioláveis)

- Dimensão: **600 × 378 px lógicos**.
- Exportação: **PNG** com **pixelRatio 3** (1800 × 1134 físico), via `html-to-image`.
- Nome do arquivo: **`AMOCOC-00001-A8ZK-NOME-DO-ASSOCIADO.png`** — nome normalizado:
  sem acentos (NFD), MAIUSCULAS, não-alfanuméricos → `-`, sem `-` nas pontas, máx. 80
  chars, fallback `ASSOCIADO`.
- **Sem QR Code.** **Sem integração WhatsApp.** (nunca incluir)
- A geração registra `MembershipCardRecord` + auditoria `CARD_GENERATED`;
  o download gera `CARD_DOWNLOADED`.
- Conteúdo configurável (`CardSettings`): título, rodapé, mostrar CPF/nascimento/telefone/
  endereço/data de emissão — e **mostra o WhatsApp, não o telefone** na carteirinha.
- Nascimento exibido em formato **brasileiro dd/mm/aaaa** (nunca trocar dia ↔ mês).
- Diálogo de geração: prévia com rolagem, zoom com "mãozinha" (`cursor: grab`) e arrasto.

### 8.2 Assinatura oficial — OBRIGATÓRIA

Se a assinatura do Presidente não estiver cadastrada, a geração é **bloqueada**:

- Título: **`Assinatura oficial necessária`**
- Corpo: **`Não é possível gerar a carteirinha porque a assinatura oficial do Presidente ainda não foi cadastrada.`**
- Botão: **`Ir para Configurações`** → navega para `/configuracoes/assinatura`.

Quando há assinatura, ela entra **automaticamente** na carteirinha (sem controle manual):
alerta de sucesso **`CARTEIRINHA GERADA COM SUCESSO`** com
`Código <code> · Matrícula <n>. A assinatura oficial foi inserida automaticamente.`

### 8.3 Posição da assinatura

- `signaturePlacement {x, y, width}` em px lógicos (0–600 / 0–378), largura define altura
  preservando proporção; `null` = **posição padrão**: colada na linha de assinatura, à
  direita.
- O usuário pode arrastar/ajustar; há botão "limpar" que restaura o padrão.

---

## 9. ASSINATURA OFICIAL (CONFIGURAÇÃO)

- Campos: `presidentName`, `presidentTitle`, `imageDataUrl`, `mimeType`, `updatedAt`.
- Aceita **PNG e JPEG**; transparência do PNG preservada, fundo branco mantido.
- Trocar assinatura → auditoria `SIGNATURE_UPDATED`.
- **Seed de produção:** a assinatura oficial já nasce cadastrada a partir do asset
  `public/assets/images/assinatura-leo.png` — o presidente não precisa cadastrar nada
  no primeiro acesso.

---

## 10. CONFIGURAÇÕES

- Registro único (`id: "general"`): `association`, `card`, `signature`, `security`.
- Exigem permissão `settings.view`/`settings.edit`; alterações → `SETTINGS_UPDATED`.
- `association.customLogoDataUrl` substitui o logo padrão quando presente.

---

## 11. AUDITORIA — OS 18 EVENTOS

Fonte: `AuditAction` em `packages/shared/src/types.ts`. **Nenhum pode ser removido.**

| # | Evento | Quando |
|---|---|---|
| 1 | `LOGIN` | autenticação bem-sucedida |
| 2 | `LOGOUT` | saída (manual ou inatividade) |
| 3 | `MEMBER_CREATED` | criação de associado |
| 4 | `MEMBER_UPDATED` | edição de associado |
| 5 | `MEMBER_INACTIVATED` | inativação |
| 6 | `MEMBER_REACTIVATED` | reativação |
| 7 | `MEMBER_DELETED` | exclusão definitiva |
| 8 | `CARD_GENERATED` | geração de carteirinha |
| 9 | `CARD_DOWNLOADED` | download de carteirinha |
| 10 | `USER_CREATED` | criação de usuário |
| 11 | `USER_UPDATED` | edição de usuário |
| 12 | `USER_INACTIVATED` | inativação de usuário |
| 13 | `USER_REACTIVATED` | reativação de usuário |
| 14 | `PERMISSION_CHANGED` | troca de permissões |
| 15 | `SETTINGS_UPDATED` | alteração de configurações |
| 16 | `SIGNATURE_UPDATED` | troca de assinatura |
| 17 | `PASSWORD_CHANGED` | troca/redefinição de senha |
| 18 | `SYSTEM_FACTORY_RESET` | LIMPAR sistema |

- `AuditLog`: quem (userId/userName — `userId` pode ser null), o quê (action), onde
  (entity/entityId), detalhe livre (details), quando (createdAt).
- Exibição em **ordem decrescente por data**.
- Na Fase 5 o registro passa a ser feito **no servidor** (client-side não é confiável).

---

## 12. SEED, ESTADO INICIAL E FACTORY RESET

### 12.1 Produção (primeira utilização)

- SuperAdmin inicial: **login `amococ` / senha `123`**, papel SUPERADMIN.
- Assinatura oficial **já cadastrada** (asset oficial).
- **Zero** associados, carteirinhas, usuários extras e auditoria
  (primeiro evento só aparece após o 1º LOGIN).
- Verificação automatizada: `scripts/verify-deploy-clean.mjs` (8 checagens).

### 12.2 Desenvolvimento (assimétrico de propósito)

- Nasce com dados de demonstração (Ana Souza, João da Silva, Maria Oliveira, Carlos
  Santos…) e **sem** assinatura — para os testes E2E exercitarem o bloqueio.

### 12.3 LIMPAR (factory reset)

- Restaura **exatamente** o estado de primeira utilização de produção, em **qualquer
  ambiente**: `users=1` (amococ/123), `settings=1` (com assinatura oficial), demais
  tabelas **zeradas**.
- A demonstração **NÃO volta**.
- Auditoria zerada; gera `SYSTEM_FACTORY_RESET`.
- Regra: **"fica zerada"** — nunca "volta ao demo".

---

## 13. VALIDAÇÕES E FORMATOS

| Campo | Regra |
|---|---|
| CPF | máscara + validação de dígito verificador (`isValidCpf`) |
| Data de nascimento | entrada BR `dd/mm/aaaa` → armazenamento ISO `yyyy-mm-dd`; exibição sempre BR |
| CEP | consulta ViaCEP com **campo bloqueado** durante a busca; erro não silencia |
| Telefone × WhatsApp | campos **separados**; carteirinha usa **WhatsApp** |
| Foto | apenas PNG/JPG/JPEG até **4 MB**, redimensionada antes de salvar (data URL) |
| Senha | hash + salt individual por usuário |
| Matrícula | `/^\d{6}$/` |
| Código | `/^AMOCOC-\d{5}-[A-Z2-9]{4,6}$/` |

---

## 14. MENSAGENS EXATAS (obrigatórias — copiar literalmente)

| Contexto | Mensagem |
|---|---|
| Login/senha inválidos | `Usuário ou senha incorretos. Verifique os dados e tente novamente.` |
| Excluir associado ATIVO | `Associados ativos não podem ser excluídos. Inative o associado primeiro.` |
| Bloqueio de assinatura (título) | `Assinatura oficial necessária` |
| Bloqueio de assinatura (corpo) | `Não é possível gerar a carteirinha porque a assinatura oficial do Presidente ainda não foi cadastrada.` |
| Botão do bloqueio | `Ir para Configurações` |
| Senha atual incorreta | `A senha atual está incorreta.` |
| Sucesso na geração | `CARTEIRINHA GERADA COM SUCESSO` |
| Erros internos | `MEMBERSHIP_NUMBER_TAKEN` · `CARD_CODE_GENERATION_FAILED` |

---

## 15. SEGURANÇA — ESTADO ATUAL VS. BACKEND

**Problemas conhecidos hoje (client-side, aceitos até a Fase 5):**

- senha com SHA-256 + salt (**não** adequado — backend usará bcrypt/argon2)
- permissões avaliadas só no navegador
- auditoria gravada só no navegador
- geração de matrícula/código no navegador
- dados sensíveis no bundle do frontend

**Diretriz:** a Fase 5 resolve isso **no servidor**. **NÃO** fazer "correções falsas"
só no frontend — é perda de tempo e cria sensação falsa de segurança.

---

## 16. MAPA: REGRA → FASE DE IMPLEMENTAÇÃO

| Regra | Hoje | Passa a valer no backend na |
|---|---|---|
| Estrutura API + banco + migrations | — | **Fase 1** (estrutura, health) |
| CRUD seguindo os contratos de `repositories/` | IndexedDB | **Fase 2** |
| Matrícula/código gerados **no servidor** | client | **Fase 2** (prioridade) |
| Exportação do IndexedDB + import idempotente | — | **Fase 3** |
| Frontend passa a consumir a API | repositories | **Fase 4** |
| Auth, sessão, autorização e auditoria server-side | client | **Fase 5** |
| Testes, CI/CD, Docker de produção, deploy da API | manual | **Fase 6** |

---

## 17. CHECKLIST — REGRAS INVIOLÁVEIS

- [ ] Matrícula: 6 dígitos, imutável, única, **nunca reutilizada** (nem após exclusão)
- [ ] Código: `AMOCOC-#####-XXXX`, imutável, único, **nunca reutilizado**, gerado com CSPRNG **no servidor**
- [ ] `usedIdentifiers` nunca é apagada
- [ ] Só INATIVOS podem ser excluídos; ATIVOS só inativam
- [ ] Reativação preserva id, matrícula e código
- [ ] Exclusão = definitiva (confirmação digitando o nome)
- [ ] SUPERADMIN ignora matriz de permissões; as 18 permissões existem por nome exato
- [ ] Sessão só em sessionStorage; logout ao fechar aba; idle 15 min
- [ ] Carteirinha 600×378, pixelRatio 3, PNG, **assinatura obrigatória**, sem QR, sem WhatsApp
- [ ] Nome do PNG: `CODIGO-NOME.png`
- [ ] Os 18 eventos de auditoria, em ordem decrescente
- [ ] Seed de produção = primeira utilização zerada; LIMPAR zera de verdade (demo não volta)
- [ ] Mensagens do §14 mantidas literalmente
- [ ] Frontend continua intocado até a Fase 4

---

## 18. LIMITES DO SISTEMA (o que NÃO existe)

Não implementar (não é pedido, é escopo fechado): financeiro/cobranças · QR Code ·
integração WhatsApp · multi-tenant/outras associações · app mobile · notificações ·
módulo de eleições/eventos · emissão de carteirinha física por terceiros.

---

## 19. MAPA DO CÓDIGO-FONTE (onde a regra vive)

| Regra | Arquivo |
|---|---|
| Permissões (18) | `packages/shared/src/permissions.ts` |
| Entidades + 18 eventos de auditoria | `packages/shared/src/types.ts` |
| Ciclo de vida/matrícula do associado | `apps/web/src/services/memberService.ts` |
| Matrícula (próxima/validação) | `apps/web/src/services/membershipNumberService.ts` + `repositories/indexeddb/MembersRepository.ts` |
| Código da carteirinha | `apps/web/src/services/membershipCardCodeService.ts` |
| Reserva permanente | `apps/web/src/services/usedIdentifiersService.ts` |
| Autenticação/sessão | `apps/web/src/services/authService.ts`, `sessionGuard.ts`, `hooks/AuthProvider.tsx` |
| Permissões/autorização | `apps/web/src/services/authorizationService.ts`, `routes/guards.tsx` |
| Carteirinha/assinatura | `apps/web/src/services/cardGenerationService.ts`, `signatureService.ts`, `features/cards/CardPreviewDialog.tsx` |
| Auditoria | `apps/web/src/services/auditService.ts` |
| Seed/factory reset | `apps/web/src/services/seedService.ts`, `systemService.ts` |
| Constantes (idle 15 min) | `apps/web/src/constants/index.ts` |
| Composition root (troca p/ API) | `apps/web/src/repositories/index.ts` |

---

## REGRA FINAL

Este documento é **referência de regras**, não ordem de execução. A execução de cada fase
segue a spec correspondente (`001`, `002`, …) mediante **pedido explícito do usuário**.
Nenhuma regra deste arquivo pode ser removida ou enfraquecida durante a migração; qualquer
dúvida sobre comportamento esperado deve ser resolvida consultando o código-fonte (§19)
ou perguntando antes de implementar.
