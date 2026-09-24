import { IDLE_TIMEOUT_MINUTES } from "@/constants";

/**
 * GUARDA DE SESSÃO — REGRA OBRIGATÓRIA E PRINCIPAL DE SEGURANÇA (LGPD).
 *
 * 1) 15 MINUTOS de inatividade → LOGOUT AUTOMÁTICO do sistema.
 * 2) Fechar a aba → a sessão termina (a sessão vive em `sessionStorage`,
 *    escopo de aba): abrir de novo exige login novamente.
 *
 * "Atividade" = qualquer movimento de mouse/ponteiro, clique, tecla,
 * rolagem ou toque dentro da aplicação — qualquer interação zera a
 * contagem. A verificação acontece por relógio (1s) e imediatamente
 * quando a volta a ficar visível (visibilitychange), cobrindo abas em
 * segundo plano mesmo com timers do navegador reduzidos.
 *
 * Ao expirar, o AuthProvider registra LOGOUT na auditoria, marca o motivo
 * em sessionStorage (exibido como aviso na tela de login) e derruba a
 * sessão — o RequireAuth leva o usuário para /login.
 */

/** Limite oficial: 15 minutos (900.000 ms). */
const IDLE_LIMIT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
/** Relógio de verificação: 1 segundo (latência máxima de 1s na expiração). */
const IDLE_CHECK_INTERVAL_MS = 1000;

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "mousemove",
  "keydown",
  "wheel",
  "touchstart",
] as const;

let idleLimitMs = IDLE_LIMIT_MS;
let lastActivityAt = Date.now();
let expired = false;
let cleanup: (() => void) | null = null;

/** Zera a contagem de inatividade (chamado por cada evento de usuário). */
function touch(): void {
  lastActivityAt = Date.now();
}

export const sessionGuard = {
  /** Constante oficial da regra (15 min = 900.000 ms) — usada nos testes. */
  IDLE_LIMIT_MS,

  /** Limite efetivo em vigor (produtivo: 15 min; testes podem encurtar). */
  get idleLimitMs(): number {
    return idleLimitMs;
  },

  touch,

  /**
   * Inicia a vigilância enquanto há usuário logado.
   * `onExpired` é disparado UMA única vez quando a inatividade atinge o
   * limite. Retorna a função que para a vigilância.
   */
  start(onExpired: () => void): () => void {
    sessionGuard.stop();
    expired = false;
    lastActivityAt = Date.now();

    const check = () => {
      if (expired) return;
      if (Date.now() - lastActivityAt >= idleLimitMs) {
        expired = true;
        onExpired();
      }
    };

    const onVisibilityChange = () => {
      // Aba voltou ao foco: avalia a inatividade imediatamente.
      if (!document.hidden) check();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(check, IDLE_CHECK_INTERVAL_MS);

    cleanup = () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touch);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
      cleanup = null;
    };
    return cleanup;
  },

  /** Encerra a vigilância (logout manual, troca de usuário, desmontagem). */
  stop(): void {
    cleanup?.();
  },

  /**
   * Altera o limite APENAS em desenvolvimento — usado pelos testes
   * automatizados (scripts/test-security.mjs) para não esperar 15 min.
   * No build de produção esta função é um no-op.
   */
  setIdleLimitForTests(ms: number): void {
    if (!import.meta.env.DEV) return;
    idleLimitMs = ms;
  },
};
