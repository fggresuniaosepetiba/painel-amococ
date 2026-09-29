import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  SIGNATURE_REQUIRED_BODY,
  SIGNATURE_REQUIRED_TITLE,
  cardsService,
} from "./cards.service.js";
import { membersService } from "../members/members.service.js";
import { settingsService } from "../settings/settings.service.js";
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

const PNG = "data:image/png;base64,iVBORw0KGgo=";
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

describe("carteirinhas", () => {
  it("geração sem assinatura é bloqueada com título e corpo exatos", async () => {
    const member = await membersService.create(memberDraft(), db);
    const promise = cardsService.generate(member.id, PNG, ACTOR, db);
    await expect(promise).rejects.toMatchObject({
      status: 422,
      code: "SIGNATURE_MISSING",
      title: SIGNATURE_REQUIRED_TITLE,
      message: SIGNATURE_REQUIRED_BODY,
    });
  });

  it("gera registro com assinatura + CARD_GENERATED", async () => {
    await configureSignature();
    const member = await membersService.create(
      { ...memberDraft(), actor: ACTOR },
      db,
    );
    const record = await cardsService.generate(member.id, PNG, ACTOR, db);

    expect(record.memberId).toBe(member.id);
    expect(record.cardCode).toBe(member.cardCode);
    expect(record.generatedByName).toBe(ACTOR.name);
    expect(record.fileSizeBytes).toBeGreaterThan(0);

    const log = await db.auditLog.findFirst({
      where: { action: "CARD_GENERATED" },
    });
    expect(log?.details).toBe(
      `Carteirinha ${record.cardCode} gerada para "${record.memberName}" (matrícula ${record.membershipNumber})`,
    );
  });

  it("download registra CARD_DOWNLOADED e devolve o nome oficial", async () => {
    await configureSignature();
    const member = await membersService.create(
      memberDraft({ fullName: "João da Silva" }),
      db,
    );
    const record = await cardsService.generate(member.id, PNG, ACTOR, db);
    const { fileName } = await cardsService.registerDownload(record.id, ACTOR, db);

    expect(fileName).toBe(`${record.cardCode}-JOAO-DA-SILVA.png`);
    const log = await db.auditLog.findFirst({
      where: { action: "CARD_DOWNLOADED" },
    });
    expect(log?.details).toBe(`Arquivo ${fileName} baixado`);
  });
});
