import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middlewares/requireAuth.js";
import { usersController } from "./users.controller.js";

// Matriz §6 (espelho da tela de usuários): leitura → users.view,
// criação → users.create, edição → users.edit, inativação/reativação →
// users.inactivate, permissões → users.permissions, redefinição de senha →
// users.edit (mesmo gate do botão "Redefinir senha"). O `/verify` temporário
// da Fase 4 foi removido (login agora é JWT em /api/auth).
export const usersRouter = Router();

usersRouter.get(
  "/",
  requireAuth,
  requirePermission("users.view"),
  usersController.list,
);
usersRouter.get(
  "/:id",
  requireAuth,
  requirePermission("users.view"),
  usersController.getById,
);
usersRouter.post(
  "/",
  requireAuth,
  requirePermission("users.create"),
  usersController.create,
);
usersRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("users.edit"),
  usersController.update,
);
usersRouter.post(
  "/:id/status",
  requireAuth,
  requirePermission("users.inactivate"),
  usersController.setStatus,
);
usersRouter.put(
  "/:id/permissions",
  requireAuth,
  requirePermission("users.permissions"),
  usersController.savePermissions,
);
usersRouter.post(
  "/:id/reset-password",
  requireAuth,
  requirePermission("users.edit"),
  usersController.resetPassword,
);
