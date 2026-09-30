import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middlewares/requireAuth.js";
import { usedIdentifiersController } from "./used-identifiers.controller.js";

// Reserva permanente (§17): consulta exige leitura de associados
// (view OU create — o formulário de criação valida sem ter view);
// registro exige members.create (fluxo de criação + backfill autenticado).
export const usedIdentifiersRouter = Router();

usedIdentifiersRouter.get(
  "/",
  requireAuth,
  requirePermission("members.view", "members.create"),
  usedIdentifiersController.list,
);
usedIdentifiersRouter.get(
  "/check",
  requireAuth,
  requirePermission("members.view", "members.create"),
  usedIdentifiersController.check,
);
usedIdentifiersRouter.post(
  "/",
  requireAuth,
  requirePermission("members.create"),
  usedIdentifiersController.register,
);
