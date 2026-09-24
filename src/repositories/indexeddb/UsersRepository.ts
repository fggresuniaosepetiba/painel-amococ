import { db } from "@/db/database";
import type { User } from "@/types";
import type { UsersRepository } from "../types";

export class IndexedDbUsersRepository implements UsersRepository {
  getAll(): Promise<User[]> {
    return db.users.orderBy("createdAt").reverse().toArray();
  }

  getById(id: string): Promise<User | undefined> {
    return db.users.get(id);
  }

  getByLogin(login: string): Promise<User | undefined> {
    return db.users.where("login").equals(login).first();
  }

  count(): Promise<number> {
    return db.users.count();
  }

  async create(user: User): Promise<User> {
    const existing = await db.users.where("login").equals(user.login).first();
    if (existing) {
      throw new Error("LOGIN_ALREADY_EXISTS");
    }
    await db.users.add(user);
    return user;
  }

  async update(id: string, patch: Partial<User>): Promise<User> {
    await db.users.update(id, patch);
    const updated = await db.users.get(id);
    if (!updated) throw new Error("USER_NOT_FOUND");
    return updated;
  }
}
