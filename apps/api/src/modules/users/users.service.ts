import type { Permission, PublicUser, UserStatus } from "@amococ/shared";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../shared/audit.js";
import type { Actor } from "../../shared/actor.js";
import { SYSTEM_ACTOR } from "../../shared/actor.js";
import type { Db } from "../../shared/db.js";
import { createId } from "../../shared/ids.js";
import { passwordHasher } from "./password-hasher.js";
import { toPublicUser, usersRepository } from "./users.repository.js";

// Serviço de usuários — regras copiadas do frontend (userService.ts):
// login único (minúsculas), sem auto-inativação, auditoria com textos exatos.
// Respostas sempre PublicUser (sem salt/hash). Autorização entra na Fase 5.

export interface UserCreateInput {
  name: string;
  login: string;
  email: string;
  role: "SUPERADMIN" | "ADMINISTRADOR" | "COLABORADOR";
  status: UserStatus;
  permissions: Permission[];
  initialPassword: string;
  actor?: Actor | null;
}

export const usersService = {
  async list(db: Db = prisma): Promise<PublicUser[]> {
    const users = await usersRepository.getAll(db);
    return users.map(toPublicUser);
  },

  async getById(id: string, db: Db = prisma): Promise<PublicUser | undefined> {
    const user = await usersRepository.getById(db, id);
    return user ? toPublicUser(user) : undefined;
  },

  async create(input: UserCreateInput, db: Db = prisma): Promise<PublicUser> {
    const actor = input.actor ?? SYSTEM_ACTOR;
    const login = input.login.trim().toLowerCase();
    const existing = await usersRepository.getByLogin(db, login);
    if (existing) throw new Error("LOGIN_ALREADY_EXISTS");

    const { salt, hash } = await passwordHasher.hash(input.initialPassword);
    const now = new Date().toISOString();
    const created = await usersRepository.create(db, {
      id: createId(),
      name: input.name.trim(),
      login,
      email: input.email.trim(),
      role: input.role,
      status: input.status,
      permissions: input.permissions,
      salt,
      passwordHash: hash,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
    await logAudit(db, {
      userId: actor.id === SYSTEM_ACTOR.id ? null : actor.id,
      userName: actor.name,
      action: "USER_CREATED",
      entity: "user",
      entityId: created.id,
      details: `Usuário "${created.name}" (${created.login}) criado com role ${created.role}`,
    });
    return toPublicUser(created);
  },

  async update(
    id: string,
    draft: Omit<UserCreateInput, "initialPassword" | "actor">,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<PublicUser> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await usersRepository.getById(db, id);
    if (!existing) throw new Error("USER_NOT_FOUND");

    const login = draft.login.trim().toLowerCase();
    if (login !== existing.login) {
      const conflict = await usersRepository.getByLogin(db, login);
      if (conflict && conflict.id !== id) throw new Error("LOGIN_ALREADY_EXISTS");
    }

    const updated = await usersRepository.update(db, id, {
      name: draft.name.trim(),
      login,
      email: draft.email.trim(),
      role: draft.role,
      status: draft.status,
      permissions: draft.permissions,
      updatedAt: new Date().toISOString(),
    });
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "USER_UPDATED",
      entity: "user",
      entityId: id,
      details: `Dados de "${updated.name}" (${updated.login}) atualizados`,
    });
    return toPublicUser(updated);
  },

  async setStatus(
    id: string,
    status: UserStatus,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<PublicUser> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await usersRepository.getById(db, id);
    if (!existing) throw new Error("USER_NOT_FOUND");
    if (who.id !== SYSTEM_ACTOR.id && existing.id === who.id && status === "INATIVO") {
      throw new Error("CANNOT_INACTIVATE_SELF");
    }
    const updated = await usersRepository.update(db, id, {
      status,
      updatedAt: new Date().toISOString(),
    });
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: status === "INATIVO" ? "USER_INACTIVATED" : "USER_REACTIVATED",
      entity: "user",
      entityId: id,
      details:
        status === "INATIVO"
          ? `Usuário "${updated.name}" inativado — login bloqueado`
          : `Usuário "${updated.name}" reativado`,
    });
    return toPublicUser(updated);
  },

  async savePermissions(
    id: string,
    permissions: Permission[],
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<PublicUser> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await usersRepository.getById(db, id);
    if (!existing) throw new Error("USER_NOT_FOUND");
    const updated = await usersRepository.update(db, id, {
      permissions,
      updatedAt: new Date().toISOString(),
    });
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "PERMISSION_CHANGED",
      entity: "user",
      entityId: id,
      details: `Permissões de "${updated.name}" atualizadas (${permissions.length} permissões)`,
    });
    return toPublicUser(updated);
  },

  async resetPassword(
    id: string,
    newPassword: string,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<void> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await usersRepository.getById(db, id);
    if (!existing) throw new Error("USER_NOT_FOUND");
    const { salt, hash } = await passwordHasher.hash(newPassword);
    await usersRepository.update(db, id, {
      salt,
      passwordHash: hash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    });
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "PASSWORD_CHANGED",
      entity: "user",
      entityId: id,
      details: `Senha redefinida pelo administrador para "${existing.login}"`,
    });
  },
  /**
   * @deprecated Temporário da Fase 4 — uso exclusivo do authService do frontend.
   * Remoção obrigatória na Fase 5 (login passa a JWT). Nunca revela o motivo:
   * usuário inexistente e senha errada retornam `false` do mesmo jeito.
   * No sucesso, atualiza `lastLoginAt` (o login client-side fazia isso via
   * `users.update` — sem endpoint dedicado, o carimbo vive aqui).
   */
  async verifyPassword(
    id: string,
    plain: string,
    db: Db = prisma,
  ): Promise<boolean> {
    const existing = await usersRepository.getById(db, id);
    if (!existing) return false;
    const ok = await passwordHasher.verify(plain, existing.passwordHash);
    if (ok) {
      await usersRepository.update(db, id, {
        lastLoginAt: new Date().toISOString(),
      });
    }
    return ok;
  },
};
