import type { Request, Response } from "express";
import { checkDatabaseConnection } from "./health.service.js";

const SERVICE_NAME = "amococ-api";

// Camada de apresentação do health: traduz o resultado do serviço em
// resposta HTTP (200 conectado / 503 degradado).
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const connected = await checkDatabaseConnection();
  if (connected) {
    res
      .status(200)
      .json({ status: "ok", service: SERVICE_NAME, database: "connected" });
    return;
  }
  res
    .status(503)
    .json({ status: "degraded", service: SERVICE_NAME, database: "disconnected" });
}
