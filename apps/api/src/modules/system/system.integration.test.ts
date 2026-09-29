import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { systemService } from "./system.service.js";
import { createTestClient, resetDatabase } from "../../test/db.js";

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

describe("seed — primeira utilização", () => {
  it("cria SuperAdmin + padrões + assinatura oficial, resto zerado", async () => {
    const result = await systemService.seed({}, db);
    expect(result).toEqual({ seeded: true, demo: false });

    const admin = await db.user.findUnique({ where: { login: "amococ" } });
    expect(admin?.role).toBe("SUPERADMIN");
    expect(admin?.status).toBe("ATIVO");
    expect(admin?.passwordHash).not.toBe("123");

    const settings = await db.setting.findUnique({ where: { id: "general" } });
    const data = settings?.data as unknown as {
      signature: { imageDataUrl: string | null; mimeType: string | null };
    };
    expect(data.signature.imageDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(data.signature.mimeType).toBe("image/png");

    expect(await db.member.count()).toBe(0);
    expect(await db.usedIdentifier.count()).toBe(0);
    expect(await db.membershipCard.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("segunda execução não semeia de novo", async () => {
    await systemService.seed({}, db);
    expect(await systemService.seed({}, db)).toEqual({
      seeded: false,
      demo: false,
    });
  });

  it("demo cria 4 associados, carteirinhas e auditoria, sem assinatura", async () => {
    const result = await systemService.seed({ demo: true }, db);
    expect(result).toEqual({ seeded: true, demo: true });

    expect(await db.member.count()).toBe(4);
    expect(await db.usedIdentifier.count()).toBe(8);
    expect(await db.membershipCard.count()).toBe(2);

    const actions = await db.auditLog.findMany({ select: { action: true } });
    expect(actions.map((a) => a.action)).toContain("USER_CREATED");
    expect(
      actions.filter((a) => a.action === "MEMBER_CREATED"),
    ).toHaveLength(4);

    const settings = await db.setting.findUnique({ where: { id: "general" } });
    const data = settings?.data as unknown as {
      signature: { imageDataUrl: string | null };
    };
    expect(data.signature.imageDataUrl).toBeNull();
  });
});

describe("factory reset — LIMPAR", () => {
  it("demo vira estado base + SYSTEM_FACTORY_RESET", async () => {
    await systemService.seed({ demo: true }, db);
    const result = await systemService.factoryReset(db);
    expect(result).toEqual({ reset: true });

    expect(await db.user.count()).toBe(1);
    expect(await db.member.count()).toBe(0);
    expect(await db.membershipCard.count()).toBe(0);
    expect(await db.usedIdentifier.count()).toBe(0);

    const logs = await db.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("SYSTEM_FACTORY_RESET");
  });
});
