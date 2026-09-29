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
import { setActorProvider } from "@/lib/apiClient";
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Base mínima no servidor (idempotente) + demo em DEV na 1ª vez.
        await systemService.seedIfEmpty({ demo: import.meta.env.DEV });
        // Reserva permanente de identificadores: garante que matrículas e
        // códigos de associados de bases legadas já estejam registrados
        // antes de qualquer nova alocação.
        await usedIdentifiersService.backfill();
        const restored = await authService.restoreSession();
        if (!cancelled) {
          setActorProvider(() => restored);
          setUser(restored);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (loginName: string, password: string) => {
    const logged = await authService.login(loginName, password);
    setActorProvider(() => logged);
    setUser(logged);
  }, []);

  const logout = useCallback(async () => {
    sessionGuard.stop();
    await authService.logout(user);
    setActorProvider(() => null);
    setUser(null);
  }, [user]);

  // REGRA OBRIGATÓRIA E PRINCIPAL DE SEGURANÇA (LGPD):
  // 15 minutos de inatividade → LOGOUT AUTOMÁTICO. O motivo fica marcado
  // em sessionStorage para a tela de login explicar o ocorrido, o LOGOUT
  // é registrado na auditoria e o RequireAuth leva para /login.
  useEffect(() => {
    if (!user) return;
    return sessionGuard.start(() => {
      authService.setSessionNotice("IDLE_TIMEOUT");
      void authService.logout(user); // auditoria: LOGOUT
      setActorProvider(() => null);
      setUser(null);
    });
  }, [user]);

  const refreshUser = useCallback(async () => {
    const restored = await authService.restoreSession();
    setActorProvider(() => restored);
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
