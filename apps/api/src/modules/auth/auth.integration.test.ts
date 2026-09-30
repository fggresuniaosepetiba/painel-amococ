import { createHash } from "node:crypto";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createApp } from "../../app.js";
import { createTestClient, resetDatabase } from "../../test/db.js";
import { bearer, createIdentity, type TestIdentity } from "../../test/auth-helpers.js";
import { createId } from "../../shared/ids.js";
import { passwordHasher } from "../users/password-hasher.js";
import { usersRepository } from "../users/users.repository.js";
import { INVALID_CREDENTIALS_MESSAGE } from "./auth.service.js";
import { systemService } from "../system/system.service.js";

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
  vi.unstubAllEnvs();
});

async function seedSettings(): Promise<void> {
  await systemService.seed({ demo: false }, db);
}

describe("auth — login", () => {
  it("login válido retorna tokens + PublicUser, carimba lastLoginAt e audita LOGIN", async () => {
    const identity = await createIdentity(app, db, { login: "amococ" });

    expect(identity.accessToken).toBeTruthy();
    expect(identity.refreshToken).toBeTruthy();
    expect(identity.user).not.toHaveProperty("salt");
    expect(identity.user).not.toHaveProperty("passwordHash");
    expect(identity.user.lastLoginAt).toBeTruthy();

    const log = await db.auditLog.findFirst({ where: { action: "LOGIN" } });
    expect(log?.userId).toBe(identity.user.id);
    expect(log?.details).toBe("Login realizado por amococ");
  });

  it("senha errada e usuário inexistente → mesmo 401 §14", async () => {
    await createIdentity(app, db, { login: "alguem", password: "certa123" });
    const before = await db.auditLog.count({ where: { action: "LOGIN" } });

    for (const body of [
      { login: "alguem", password: "errada" },
      { login: "ninguem", password: "qualquer" },
    ]) {
      const res = await request(app).post("/api/auth/login").send(body).expect(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
      expect(res.body.message).toBe(
        "Usuário ou senha incorretos. Verifique os dados e tente novamente.",
      );
    }
    // Nenhum LOGIN novo — só o do setup.
    expect(await db.auditLog.count({ where: { action: "LOGIN" } })).toBe(before);
  });

  it("INATIVO recebe a mesma mensagem (sem distinguir)", async () => {
    const { createAccount } = await import("../../test/auth-helpers.js");
    const account = await createAccount(db, {
      login: "inativo",
      password: "senha123",
      status: "INATIVO",
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ login: account.login, password: account.password })
      .expect(401);
    expect(res.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it("hash legado SHA-256 funciona 1x e vira bcrypt (upgrade transparente)", async () => {
    const salt = "saltlegado123";
    const legacyHash = createHash("sha256")
      .update(`${salt}:senha-antiga`, "utf8")
      .digest("hex");
    const now = new Date().toISOString();
    await usersRepository.create(db, {
      id: createId(),
      name: "Legado",
      login: "legado",
      email: "",
      role: "COLABORADOR",
      status: "ATIVO",
      permissions: [],
      salt,
      passwordHash: legacyHash,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ login: "legado", password: "senha-antiga" })
      .expect(200);
    expect(res.body.data.accessToken).toBeTruthy();

    const stored = await usersRepository.getByLogin(db, "legado");
    expect(stored!.passwordHash).not.toBe(legacyHash);
    expect(await passwordHasher.verify("senha-antiga", stored!.passwordHash)).toBe(true);
  });
});

describe("auth — refresh rotativo", () => {
  it("rotaciona o par e o refresh antigo morre", async () => {
    const identity = await createIdentity(app, db, { login: "rot" });

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: identity.refreshToken })
      .expect(200);
    expect(res.body.data.refreshToken).not.toBe(identity.refreshToken);
    expect(res.body.data.accessToken).toBeTruthy();

    // Reuso do refresh já rotacionado → 401.
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: identity.refreshToken })
      .expect(401);
  });

  it("reuso de refresh revoga TODAS as sessões do usuário", async () => {
    const identity = await createIdentity(app, db, { login: "roubo" });
    // Segunda sessão ativa (outro dispositivo).
    const second = await request(app)
      .post("/api/auth/login")
      .send({ login: "roubo", password: identity.password })
      .expect(200);

    const rotated = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: identity.refreshToken })
      .expect(200);

    // Reapresenta o refresh antigo (roubado): derruba tudo.
    const reuse = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: identity.refreshToken })
      .expect(401);
    expect(reuse.body.code).toBe("SESSION_REUSED");

    // Nem o par novo nem o do outro dispositivo funcionam mais.
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: rotated.body.data.refreshToken })
      .expect(401);
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: second.body.data.refreshToken })
      .expect(401);
  });

  it("refresh expirado → 401", async () => {
    const identity = await createIdentity(app, db, { login: "exp" });
    await db.session.updateMany({
      where: { userId: identity.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: identity.refreshToken })
      .expect(401);
  });
});

