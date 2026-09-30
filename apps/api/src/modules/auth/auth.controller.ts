import type { Request, Response } from "express";
import type { ZodSchema } from "zod";
import { toApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import type { AuthenticatedRequest } from "../../middlewares/requireAuth.js";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
} from "../../shared/validation.js";
import { authService } from "./auth.service.js";

function sendError(res: Response, err: unknown): void {
  const apiError = toApiError(err);
  res
    .status(apiError.status)
    .json({ status: "error", code: apiError.code, message: apiError.message });
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ status: "error", code: "VALIDATION_ERROR", message });
}

function parse<T>(res: Response, schema: ZodSchema<T>, body: unknown): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    badRequest(res, parsed.error.issues[0]?.message ?? "Dados inválidos.");
    return null;
  }
  return parsed.data;
}

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const input = parse(res, loginSchema, req.body);
      if (!input) return;
      const result = await authService.login(
        input.login,
        input.password,
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: result });
    } catch (err) {
      sendError(res, err);
    }
  },

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const input = parse(res, refreshSchema, req.body);
      if (!input) return;
      const result = await authService.refresh(input.refreshToken, dbOf(req));
      res.status(200).json({ status: "ok", data: result });
    } catch (err) {
      sendError(res, err);
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    try {
      // Refresh no corpo (não exige access válido: cobre logout com access
      // expirado e o encerramento por inatividade). Desconhecido = no-op.
      const body = (req.body ?? {}) as { refreshToken?: unknown };
      const refreshToken =
        typeof body.refreshToken === "string" ? body.refreshToken : undefined;
      await authService.logout(refreshToken, dbOf(req));
      res.status(200).json({ status: "ok", data: { loggedOut: true } });
    } catch (err) {
      sendError(res, err);
    }
  },

  async me(req: Request, res: Response): Promise<void> {
    try {
      const user = await authService.me(
        (req as AuthenticatedRequest).user.id,
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: user });
    } catch (err) {
      sendError(res, err);
    }
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const input = parse(res, changePasswordSchema, req.body);
      if (!input) return;
      const authReq = req as AuthenticatedRequest;
      await authService.changePassword(
        { id: authReq.user.id, name: authReq.user.name },
        input.currentPassword,
        input.newPassword,
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: { changed: true } });
    } catch (err) {
      sendError(res, err);
    }
  },
};
