import { useEffect, useState } from "react";
import { Database, Download, Info, MonitorCog, Package, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import {
  auditService,
  cardGenerationService,
  memberService,
  systemService,
  userService,
} from "@/services";
import { authorizationService } from "@/services/authorizationService";
import {
  APP_ENVIRONMENT,
  APP_FULL_NAME,
  APP_NAME,
  APP_VERSION,
} from "@/constants";

const CONFIRM_WORD = "LIMPAR";

export function SystemSettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const canExport = authorizationService.hasPermission(user ?? null, "settings.view");
  const [armed, setArmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleFactoryReset = async () => {
    if (busy || confirmText.trim().toUpperCase() !== CONFIRM_WORD) return;
    setBusy(true);
    try {
      await systemService.factoryReset();
    } catch {
      setBusy(false);
      toast.error("Não foi possível limpar a base", "Tente novamente.");
      return;
    }
    try {
      await logout();
    } catch {
      // A sessão local já não corresponde a nenhum usuário — siga em frente.
    }
    window.location.assign("/login");
  };

  const handleExportBackup = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const counts = await systemService.exportBackup();
      toast.success(
        "Backup exportado",
        `${counts.members} associados, ${counts.users} usuários e ${counts.audit} registros de auditoria.`
      );
    } catch {
      toast.error("Não foi possível exportar o backup", "Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  const [counts, setCounts] = useState<
    { members: number; users: number; cards: number; audit: number } | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [members, users, cards, audit] = await Promise.all([
          memberService.getAll(),
          userService.getAll(),
          cardGenerationService.getIssuedCards(),
          auditService.getAll(),
        ]);
        if (!cancelled) {
          setCounts({
            members: members.length,
            users: users.length,
            cards: cards.length,
            audit: audit.length,
          });
        }
      } catch {
        // Mantém indefinido; a tela segue utilizável.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const info: { label: string; value: string }[] = [
    { label: "Aplicação", value: `${APP_NAME} — Painel Administrativo` },
    { label: "Entidade", value: APP_FULL_NAME },
    { label: "Versão", value: APP_VERSION },
    { label: "Ambiente", value: APP_ENVIRONMENT },
    { label: "Banco de dados", value: "PostgreSQL (via API)" },
    { label: "Armazenamento", value: "Servidor da API" },
    { label: "Navegador", value: navigator.userAgent.split(") ")[0] + ")" },
  ];

  const tables = [
    { label: "Associados", value: counts?.members, icon: Database },
    { label: "Usuários", value: counts?.users, icon: Package },
    { label: "Carteirinhas", value: counts?.cards, icon: MonitorCog },
    { label: "Registros de auditoria", value: counts?.audit, icon: Info },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações técnicas</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-slate-100">
            {info.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 py-3"
              >
                <dt className="text-[13px] text-slate-500">{item.label}</dt>
                <dd className="text-right text-[13px] font-medium text-slate-800">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados armazenados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {tables.map((table) => (
              <div
                key={table.label}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <table.icon className="h-4 w-4 text-brand-500" />
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {counts ? table.value ?? 0 : "—"}
                </p>
                <p className="mt-0.5 text-2xs leading-tight text-slate-500">
                  {table.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Alert variant="info" title="Sobre a persistência">
              Os dados ficam gravados no banco do servidor (PostgreSQL, via
              API) e permanecem após recarregar a página, fechar o navegador
              ou reiniciar o computador.
            </Alert>
          </div>
        </CardContent>
      </Card>

      {canExport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-4 w-4 text-brand-500" />
              Exportar backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="info" title="Backup da base do servidor">
              Baixa todos os dados (associados, usuários, carteirinhas,
              configurações, auditoria e identificadores) em um arquivo JSON,
              pronto para importar no PostgreSQL via{" "}
              <strong className="font-mono">POST /api/system/import</strong>. A
              base <strong>não</strong> é alterada.
            </Alert>
            <Button
              type="button"
              variant="outline"
              loading={exporting}
              disabled={exporting}
              onClick={() => void handleExportBackup()}
            >
              {!exporting && <Download className="h-4 w-4" />}
              {exporting ? "Exportando..." : "Exportar backup (JSON)"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isSuperAdmin && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-4 w-4 text-red-500" />
              Limpar base de dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="danger" title="Restaurar o estado de fábrica">
              Apaga <strong>todos</strong> os dados locais — associados,
              carteirinhas emitidas, usuários, configurações, assinatura
              oficial e auditoria — e restaura o estado de primeira utilização:
              <strong> apenas o usuário amococ / 123, as configurações padrão
              e (em produção) a assinatura oficial</strong>. Os dados de
              demonstração <strong>não voltam</strong>: a base fica{" "}
              <strong>zerada</strong>. A sessão atual será encerrada. Esta ação
              não pode ser desfeita.
            </Alert>
            {!armed ? (
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setArmed(true)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
                Limpar base de dados
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-slate-600">
                  Digite{" "}
                  <strong className="font-mono tracking-wider">
                    {CONFIRM_WORD}
                  </strong>{" "}
                  para confirmar:
                </p>
                <Input
                  autoFocus
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  className="w-40 uppercase tracking-wider"
                />
                <Button
                  type="button"
                  variant="danger"
                  loading={busy}
                  disabled={confirmText.trim().toUpperCase() !== CONFIRM_WORD}
                  onClick={() => void handleFactoryReset()}
                >
                  {!busy && <Trash2 className="h-4 w-4" />}
                  {busy ? "Limpando..." : "Confirmar limpeza"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setArmed(false);
                    setConfirmText("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
