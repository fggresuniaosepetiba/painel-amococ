import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/misc";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import {
  cardGenerationService,
  membershipCardRenderer,
} from "@/services/cardGenerationService";
import { imageService } from "@/services/imageService";
import { membershipCardCodeService } from "@/services/membershipCardCodeService";
import type { MembershipCardRecord } from "@/types";
import { MembershipCard } from "./MembershipCard";

interface GeneratedCardViewerProps {
  record: MembershipCardRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Visualização de carteirinha já emitida.
 * Se o PNG estiver armazenado, exibe e baixa o arquivo original;
 * caso contrário, regenera a partir dos dados do associado.
 */
export function GeneratedCardViewer({
  record,
  open,
  onOpenChange,
}: GeneratedCardViewerProps) {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  /** Área rolável da carteirinha (scroll + pan do zoom). */
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const [context, setContext] = useState<
    Awaited<ReturnType<typeof cardGenerationService.buildContext>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [panning, setPanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setZoomed(false);
    try {
      if (record.pngDataUrl) {
        setContext(null);
      } else {
        const ctx = await cardGenerationService.buildContext(record.memberId);
        setContext(ctx);
      }
    } catch (err) {
      setError(
        err instanceof Error && err.name === "SignatureMissingError"
          ? "A assinatura oficial do Presidente não está configurada."
          : "Não foi possível carregar a carteirinha."
      );
    } finally {
      setLoading(false);
    }
  }, [record]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const scale = zoomed ? 1.25 : 1;

  /** Ao ligar o zoom, centraliza a visualização; ao desligar, volta ao topo. */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (zoomed) {
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
    } else {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }, [zoomed]);

  /**
   * Mãozinha: com o zoom ativo, arrastar a área move a carteirinha
   * (pan da área de rolagem). Scrollbars e rolagem nativa continuam.
   */
  const handlePanDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!zoomed || event.button !== 0) return;
    const el = viewportRef.current;
    // Alvo = o próprio contêiner → clique na barra de rolagem: deixa nativo.
    if (!el || event.target === el) return;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setPanning(true);
    el.setPointerCapture(event.pointerId);
  };

  const handlePanMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const st = panRef.current;
    const el = viewportRef.current;
    if (!st || !el || st.pointerId !== event.pointerId) return;
    el.scrollLeft = st.scrollLeft - (event.clientX - st.x);
    el.scrollTop = st.scrollTop - (event.clientY - st.y);
  };

  const handlePanEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const st = panRef.current;
    if (!st || st.pointerId !== event.pointerId) return;
    panRef.current = null;
    setPanning(false);
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const handleDownload = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (record.pngDataUrl) {
        await cardGenerationService.downloadCard(user, record);
      } else {
        const node = cardRef.current;
        if (!node) return;
        const dataUrl = await membershipCardRenderer.toPng(node, 3);
        const fileName = membershipCardCodeService.buildFileName(
          record.cardCode,
          record.memberName
        );
        await imageService.downloadDataUrl(dataUrl, fileName);
      }
      toast.success("Download iniciado", record.cardCode);
    } catch {
      toast.error("Não foi possível baixar", "Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Carteirinha
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs tracking-wide text-ink-800">
              {record.cardCode}
            </span>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col items-center gap-4">
          <div
            ref={viewportRef}
            data-card-viewport=""
            onPointerDown={handlePanDown}
            onPointerMove={handlePanMove}
            onPointerUp={handlePanEnd}
            onPointerCancel={handlePanEnd}
            className={cn(
              "relative w-full shrink-0 overflow-auto rounded-xl bg-ink-950/5",
              zoomed && "max-h-[50vh] select-none",
              zoomed && (panning ? "cursor-grabbing" : "cursor-grab")
            )}
            style={{ touchAction: zoomed ? "none" : undefined }}
          >
            {loading || error ? (
              <div className="flex w-full items-center justify-center p-6">
                {loading ? (
                  <div className="w-full max-w-[600px] space-y-3">
                    <Skeleton className="h-[378px] w-full" />
                    <p className="text-center text-xs text-slate-500">
                      Carregando carteirinha...
                    </p>
                  </div>
                ) : (
                  <Alert variant="warning" title="Carteirinha indisponível">
                    {error}
                  </Alert>
                )}
              </div>
            ) : (
              <div className="flex min-h-full min-w-full w-max items-center justify-center p-6">
                {/* Caixa com o tamanho VISUAL (600×378 × escala) para a
                    rolagem refletir o zoom; o card em si não recebe
                    transform, preservando a exportação PNG. */}
                <div style={{ width: 600 * scale, height: 378 * scale }}>
                  {record.pngDataUrl ? (
                    <img
                      src={record.pngDataUrl}
                      alt={`Carteirinha de ${record.memberName}`}
                      className="block h-full w-full rounded-xl object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div
                      style={{
                        width: 600,
                        height: 378,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        transition: "transform 180ms ease",
                      }}
                    >
                      {context && (
                        <MembershipCard ref={cardRef} context={context} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {zoomed && !loading && !error && (
            <p className="w-full text-center text-2xs text-slate-400">
              Arraste para mover a carteirinha · role para percorrer
            </p>
          )}

          {!loading && !error && (
            <p className="text-xs text-slate-500">
              Emitida em {new Date(record.generatedAt).toLocaleDateString("pt-BR")} ·
              por {record.generatedByName} · Matrícula {record.membershipNumber}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setZoomed((z) => !z)}
            disabled={loading || Boolean(error)}
          >
            {zoomed ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {zoomed ? "Reduzir" : "Ampliar"}
          </Button>
          {!record.pngDataUrl && !loading && !error && (
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={busy}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerar
            </Button>
          )}
          <Button
            onClick={() => void handleDownload()}
            disabled={loading || Boolean(error) || busy || !hasPermission("cards.download")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
