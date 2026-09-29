import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env.js";

// Erro centralizado: resposta JSON com status 500, sem vazar stacktrace em
// produção. Registrado por último no app.
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (!isProduction) {
    console.error(err);
  }
  res.status(500).json({ status: "error", message: "Erro interno do servidor." });
}
