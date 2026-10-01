import cors from "cors";
import express from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
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

  // Atrás de proxy reverso (Render): confia no primeiro hop para que
  // req.ip reflita o cliente real. Sem isso, o express-rate-limit registra
  // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR e todo o tráfego compartilha um
  // único balde de rate-limit (IP do proxy). `1` = só o hop mais próximo.
  app.set("trust proxy", 1);

  app.use(cors({ origin: env.corsOrigins }));
  // Limite alto: foto/assinatura/PNG trafegam como data URL no JSON.
  app.use(express.json({ limit: "10mb" }));

  app.use("/api", healthRouter);
  // Auth: login/refresh/logout públicos (rate-limit no login); me e
  // change-password exigem Bearer (definidos no authRouter).
  app.use("/api/auth", authRouter);
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
