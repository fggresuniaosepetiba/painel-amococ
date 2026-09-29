import { Router } from "express";
import { cardsController } from "./cards.controller.js";

export const cardsRouter = Router();

cardsRouter.get("/", cardsController.list);
cardsRouter.get("/:id", cardsController.getById);
cardsRouter.post("/", cardsController.generate);
cardsRouter.post("/:id/downloaded", cardsController.registerDownload);
