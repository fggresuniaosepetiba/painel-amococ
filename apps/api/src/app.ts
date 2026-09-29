import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { healthRouter } from "./modules/health/health.routes.js";

// Fábrica do app Express (sem listen): permite testar as rotas sem subir porta.
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json());

  app.use("/api", healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
