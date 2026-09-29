import { Router } from "express";
import { usersController } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/", usersController.list);
usersRouter.get("/:id", usersController.getById);
usersRouter.post("/", usersController.create);
usersRouter.patch("/:id", usersController.update);
usersRouter.post("/:id/status", usersController.setStatus);
usersRouter.put("/:id/permissions", usersController.savePermissions);
usersRouter.post("/:id/reset-password", usersController.resetPassword);
