import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { History, Search } from "lucide-react";
import { db } from "@/db/database";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionBadge } from "@/components/shared/badges";
import { formatDateTime, formatRelativeTime, initialsOf } from "@/utils/format";
import type { AuditAction } from "@/types";

const ACTIONS: { value: AuditAction | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todas as ações" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "MEMBER_CREATED", label: "Associado criado" },
  { value: "MEMBER_UPDATED", label: "Associado editado" },
  { value: "MEMBER_INACTIVATED", label: "Associado inativado" },
  { value: "MEMBER_REACTIVATED", label: "Associado reativado" },
  { value: "MEMBER_DELETED", label: "Associado excluído" },
  { value: "CARD_GENERATED", label: "Carteirinha gerada" },
  { value: "CARD_DOWNLOADED", label: "Carteirinha baixada" },
  { value: "USER_CREATED", label: "Usuário criado" },
  { value: "USER_UPDATED", label: "Usuário editado" },
  { value: "USER_INACTIVATED", label: "Usuário inativado" },
  { value: "USER_REACTIVATED", label: "Usuário reativado" },
  { value: "PERMISSION_CHANGED", label: "Permissão alterada" },
  { value: "SETTINGS_UPDATED", label: "Configuração alterada" },
  { value: "SIGNATURE_UPDATED", label: "Assinatura alterada" },
  { value: "PASSWORD_CHANGED", label: "Senha alterada" },
  { value: "SYSTEM_FACTORY_RESET", label: "Base restaurada" },
];

export function AuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<AuditAction | "ALL">("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const logs =
    useLiveQuery(() => db.audit.orderBy("createdAt").reverse().toArray(), []) ??
    [];

  const users = useMemo(() => {
    const set = new Set(logs.map((l) => l.userName));
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (action !== "ALL" && log.action !== action) return false;
      if (userFilter !== "ALL" && log.userName !== userFilter) return false;
      if (!term) return true;
      return [log.details, log.userName, log.entity, log.action].some((v) =>
        v.toLowerCase().includes(term)
      );
    });
  }, [logs, search, action, userFilter]);

  const total = filtered.length;
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  return (
    <PageContainer>
      <PageHeader
        title="Auditoria"
        description="Histórico de todas as ações realizadas no sistema."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por detalhes, usuário ou entidade..."
              className="pl-10"
              aria-label="Buscar registros de auditoria"
            />
          </div>
          <Select
            className="lg:w-56"
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AuditAction | "ALL");
              setPage(1);
            }}
            aria-label="Filtrar por ação"
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
          <Select
            className="lg:w-48"
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por usuário"
          >
            <option value="ALL">Todos os usuários</option>
            {users.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="Nenhum registro encontrado"
            description={
              logs.length === 0
                ? "As ações realizadas no sistema aparecerão aqui."
                : "Ajuste a busca ou os filtros e tente novamente."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <span className="block text-[13px] text-slate-700">
                        {formatDateTime(log.createdAt)}
                      </span>
                      <span className="block text-2xs text-slate-400">
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                          {initialsOf(log.userName)}
                        </span>
                        <span className="text-[13px] font-medium text-slate-700">
                          {log.userName}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={log.action} />
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {log.entity}
                      {log.entityId && (
                        <span className="block max-w-[110px] truncate font-mono text-2xs text-slate-400">
                          {log.entityId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[380px]">
                      <span className="line-clamp-2 text-[13px] leading-snug text-slate-600">
                        {log.details}
                      </span>
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
    </PageContainer>
  );
}
