import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { passwordHasher } from "./password-hasher.js";
import { usersRepository } from "./users.repository.js";
import { usersService } from "./users.service.js";
import { createTestClient, resetDatabase } from "../../test/db.js";
import { ACTOR } from "../../test/fixtures.js";

let db: PrismaClient;

beforeAll(() => {
  db = createTestClient();
});

beforeEach(async () => {
  await resetDatabase(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const draft = {
  name: "Usuário Teste",
  login: "Teste.User",
  email: "teste@amococ.local",
  role: "COLABORADOR" as const,
  status: "ATIVO" as const,
  permissions: ["members.view" as const],
  initialPassword: "segredo123",
};

describe("usuários", () => {
  it("normaliza login, aplica bcrypt e nunca expõe credenciais", async () => {
    const created = await usersService.create(draft, db);

    expect(created.login).toBe("teste.user");
    expect(created).not.toHaveProperty("salt");
    expect(created).not.toHaveProperty("passwordHash");

    const stored = await usersRepository.getByLogin(db, "teste.user");
    expect(stored?.salt).toBeTruthy();
    expect(stored?.passwordHash).not.toBe("segredo123");
    expect(await passwordHasher.verify("segredo123", stored!.passwordHash)).toBe(true);
    expect(await passwordHasher.verify("errada", stored!.passwordHash)).toBe(false);
  });

  it("login duplicado → LOGIN_ALREADY_EXISTS", async () => {
    await usersService.create(draft, db);
    await expect(usersService.create(draft, db)).rejects.toThrow(
      "LOGIN_ALREADY_EXISTS",
    );
  });

  it("atualização com login em conflito → LOGIN_ALREADY_EXISTS", async () => {
    const first = await usersService.create(draft, db);
    const second = await usersService.create(
      { ...draft, login: "outro", name: "Outro" },
      db,
    );
    await expect(
      usersService.update(second.id, { ...draft, login: first.login }, ACTOR, db),
    ).rejects.toThrow("LOGIN_ALREADY_EXISTS");
  });

  it("inativar a si mesmo é bloqueado", async () => {
    const me = await usersService.create(draft, db);
    await expect(
      usersService.setStatus(me.id, "INATIVO", { id: me.id, name: me.name }, db),
    ).rejects.toThrow("CANNOT_INACTIVATE_SELF");
  });

  it("troca de permissões gera PERMISSION_CHANGED", async () => {
    const user = await usersService.create(draft, db);
    const updated = await usersService.savePermissions(
      user.id,
      ["members.view", "members.create"],
      ACTOR,
      db,
    );
    expect(updated.permissions).toEqual(["members.view", "members.create"]);
    const log = await db.auditLog.findFirst({
      where: { action: "PERMISSION_CHANGED" },
    });
    expect(log?.details).toBe(
      `Permissões de "${user.name}" atualizadas (2 permissões)`,
    );
  });

  it("reset de senha troca o hash e gera PASSWORD_CHANGED com texto exato", async () => {
    const user = await usersService.create(draft, db);
    await usersService.resetPassword(user.id, "nova-senha", ACTOR, db);

    const stored = await usersRepository.getByLogin(db, user.login);
    expect(await passwordHasher.verify("nova-senha", stored!.passwordHash)).toBe(true);

    const log = await db.auditLog.findFirst({
      where: { action: "PASSWORD_CHANGED" },
    });
    expect(log?.details).toBe(
      `Senha redefinida pelo administrador para "${user.login}"`,
    );
  });
});
