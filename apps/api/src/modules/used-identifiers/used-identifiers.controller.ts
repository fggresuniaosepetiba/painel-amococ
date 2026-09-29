import type { Request, Response } from "express";
import { toApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import { usedIdentifierRegisterSchema } from "../../shared/validation.js";
import { usedIdentifiersService } from "./used-identifiers.service.js";

function sendError(res: Response, err: unknown): void {
  const apiError = toApiError(err);
  res
    .status(apiError.status)
    .json({ status: "error", code: apiError.code, message: apiError.message });
}

export const usedIdentifiersController = {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      res
        .status(200)
        .json({ status: "ok", data: await usedIdentifiersService.list(dbOf(_req)) });
    } catch (err) {
      sendError(res, err);
    }
  },

  async check(req: Request, res: Response): Promise<void> {
    try {
      const { value } = req.query;
      if (typeof value !== "string" || value.length === 0) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: "Parâmetro value ausente.",
        });
        return;
      }
      const used = await usedIdentifiersService.isUsed(value, dbOf(req));
      res.status(200).json({ status: "ok", data: { value, used } });
    } catch (err) {
      sendError(res, err);
    }
  },

  async register(req: Request, res: Response): Promise<void> {
    try {
      const parsed = usedIdentifierRegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        });
        return;
      }
      await usedIdentifiersService.register(
        {
          ...parsed.data,
          usedAt: new Date().toISOString(),
        },
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: { registered: true } });
    } catch (err) {
      sendError(res, err);
    }
  },
};
