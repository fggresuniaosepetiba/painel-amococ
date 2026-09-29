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

const BACKUP = {
  version: 1,
  exportedAt: "2026-09-29T00:00:00.000Z",
  users: [
    {
      id: "user-1",
      name: "Administrador AMOCOC",
      login: "amococ",
      email: "admin@amococ.local",
      role: "SUPERADMIN",
      status: "ATIVO",
      permissions: [],
      salt: "legacysalt",
      passwordHash: "legacyhash",
      mustChangePassword: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastLoginAt: null,
    },
  ],
  members: [
    {
      id: "member-1",
      membershipNumber: "000001",
      cardCode: "AMOCOC-00001-A8ZK",
      fullName: "João da Silva",
      cpf: "52998224725",
      birthDate: "1985-04-12",
      phone: "(85) 98811-2233",
      whatsapp: "(85) 98811-2233",
      cep: "60000-001",
      address: "Rua das Acácias",
      addressNumber: "120",
      complement: "Bloco A",
      district: "Conjunto Otacílio Câmara",
      city: "Fortaleza",
      state: "CE",
      photoDataUrl: null,
      notes: "",
      status: "ATIVO",
      inactivatedAt: null,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
  ],
  cards: [
    {
      id: "card-1",
      memberId: "member-1",
      cardCode: "AMOCOC-00001-A8ZK",
      membershipNumber: "000001",
      memberName: "João da Silva",
      generatedAt: "2026-03-01T00:00:00.000Z",
      generatedByUserId: "user-1",
      generatedByName: "Administrador AMOCOC",
      pngDataUrl: null,
      fileSizeBytes: null,
    },
  ],
  settings: {
    id: "general",
    association: {
      name: "Associação Teste",
      acronym: "AMOCOC",
      address: "",
      phone: "",
      email: "",
      information: "",
      customLogoDataUrl: null,
    },
    card: {
      title: "CARTEIRA DE ASSOCIADO",
      footerText: "",
      showCpf: true,
      showBirthDate: true,
      showPhone: true,
      showAddress: false,
      showIssueDate: true,
      signaturePlacement: null,
    },
    signature: {
      presidentName: "",
      presidentTitle: "Presidente da Diretoria",
      imageDataUrl: null,
      mimeType: null,
      updatedAt: null,
    },
    security: { lastPasswordChangeAt: null },
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  audit: [
    {
      id: "audit-1",
      createdAt: "2026-02-01T00:00:00.000Z",
      userId: "user-1",
      userName: "Administrador AMOCOC",
      action: "MEMBER_CREATED",
      entity: "member",
      entityId: "member-1",
      details: "Associado criado no backup",
    },
  ],
  usedIdentifiers: [
    {
      value: "000001",
      type: "membershipNumber",
      usedAt: "2026-02-01T00:00:00.000Z",
      memberId: "member-1",
      memberName: "João da Silva",
    },
    {
      value: "AMOCOC-00001-A8ZK",
      type: "cardCode",
      usedAt: "2026-02-01T00:00:00.000Z",
      memberId: "member-1",
      memberName: "João da Silva",
    },
  ],
};

describe("import — backup v1 do IndexedDB", () => {
  it("importa tudo com história preservada e força troca de senha", async () => {
    const summary = await systemService.importBackup(BACKUP, db);

    expect(summary.errors).toEqual([]);
    expect(summary.imported).toMatchObject({
      users: 1,
      members: 1,
      cards: 1,
      audit: 1,
      // A criação do membro já registra os 2 identificadores na mesma
      // transação — o loop da reserva os encontra usados (2 pulados).
      usedIdentifiers: 0,
      settings: 1,
    });
    expect(summary.skipped.usedIdentifiers).toBe(2);
    // Reserva garantida de qualquer forma.
    expect(
      await db.usedIdentifier.findUnique({ where: { value: "000001" } }),
    ).not.toBeNull();

    // História preservada (ids e datas originais).
    const member = await db.member.findUnique({ where: { id: "member-1" } });
    expect(member?.createdAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    const log = await db.auditLog.findUnique({ where: { id: "audit-1" } });
    expect(log?.details).toBe("Associado criado no backup");

    // Senha legada preservada, mas com troca forçada (Fase 5 faz upgrade).
    const user = await db.user.findUnique({ where: { id: "user-1" } });
    expect(user?.passwordHash).toBe("legacyhash");
    expect(user?.mustChangePassword).toBe(true);
  });

  it("rerun do mesmo arquivo → zero inserções e zero erros", async () => {
    await systemService.importBackup(BACKUP, db);
    const rerun = await systemService.importBackup(BACKUP, db);

    expect(rerun.errors).toEqual([]);
    expect(rerun.imported).toEqual({
      users: 0,
      members: 0,
      cards: 0,
      audit: 0,
      usedIdentifiers: 0,
      settings: 0,
    });
  });

  it("matrícula em conflito com outro id vira erro no item", async () => {
    await systemService.importBackup(BACKUP, db);
    const summary = await systemService.importBackup(
      {
        ...BACKUP,
        members: [
          { ...BACKUP.members[0]!, id: "member-2", fullName: "Outro Nome" },
        ],
      },
      db,
    );

    expect(summary.imported.members).toBe(0);
    expect(summary.errors).toEqual([
      { entity: "member", id: "member-2", code: "MEMBERSHIP_NUMBER_TAKEN" },
    ]);
    // O original segue intacto.
    expect((await db.member.findUnique({ where: { id: "member-1" } }))?.fullName).toBe(
      "João da Silva",
    );
  });

  it("backup inválido → 400 INVALID_BACKUP", async () => {
    await expect(systemService.importBackup({ version: 2 }, db)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_BACKUP",
    });
  });
});
