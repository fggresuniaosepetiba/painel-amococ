import { Router } from "express";
import type { Request, Response } from "express";
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

systemRouter.post("/seed", async (req: Request, res: Response) => {
  try {
    const demo = (req.body as { demo?: unknown } | undefined)?.demo === true;
    res
      .status(200)
      .json({ status: "ok", data: await systemService.seed({ demo }, dbOf(req)) });
  } catch (err) {
    sendError(res, err);
  }
});

systemRouter.post("/factory-reset", async (_req: Request, res: Response) => {
  try {
    res
      .status(200)
      .json({ status: "ok", data: await systemService.factoryReset(dbOf(_req)) });
  } catch (err) {
    sendError(res, err);
  }
});
