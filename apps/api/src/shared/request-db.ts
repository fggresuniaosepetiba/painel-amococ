import type { Request } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Cliente de banco da requisição: em produção é o singleton; nos testes de
// integração, o banco isolado injetado via createApp(client).
export function dbOf(req: Request): PrismaClient {
  return (req.app.locals["db"] as PrismaClient | undefined) ?? prisma;
}
