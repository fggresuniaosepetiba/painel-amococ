import { Router } from "express";
import type { Request, Response } from "express";
import { isProduction } from "../../config/env.js";
import {
  requireAuth,
  requirePermission,
  requireSuperAdmin,
} from "../../middlewares/requireAuth.js";
import { toApiError } from "../../shared/api-error.js";
import { dbOf } from "../../shared/request-db.js";
import { systemService } from "./system.service.js";

function sendError(res: Response, err: unknown): void {
  const apiError = toApiError(err);
  res
    .status(apiError.status)
    .json({ status: "error", code: apiError.code, message: apiError.message });
}

export const systemRouter = Router();

// Seed público (Fase 5): o boot do frontend chama antes do login para
// garantir a base mínima (SuperAdmin amococ/123). Idempotente — só semeia
// banco vazio. `demo=true` só fora de produção (nunca injeta demo em prod).
systemRouter.post("/seed", async (req: Request, res: Response) => {
  try {
    const demo =
      (req.body as { demo?: unknown } | undefined)?.demo === true &&
      !isProduction;
    res
      .status(200)
      .json({ status: "ok", data: await systemService.seed({ demo }, dbOf(req)) });
  } catch (err) {
    sendError(res, err);
  }
});

// LIMPAR: só SUPERADMIN (mesmo gate da tela "Limpar base de dados").
systemRouter.post(
  "/factory-reset",
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      res
        .status(200)
        .json({ status: "ok", data: await systemService.factoryReset(dbOf(req)) });
    } catch (err) {
      sendError(res, err);
    }
  },
);

// Import de backup: manutenção administrativa (settings.edit).
systemRouter.post(
  "/import",
  requireAuth,
  requirePermission("settings.edit"),
  async (req: Request, res: Response) => {
    try {
      res
        .status(200)
        .json({ status: "ok", data: await systemService.importBackup(req.body, dbOf(req)) });
    } catch (err) {
      sendError(res, err);
    }
  },
);
