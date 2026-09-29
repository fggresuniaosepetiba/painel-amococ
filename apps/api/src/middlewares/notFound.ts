import type { Request, Response } from "express";

// Rota inexistente → 404 JSON (registrado após todas as rotas).
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ status: "error", message: "Rota não encontrada." });
}
