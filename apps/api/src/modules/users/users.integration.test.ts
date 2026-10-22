import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { passwordHasher } from "./password-hasher.js";
import { usersRepository } from "./users.repository.js";
import { usersService } from "./users.service.js";
import { createTestClient, resetDatabase } from "../../test/db.js";
import { ACTOR } from "../../test/fixtures.js";
import { createId } from "../../shared/ids.js";

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

  it("edição não altera o status (ciclo de vida só via /status)", async () => {
    const user = await usersService.create(draft, db);
    const { initialPassword: _password, status: _status, ...editable } = draft;
    const updated = await usersService.update(user.id, editable, ACTOR, db);
    expect(updated.status).toBe("ATIVO");

    // Payload legado (com status) é ignorado — nunca muda o status pela edição.
    const legacyPayload = { ...editable, status: "INATIVO" as const };
    const forced = await usersService.update(user.id, legacyPayload, ACTOR, db);
    expect(forced.status).toBe("ATIVO");
  });

  it("excluir usuário ativo → ACTIVE_USER_DELETE (exige inativar antes)", async () => {
    const user = await usersService.create(draft, db);
    await expect(usersService.delete(user.id, ACTOR, db)).rejects.toMatchObject({
      code: "ACTIVE_USER_DELETE",
      status: 422,
      message:
        "Usuários ativos não podem ser excluídos. Inative o usuário primeiro.",
    });
    expect(await usersRepository.getById(db, user.id)).toBeDefined();
  });

  it("excluir usuário inativo apaga usuário, sessões e gera USER_DELETED", async () => {
    const user = await usersService.create(draft, db);
    await db.session.create({
      data: {
        id: createId(),
        userId: user.id,
        refreshHash: `hash-${createId()}`,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    await usersService.setStatus(user.id, "INATIVO", ACTOR, db);
    await usersService.delete(user.id, ACTOR, db);

    expect(await usersRepository.getById(db, user.id)).toBeUndefined();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

    const log = await db.auditLog.findFirst({
      where: { action: "USER_DELETED" },
    });
    expect(log?.entityId).toBe(user.id);
    expect(log?.details).toBe(
      `Usuário "${user.name}" (${user.login}) excluído definitivamente — perfil ${user.role}, ID ${user.id}`,
    );
    // Histórico anterior é preservado.
    expect(
      await db.auditLog.count({ where: { entityId: user.id } }),
    ).toBeGreaterThan(1);
  });

  it("auto-exclusão é bloqueada", async () => {
    const me = await usersService.create(draft, db);
    await usersService.setStatus(me.id, "INATIVO", ACTOR, db);
    await expect(
      usersService.delete(me.id, { id: me.id, name: me.name }, db),
    ).rejects.toThrow("CANNOT_DELETE_SELF");
    expect(await usersRepository.getById(db, me.id)).toBeDefined();
  });

  it("excluir usuário inexistente → USER_NOT_FOUND", async () => {
    await expect(usersService.delete("inexistente", ACTOR, db)).rejects.toThrow(
      "USER_NOT_FOUND",
    );
  });

});