describe("auth — logout e me", () => {
  it("logout revoga, audita LOGOUT com texto exato e é idempotente", async () => {
    const identity = await createIdentity(app, db, { login: "saida" });

    await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: identity.refreshToken })
      .expect(200);

    const log = await db.auditLog.findFirst({ where: { action: "LOGOUT" } });
    expect(log?.userId).toBe(identity.user.id);
    expect(log?.details).toBe("Sessão encerrada por saida");

    // Refresh revogado não ressuscita; logout repetido é no-op 200.
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: identity.refreshToken })
      .expect(401);
    await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: identity.refreshToken })
      .expect(200);
  });

  it("me retorna o usuário com Bearer válido e 401 sem ele", async () => {
    const identity = await createIdentity(app, db, { login: "eu" });
    const res = await request(app)
      .get("/api/auth/me")
      .set(bearer(identity))
      .expect(200);
    expect(res.body.data.login).toBe("eu");
    expect(res.body.data).not.toHaveProperty("passwordHash");

    await request(app).get("/api/auth/me").expect(401);
    await request(app)
      .get("/api/auth/me")
      .set({ Authorization: "Bearer lixo" })
      .expect(401);
  });
});

describe("auth — troca de senha própria", () => {
  it("troca com a atual correta: bcrypt, carimbo, auditoria sem vazar a senha", async () => {
    await seedSettings();
    const identity: TestIdentity = await createIdentity(app, db, {
      login: "troca",
      password: "antiga123",
    });

    await request(app)
      .post("/api/auth/change-password")
      .set(bearer(identity))
      .send({ currentPassword: "antiga123", newPassword: "nova-senha-456" })
      .expect(200);

    // Nova senha funciona; antiga não.
    await request(app)
      .post("/api/auth/login")
      .send({ login: "troca", password: "nova-senha-456" })
      .expect(200);
    await request(app)
      .post("/api/auth/login")
      .send({ login: "troca", password: "antiga123" })
      .expect(401);

    const stored = await usersRepository.getByLogin(db, "troca");
    expect(await passwordHasher.verify("nova-senha-456", stored!.passwordHash)).toBe(true);
    expect(stored!.mustChangePassword).toBe(false);

    const { settingsService } = await import("../settings/settings.service.js");
    const saved = await settingsService.get(db);
    expect(saved.security.lastPasswordChangeAt).toBeTruthy();
    const log = await db.auditLog.findFirst({ where: { action: "PASSWORD_CHANGED" } });
    expect(log?.details).toContain("Senha alterada");
    expect(log?.details).not.toContain("nova-senha-456");

    const security = await db.setting.findUnique({ where: { id: "general" } });
    expect(security).toBeTruthy();
  });

  it("senha atual errada → 401 com mensagem exata §14", async () => {
    await seedSettings();
    const identity = await createIdentity(app, db, {
      login: "troca2",
      password: "certa123",
    });
    const res = await request(app)
      .post("/api/auth/change-password")
      .set(bearer(identity))
      .send({ currentPassword: "errada", newPassword: "nova-senha-456" })
      .expect(401);
    expect(res.body.message).toBe("A senha atual está incorreta.");
  });

  it("sem Bearer → 401", async () => {
    await request(app)
      .post("/api/auth/change-password")
      .send({ currentPassword: "x", newPassword: "nova-senha-456" })
      .expect(401);
  });
});

describe("auth — rate-limit do login", () => {
  it("estoura o teto configurado via LOGIN_RATE_LIMIT_MAX → 429", async () => {
    vi.stubEnv("LOGIN_RATE_LIMIT_MAX", "3");
    vi.resetModules();
    const freshApp = (await import("../../app.js")).createApp(db);
    const { createAccount } = await import("../../test/auth-helpers.js");

    // Criado via service: nenhuma requisição HTTP consome o teto.
    await createAccount(db, { login: "limite", password: "senha123" });
    for (let i = 0; i < 3; i++) {
      await request(freshApp)
        .post("/api/auth/login")
        .send({ login: "limite", password: "errada" })
        .expect(401);
    }
    const limited = await request(freshApp)
      .post("/api/auth/login")
      .send({ login: "limite", password: "errada" })
      .expect(429);
    expect(limited.body.code).toBe("RATE_LIMITED");

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
