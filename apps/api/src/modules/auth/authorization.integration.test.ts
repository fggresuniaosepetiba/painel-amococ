import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import type { User } from "@amococ/shared";
import type { Permission } from "@amococ/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createTestClient, resetDatabase } from "../../test/db.js";
import { memberDraft } from "../../test/fixtures.js";
import { createId } from "../../shared/ids.js";
import { passwordHasher } from "../users/password-hasher.js";
import { usersRepository } from "../users/users.repository.js";
import { membersService } from "../members/members.service.js";
import { signAccessToken } from "./tokens.js";

// Matriz de autorização §6 (server-side, espelho do frontend):
// para cada endpoint, com permissão → passa (nunca 401/403),
// sem permissão → 403, SUPERADMIN sem permissões → passa (bypass),
// sem token → 401. Tokens cunhados direto (o fluxo JWT é coberto
// em auth.integration.test.ts); hash bcrypt calculado uma vez.

let db: PrismaClient;
let app: Express;
let fixedHash: { salt: string; hash: string };
let memberId: string;
let otherUserId: string;

const MATRIX_PASSWORD = "matrix-123";

async function makeUser(
  role: "SUPERADMIN" | "ADMINISTRADOR",
  permissions: Permission[],
): Promise<string> {
  const now = new Date().toISOString();
  const created: User = await usersRepository.create(db, {
    id: createId(),
    name: `Matrix ${role}`,
    login: `matrix-${createId()}`.toLowerCase(),
    email: "",
    role,
    status: "ATIVO",
    permissions,
    salt: fixedHash.salt,
    passwordHash: fixedHash.hash,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });
  return signAccessToken({
    id: created.id,
    name: created.name,
    role: created.role,
    permissions: created.permissions,
  });
}

beforeAll(async () => {
  db = createTestClient();
  app = createApp(db);
  fixedHash = await passwordHasher.hash(MATRIX_PASSWORD);
});

beforeEach(async () => {
  await resetDatabase(db);
  const member = await membersService.create(
    { ...memberDraft(), actor: { id: "matrix", name: "matrix" } },
    db,
  );
  memberId = member.id;
  const now = new Date().toISOString();
  const other = await usersRepository.create(db, {
    id: createId(),
    name: "Matrix Alvo",
    login: `matrix-alvo-${createId()}`.toLowerCase(),
    email: "",
    role: "COLABORADOR",
    status: "ATIVO",
    permissions: [],
    salt: fixedHash.salt,
    passwordHash: fixedHash.hash,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });
  otherUserId = other.id;
});

afterAll(async () => {
  await db.$disconnect();
});

type Method = "get" | "post" | "patch" | "put" | "delete";

interface MatrixRow {
  name: string;
  method: Method;
  path: () => string;
  permission: Permission | "SUPERADMIN_ONLY" | "AUTH_ONLY" | "PUBLIC";
  body?: () => unknown;
  /** Preparo por cenário (ex.: inativar antes de excluir). */
  prepare?: () => Promise<void>;
}

const userDraftBody = () => ({
  name: "Matrix Novo",
  login: `matrix-novo-${createId()}`.toLowerCase(),
  email: "",
  role: "COLABORADOR",
  status: "ATIVO",
  permissions: [],
  initialPassword: "senha123",
});

const settingsBlocks = () => ({
  association: {},
  card: {},
  security: {},
});

