import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

vi.mock("./lib/prisma.js", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

const queryRawMock = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("responde 200 connected quando o banco está acessível", async () => {
    queryRawMock.mockResolvedValueOnce(1);

    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "amococ-api",
      database: "connected",
    });
  });

  it("responde 503 disconnected quando o banco está inacessível", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("connection refused"));

    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "degraded",
      service: "amococ-api",
      database: "disconnected",
    });
  });

  it("responde 404 JSON em rota inexistente", async () => {
    const response = await request(createApp()).get("/api/inexistente");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: "error",
      code: "NOT_FOUND",
      message: "Rota não encontrada.",
    });
  });
});
