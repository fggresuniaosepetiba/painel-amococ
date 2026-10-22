import { Router } from "express";
import { requireAuth, requireSuperAdmin } from "../../middlewares/requireAuth.js";
import { usersController } from "./users.controller.js";

// Área de usuários EXCLUSIVA do SuperAdmin (ADR-025): listagem, criação,
// edição, ciclo de vida, permissões, redefinição de senha e exclusão
// definitiva não usam mais permissões granulares — qualquer outro perfil
// recebe 403 mesmo com permissões antigas ainda gravadas. O `/verify`
// temporário da Fase 4 foi removido (login agora é JWT em /api/auth).
export const usersRouter = Router();

usersRouter.use(requireAuth, requireSuperAdmin);

usersRouter.get("/", usersController.list);
usersRouter.get("/:id", usersController.getById);
usersRouter.post("/", usersController.create);
usersRouter.patch("/:id", usersController.update);
usersRouter.post("/:id/status", usersController.setStatus);
usersRouter.put("/:id/permissions", usersController.savePermissions);
usersRouter.post("/:id/reset-password", usersController.resetPassword);
usersRouter.delete("/:id", usersController.remove);
