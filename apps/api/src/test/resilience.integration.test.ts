import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";

// Regressão do 502 em produção: um erro inesperado (falha do banco/driver,
// tabela ausente, rede) dentro de um handler async NUNCA pode virar rejeição
// não tratada — no Node 15+ isso derruba o processo inteiro e o proxy
// responde 502 vazio, mascarando a causa real. Deve virar 500 JSON com log.
function brokenApp(): Express {
  const boom = async (): Promise<never> => {
    throw new Error("boom simulado (falha de banco/driver)");
  };
  // Qualquer acesso ao banco explode (qualquer tabela, qualquer operação).
  const db = new Proxy({}, { get: () => boom }) as unknown as PrismaClient;
  return createApp(db);
}

describe("Resiliência — erro inesperado vira 500 (nunca derruba o processo)", () => {
  it("confia no primeiro proxy (rate-limit enxerga o IP real atrás do Render)", () => {
    // Sem isso, o express-rate-limit registra ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
    // e todo o tráfego compartilha um único balde (IP do proxy).
    expect(brokenApp().get("trust proxy")).toBe(1);
  });
  it("POST /api/auth/login com banco quebrado → 500 JSON", async () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await request(brokenApp())
        .post("/api/auth/login")
        .send({ login: "amococ", password: "123" })
        .expect(500);
      expect(response.body.status).toBe("error");
    } finally {
      silence.mockRestore();
    }
  });

  it("POST /api/system/seed com banco quebrado → 500 JSON", async () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await request(brokenApp())
        .post("/api/system/seed")
        .send({})
        .expect(500);
      expect(response.body.status).toBe("error");
    } finally {
      silence.mockRestore();
    }
  });
});
