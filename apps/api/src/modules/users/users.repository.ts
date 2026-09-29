import type { PublicUser, User } from "@amococ/shared";
import type { User as PrismaUser } from "@prisma/client";
import type { Db } from "../../shared/db.js";

function toDomain(row: PrismaUser): User {
  return {
    id: row.id,
    name: row.name,
    login: row.login,
    email: row.email,
    role: row.role as User["role"],
    status: row.status as User["status"],
    permissions: row.permissions as User["permissions"],
    salt: row.salt,
    passwordHash: row.passwordHash,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  };
}

/** Credenciais nunca saem da API (PublicUser). */
export function toPublicUser(user: User): PublicUser {
  const { salt: _salt, passwordHash: _hash, ...rest } = user;
  return rest;
}

// Implementação Prisma do contrato UsersRepository — mesma semântica e erros.
export const usersRepository = {
  getAll(db: Db): Promise<User[]> {
    return db.user
      .findMany({ orderBy: { createdAt: "desc" } })
      .then((rows) => rows.map(toDomain));
  },

  async getById(db: Db, id: string): Promise<User | undefined> {
    const row = await db.user.findUnique({ where: { id } });
    return row ? toDomain(row) : undefined;
  },

  async getByLogin(db: Db, login: string): Promise<User | undefined> {
    const row = await db.user.findUnique({ where: { login } });
    return row ? toDomain(row) : undefined;
  },

  count(db: Db): Promise<number> {
    return db.user.count();
  },

  async create(db: Db, user: User): Promise<User> {
    const existing = await db.user.findUnique({
      where: { login: user.login },
      select: { id: true },
    });
    if (existing) throw new Error("LOGIN_ALREADY_EXISTS");
    const row = await db.user.create({
      data: {
        ...user,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
      },
    });
    return toDomain(row);
  },

  async update(db: Db, id: string, patch: Partial<User>): Promise<User> {
    try {
      const row = await db.user.update({
        where: { id },
        data: {
          ...patch,
          id: undefined,
          createdAt: patch.createdAt ? new Date(patch.createdAt) : undefined,
          updatedAt: patch.updatedAt ? new Date(patch.updatedAt) : undefined,
          lastLoginAt:
            patch.lastLoginAt === undefined
              ? undefined
              : patch.lastLoginAt
                ? new Date(patch.lastLoginAt)
                : null,
        },
      });
      return toDomain(row);
    } catch {
      throw new Error("USER_NOT_FOUND");
    }
  },
};
