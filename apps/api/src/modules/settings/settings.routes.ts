import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middlewares/requireAuth.js";
import { settingsController } from "./settings.controller.js";

// Matriz §10: leitura → settings.view, escrita → settings.edit.
export const settingsRouter = Router();

settingsRouter.get(
  "/",
  requireAuth,
  requirePermission("settings.view"),
  settingsController.get,
);
settingsRouter.patch(
  "/association",
  requireAuth,
  requirePermission("settings.edit"),
  settingsController.updateAssociation,
);
settingsRouter.patch(
  "/card",
  requireAuth,
  requirePermission("settings.edit"),
  settingsController.updateCard,
);
settingsRouter.patch(
  "/security",
  requireAuth,
  requirePermission("settings.edit"),
  settingsController.updateSecurity,
);
settingsRouter.put(
  "/signature",
  requireAuth,
  requirePermission("settings.edit"),
  settingsController.saveSignature,
);
