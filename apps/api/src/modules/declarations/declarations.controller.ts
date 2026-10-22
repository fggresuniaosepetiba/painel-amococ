import type { Request, Response } from "express";
import { reqUser } from "../../middlewares/requireAuth.js";
import { toApiError, ApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import { declarationCreateSchema } from "../../shared/validation.js";
import { declarationsService } from "./declarations.service.js";

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

export const declarationsController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      const declarations = await declarationsService.list(dbOf(req));
      const filtered =
        status === "ATIVO" || status === "INATIVO"
          ? declarations.filter((d) => d.status === status)
          : declarations;
      res.status(200).json({ status: "ok", data: filtered });
    } catch (err) {
      sendError(res, err);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const record = await declarationsService.getById(req.params.id!, dbOf(req));
      if (!record) {
        res.status(404).json({
          status: "error",
          code: "DECLARATION_NOT_FOUND",
          message: "DECLARATION_NOT_FOUND",
        });
        return;
      }
      res.status(200).json({ status: "ok", data: record });
    } catch (err) {
      sendError(res, err);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const parsed = declarationCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        });
        return;
      }
      const record = await declarationsService.create(
        parsed.data,
        reqUser(req),
        dbOf(req),
      );
      res.status(201).json({ status: "ok", data: record });
    } catch (err) {
      sendError(res, err);
    }
  },

  async registerPrint(req: Request, res: Response): Promise<void> {
    try {
      await declarationsService.registerPrint(req.params.id!, reqUser(req), dbOf(req));
      res.status(200).json({ status: "ok" });
    } catch (err) {
      sendError(res, err);
    }
  },

  async inactivate(req: Request, res: Response): Promise<void> {
    try {
      const record = await declarationsService.inactivate(
        req.params.id!,
        reqUser(req),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: record });
    } catch (err) {
      sendError(res, err);
    }
  },

  async reactivate(req: Request, res: Response): Promise<void> {
    try {
      const record = await declarationsService.reactivate(
        req.params.id!,
        reqUser(req),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: record });
    } catch (err) {
      sendError(res, err);
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await declarationsService.delete(req.params.id!, reqUser(req), dbOf(req));
      res.status(200).json({ status: "ok" });
    } catch (err) {
      sendError(res, err);
    }
  },
};
