import { usersRepository } from "@/repositories";
import type { Permission } from "@amococ/shared";
import type { PublicUser, Role, User, UserStatus } from "@amococ/shared";
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

    // Hash bcrypt no servidor (Fase 4); auditoria USER_CREATED no servidor.
    const created = await usersRepository.create({
      name: draft.name.trim(),
      login,
      email: draft.email.trim(),
      role: draft.role,
      status: draft.status,
      permissions: draft.permissions,
      initialPassword: draft.initialPassword,
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
    // Senha em texto plano até o repository (hash + auditoria no servidor).
    await usersRepository.update(id, { newPassword });
  },
};

function authService_toPublic(user: User): PublicUser {
  const { salt: _s, passwordHash: _h, ...rest } = user;
  return rest;
}
