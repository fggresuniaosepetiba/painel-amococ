import { Router } from "express";
import { settingsController } from "./settings.controller.js";

export const settingsRouter = Router();

settingsRouter.get("/", settingsController.get);
settingsRouter.patch("/association", settingsController.updateAssociation);
settingsRouter.patch("/card", settingsController.updateCard);
settingsRouter.patch("/security", settingsController.updateSecurity);
settingsRouter.put("/signature", settingsController.saveSignature);
