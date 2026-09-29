import type { Request, Response } from "express";
import { parseActor } from "../../shared/actor.js";
import { toApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import {
  settingsSaveSchema,
  signatureSaveSchema,
} from "../../shared/validation.js";
import { settingsService } from "./settings.service.js";

function sendError(res: Response, err: unknown): void {
  const apiError = toApiError(err);
  res
    .status(apiError.status)
    .json({ status: "error", code: apiError.code, message: apiError.message });
}

export const settingsController = {
  async get(_req: Request, res: Response): Promise<void> {
    try {
      res
        .status(200)
        .json({ status: "ok", data: await settingsService.get(dbOf(_req)) });
    } catch (err) {
      sendError(res, err);
    }
  },

  async updateAssociation(req: Request, res: Response): Promise<void> {
    try {
      const parsed = settingsSaveSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.association) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message:
            parsed.success === false
              ? (parsed.error.issues[0]?.message ?? "Dados inválidos.")
              : "Bloco association ausente.",
        });
        return;
      }
      const saved = await settingsService.updateAssociation(
        parsed.data.association,
        parseActor(parsed.data.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: saved });
    } catch (err) {
      sendError(res, err);
    }
  },

  async updateCard(req: Request, res: Response): Promise<void> {
    try {
      const parsed = settingsSaveSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.card) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message:
            parsed.success === false
              ? (parsed.error.issues[0]?.message ?? "Dados inválidos.")
              : "Bloco card ausente.",
        });
        return;
      }
      const saved = await settingsService.updateCard(
        parsed.data.card,
        parseActor(parsed.data.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: saved });
    } catch (err) {
      sendError(res, err);
    }
  },

  async updateSecurity(req: Request, res: Response): Promise<void> {
    try {
      const parsed = settingsSaveSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.security) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message:
            parsed.success === false
              ? (parsed.error.issues[0]?.message ?? "Dados inválidos.")
              : "Bloco security ausente.",
        });
        return;
      }
      const saved = await settingsService.updateSecurity(
        parsed.data.security,
        parseActor(parsed.data.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: saved });
    } catch (err) {
      sendError(res, err);
    }
  },

  async saveSignature(req: Request, res: Response): Promise<void> {
    try {
      const parsed = signatureSaveSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        });
        return;
      }
      const saved = await settingsService.saveSignature(
        parsed.data,
        parseActor(parsed.data.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: saved });
    } catch (err) {
      sendError(res, err);
    }
  },
};
