# Changelog — Modal de usuário: rodapé sempre visível e vocabulário `Perfil`

- `DialogForm` (`apps/web/src/components/ui/dialog.tsx`): wrapper de `<form>`
  com `flex min-h-0 flex-1 flex-col`. Um `<form>` plano quebrava a cadeia
  flex do `DialogContent`, o `flex-1` do `DialogBody` deixava de valer, a
  rolagem interna nunca ativava e o `DialogFooter` (Salvar) saía da tela em
  viewports baixos — corrigido também com `min-h-0` no `DialogBody`.
- Vocabulário de UI: campo e coluna de tabela passam a se chamar **Perfil**
  (era "Role"/"Função"); **Permissões** fica reservado para a matriz granular.
  Rótulos centralizados em `ROLE_LABELS` (`SuperAdmin`, `Administrador`,
  `Colaborador`). Atributos ARIA `role=` não foram alterados.
- Legibilidade: itens de mapas renomeados de `u` para `user` em
  `PermissionsPage` e `UsersPage` (`4d7b969`, 2 arquivos, +27/−27, sem
  mudança de comportamento; uma ocorrência esquecida foi pega pelo `tsc`).
- Validação: `tsc -b` e `vite build` limpos; fluxo de criação/edição de
  usuário conferido no navegador em viewport baixo.
