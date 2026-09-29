import type { Request, Response } from "express";
import type { Permission } from "@amococ/shared";
import type { ZodSchema } from "zod";
import { parseActor } from "../../shared/actor.js";
import { toApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import {
  resetPasswordSchema,
  userDraftSchema,
  userPermissionsSchema,
  userStatusSchema,
  userUpdateSchema,
} from "../../shared/validation.js";
import { usersService } from "./users.service.js";

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

export const usersController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({ status: "ok", data: await usersService.list(dbOf(req)) });
    } catch (err) {
      sendError(res, err);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const user = await usersService.getById(req.params.id!, dbOf(req));
      if (!user) {
        res.status(404).json({
          status: "error",
          code: "USER_NOT_FOUND",
          message: "USER_NOT_FOUND",
        });
        return;
      }
      res.status(200).json({ status: "ok", data: user });
    } catch (err) {
      sendError(res, err);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = parse(res, userDraftSchema, req.body);
      if (!input) return;
      const user = await usersService.create(
        {
          ...input,
          email: input.email ?? "",
          permissions: input.permissions as Permission[],
          actor: parseActor(input.actor),
        },
        dbOf(req),
      );
      res.status(201).json({ status: "ok", data: user });
    } catch (err) {
      sendError(res, err);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const input = parse(res, userUpdateSchema, req.body);
      if (!input) return;
      const user = await usersService.update(
        req.params.id!,
        {
          ...input,
          email: input.email ?? "",
          permissions: input.permissions as Permission[],
        },
        parseActor(input.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: user });
    } catch (err) {
      sendError(res, err);
    }
  },

  async setStatus(req: Request, res: Response): Promise<void> {
    try {
      const input = parse(res, userStatusSchema, req.body);
      if (!input) return;
      const user = await usersService.setStatus(
        req.params.id!,
        input.status,
        parseActor(input.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: user });
    } catch (err) {
      sendError(res, err);
    }
  },

  async savePermissions(req: Request, res: Response): Promise<void> {
    try {
      const input = parse(res, userPermissionsSchema, req.body);
      if (!input) return;
      const user = await usersService.savePermissions(
        req.params.id!,
        input.permissions as Permission[],
        parseActor(input.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: user });
    } catch (err) {
      sendError(res, err);
    }
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const input = parse(res, resetPasswordSchema, req.body);
      if (!input) return;
      await usersService.resetPassword(
        req.params.id!,
        input.newPassword,
        parseActor(input.actor),
        dbOf(req),
      );
      res.status(200).json({ status: "ok", data: { reset: true } });
    } catch (err) {
      sendError(res, err);
    }
  },
};
