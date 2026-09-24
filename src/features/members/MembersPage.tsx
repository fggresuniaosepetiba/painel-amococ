import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Download,
  Eye,
  MoreHorizontal,
  PencilLine,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { db } from "@/db/database";
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
import { CardPreviewDialog } from "@/features/cards/CardPreviewDialog";
import { cardGenerationService, memberService } from "@/services";
import { formatDate, initialsOf } from "@/utils/format";
import type { Member, MemberStatus } from "@/types";
import { cn } from "@/utils/cn";

/**
 * FLUXO DE STATUS DOS ASSOCIADOS
 *
 * Aba ATIVOS (status = ATIVO):
 *   Visualizar · Editar · Gerar carteirinha · Baixar carteirinha · Inativar
 *   → NÃO existe exclusão (nem botão, nem caminho).
 *
 * Aba INATIVOS (status = INATIVO):
 *   Visualizar · Reativar · Excluir
 *
 * As abas são filtros reais dos dados, com contadores dinâmicos. A exclusão
 * definitiva exige modal com digitação do nome e passa pela validação de
 * status do `memberService` (camada de serviço) — a interface esconde o
 * botão, mas quem decide é o serviço.
 */
const TABS: { key: MemberStatus; label: string }[] = [
  { key: "ATIVO", label: "Ativos" },
  { key: "INATIVO", label: "Inativos" },
];

