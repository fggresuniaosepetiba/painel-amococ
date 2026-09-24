import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Settings,
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
import { Alert } from "@/components/ui/misc";
import { cn } from "@/utils/cn";
import { useToast } from "@/hooks/ToastProvider";
import { useAuth } from "@/hooks/AuthProvider";
import {
  cardGenerationService,
  membershipCardRenderer,
  SignatureMissingError,
  type CardRenderContext,
} from "@/services/cardGenerationService";
import { imageService } from "@/services";
import { membershipCardCodeService } from "@/services/membershipCardCodeService";
import type { MembershipCardRecord } from "@/types";
import { MembershipCard } from "./MembershipCard";

type Phase =
  | "preparing"
  | "generating"
  | "ready"
  | "viewing"
  | "error"
  | "signature-missing";

interface CardPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modo geração: prepara, renderiza, exporta e persiste. */
  mode: "generate";
  memberId: string;
}

/**
 * Fluxo: gerar → validar → renderizar → exportar PNG → persistir → preview.
 * A assinatura oficial entra automaticamente; nenhum controle de edição.
 */
export function CardPreviewDialog(props: CardPreviewDialogProps) {
  const { open, onOpenChange, mode, memberId } = props;
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const cardRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  /** Área rolável da carteirinha (scroll + pan do zoom). */
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const [phase, setPhase] = useState<Phase>("preparing");
  const [context, setContext] = useState<CardRenderContext | null>(null);
  const [record, setRecord] = useState<MembershipCardRecord | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [panning, setPanning] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");

  const run = useCallback(async () => {
    if (!user || busyRef.current) return;
    busyRef.current = true;
    setPhase("preparing");
    setContext(null);
    setRecord(null);
    setZoomed(false);

    try {
      // 1) Validar dados + assinatura
      const ctx = await cardGenerationService.prepare(user, memberId);
      setContext(ctx);

      // 2/3) Renderizar e exportar PNG
      setPhase("generating");
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 120));
      const node = cardRef.current;
      if (!node) throw new Error("RENDER_NODE_MISSING");
      const png = await membershipCardRenderer.toPng(node, 3);

      // 4) Persistir registro
      const saved = await cardGenerationService.saveGeneratedCard(
        user,
        ctx,
        png
      );
      setRecord(saved);
      setPhase("ready");
      toast.success(
        "Carteirinha gerada com sucesso",
        `Código ${saved.cardCode} emitido para ${saved.memberName}.`
      );
    } catch (err) {
      if (err instanceof SignatureMissingError) {
        setPhase("signature-missing");
      } else {
        setErrorTitle(
          "Não foi possível gerar a carteirinha agora. Tente novamente."
        );
        setPhase("error");
      }
    } finally {
      busyRef.current = false;
    }
  }, [user, memberId, toast]);

  useEffect(() => {
    if (open && mode === "generate") void run();
  }, [open, mode, run]);

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
    if (!record || !user || !context) return;
    try {
      if (record.pngDataUrl) {
        await cardGenerationService.downloadCard(user, record);
        toast.success("Download iniciado");
      } else {
        const node = cardRef.current;
        if (!node) return;
        const fileName = membershipCardCodeService.buildFileName(
          context.member.cardCode,
          context.member.fullName
        );
        const dataUrl = await membershipCardRenderer.toPng(node, 3);
        await imageService.downloadDataUrl(dataUrl, fileName);
        toast.success("Download iniciado");
      }
    } catch {
      toast.error("Falha no download", "Tente novamente em instantes.");
    }
  };

  const handleVisualize = async () => {
    if (!record?.pngDataUrl) {
      setZoomed(true);
      return;
    }
    try {
      const blob = await (await fetch(record.pngDataUrl)).blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setZoomed(true);
    }
  };

  const generating = phase === "preparing" || phase === "generating";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!generating || !o) onOpenChange(o);
      }}
    >
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            {phase === "ready"
              ? "Carteirinha gerada com sucesso"
              : phase === "signature-missing"
                ? "Assinatura não configurada"
                : phase === "error"
                  ? "Falha na geração"
                  : "Gerando carteirinha"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col items-center gap-4">
          {phase === "signature-missing" && (
            <Alert
              variant="warning"
              title="Assinatura oficial necessária"
              icon={<Settings className="h-4 w-4" />}
            >
              Não é possível gerar a carteirinha porque a assinatura oficial do
              Presidente ainda não foi cadastrada.
            </Alert>
          )}

          {phase === "error" && (
            <Alert variant="danger" title={errorTitle}>
              Se o problema persistir, recarregue a página e tente novamente.
            </Alert>
          )}

          {phase === "ready" && (
            <Alert
              variant="success"
              title="CARTEIRINHA GERADA COM SUCESSO"
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Código <strong>{record?.cardCode}</strong> · Matrícula{" "}
              <strong>{record?.membershipNumber}</strong>. A assinatura oficial
              foi inserida automaticamente.
            </Alert>
          )}

          {(context || generating) && (
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
              {generating && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/75 backdrop-blur-[1px]">
                  <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                  <p className="text-sm font-medium text-slate-600">
                    {phase === "preparing"
                      ? "Validando dados..."
                      : "Gerando carteirinha..."}
                  </p>
                </div>
              )}

              {context && (
                <div className="flex min-h-full min-w-full w-max items-center justify-center p-6">
                  {/* Caixa com o tamanho VISUAL (600×378 × escala) para a
                      rolagem refletir o zoom; o card em si não recebe
                      transform, preservando a exportação PNG. */}
                  <div style={{ width: 600 * scale, height: 378 * scale }}>
                    <div
                      style={{
                        width: 600,
                        height: 378,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        transition: "transform 180ms ease",
                      }}
                    >
                      <MembershipCard ref={cardRef} context={context} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {zoomed && phase === "ready" && (
            <p className="w-full text-center text-2xs text-slate-400">
              Arraste para mover a carteirinha · role para percorrer
            </p>
          )}

          {phase === "signature-missing" && (
            <Button
              variant="primary"
              onClick={() => {
                onOpenChange(false);
                navigate("/configuracoes/assinatura");
              }}
            >
              <Settings className="h-4 w-4" />
              Ir para Configurações
            </Button>
          )}
        </DialogBody>

        {phase === "ready" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoomed((z) => !z)}>
              {zoomed ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
              {zoomed ? "Reduzir" : "Visualizar"}
            </Button>
            <Button variant="outline" onClick={() => void handleVisualize()}>
              <ExternalLink className="h-4 w-4" />
              Abrir em nova aba
            </Button>
            <Button
              onClick={() => void handleDownload()}
              disabled={!hasPermission("cards.download")}
            >
              <Download className="h-4 w-4" />
              BAIXAR PNG
            </Button>
          </DialogFooter>
        )}

        {(phase === "error" || phase === "signature-missing") && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {phase === "error" && (
              <Button onClick={() => void run()}>Tentar novamente</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