const ROWS: MatrixRow[] = [
  { name: "GET /api/members", method: "get", path: () => "/api/members", permission: "members.view" },
  { name: "GET /api/members/preview-next", method: "get", path: () => "/api/members/preview-next", permission: "members.view" },
  { name: "GET /api/members/:id", method: "get", path: () => `/api/members/${memberId}`, permission: "members.view" },
  { name: "POST /api/members", method: "post", path: () => "/api/members", permission: "members.create", body: () => memberDraft() },
  { name: "PATCH /api/members/:id", method: "patch", path: () => `/api/members/${memberId}`, permission: "members.edit", body: () => memberDraft() },
  { name: "POST /api/members/:id/inactivate", method: "post", path: () => `/api/members/${memberId}/inactivate`, permission: "members.inactivate", body: () => ({}) },
  {
    name: "POST /api/members/:id/reactivate",
    method: "post",
    path: () => `/api/members/${memberId}/reactivate`,
    permission: "members.reactivate",
    body: () => ({}),
    prepare: () => membersService.inactivate(memberId, { id: "matrix", name: "matrix" }, db).then(() => undefined),
  },
  {
    name: "DELETE /api/members/:id",
    method: "delete",
    path: () => `/api/members/${memberId}`,
    permission: "members.delete",
    body: () => ({}),
    prepare: () => membersService.inactivate(memberId, { id: "matrix", name: "matrix" }, db).then(() => undefined),
  },
  { name: "GET /api/cards", method: "get", path: () => "/api/cards", permission: "cards.view" },
  { name: "GET /api/cards/:id (inexistente)", method: "get", path: () => "/api/cards/inexistente", permission: "cards.view" },
  {
    name: "POST /api/cards",
    method: "post",
    path: () => "/api/cards",
    permission: "cards.generate",
    body: () => ({ memberId, pngDataUrl: "data:image/png;base64,eA==" }),
  },
  {
    name: "POST /api/cards/:id/downloaded",
    method: "post",
    path: () => `/api/cards/${memberId}/downloaded`,
    permission: "cards.download",
    body: () => ({}),
  },
  { name: "GET /api/users", method: "get", path: () => "/api/users", permission: "users.view" },
  { name: "GET /api/users/:id", method: "get", path: () => `/api/users/${otherUserId}`, permission: "users.view" },
  { name: "POST /api/users", method: "post", path: () => "/api/users", permission: "users.create", body: userDraftBody },
  {
    name: "PATCH /api/users/:id",
    method: "patch",
    path: () => `/api/users/${otherUserId}`,
    permission: "users.edit",
    body: () => ({ ...userDraftBody(), initialPassword: undefined }),
  },
  {
    name: "POST /api/users/:id/status",
    method: "post",
    path: () => `/api/users/${otherUserId}/status`,
    permission: "users.inactivate",
    body: () => ({ status: "INATIVO" }),
  },
  {
    name: "PUT /api/users/:id/permissions",
    method: "put",
    path: () => `/api/users/${otherUserId}/permissions`,
    permission: "users.permissions",
    body: () => ({ permissions: ["members.view"] }),
  },
  {
    name: "POST /api/users/:id/reset-password",
    method: "post",
    path: () => `/api/users/${otherUserId}/reset-password`,
    permission: "users.edit",
    body: () => ({ newPassword: "nova-senha-789" }),
  },
  { name: "GET /api/settings", method: "get", path: () => "/api/settings", permission: "settings.view" },
  {
    name: "PATCH /api/settings/association",
    method: "patch",
    path: () => "/api/settings/association",
    permission: "settings.edit",
    body: settingsBlocks,
  },
  {
    name: "PATCH /api/settings/card",
    method: "patch",
    path: () => "/api/settings/card",
    permission: "settings.edit",
    body: settingsBlocks,
  },
  {
    name: "PATCH /api/settings/security",
    method: "patch",
    path: () => "/api/settings/security",
    permission: "settings.edit",
    body: settingsBlocks,
  },
  {
    name: "PUT /api/settings/signature",
    method: "put",
    path: () => "/api/settings/signature",
    permission: "settings.edit",
    body: () => ({ presidentName: "Matrix" }),
  },
  { name: "GET /api/audit", method: "get", path: () => "/api/audit", permission: "audit.view" },
  {
    name: "POST /api/audit (só autenticado — CARD_DOWNLOADED client-side)",
    method: "post",
    path: () => "/api/audit",
    permission: "AUTH_ONLY",
    body: () => ({
      userId: null,
      userName: "matrix",
      action: "CARD_DOWNLOADED",
      entity: "card",
      entityId: "x",
      details: "download de teste",
    }),
  },
  { name: "GET /api/used-identifiers", method: "get", path: () => "/api/used-identifiers", permission: "members.view" },
  {
    name: "GET /api/used-identifiers/check",
    method: "get",
    path: () => "/api/used-identifiers/check?value=000001&type=membershipNumber",
    permission: "members.view",
  },
  {
    name: "POST /api/used-identifiers",
    method: "post",
    path: () => "/api/used-identifiers",
    permission: "members.create",
    body: () => ({ value: "000099", type: "membershipNumber", memberName: "Matrix" }),
  },
  { name: "POST /api/system/seed (público)", method: "post", path: () => "/api/system/seed", permission: "PUBLIC", body: () => ({}) },
  {
    name: "POST /api/system/factory-reset (só SUPERADMIN)",
    method: "post",
    path: () => "/api/system/factory-reset",
    permission: "SUPERADMIN_ONLY",
    body: () => ({}),
  },
  {
    name: "POST /api/system/import",
    method: "post",
    path: () => "/api/system/import",
    permission: "settings.edit",
    body: () => ({}),
  },
];

async function call(row: MatrixRow, token?: string) {
  await row.prepare?.();
  let req = request(app)[row.method](row.path());
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  const body = row.body?.();
  if (body !== undefined && body !== null) req = req.send(body as object);
  return req;
}

describe("autorização — matriz por endpoint", () => {
  for (const row of ROWS) {
    describe(row.name, () => {
      if (row.permission === "PUBLIC") {
        it("acessível sem token", async () => {
          const res = await call(row);
          expect(res.status).toBe(200);
        });
        return;
      }

      it("com a permissão → passa na autorização (nunca 401/403)", async () => {
        const permission =
          row.permission === "SUPERADMIN_ONLY" || row.permission === "AUTH_ONLY"
            ? []
            : [row.permission];
        const role =
          row.permission === "SUPERADMIN_ONLY" ? "SUPERADMIN" : "ADMINISTRADOR";
        const token = await makeUser(role, permission as Permission[]);
        const res = await call(row, token);
        expect([401, 403]).not.toContain(res.status);
        expect(res.status).toBeLessThan(500);
      });

      it("sem a permissão → 403", async () => {
        if (row.permission === "AUTH_ONLY") {
          // POST /api/audit exige só autenticação: sem permissões passa.
          const token = await makeUser("ADMINISTRADOR", []);
          const res = await call(row, token);
          expect(res.status).toBe(201);
          return;
        }
        const role =
          row.permission === "SUPERADMIN_ONLY" ? "ADMINISTRADOR" : "ADMINISTRADOR";
        const token = await makeUser(role, []);
        const res = await call(row, token);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("FORBIDDEN");
      });

      it("SUPERADMIN sem permissões → bypass (passa)", async () => {
        const token = await makeUser("SUPERADMIN", []);
        const res = await call(row, token);
        expect([401, 403]).not.toContain(res.status);
        expect(res.status).toBeLessThan(500);
      });

      it("sem token → 401", async () => {
        const res = await call(row);
        expect(res.status).toBe(401);
      });
    });
  }
});
