import type { Request, Response } from "express";
import { toApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import { isAuditAction } from "../../domain/audit-actions.js";
import { auditCreateSchema } from "../../shared/validation.js";
import { auditRepository } from "./audit.repository.js";

function sendError(res: Response, err: unknown): void {
  const apiError = toApiError(err);
  res
    .status(apiError.status)
    .json({ status: "error", code: apiError.code, message: apiError.message });
}

export const auditController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { action, limit } = req.query;
      const take =
        typeof limit === "string" && Number.isInteger(Number(limit)) && Number(limit) > 0
          ? Math.min(Number(limit), 5000)
          : 5000;
      const db = dbOf(req);
      const data =
        typeof action === "string" && isAuditAction(action)
          ? await auditRepository.filterByAction(db, action, take)
          : await auditRepository.getAll(db, take);
      res.status(200).json({ status: "ok", data });
    } catch (err) {
      sendError(res, err);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const parsed = auditCreateSchema.safeParse(req.body);
      if (!parsed.success || !isAuditAction(parsed.data.action)) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: parsed.success
            ? "Ação de auditoria inválida."
            : (parsed.error.issues[0]?.message ?? "Dados inválidos."),
        });
        return;
      }
      const entry = await auditRepository.create(dbOf(req), {
        ...parsed.data,
        action: parsed.data.action,
      });
      res.status(201).json({ status: "ok", data: entry });
    } catch (err) {
      sendError(res, err);
    }
  },
};
