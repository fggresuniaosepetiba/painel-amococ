import { usersRepository } from "@/repositories";
import type { Permission } from "@amococ/shared";
import type { PublicUser, Role, User, UserStatus } from "@amococ/shared";
import { createId } from "@/utils/id";
import { hashPassword } from "@/utils/password";
import { auditService } from "./auditService";
import { authorizationService } from "./authorizationService";

export interface UserDraft {
  name: string;
  login: string;
  email: string;
  role: Role;
  status: UserStatus;
  permissions: Permission[];
  initialPassword: string;
}

function assertPermission(user: PublicUser, permission: Parameters<typeof authorizationService.hasPermission>[1]): void {
  if (!authorizationService.hasPermission(user, permission)) {
    throw new Error("FORBIDDEN");
  }
}

/** Gestão de usuários administrativos. */
export const userService = {
  async getAll(): Promise<User[]> {
    return usersRepository.getAll();
  },

  async getById(id: string): Promise<User | undefined> {
    return usersRepository.getById(id);
  },

  async create(actor: PublicUser, draft: UserDraft): Promise<PublicUser> {
    assertPermission(actor, "users.create");
    const login = draft.login.trim().toLowerCase();
    const existing = await usersRepository.getByLogin(login);
    if (existing) throw new Error("LOGIN_ALREADY_EXISTS");

    const { salt, hash } = await hashPassword(draft.initialPassword);
    const now = new Date().toISOString();
    const user: User = {
      id: createId(),
      name: draft.name.trim(),
      login,
      email: draft.email.trim(),
      role: draft.role,
      status: draft.status,
      permissions: draft.permissions,
      salt,
      passwordHash: hash,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    const created = await usersRepository.create(user);
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "USER_CREATED",
      entity: "user",
      entityId: created.id,
      details: `Usuário "${created.name}" (${created.login}) criado com role ${created.role}`,
    });
    return authService_toPublic(created);
  },

  async update(
    actor: PublicUser,
    id: string,
    draft: Omit<UserDraft, "initialPassword">
  ): Promise<PublicUser> {
    assertPermission(actor, "users.edit");
    const existing = await usersRepository.getById(id);
    if (!existing) throw new Error("USER_NOT_FOUND");

    const login = draft.login.trim().toLowerCase();
    if (login !== existing.login) {
      const conflict = await usersRepository.getByLogin(login);
      if (conflict && conflict.id !== id) throw new Error("LOGIN_ALREADY_EXISTS");
    }

    const updated = await usersRepository.update(id, {
      name: draft.name.trim(),
      login,
      email: draft.email.trim(),
      role: draft.role,
      status: draft.status,
      permissions: draft.permissions,
      updatedAt: new Date().toISOString(),
    });
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "USER_UPDATED",
      entity: "user",
      entityId: id,
      details: `Dados de "${updated.name}" (${updated.login}) atualizados`,
    });
    return authService_toPublic(updated);
  },

  async setStatus(
    actor: PublicUser,
    id: string,
    status: UserStatus
  ): Promise<PublicUser> {
    assertPermission(actor, "users.inactivate");
    const existing = await usersRepository.getById(id);
    if (!existing) throw new Error("USER_NOT_FOUND");
    if (existing.id === actor.id && status === "INATIVO") {
      throw new Error("CANNOT_INACTIVATE_SELF");
    }
    const updated = await usersRepository.update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: status === "INATIVO" ? "USER_INACTIVATED" : "USER_REACTIVATED",
      entity: "user",
      entityId: id,
      details:
        status === "INATIVO"
          ? `Usuário "${updated.name}" inativado — login bloqueado`
          : `Usuário "${updated.name}" reativado`,
    });
    return authService_toPublic(updated);
  },

  async savePermissions(
    actor: PublicUser,
    id: string,
    permissions: Permission[]
  ): Promise<PublicUser> {
    assertPermission(actor, "users.permissions");
    const existing = await usersRepository.getById(id);
    if (!existing) throw new Error("USER_NOT_FOUND");
    const updated = await usersRepository.update(id, {
      permissions,
      updatedAt: new Date().toISOString(),
    });
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "PERMISSION_CHANGED",
      entity: "user",
      entityId: id,
      details: `Permissões de "${updated.name}" atualizadas (${permissions.length} permissões)`,
    });
    return authService_toPublic(updated);
  },

  async resetPassword(
    actor: PublicUser,
    id: string,
    newPassword: string
  ): Promise<void> {
    assertPermission(actor, "users.edit");
    const existing = await usersRepository.getById(id);
    if (!existing) throw new Error("USER_NOT_FOUND");
    const { salt, hash } = await hashPassword(newPassword);
    await usersRepository.update(id, {
      salt,
      passwordHash: hash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    });
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "PASSWORD_CHANGED",
      entity: "user",
      entityId: id,
      details: `Senha redefinida pelo administrador para "${existing.login}"`,
    });
  },
};

function authService_toPublic(user: User): PublicUser {
  const { salt: _s, passwordHash: _h, ...rest } = user;
  return rest;
}
