import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middlewares/requireAuth.js";
import { cardsController } from "./cards.controller.js";

// Matriz §6: leitura → cards.view, geração → cards.generate,
// registro de download → cards.download.
export const cardsRouter = Router();

cardsRouter.get(
  "/",
  requireAuth,
  requirePermission("cards.view"),
  cardsController.list,
);
cardsRouter.get(
  "/:id",
  requireAuth,
  requirePermission("cards.view"),
  cardsController.getById,
);
cardsRouter.post(
  "/",
  requireAuth,
  requirePermission("cards.generate"),
  cardsController.generate,
);
cardsRouter.post(
  "/:id/downloaded",
  requireAuth,
  requirePermission("cards.download"),
  cardsController.registerDownload,
);
