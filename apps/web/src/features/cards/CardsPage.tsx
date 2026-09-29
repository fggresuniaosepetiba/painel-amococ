import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  Download,
  Eye,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  cardGenerationService,
} from "@/services/cardGenerationService";
import { formatBytes, formatDate, initialsOf } from "@/utils/format";
import type { MembershipCardRecord } from "@amococ/shared";
import { GeneratedCardViewer } from "./GeneratedCardViewer";

export function CardsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [viewing, setViewing] = useState<MembershipCardRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [cards, setCards] = useState<MembershipCardRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const issued = await cardGenerationService.getIssuedCards();
        if (!cancelled) setCards(issued);
      } catch {
        // Mantém a lista atual; erros aparecem nas ações.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((c) =>
      [c.memberName, c.cardCode, c.membershipNumber].some((v) =>
        v.toLowerCase().includes(term)
      )
    );
  }, [cards, search]);

  const total = filtered.length;
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const handleDownload = async (record: MembershipCardRecord) => {
    if (!user || !hasPermission("cards.download")) return;
    setBusyId(record.id);
    try {
      if (record.pngDataUrl) {
        await cardGenerationService.downloadCard(user, record);
        toast.success("Download iniciado");
      } else {
        // Registro sem PNG armazenado: abre o visualizador para regenerar
        setViewing(record);
        toast.info(
          "PNG será regerado",
          "Abra a carteirinha e clique em Baixar PNG para salvar o arquivo."
        );
      }
    } catch {
      toast.error("Não foi possível baixar", "Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Carteirinhas emitidas"
        description="Histórico de carteirinhas geradas com código, matrícula e responsável."
        actions={
          hasPermission("members.create") ? (
            <Button asChild variant="outline">
              <Link to="/associados/novo">
                <Plus className="h-4 w-4" />
                Novo associado
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome, código ou matrícula..."
              className="pl-10"
              aria-label="Buscar carteirinhas"
            />
          </div>
        </div>

        {cards.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Nenhuma carteirinha emitida"
            description="Gere a primeira carteirinha a partir da página de um associado."
            action={
              <Button asChild>
                <Link to="/associados">
                  <UserPlus className="h-4 w-4" />
                  Ver associados
                </Link>
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Nenhuma carteirinha encontrada"
            description="Ajuste a busca e tente novamente."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Associado</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Emitida em</TableHead>
                  <TableHead>Gerada por</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                          {initialsOf(record.memberName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900">
                            {record.memberName}
                          </span>
                          <Link
                            to={`/associados/${record.memberId}`}
                            className="block text-2xs text-brand-600 hover:underline"
                          >
                            Ver associado
                          </Link>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[12px] font-semibold tracking-wide text-ink-800">
                        {record.cardCode}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-slate-600">
                      {record.membershipNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDate(record.generatedAt)}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {record.generatedByName}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {record.pngDataUrl ? (
                        formatBytes(
                          record.fileSizeBytes ??
                            Math.round((record.pngDataUrl.length * 3) / 4)
                        )
                      ) : (
                        <span className="text-amber-600">Pendente</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setViewing(record)}
                          aria-label="Visualizar carteirinha"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          onClick={() => void handleDownload(record)}
                          disabled={
                            busyId === record.id ||
                            !hasPermission("cards.download")
                          }
                          aria-label="Baixar PNG"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
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
            />
          </>
        )}
      </Card>

      {viewing && user && (
        <GeneratedCardViewer
          record={viewing}
          open
          onOpenChange={(o) => {
            if (!o) setViewing(null);
          }}
        />
      )}
    </PageContainer>
  );
}
