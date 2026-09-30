import type { Request, Response } from "express";
import { reqUser } from "../../middlewares/requireAuth.js";
import { toApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import { ApiError } from "../../shared/api-error.js";
import { cardGenerateSchema } from "../../shared/validation.js";
import { cardsService } from "./cards.service.js";

function sendError(res: Response, err: unknown): void {
  const apiError = toApiError(err);
  const body: Record<string, string> = {
    status: "error",
    code: apiError.code,
    message: apiError.message,
  };
  if (apiError instanceof ApiError && apiError.title) {
    body["title"] = apiError.title;
  }
  res.status(apiError.status).json(body);
}

export const cardsController = {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = _req.query;
      const db = dbOf(_req);
      const data =
        typeof memberId === "string"
          ? ((await cardsService.getByMemberId(memberId, db)) ?? null)
          : await cardsService.list(db);
      res.status(200).json({ status: "ok", data });
    } catch (err) {
      sendError(res, err);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const record = await cardsService.getById(req.params.id!, dbOf(req));
      if (!record) {
        res.status(404).json({
          status: "error",
          code: "CARD_NOT_FOUND",
          message: "CARD_NOT_FOUND",
        });
        return;
      }
      res.status(200).json({ status: "ok", data: record });
    } catch (err) {
      sendError(res, err);
    }
  },

  async generate(req: Request, res: Response): Promise<void> {
    try {
      const parsed = cardGenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        });
        return;
      }
      const record = await cardsService.generate(
        parsed.data.memberId,
        parsed.data.pngDataUrl,
        reqUser(req),
        dbOf(req),
      );
      res.status(201).json({ status: "ok", data: record });
    } catch (err) {
      sendError(res, err);
    }
  },

  async registerDownload(req: Request, res: Response): Promise<void> {
    try {
      const { record, fileName } = await cardsService.registerDownload(
        req.params.id!,
        reqUser(req),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: { record, fileName } });
    } catch (err) {
      sendError(res, err);
    }
  },
};
