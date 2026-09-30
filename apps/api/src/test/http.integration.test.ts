import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestClient, resetDatabase } from "./db.js";
import { bearer, createIdentity, type TestIdentity } from "./auth-helpers.js";
import { memberDraft } from "./fixtures.js";

let db: PrismaClient;
let app: Express;
let admin: TestIdentity;

beforeAll(() => {
  db = createTestClient();
  app = createApp(db);
});

beforeEach(async () => {
  await resetDatabase(db);
  // SUPERADMIN com bypass: cobre todos os endpoints deste arquivo.
  admin = await createIdentity(app, db, { login: "admin", role: "SUPERADMIN" });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("HTTP — associados ponta a ponta", () => {
  it("cria (201), lista, detalha, inativa, reativa e exclui", async () => {
    const created = await request(app)
      .post("/api/members")
      .set(bearer(admin))
      .send(memberDraft())
      .expect(201);
    expect(created.body.data.membershipNumber).toBe("000001");

    const id = created.body.data.id as string;
    await request(app).get("/api/members?status=ATIVO").set(bearer(admin)).expect(200);
    await request(app).get(`/api/members/${id}`).set(bearer(admin)).expect(200);

    await request(app).post(`/api/members/${id}/inactivate`).set(bearer(admin)).send({}).expect(200);
    const inactive = await request(app).get("/api/members?status=INATIVO").set(bearer(admin)).expect(200);
    expect(inactive.body.data).toHaveLength(1);

    await request(app).post(`/api/members/${id}/reactivate`).set(bearer(admin)).send({}).expect(200);
    await request(app).post(`/api/members/${id}/inactivate`).set(bearer(admin)).send({}).expect(200);
    await request(app).delete(`/api/members/${id}`).set(bearer(admin)).send({}).expect(200);
    await request(app).get(`/api/members/${id}`).set(bearer(admin)).expect(404);
  });

  it("sem token → 401", async () => {
    await request(app).get("/api/members").expect(401);
  });

  it("CPF inválido → 400 VALIDATION_ERROR", async () => {
    const response = await request(app)
      .post("/api/members")
      .set(bearer(admin))
      .send(memberDraft({ cpf: "123" }))
      .expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("excluir ATIVO → 422 com mensagem exata", async () => {
    const created = await request(app)
      .post("/api/members")
      .set(bearer(admin))
      .send(memberDraft())
      .expect(201);
    const response = await request(app)
      .delete(`/api/members/${created.body.data.id}`)
      .set(bearer(admin))
      .send({})
      .expect(422);
    expect(response.body.message).toBe(
      "Associados ativos não podem ser excluídos. Inative o associado primeiro.",
    );
  });
});

describe("HTTP — usuários e carteirinhas", () => {
  it("cria usuário sem expor credenciais", async () => {
    const response = await request(app)
      .post("/api/users")
      .set(bearer(admin))
      .send({
        name: "Novo Admin",
        login: "NovoAdmin",
        email: "",
        role: "ADMINISTRADOR",
        status: "ATIVO",
        permissions: ["members.view"],
        initialPassword: "abc123",
      })
      .expect(201);
    expect(response.body.data.login).toBe("novoadmin");
    expect(response.body.data).not.toHaveProperty("passwordHash");
  });

  it("gera carteirinha bloqueada sem assinatura (título + corpo exatos)", async () => {
    const created = await request(app)
      .post("/api/members")
      .set(bearer(admin))
      .send(memberDraft())
      .expect(201);
    const response = await request(app)
      .post("/api/cards")
      .set(bearer(admin))
      .send({ memberId: created.body.data.id, pngDataUrl: "data:image/png;base64,eA==" })
      .expect(422);
    expect(response.body.title).toBe("Assinatura oficial necessária");
    expect(response.body.message).toBe(
      "Não é possível gerar a carteirinha porque a assinatura oficial do Presidente ainda não foi cadastrada.",
    );
  });

  it("seed (público) + factory-reset (só SUPERADMIN) via HTTP", async () => {
    // Parte de base realmente vazia: o seed cria o SuperAdmin sem auditoria.
    await resetDatabase(db);
    await request(app).post("/api/system/seed").send({}).expect(200);
    const seeded = await request(app)
      .post("/api/auth/login")
      .send({ login: "amococ", password: "123" })
      .expect(200);
    const seedToken = seeded.body.data.accessToken as string;
    const audit = await request(app)
      .get("/api/audit")
      .set({ Authorization: `Bearer ${seedToken}` })
      .expect(200);
    // O seed não gera auditoria: o único registro é o LOGIN acima.
    expect(audit.body.data).toHaveLength(1);
    expect(audit.body.data[0].action).toBe("LOGIN");

    // Não-superadmin é barrado mesmo com settings.edit.
    const editor = await createIdentity(app, db, {
      login: "editor",
      permissions: ["settings.edit"],
    });
    await request(app)
      .post("/api/system/factory-reset")
      .set(bearer(editor))
      .send({})
      .expect(403);

    const reset = await request(app)
      .post("/api/system/factory-reset")
      .set({ Authorization: `Bearer ${seedToken}` })
      .send({})
      .expect(200);
    expect(reset.body.data).toEqual({ reset: true });
  });
});
