import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env.js";
import { ApiError } from "../shared/api-error.js";

// Erro centralizado: ApiError vira seu status/código; resto é 500 JSON,
// sem vazar stacktrace em produção. Registrado por último no app.
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    const body: Record<string, string> = {
      status: "error",
      code: err.code,
      message: err.message,
    };
    if (err.title) body["title"] = err.title;
    res.status(err.status).json(body);
    return;
  }
  if (!isProduction) {
    console.error(err);
  }
  res.status(500).json({ status: "error", message: "Erro interno do servidor." });
}
