import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { authController } from "./auth.controller.js";

// Rate-limit do login (Fase 5, §7.7): 20 tentativas/15 min por IP, sem
// lockout por usuário (decisão registrada em docs/decisions.md).
// Pulado nos testes automatizados, salvo override explícito
// (LOGIN_RATE_LIMIT_MAX) — a suíte faz dezenas de logins do mesmo IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.loginRateLimitMax,
  standardHeaders: false,
  legacyHeaders: false,
  skip: () =>
    process.env["NODE_ENV"] === "test" &&
    process.env["LOGIN_RATE_LIMIT_MAX"] === undefined,
  message: {
    status: "error",
    code: "RATE_LIMITED",
    message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
  },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", requireAuth, authController.me);
authRouter.post("/change-password", requireAuth, authController.changePassword);
