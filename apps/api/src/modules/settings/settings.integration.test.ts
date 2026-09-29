import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../domain/default-settings.js";
import { settingsService } from "./settings.service.js";
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

describe("configurações", () => {
  it("leitura cria os padrões quando ausentes", async () => {
    const settings = await settingsService.get(db);
    expect(settings.id).toBe("general");
    expect(settings.association.acronym).toBe(
      DEFAULT_SETTINGS.association.acronym,
    );
    expect(settings.card.title).toBe(DEFAULT_SETTINGS.card.title);
  });

  it("atualiza bloco da associação + SETTINGS_UPDATED", async () => {
    const saved = await settingsService.updateAssociation(
      { name: "Nova Associação" },
      ACTOR,
      db,
    );
    expect(saved.association.name).toBe("Nova Associação");
    expect(saved.association.acronym).toBe(
      DEFAULT_SETTINGS.association.acronym,
    );
    const log = await db.auditLog.findFirst({
      where: { action: "SETTINGS_UPDATED" },
    });
    expect(log).toBeTruthy();
  });

  it("assinatura define updatedAt e gera SIGNATURE_UPDATED", async () => {
    const saved = await settingsService.saveSignature(
      {
        presidentName: "Presidente",
        imageDataUrl: "data:image/png;base64,eA==",
        mimeType: "image/png",
      },
      ACTOR,
      db,
    );
    expect(saved.signature.presidentName).toBe("Presidente");
    expect(saved.signature.updatedAt).not.toBeNull();
    const log = await db.auditLog.findFirst({
      where: { action: "SIGNATURE_UPDATED" },
    });
    expect(log).toBeTruthy();
  });

  it("assinatura sem imagem zera updatedAt", async () => {
    const saved = await settingsService.saveSignature(
      { imageDataUrl: null },
      ACTOR,
      db,
    );
    expect(saved.signature.imageDataUrl).toBeNull();
    expect(saved.signature.updatedAt).toBeNull();
  });
});
