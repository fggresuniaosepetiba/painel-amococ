import { api, isNotFound } from "@/lib/apiClient";
import type {
  PublicUser,
  User,
  UserStatus,
} from "@amococ/shared";
import type {
  NewUserInput,
  UserPatch,
  UsersRepository,
} from "../types";

/** User da API (PublicUser) → User local (sem credenciais — login é JWT). */
function toLocalUser(user: PublicUser): User {
  return { ...user, salt: "", passwordHash: "" };
}

export class ApiUsersRepository implements UsersRepository {
  async getAll(): Promise<User[]> {
    return (await api<PublicUser[]>("/api/users")).map(toLocalUser);
  }

  async getById(id: string): Promise<User | undefined> {
    try {
      return toLocalUser(await api<PublicUser>(`/api/users/${id}`));
    } catch (err) {
      if (isNotFound(err)) return undefined;
      throw err;
    }
  }

  async getByLogin(login: string): Promise<User | undefined> {
    return (await this.getAll()).find((user) => user.login === login);
  }

  async count(): Promise<number> {
    return (await this.getAll()).length;
  }

  async create(input: NewUserInput): Promise<User> {
    return toLocalUser(
      await api<PublicUser>("/api/users", {
        method: "POST",
        body: { ...input },
      })
    );
  }

  async update(id: string, patch: UserPatch): Promise<User> {
    const { newPassword, ...rest } = patch;
    if (newPassword !== undefined) {
      await api(`/api/users/${id}/reset-password`, {
        method: "POST",
        body: { newPassword },
      });
      return this.getByIdOrThrow(id);
    }
    // Roteamento por formato (services chamam `update` p/ tudo):
    // - só status (+ carimbos) → POST /:id/status
    // - só permissions → PUT /:id/permissions
    // - só lastLoginAt → relê (servidor carimba no login)
    // - demais campos → PATCH /:id
    const keys = Object.keys(rest).filter((key) => key !== "updatedAt");
    const only = (...names: string[]) =>
      keys.length > 0 && keys.every((key) => names.includes(key));
    if (rest.status !== undefined && only("status", "inactivatedAt")) {
      return toLocalUser(
        await api<PublicUser>(`/api/users/${id}/status`, {
          method: "POST",
          body: { status: rest.status as UserStatus },
        })
      );
    }
    if (rest.permissions !== undefined && only("permissions")) {
      return toLocalUser(
        await api<PublicUser>(`/api/users/${id}/permissions`, {
          method: "PUT",
          body: { permissions: rest.permissions ?? [] },
        })
      );
    }
    if (keys.length === 0 || only("lastLoginAt")) {
      // Servidor carimba `lastLoginAt` no login — só relê.
      return this.getByIdOrThrow(id);
    }
    return toLocalUser(
      await api<PublicUser>(`/api/users/${id}`, {
        method: "PATCH",
        body: {
          name: rest.name,
          login: rest.login,
          email: rest.email ?? "",
          role: rest.role,
          status: rest.status,
          permissions: rest.permissions ?? [],
        },
      })
    );
  }

  private async getByIdOrThrow(id: string): Promise<User> {
    const user = await this.getById(id);
    if (!user) throw new Error("USER_NOT_FOUND");
    return user;
  }
}
