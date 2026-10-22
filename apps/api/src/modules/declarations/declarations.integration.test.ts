import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { declarationCreateSchema } from "../../shared/validation.js";
import {
  DECLARATION_SIGNATURE_REQUIRED_BODY,
  DECLARATION_SIGNATURE_REQUIRED_TITLE,
  declarationsService,
} from "./declarations.service.js";
import { settingsService } from "../settings/settings.service.js";
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

const SIGNATURE = "data:image/png;base64,c2lnbmF0dXJl";

async function configureSignature(): Promise<void> {
  await settingsService.saveSignature(
    {
      presidentName: "Presidente Teste",
      presidentTitle: "Presidente da Diretoria",
      imageDataUrl: SIGNATURE,
      mimeType: "image/png",
    },
    ACTOR,
    db,
  );
}

function declarationDraft(
  overrides: Partial<Parameters<typeof declarationCreateSchema.parse>[0]> = {},
) {
  return {
    residentName: "Maria do Socorro",
    birthDate: "1985-07-03",
    cpf: "529.982.247-25",
    address: "Rua Alpha, 10 - Conjunto Otacílio Câmara",
    residenceYears: 8,
    residenceMonths: 6,
    ...overrides,
  };
}

describe("declarações de residência", () => {
  it("emissão sem assinatura é bloqueada com título e corpo exatos", async () => {
    const promise = declarationsService.create(declarationDraft(), ACTOR, db);
    await expect(promise).rejects.toMatchObject({
      status: 422,
      code: "SIGNATURE_MISSING",
      title: DECLARATION_SIGNATURE_REQUIRED_TITLE,
      message: DECLARATION_SIGNATURE_REQUIRED_BODY,
    });
  });

  it("emite registro com dados do formulário + DECLARATION_CREATED", async () => {
    await configureSignature();
    const record = await declarationsService.create(declarationDraft(), ACTOR, db);

    expect(record.status).toBe("ATIVO");
    expect(record.residentName).toBe("Maria do Socorro");
    expect(record.residenceYears).toBe(8);
    expect(record.residenceMonths).toBe(6);
    expect(record.inactivatedAt).toBeNull();
    expect(record.issuedByName).toBe(ACTOR.name);

    const log = await db.auditLog.findFirst({
      where: { action: "DECLARATION_CREATED" },
    });
    expect(log?.details).toBe(
      'Declaração de residência emitida para "Maria do Socorro" (8 ano(s) e 6 mês(es) de residência)',
    );
  });

  it("validação rejeita CPF inválido e meses fora de 0–11", () => {
    expect(
      declarationCreateSchema.safeParse(
        declarationDraft({ cpf: "111.111.111-11" }),
      ).success,
    ).toBe(false);
    expect(
      declarationCreateSchema.safeParse(
        declarationDraft({ residenceMonths: 12 }),
      ).success,
    ).toBe(false);
  });

  it("impressão registra DECLARATION_PRINTED", async () => {
    await configureSignature();
    const record = await declarationsService.create(declarationDraft(), ACTOR, db);
    await declarationsService.registerPrint(record.id, ACTOR, db);

    const log = await db.auditLog.findFirst({
      where: { action: "DECLARATION_PRINTED" },
    });
    expect(log?.details).toBe(
      'Declaração de residência de "Maria do Socorro" impressa',
    );
  });

  it("inativar e reativar alteram status com auditoria em cada ação", async () => {
    await configureSignature();
    const record = await declarationsService.create(declarationDraft(), ACTOR, db);

    const inactivated = await declarationsService.inactivate(record.id, ACTOR, db);
    expect(inactivated.status).toBe("INATIVO");
    expect(inactivated.inactivatedAt).not.toBeNull();
    expect(
      await db.auditLog.findFirst({ where: { action: "DECLARATION_INACTIVATED" } }),
    ).not.toBeNull();

    const reactivated = await declarationsService.reactivate(record.id, ACTOR, db);
    expect(reactivated.status).toBe("ATIVO");
    expect(reactivated.inactivatedAt).toBeNull();
    expect(
      await db.auditLog.findFirst({ where: { action: "DECLARATION_REACTIVATED" } }),
    ).not.toBeNull();
  });

  it("exclusão bloqueia declaração ATIVA e exclui após inativar", async () => {
    await configureSignature();
    const record = await declarationsService.create(declarationDraft(), ACTOR, db);

    const blocked = declarationsService.delete(record.id, ACTOR, db);
    await expect(blocked).rejects.toMatchObject({
      status: 422,
      code: "ACTIVE_DECLARATION_DELETE",
      message: "Declarações ativas não podem ser excluídas. Inative a declaração primeiro.",
    });

    await declarationsService.inactivate(record.id, ACTOR, db);
    await declarationsService.delete(record.id, ACTOR, db);

    expect(await declarationsService.getById(record.id, db)).toBeUndefined();
    const log = await db.auditLog.findFirst({
      where: { action: "DECLARATION_DELETED" },
    });
    expect(log?.details).toBe(
      'Declaração de residência de "Maria do Socorro" excluída definitivamente',
    );
  });
});