export function MembersPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [tab, setTab] = useState<MemberStatus>("ATIVO");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [cardMemberId, setCardMemberId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const members = useLiveQuery(() => db.members.toArray(), []) ?? [];
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? [];

  /** Contadores dinâmicos das abas (nada fixo). */
  const counts = useMemo(
    () => ({
      ATIVO: members.filter((m) => m.status === "ATIVO").length,
      INATIVO: members.filter((m) => m.status === "INATIVO").length,
    }),
    [members]
  );

  /** Busca restrita ao status da aba selecionada. */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members
      .filter((m) => {
        if (m.status !== tab) return false;
        if (!term) return true;
        return [
          m.fullName,
          m.membershipNumber,
          m.cardCode,
          m.cpf,
          m.phone,
          m.city,
        ].some((value) => value.toLowerCase().includes(term));
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  }, [members, search, tab]);

  const total = filtered.length;
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  /** Inativação — confirmação obrigatória. Preserva tudo. */
  const handleInactivate = async (member: Member) => {
    if (!user) return;
    const ok = await confirm({
      title: "Você deseja inativar este associado?",
      message:
        "O associado será movido para a lista de inativos. Seus dados, matrícula e código de carteirinha serão preservados e ele poderá ser reativado posteriormente.",
      confirmLabel: "Inativar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await memberService.inactivate(user, member.id);
      toast.success("Associado inativado com sucesso.");
    } catch {
      toast.error("Não foi possível inativar", "Tente novamente em instantes.");
    }
  };

  /** Reativação — mesma matrícula, mesmo código, mesmo ID. */
  const handleReactivate = async (member: Member) => {
    if (!user) return;
    const ok = await confirm({
      title: "Reativar associado?",
      message:
        "O associado voltará para a lista de ativos e continuará utilizando a mesma matrícula e o mesmo código de carteirinha.",
      confirmLabel: "Reativar",
      variant: "primary",
    });
    if (!ok) return;
    try {
      await memberService.reactivate(user, member.id);
      toast.success("Associado reativado com sucesso.");
    } catch {
      toast.error("Não foi possível reativar", "Tente novamente em instantes.");
    }
  };

  /** Exclusão definitiva — chamada a partir do modal de confirmação. */
  const handleDeleteConfirm = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    try {
      await memberService.delete(user, deleteTarget.id);
      toast.success("Associado excluído definitivamente.");
      setDeleteTarget(null);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setDeleteTarget(null);
      if (code === "FORBIDDEN") {
        toast.error("Acesso restrito", "Você não tem permissão para esta ação.");
      } else if (code === "MEMBER_NOT_FOUND") {
        toast.error(
          "Associado não encontrado",
          "Recarregue a lista e tente novamente."
        );
      } else if (code.includes("não podem ser excluídos")) {
        toast.error("Operação bloqueada", code);
      } else {
        toast.error("Não foi possível excluir", "Tente novamente.");
      }
    } finally {
      setDeleting(false);
    }
  };

  /** Baixar carteirinha: PNG pronto baixa direto; caso contrário gera. */
  const handleDownload = async (member: Member) => {
    if (!user) return;
    const record = cards.find((c) => c.memberId === member.id);
    if (record?.pngDataUrl) {
      try {
        await cardGenerationService.downloadCard(user, record);
        toast.success("Download iniciado");
      } catch {
        toast.error("Não foi possível baixar", "Tente novamente.");
      }
      return;
    }
    setCardMemberId(member.id);
    toast.info(
      "Carteirinha será gerada para download",
      "Clique em BAIXAR PNG na janela de geração."
    );
  };

  const isInactiveTab = tab === "INATIVO";

  return (
    <PageContainer>
      <PageHeader
        title="Associados"
        description="Gestão de associados ativos e inativos, com matrículas e códigos de carteirinha imutáveis."
        actions={
          hasPermission("members.create") ? (
            <Button asChild>
              <Link to="/associados/novo">
                <Plus className="h-4 w-4" />
                Novo associado
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
          aria-label="Filtrar associados por status"
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
              placeholder="Buscar por nome, matrícula, código, CPF..."
              className="pl-10"
              aria-label={
                isInactiveTab
                  ? "Buscar entre associados inativos"
                  : "Buscar entre associados ativos"
              }
            />
          </div>
        </div>

        {/* Tabela */}
        {members.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Nenhum associado cadastrado"
            description="Comece cadastrando o primeiro associado da associação."
            action={
              hasPermission("members.create") ? (
                <Button asChild>
                  <Link to="/associados/novo">
                    <Plus className="h-4 w-4" />
                    Novo Associado
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="Nenhum associado encontrado"
              description="Ajuste a busca e tente novamente."
            />
          ) : isInactiveTab ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Nenhum associado inativo"
              description="Associados inativados aparecerão nesta lista."
            />
          ) : (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Nenhum associado ativo"
              description="Cadastre novos associados para vê-los aqui."
              action={
                hasPermission("members.create") ? (
                  <Button asChild>
                    <Link to="/associados/novo">
                      <Plus className="h-4 w-4" />
                      Novo Associado
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
                  <TableHead>Associado</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Código da carteirinha</TableHead>
                  {!isInactiveTab && <TableHead>WhatsApp</TableHead>}
                  {isInactiveTab && <TableHead>Cadastro</TableHead>}
                  {isInactiveTab && <TableHead>Inativação</TableHead>}
                  <TableHead>Status</TableHead>
                  {!isInactiveTab && <TableHead>Cadastro</TableHead>}
                  <TableHead className="w-12 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => navigate(`/associados/${member.id}`)}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                          {initialsOf(member.fullName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900">
                            {member.fullName}
                          </span>
                          <span className="block truncate text-2xs text-slate-400">
                            {member.cpf || "CPF não informado"}
                          </span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[13px] font-semibold text-slate-600">
                        {member.membershipNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[12px] font-semibold tracking-wide text-ink-800">
                        {member.cardCode}
                      </span>
                    </TableCell>
                    {!isInactiveTab && (
                      <TableCell className="text-slate-500">
                        {member.phone || "—"}
                      </TableCell>
                    )}
                    {isInactiveTab && (
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDate(member.createdAt)}
                      </TableCell>
                    )}
                    {isInactiveTab && (
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {member.inactivatedAt
                          ? formatDate(member.inactivatedAt)
                          : "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <StatusBadge status={member.status} />
                    </TableCell>
                    {!isInactiveTab && (
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDate(member.createdAt)}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <RowActions
                        member={member}
                        onOpen={() => navigate(`/associados/${member.id}`)}
                        onEdit={
                          hasPermission("members.edit")
                            ? () => navigate(`/associados/${member.id}/editar`)
                            : undefined
                        }
                        onGenerate={
                          member.status === "ATIVO" &&
                          hasPermission("cards.generate")
                            ? () => setCardMemberId(member.id)
                            : undefined
                        }
                        onDownload={
                          member.status === "ATIVO" &&
                          hasPermission("cards.download")
                            ? () => void handleDownload(member)
                            : undefined
                        }
                        onInactivate={
                          member.status === "ATIVO" &&
                          hasPermission("members.inactivate")
                            ? () => void handleInactivate(member)
                            : undefined
                        }
                        onReactivate={
                          member.status === "INATIVO" &&
                          hasPermission("members.reactivate")
                            ? () => void handleReactivate(member)
                            : undefined
                        }
                        onDelete={
                          member.status === "INATIVO" &&
                          hasPermission("members.delete")
                            ? () => setDeleteTarget(member)
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

      {cardMemberId && user && (
        <CardPreviewDialog
          open
          onOpenChange={(o) => {
            if (!o) setCardMemberId(null);
          }}
          mode="generate"
          memberId={cardMemberId}
        />
      )}

      {deleteTarget && (
        <DeleteMemberDialog
          member={deleteTarget}
          busy={deleting}
          onOpenChange={(o) => {
            if (!o && !deleting) setDeleteTarget(null);
          }}
          onConfirm={() => void handleDeleteConfirm()}
        />
      )}
    </PageContainer>
  );
}

/**
 * Ações da linha, variadas conforme o STATUS do associado.
 * Associado ATIVO nunca recebe "Excluir"; INATIVO nunca recebe
 * editar/gerar/inativar (somente visualizar, reativar e excluir).
 */
function RowActions({
  member,
  onOpen,
  onEdit,
  onGenerate,
  onDownload,
  onInactivate,
  onReactivate,
  onDelete,
}: {
  member: Member;
  onOpen: () => void;
  onEdit?: () => void;
  onGenerate?: () => void;
  onDownload?: () => void;
  onInactivate?: () => void;
  onReactivate?: () => void;
  onDelete?: () => void;
}) {
  const isActive = member.status === "ATIVO";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-ring"
          aria-label={`Ações de ${member.fullName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onOpen}>
          <Eye className="h-4 w-4" />
          Visualizar
        </DropdownMenuItem>

        {isActive && onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <PencilLine className="h-4 w-4" />
            Editar
          </DropdownMenuItem>
        )}

        {isActive && (onGenerate || onDownload) && (
          <>
            <DropdownMenuSeparator />
            {onGenerate && (
              <DropdownMenuItem onSelect={onGenerate}>
                <CreditCard className="h-4 w-4" />
                Gerar carteirinha
              </DropdownMenuItem>
            )}
            {onDownload && (
              <DropdownMenuItem onSelect={onDownload}>
                <Download className="h-4 w-4" />
                Baixar carteirinha
              </DropdownMenuItem>
            )}
          </>
        )}

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
 * Modal de exclusão definitiva — proteção em 4 camadas:
 * 1. o botão só existe para associados INATIVOS (interface);
 * 2. o service bloqueia status ATIVO independentemente da UI;
 * 3. a digitação exata do nome é obrigatória para habilitar o botão;
 * 4. os identificadores ficam reservados para sempre (persistência).
 */
function DeleteMemberDialog({
  member,
  busy,
  onOpenChange,
  onConfirm,
}: {
  member: Member;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
  const matches = typed.length > 0 && normalize(typed) === normalize(member.fullName);

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
                Excluir associado permanentemente?
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-relaxed text-red-700">
            Esta ação é definitiva.
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
            <li>O associado precisa estar inativo para ser excluído.</li>
            <li>
              A matrícula e o código da carteirinha utilizados por este
              associado nunca poderão ser reutilizados.
            </li>
          </ul>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label
              htmlFor="delete-confirm-name"
              className="block text-xs font-semibold text-slate-600"
            >
              Digite o nome do associado para confirmar:
            </label>
            <p className="mt-1.5 text-sm text-slate-500">
              Digite:{" "}
              <span className="font-mono font-bold text-ink-900">
                {member.fullName}
              </span>
            </p>
            <Input
              id="delete-confirm-name"
              data-testid="delete-confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={member.fullName}
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
