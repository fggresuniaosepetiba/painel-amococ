import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import type { Permission, PublicUser, Role } from "@amococ/shared";
import { createId } from "../shared/ids.js";
import { usersService } from "../modules/users/users.service.js";

// Identidade autenticada para testes HTTP: cria o usuário via service e faz
// login de verdade (exercita o fluxo JWT). Rate-limit é pulado em teste.

export interface TestIdentity {
  user: PublicUser;
  login: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

interface IdentityOverrides {
  login?: string;
  password?: string;
  role?: Role;
  status?: "ATIVO" | "INATIVO";
  permissions?: Permission[];
}

export interface TestAccount {
  user: PublicUser;
  login: string;
  password: string;
}

/** Cria o usuário via service (sem HTTP — não consome rate-limit). */
export async function createAccount(
  db: PrismaClient,
  overrides: IdentityOverrides = {},
): Promise<TestAccount> {
  const login = (overrides.login ?? `test-${createId()}`).toLowerCase();
  const password = overrides.password ?? "senha-teste-123";
  const created = await usersService.create(
    {
      name: `Teste ${login}`,
      login,
      email: "",
      role: overrides.role ?? "ADMINISTRADOR",
      status: overrides.status ?? "ATIVO",
      permissions: overrides.permissions ?? [],
      initialPassword: password,
    },
    db,
  );
  return { user: created, login, password };
}

export async function createIdentity(
  app: Express,
  db: PrismaClient,
  overrides: IdentityOverrides = {},
): Promise<TestIdentity> {
  const account = await createAccount(db, overrides);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ login: account.login, password: account.password })
    .expect(200);
  return {
    user: res.body.data.user as PublicUser,
    login: account.login,
    password: account.password,
    accessToken: res.body.data.accessToken as string,
    refreshToken: res.body.data.refreshToken as string,
  };
}

/** Header `Authorization: Bearer` para o supertest. */
export function bearer(identity: TestIdentity): { Authorization: string } {
  return { Authorization: `Bearer ${identity.accessToken}` };
}
