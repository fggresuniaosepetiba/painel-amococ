import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middlewares/requireAuth.js";
import { membersController } from "./members.controller.js";

// Matriz §6 (espelho das rotas do frontend): leitura → members.view,
// escrita por ação (create/edit/inactivate/reactivate/delete).
export const membersRouter = Router();

membersRouter.get(
  "/preview-next",
  requireAuth,
  requirePermission("members.view"),
  membersController.previewNext,
);
membersRouter.get(
  "/",
  requireAuth,
  requirePermission("members.view"),
  membersController.list,
);
membersRouter.get(
  "/:id",
  requireAuth,
  requirePermission("members.view"),
  membersController.getById,
);
membersRouter.post(
  "/",
  requireAuth,
  requirePermission("members.create"),
  membersController.create,
);
membersRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("members.edit"),
  membersController.update,
);
membersRouter.post(
  "/:id/inactivate",
  requireAuth,
  requirePermission("members.inactivate"),
  membersController.inactivate,
);
membersRouter.post(
  "/:id/reactivate",
  requireAuth,
  requirePermission("members.reactivate"),
  membersController.reactivate,
);
membersRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("members.delete"),
  membersController.remove,
);
