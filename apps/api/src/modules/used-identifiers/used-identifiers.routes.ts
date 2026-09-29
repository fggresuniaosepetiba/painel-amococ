import { Router } from "express";
import { usedIdentifiersController } from "./used-identifiers.controller.js";

export const usedIdentifiersRouter = Router();

usedIdentifiersRouter.get("/", usedIdentifiersController.list);
usedIdentifiersRouter.get("/check", usedIdentifiersController.check);
usedIdentifiersRouter.post("/", usedIdentifiersController.register);
