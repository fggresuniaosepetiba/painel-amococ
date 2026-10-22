import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middlewares/requireAuth.js";
import { declarationsController } from "./declarations.controller.js";

// Matriz §6 (espelho das rotas do frontend): leitura/impressão →
// declarations.view, escrita por ação (create/inactivate/reactivate/delete).
export const declarationsRouter = Router();

declarationsRouter.get(
  "/",
  requireAuth,
  requirePermission("declarations.view"),
  declarationsController.list,
);
declarationsRouter.get(
  "/:id",
  requireAuth,
  requirePermission("declarations.view"),
  declarationsController.getById,
);
declarationsRouter.post(
  "/",
  requireAuth,
  requirePermission("declarations.create"),
  declarationsController.create,
);
declarationsRouter.post(
  "/:id/printed",
  requireAuth,
  requirePermission("declarations.view"),
  declarationsController.registerPrint,
);
declarationsRouter.post(
  "/:id/inactivate",
  requireAuth,
  requirePermission("declarations.inactivate"),
  declarationsController.inactivate,
);
declarationsRouter.post(
  "/:id/reactivate",
  requireAuth,
  requirePermission("declarations.reactivate"),
  declarationsController.reactivate,
);
declarationsRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("declarations.delete"),
  declarationsController.remove,
);
