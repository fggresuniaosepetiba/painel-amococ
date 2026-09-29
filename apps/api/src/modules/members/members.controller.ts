import type { Request, Response } from "express";
import { parseActor } from "../../shared/actor.js";
import { toApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import { memberDraftSchema } from "../../shared/validation.js";
import { membersService } from "./members.service.js";

function sendError(res: Response, err: unknown): void {
  const apiError = toApiError(err);
  res
    .status(apiError.status)
    .json({ status: "error", code: apiError.code, message: apiError.message });
}

export const membersController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      const members = await membersService.list(dbOf(req));
      const filtered =
        status === "ATIVO" || status === "INATIVO"
          ? members.filter((m) => m.status === status)
          : members;
      res.status(200).json({ status: "ok", data: filtered });
    } catch (err) {
      sendError(res, err);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const member = await membersService.getById(req.params.id!, dbOf(req));
      if (!member) {
        res.status(404).json({
          status: "error",
          code: "MEMBER_NOT_FOUND",
          message: "MEMBER_NOT_FOUND",
        });
        return;
      }
      res.status(200).json({ status: "ok", data: member });
    } catch (err) {
      sendError(res, err);
    }
  },

  async previewNext(req: Request, res: Response): Promise<void> {
    try {
      const membershipNumber = await membersService.previewNext(dbOf(req));
      res.status(200).json({ status: "ok", data: { membershipNumber } });
    } catch (err) {
      sendError(res, err);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const parsed = memberDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        });
        return;
      }
      const member = await membersService.create(
        {
          ...parsed.data,
          actor: parseActor(parsed.data.actor),
        },
        dbOf(req),
      );
      res.status(201).json({ status: "ok", data: member });
    } catch (err) {
      sendError(res, err);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const parsed = memberDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        });
        return;
      }
      const member = await membersService.update(
        req.params.id!,
        parsed.data,
        parseActor(parsed.data.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: member });
    } catch (err) {
      sendError(res, err);
    }
  },

  async inactivate(req: Request, res: Response): Promise<void> {
    try {
      const member = await membersService.inactivate(
        req.params.id!,
        parseActor((req.body as { actor?: unknown } | undefined)?.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: member });
    } catch (err) {
      sendError(res, err);
    }
  },

  async reactivate(req: Request, res: Response): Promise<void> {
    try {
      const member = await membersService.reactivate(
        req.params.id!,
        parseActor((req.body as { actor?: unknown } | undefined)?.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: member });
    } catch (err) {
      sendError(res, err);
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await membersService.delete(
        req.params.id!,
        parseActor((req.body as { actor?: unknown } | undefined)?.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: { deleted: true } });
    } catch (err) {
      sendError(res, err);
    }
  },
};
