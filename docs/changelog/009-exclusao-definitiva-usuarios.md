# Changelog — Exclusão definitiva de usuários e área restrita ao SuperAdmin

- **Área de usuários exclusiva do SuperAdmin** (ADR-025): os menus **Usuários**
  e **Permissões** somem para Administrador/Colaborador
  (`AppLayout` com `superAdminOnly`), as rotas `/usuarios` e
  `/usuarios/permissoes` usam o novo `RequireSuperAdmin` e **todos** os
  endpoints de usuários passam a `requireAuth + requireSuperAdmin` (403
  `FORBIDDEN` para os demais perfis).
- **Permissões granulares de usuários removidas** de `Permission`,
  `ALL_PERMISSIONS` e `PERMISSION_GROUPS` (`users.view`, `users.create`,
  `users.edit`, `users.inactivate`, `users.permissions`): a matriz cai de
  **18 para 13** permissões e a tela Permissões passa a listar apenas os 5
  grupos restantes. Migration
  `20261022120000_remove_user_management_permissions` limpa os valores
  `users.*` já gravados em `users.permissions` (`db:deploy` no build do Render).
- **Exclusão definitiva** (`DELETE /api/users/:id` + `usersService.delete` +
  `usersRepository.delete` + `ApiUsersRepository.delete`):
  - somente para usuário **INATIVO** → `422 ACTIVE_USER_DELETE`
    ("Usuários ativos não podem ser excluídos. Inative o usuário primeiro.");
  - nunca o próprio usuário → `CANNOT_DELETE_SELF`;
  - apaga as sessões do usuário antes (`session.deleteMany`), preserva a
    auditoria histórica e registra `USER_DELETED` com nome, login, perfil e ID;
  - **sem restauração** — para voltar, criar um novo usuário.
- **Auditoria**: novo evento `USER_DELETED` em `AuditAction` (18 → 19), no
  espelho runtime (`apps/api/src/domain/audit-actions.ts`), no
  `ActionBadge` ("Usuário excluído", danger) e no filtro da página Auditoria.
- **Ciclo de vida em um único caminho**: `PATCH /api/users/:id` não aceita
  mais `status` (`userUpdateSchema` sem o campo), o service não grava status e
  o campo **Status** saiu do modal de edição; inativar/reativar continua em
  `POST /:id/status` (com auditoria dedicada e bloqueio de auto-inativação).
- **UI**: ação **Excluir definitivamente** no menu da linha (`Trash2`,
  variante danger), habilitada apenas para usuário INATIVO e diferente do
  logado, com `confirm` destrutivo ("Esta ação não pode ser desfeita…") e
  toasts específicos para `ACTIVE_USER_DELETE`/`CANNOT_DELETE_SELF`.
  Removidos os gates `hasPermission` da página (acesso já é exclusivo).
- Docs: README (13 permissões, regra de exclusão, evento `USER_DELETED`),
  `docs/decisions.md` (ADR-025 e contagens), `docs/roadmap.md` e comentários
  dos espelhos runtime.
- Validação: `pnpm -r typecheck` limpo; `pnpm --filter @amococ/api test`
  (matriz de autorização + novos testes de serviço) — 199 testes.
