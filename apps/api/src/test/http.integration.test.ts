import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestClient, resetDatabase } from "./db.js";
import { ACTOR, memberDraft } from "./fixtures.js";

let db: PrismaClient;
let app: Express;

beforeAll(() => {
  db = createTestClient();
  app = createApp(db);
});

beforeEach(async () => {
  await resetDatabase(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("HTTP — associados ponta a ponta", () => {
  it("cria (201), lista, detalha, inativa, reativa e exclui", async () => {
    const created = await request(app)
      .post("/api/members")
      .send({ ...memberDraft(), actor: ACTOR })
      .expect(201);
    expect(created.body.data.membershipNumber).toBe("000001");

    const id = created.body.data.id as string;
    await request(app).get("/api/members?status=ATIVO").expect(200);
    await request(app).get(`/api/members/${id}`).expect(200);

    await request(app).post(`/api/members/${id}/inactivate`).send({}).expect(200);
    const inactive = await request(app).get("/api/members?status=INATIVO").expect(200);
    expect(inactive.body.data).toHaveLength(1);

    await request(app).post(`/api/members/${id}/reactivate`).send({}).expect(200);
    await request(app).post(`/api/members/${id}/inactivate`).send({}).expect(200);
    await request(app).delete(`/api/members/${id}`).send({}).expect(200);
    await request(app).get(`/api/members/${id}`).expect(404);
  });

  it("CPF inválido → 400 VALIDATION_ERROR", async () => {
    const response = await request(app)
      .post("/api/members")
      .send(memberDraft({ cpf: "123" }))
      .expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("excluir ATIVO → 422 com mensagem exata", async () => {
    const created = await request(app)
      .post("/api/members")
      .send(memberDraft())
      .expect(201);
    const response = await request(app)
      .delete(`/api/members/${created.body.data.id}`)
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
      .send({
        name: "Admin",
        login: "Admin",
        email: "",
        role: "ADMINISTRADOR",
        status: "ATIVO",
        permissions: ["members.view"],
        initialPassword: "abc123",
      })
      .expect(201);
    expect(response.body.data.login).toBe("admin");
    expect(response.body.data).not.toHaveProperty("passwordHash");
  });

  it("gera carteirinha bloqueada sem assinatura (título + corpo exatos)", async () => {
    const created = await request(app)
      .post("/api/members")
      .send(memberDraft())
      .expect(201);
    const response = await request(app)
      .post("/api/cards")
      .send({ memberId: created.body.data.id, pngDataUrl: "data:image/png;base64,eA==" })
      .expect(422);
    expect(response.body.title).toBe("Assinatura oficial necessária");
    expect(response.body.message).toBe(
      "Não é possível gerar a carteirinha porque a assinatura oficial do Presidente ainda não foi cadastrada.",
    );
  });

  it("seed + factory-reset via HTTP", async () => {
    await request(app).post("/api/system/seed").send({}).expect(200);
    const audit = await request(app).get("/api/audit").expect(200);
    expect(audit.body.data).toHaveLength(0);

    const reset = await request(app)
      .post("/api/system/factory-reset")
      .send({})
      .expect(200);
    expect(reset.body.data).toEqual({ reset: true });
  });
});
