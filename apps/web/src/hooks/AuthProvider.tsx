import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Permission } from "@amococ/shared";
import { setAuthHandlers } from "@/lib/apiClient";
import {
  authService,
  authorizationService,
  sessionGuard,
  systemService,
  usedIdentifiersService,
} from "@/services";
import type { PublicUser } from "@amococ/shared";

interface AuthContextValue {
  user: PublicUser | null;
  booting: boolean;
  login: (loginName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);

  // Ponte apiClient ↔ authService (Bearer, refresh em 401, logout em 401
  // irrecuperável com aviso SESSION_EXPIRED no /login).
  useEffect(() => {
    setAuthHandlers({
      getAccessToken: () => authService.getAccessToken(),
      refreshAccessToken: () => authService.refreshTokens(),
      onUnauthorized: () => {
        if (authService.clearSession()) {
          authService.setSessionNotice("SESSION_EXPIRED");
        }
        sessionGuard.stop();
        setUser(null);
      },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Base mínima no servidor (rota pública, idempotente).
        await systemService.seedIfEmpty({ demo: import.meta.env.DEV });
      } catch {
        // Sem API no ar, o boot segue — as chamadas vão falhar com aviso.
      }
      let restored: PublicUser | null = null;
      try {
        // Valida a sessão da aba no servidor (renova o access se preciso).
        restored = await authService.restoreSession();
      } catch {
        restored = null;
      }
      if (!cancelled) setUser(restored);
      if (restored) {
        try {
          // Reserva permanente de identificadores (autenticado, tolerante).
          await usedIdentifiersService.backfill();
        } catch {
          // Backfill nunca quebra o boot/login.
        }
      }
      if (!cancelled) setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (loginName: string, password: string) => {
    const logged = await authService.login(loginName, password);
    setUser(logged);
    try {
      await usedIdentifiersService.backfill();
    } catch {
      // Backfill nunca quebra o login.
    }
  }, []);

  const logout = useCallback(async () => {
    sessionGuard.stop();
    await authService.logout();
    setUser(null);
  }, []);

  // REGRA OBRIGATÓRIA E PRINCIPAL DE SEGURANÇA (LGPD):
  // 15 minutos de inatividade → LOGOUT AUTOMÁTICO. O motivo fica marcado
  // em sessionStorage para a tela de login explicar o ocorrido, o LOGOUT
  // é registrado na auditoria (servidor) e o RequireAuth leva para /login.
  useEffect(() => {
    if (!user) return;
    return sessionGuard.start(() => {
      authService.setSessionNotice("IDLE_TIMEOUT");
      void authService.logout();
      setUser(null);
    });
  }, [user]);

  const refreshUser = useCallback(async () => {
    const restored = await authService.restoreSession();
    setUser(restored);
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) =>
      authorizationService.hasPermission(user, permission),
    [user]
  );

  const value = useMemo(
    () => ({ user, booting, login, logout, refreshUser, hasPermission }),
    [user, booting, login, logout, refreshUser, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
