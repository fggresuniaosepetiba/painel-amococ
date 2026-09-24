/** Tipo de permissão granular do sistema. */
export type Permission =
  | "dashboard.view"
  | "members.view"
  | "members.create"
  | "members.edit"
  | "members.inactivate"
  | "members.reactivate"
  | "members.delete"
  | "cards.view"
  | "cards.generate"
  | "cards.download"
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.inactivate"
  | "users.permissions"
  | "settings.view"
  | "settings.edit"
  | "audit.view";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "members.view",
  "members.create",
  "members.edit",
  "members.inactivate",
  "members.reactivate",
  "members.delete",
  "cards.view",
  "cards.generate",
  "cards.download",
  "users.view",
  "users.create",
  "users.edit",
  "users.inactivate",
  "users.permissions",
  "settings.view",
  "settings.edit",
  "audit.view",
];

export interface PermissionGroup {
  key: string;
  label: string;
  description: string;
  permissions: { key: Permission; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Painel inicial e resumo do sistema",
    permissions: [{ key: "dashboard.view", label: "Visualizar dashboard" }],
  },
  {
    key: "members",
    label: "Associados",
    description: "Cadastro e gestão de associados",
    permissions: [
      { key: "members.view", label: "Visualizar associados" },
      { key: "members.create", label: "Criar associados" },
      { key: "members.edit", label: "Editar associados" },
      { key: "members.inactivate", label: "Inativar associados" },
      { key: "members.reactivate", label: "Reativar associados" },
      { key: "members.delete", label: "Excluir associados" },
    ],
  },
  {
    key: "cards",
    label: "Carteirinhas",
    description: "Geração e download de carteirinhas",
    permissions: [
      { key: "cards.view", label: "Visualizar carteirinhas" },
      { key: "cards.generate", label: "Gerar carteirinhas" },
      { key: "cards.download", label: "Baixar carteirinhas" },
    ],
  },
  {
    key: "users",
    label: "Usuários",
    description: "Gestão de usuários e permissões",
    permissions: [
      { key: "users.view", label: "Visualizar usuários" },
      { key: "users.create", label: "Criar usuários" },
      { key: "users.edit", label: "Editar usuários" },
      { key: "users.inactivate", label: "Inativar usuários" },
      { key: "users.permissions", label: "Gerenciar permissões" },
    ],
  },
  {
    key: "settings",
    label: "Configurações",
    description: "Ajustes do sistema",
    permissions: [
      { key: "settings.view", label: "Visualizar configurações" },
      { key: "settings.edit", label: "Editar configurações" },
    ],
  },
  {
    key: "audit",
    label: "Auditoria",
    description: "Histórico de ações do sistema",
    permissions: [{ key: "audit.view", label: "Visualizar auditoria" }],
  },
];
