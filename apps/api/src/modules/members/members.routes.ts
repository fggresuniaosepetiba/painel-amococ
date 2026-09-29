import { Router } from "express";
import { membersController } from "./members.controller.js";

export const membersRouter = Router();

membersRouter.get("/preview-next", membersController.previewNext);
membersRouter.get("/", membersController.list);
membersRouter.get("/:id", membersController.getById);
membersRouter.post("/", membersController.create);
membersRouter.patch("/:id", membersController.update);
membersRouter.post("/:id/inactivate", membersController.inactivate);
membersRouter.post("/:id/reactivate", membersController.reactivate);
membersRouter.delete("/:id", membersController.remove);
