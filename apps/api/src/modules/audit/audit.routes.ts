import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middlewares/requireAuth.js";
import { auditController } from "./audit.controller.js";

// Matriz §11: leitura → audit.view. A escrita (POST) exige só autenticação:
// o cliente registra CARD_DOWNLOADED (download lê o PNG local, sem
// contraparte servidora — ADR-015); LOGIN/LOGOUT o servidor registra sozinho.
export const auditRouter = Router();

auditRouter.get(
  "/",
  requireAuth,
  requirePermission("audit.view"),
  auditController.list,
);
auditRouter.post("/", requireAuth, auditController.create);
