import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/badges";
import { ApiError } from "@/lib/apiClient";
import { declarationService } from "@/services";
import { formatDate } from "@/utils/format";
import type { DeclarationStatus, ResidenceDeclaration } from "@amococ/shared";
import { cn } from "@/utils/cn";

/**
 * FLUXO DE STATUS DAS DECLARAÇÕES (mesmo processo do associado):
 *
 * Aba ATIVOS (status = ATIVO):
 *   Visualizar (reimprimir) · Inativar
 *   → NÃO existe exclusão (nem botão, nem caminho).
 *
 * Aba INATIVOS (status = INATIVO):
 *   Visualizar · Reativar · Excluir
 *
 * A exclusão definitiva exige modal com digitação do nome do morador e
 * passa pela validação de status do `declarationService` — a interface
 * esconde o botão, mas quem decide é o serviço/servidor.
 */
const TABS: { key: DeclarationStatus; label: string }[] = [
  { key: "ATIVO", label: "Ativos" },
  { key: "INATIVO", label: "Inativos" },
];

export function DeclarationsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [tab, setTab] = useState<DeclarationStatus>("ATIVO");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<ResidenceDeclaration | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const [declarations, setDeclarations] = useState<ResidenceDeclaration[]>([]);

  const load = useCallback(async () => {
    try {
      setDeclarations(await declarationService.getAll());
    } catch {
      // Mantém a lista atual; erros de rede aparecem nas ações.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Contadores dinâmicos das abas (nada fixo). */
  const counts = useMemo(
    () => ({
      ATIVO: declarations.filter((d) => d.status === "ATIVO").length,
      INATIVO: declarations.filter((d) => d.status === "INATIVO").length,
    }),
    [declarations]
  );

  /**
   * Busca por NOME ou CPF (o CPF é comparado só com dígitos — "529982..." 
   * encontra "529.982..."), restrita ao status da aba selecionada.
   */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const termDigits = term.replace(/\D/g, "");
    return declarations
      .filter((d) => {
        if (d.status !== tab) return false;
        if (!term) return true;
        if (d.residentName.toLowerCase().includes(term)) return true;
        return (
          termDigits.length > 0 &&
          d.cpf.replace(/\D/g, "").includes(termDigits)
        );
      })
      .sort((a, b) =>
        a.residentName.localeCompare(b.residentName, "pt-BR")
      );
  }, [declarations, search, tab]);

  const total = filtered.length;
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  /** Inativação — confirmação obrigatória. Preserva tudo. */
  const handleInactivate = async (declaration: ResidenceDeclaration) => {
    if (!user) return;
    const ok = await confirm({
      title: "Você deseja inativar esta declaração?",
      message:
        "A declaração será movida para a lista de inativos, mas continuará disponível para consulta e reimpressão e poderá ser reativada posteriormente.",
      confirmLabel: "Inativar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await declarationService.inactivate(declaration.id);
      await load();
      toast.success("Declaração inativada com sucesso.");
    } catch {
      toast.error("Não foi possível inativar", "Tente novamente em instantes.");
    }
  };

  /** Reativação — mesmo registro, mesma data de emissão. */
  const handleReactivate = async (declaration: ResidenceDeclaration) => {
    if (!user) return;
    const ok = await confirm({
      title: "Reativar declaração?",
      message:
        "A declaração voltará para a lista de ativos mantendo os mesmos dados e a mesma data de emissão.",
      confirmLabel: "Reativar",
      variant: "primary",
    });
    if (!ok) return;
    try {
      await declarationService.reactivate(declaration.id);
      await load();
      toast.success("Declaração reativada com sucesso.");
    } catch {
      toast.error("Não foi possível reativar", "Tente novamente em instantes.");
    }
  };

  /** Exclusão definitiva — chamada a partir do modal de confirmação. */
  const handleDeleteConfirm = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    try {
      await declarationService.delete(deleteTarget.id);
      await load();
      toast.success("Declaração excluída definitivamente.");
      setDeleteTarget(null);
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;
      setDeleteTarget(null);
      if (apiError?.code === "FORBIDDEN") {
        toast.error("Acesso restrito", "Você não tem permissão para esta ação.");
      } else if (apiError?.code === "DECLARATION_NOT_FOUND") {
        toast.error(
          "Declaração não encontrada",
          "Recarregue a lista e tente novamente."
        );
      } else if (apiError?.message.includes("não podem ser excluídas")) {
        toast.error("Operação bloqueada", apiError.message);
      } else {
        toast.error("Não foi possível excluir", "Tente novamente.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const isInactiveTab = tab === "INATIVO";

  return (
    <PageContainer>
      <PageHeader
        title="Declarações"
        description="Declarações de residência emitidas — busque por nome ou CPF para reimprimir."
        actions={
          hasPermission("declarations.create") ? (
            <Button asChild>
              <Link to="/declaracoes/nova">
                <Plus className="h-4 w-4" />
                Nova declaração
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        {/* Abas ATIVOS / INATIVOS — filtros reais com contadores */}
        <div
          className="flex items-end gap-1 border-b border-slate-100 px-5 pt-4"
          role="tablist"
          aria-label="Filtrar declarações por status"
        >
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`tab-${key}`}
                onClick={() => {
                  setTab(key);
                  setPage(1);
                }}
                className={cn(
                  "-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition focus-ring",
                  active
                    ? "border-brand-500 bg-brand-50/70 text-brand-700"
                    : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"
                )}
              >
                {label}
                <span
                  data-testid={`count-${key}`}
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-2xs font-bold tabular-nums",
                    active
                      ? "bg-brand-100 text-brand-700"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Busca — restrita à aba selecionada */}
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="relative max-w-lg">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome ou CPF..."
              className="pl-10"
              aria-label={
                isInactiveTab
                  ? "Buscar entre declarações inativas"
                  : "Buscar entre declarações ativas"
              }
            />
          </div>
        </div>

        {/* Tabela */}
        {declarations.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Nenhuma declaração emitida"
            description="Emita a primeira declaração de residência para vê-la aqui."
            action={
              hasPermission("declarations.create") ? (
                <Button asChild>
                  <Link to="/declaracoes/nova">
                    <Plus className="h-4 w-4" />
                    Nova declaração
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="Nenhuma declaração encontrada"
              description="Ajuste a busca por nome ou CPF e tente novamente."
            />
          ) : isInactiveTab ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Nenhuma declaração inativa"
              description="Declarações inativadas aparecerão nesta lista."
            />
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Nenhuma declaração ativa"
              description="Emita novas declarações para vê-las aqui."
              action={
                hasPermission("declarations.create") ? (
                  <Button asChild>
                    <Link to="/declaracoes/nova">
                      <Plus className="h-4 w-4" />
                      Nova declaração
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Morador</TableHead>
                  <TableHead>Residência</TableHead>
                  <TableHead>Emissão</TableHead>
                  {isInactiveTab && <TableHead>Inativação</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((declaration) => (
                  <TableRow key={declaration.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => navigate(`/declaracoes/${declaration.id}`)}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900">
                            {declaration.residentName}
                          </span>
                          <span className="block truncate text-2xs text-slate-400">
                            {declaration.cpf || "CPF não informado"}
                          </span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {declaration.residenceYears}{" "}
                      {declaration.residenceYears === 1 ? "ano" : "anos"} e{" "}
                      {declaration.residenceMonths}{" "}
                      {declaration.residenceMonths === 1 ? "mês" : "meses"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDate(declaration.issuedAt)}
                    </TableCell>
                    {isInactiveTab && (
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {declaration.inactivatedAt
                          ? formatDate(declaration.inactivatedAt)
                          : "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <StatusBadge status={declaration.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        declaration={declaration}
                        onOpen={() => navigate(`/declaracoes/${declaration.id}`)}
                        onInactivate={
                          declaration.status === "ATIVO" &&
                          hasPermission("declarations.inactivate")
                            ? () => void handleInactivate(declaration)
                            : undefined
                        }
                        onReactivate={
                          declaration.status === "INATIVO" &&
                          hasPermission("declarations.reactivate")
                            ? () => void handleReactivate(declaration)
                            : undefined
                        }
                        onDelete={
                          declaration.status === "INATIVO" &&
                          hasPermission("declarations.delete")
                            ? () => setDeleteTarget(declaration)
                            : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      {deleteTarget && (
        <DeleteDeclarationDialog
          declaration={deleteTarget}
          busy={deleting}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !deleting) setDeleteTarget(null);
          }}
          onConfirm={() => void handleDeleteConfirm()}
        />
      )}
    </PageContainer>
  );
}

/**
 * Ações da linha, variadas conforme o STATUS da declaração.
 * Declaração ATIVA nunca recebe "Excluir"; INATIVA nunca recebe
 * inativar (somente visualizar, reativar e excluir).
 */
function RowActions({
  declaration,
  onOpen,
  onInactivate,
  onReactivate,
  onDelete,
}: {
  declaration: ResidenceDeclaration;
  onOpen: () => void;
  onInactivate?: () => void;
  onReactivate?: () => void;
  onDelete?: () => void;
}) {
  const isActive = declaration.status === "ATIVO";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-ring"
          aria-label={`Ações da declaração de ${declaration.residentName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onOpen}>
          <Eye className="h-4 w-4" />
          Visualizar e reimprimir
        </DropdownMenuItem>

        {isActive && onInactivate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={onInactivate}>
              <PowerOff className="h-4 w-4" />
              Inativar
            </DropdownMenuItem>
          </>
        )}

        {!isActive && (onReactivate || onDelete) && (
          <>
            <DropdownMenuSeparator />
            {onReactivate && (
              <DropdownMenuItem onSelect={onReactivate}>
                <Power className="h-4 w-4" />
                Reativar
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem danger onSelect={onDelete}>
                <Trash2 className="h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Modal de exclusão definitiva — proteção em 3 camadas:
 * 1. o botão só existe para declarações INATIVAS (interface);
 * 2. o service/servidor bloqueia status ATIVO independentemente da UI;
 * 3. a digitação exata do nome do morador é obrigatória para habilitar
 *    o botão de exclusão.
 */
function DeleteDeclarationDialog({
  declaration,
  busy,
  onOpenChange,
  onConfirm,
}: {
  declaration: ResidenceDeclaration;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
  const matches =
    typed.length > 0 && normalize(typed) === normalize(declaration.residentName);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="pr-6">
              <DialogTitle>
                Excluir declaração permanentemente?
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-relaxed text-red-700">
            Esta ação é definitiva.
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
            <li>A declaração precisa estar inativa para ser excluída.</li>
            <li>
              Os dados e a data de emissão serão apagados — a impressão em
              papel já entregue permanece com a pessoa.
            </li>
          </ul>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label
              htmlFor="delete-confirm-name"
              className="block text-xs font-semibold text-slate-600"
            >
              Digite o nome do morador para confirmar:
            </label>
            <p className="mt-1.5 text-sm text-slate-500">
              Digite:{" "}
              <span className="font-mono font-bold text-ink-900">
                {declaration.residentName}
              </span>
            </p>
            <Input
              id="delete-confirm-name"
              data-testid="delete-confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={declaration.residentName}
              autoComplete="off"
              className="mt-2.5"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={!matches}
            loading={busy}
            onClick={onConfirm}
          >
            EXCLUIR DEFINITIVAMENTE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
