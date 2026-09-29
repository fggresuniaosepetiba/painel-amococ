import cors from "cors";
import express from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { cardsRouter } from "./modules/cards/cards.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { membersRouter } from "./modules/members/members.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { systemRouter } from "./modules/system/system.routes.js";
import { usedIdentifiersRouter } from "./modules/used-identifiers/used-identifiers.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

// Fábrica do app Express (sem listen): permite testar as rotas sem subir porta.
// Aceita cliente Prisma opcional — testes injetam o banco isolado.
export function createApp(client: PrismaClient = prisma) {
  const app = express();
  app.locals["db"] = client;

  app.use(cors({ origin: env.corsOrigins }));
  // Limite alto: foto/assinatura/PNG trafegam como data URL no JSON.
  app.use(express.json({ limit: "10mb" }));

  app.use("/api", healthRouter);
  app.use("/api/members", membersRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/cards", cardsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/used-identifiers", usedIdentifiersRouter);
  app.use("/api/system", systemRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
