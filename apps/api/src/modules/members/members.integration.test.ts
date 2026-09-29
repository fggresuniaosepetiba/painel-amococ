import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { membersService } from "./members.service.js";
import { createTestClient, resetDatabase } from "../../test/db.js";
import { ACTOR, memberDraft } from "../../test/fixtures.js";

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

describe("associados — criação server-side", () => {
  it("gera matrícula 000001 e código AMOCOC-00001-XXXX", async () => {
    const member = await membersService.create(memberDraft(), db);

    expect(member.membershipNumber).toBe("000001");
    expect(member.cardCode).toMatch(/^AMOCOC-00001-[A-Z2-9]{4}$/);
    expect(member.status).toBe("ATIVO");
    expect(member.inactivatedAt).toBeNull();
  });

  it("sequencia matrículas e nunca reutiliza após exclusão", async () => {
    const first = await membersService.create(memberDraft(), db);
    const second = await membersService.create(
      memberDraft({ fullName: "Outro Nome" }),
      db,
    );
    expect(second.membershipNumber).toBe("000002");

    await membersService.inactivate(first.id, ACTOR, db);
    await membersService.delete(first.id, ACTOR, db);

    const third = await membersService.create(
      memberDraft({ fullName: "Terceiro Nome" }),
      db,
    );
    expect(third.membershipNumber).toBe("000003");

    // Identificadores do excluído seguem reservados para sempre.
    const used = await db.usedIdentifier.findMany();
    const values = used.map((u) => u.value);
    expect(values).toContain(first.membershipNumber);
    expect(values).toContain(first.cardCode);
  });

  it("registra MEMBER_CREATED com o texto exato do frontend", async () => {
    const member = await membersService.create(
      { ...memberDraft(), actor: ACTOR },
      db,
    );
    const logs = await db.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "MEMBER_CREATED",
      entity: "member",
      entityId: member.id,
      userId: ACTOR.id,
      userName: ACTOR.name,
      details: `Associado "${member.fullName}" criado — matrícula ${member.membershipNumber}, código ${member.cardCode}`,
    });
  });
});

describe("associados — ciclo de vida", () => {
  it("edição preserva matrícula e código", async () => {
    const created = await membersService.create(memberDraft(), db);
    const updated = await membersService.update(
      created.id,
      memberDraft({ fullName: "Nome Editado" }),
      ACTOR,
      db,
    );
    expect(updated.fullName).toBe("Nome Editado");
    expect(updated.membershipNumber).toBe(created.membershipNumber);
    expect(updated.cardCode).toBe(created.cardCode);
  });

  it("inativar move para INATIVOS com data; reativar preserva identidade", async () => {
    const created = await membersService.create(memberDraft(), db);
    const inactivated = await membersService.inactivate(created.id, ACTOR, db);
    expect(inactivated.status).toBe("INATIVO");
    expect(inactivated.inactivatedAt).not.toBeNull();

    const reactivated = await membersService.reactivate(created.id, ACTOR, db);
    expect(reactivated.status).toBe("ATIVO");
    expect(reactivated.inactivatedAt).toBeNull();
    expect(reactivated.membershipNumber).toBe(created.membershipNumber);
    expect(reactivated.cardCode).toBe(created.cardCode);
  });

  it("excluir ATIVO é bloqueado com a mensagem exata", async () => {
    const created = await membersService.create(memberDraft(), db);
    const promise = membersService.delete(created.id, ACTOR, db);
    await expect(promise).rejects.toMatchObject({
      status: 422,
      message:
        "Associados ativos não podem ser excluídos. Inative o associado primeiro.",
    });
    // Nada foi apagado.
    expect(await membersService.getById(created.id, db)).toBeDefined();
  });

  it("exclusão de INATIVO remove cadastro e carteirinhas, mantém reserva", async () => {
    const created = await membersService.create(memberDraft(), db);
    await db.membershipCard.create({
      data: {
        id: "card-1",
        memberId: created.id,
        cardCode: created.cardCode,
        membershipNumber: created.membershipNumber,
        memberName: created.fullName,
        generatedByUserId: "system",
        generatedByName: "sistema",
      },
    });
    await membersService.inactivate(created.id, ACTOR, db);
    await membersService.delete(created.id, ACTOR, db);

    expect(await membersService.getById(created.id, db)).toBeUndefined();
    expect(await db.membershipCard.count()).toBe(0);
    expect(
      await db.usedIdentifier.findUnique({
        where: { value: created.membershipNumber },
      }),
    ).not.toBeNull();

    const deleted = await db.auditLog.findFirst({
      where: { action: "MEMBER_DELETED" },
    });
    expect(deleted?.details).toContain("excluído definitivamente");
    expect(deleted?.details).toContain("nunca serão reutilizados");
  });
});
