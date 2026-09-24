import {
  forwardRef,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatDate } from "@/utils/format";
import type { CardRenderContext } from "@/services/cardGenerationService";
import { initialsOf } from "@/utils/format";
import type { SignaturePlacement } from "@/types";

/**
 * MembershipCard — carteirinha oficial da AMOCOC.
 *
 * Componente puramente visual, com tamanho fixo (600×378px) para que a
 * exportação PNG em alta resolução (pixelRatio 3 ≈ 1800×1134) preserve
 * proporção e qualidade. A assinatura oficial é inserida automaticamente
 * pelo contexto — sem controles de edição na carteirinha gerada.
 *
 * Na prévia de Configurações → Carteirinha, `signatureDrag` habilita
 * arrastar/redimensionar a assinatura (coordenadas em px lógicos 600×378).
 */
export const MembershipCard = forwardRef<
  HTMLDivElement,
  {
    context: CardRenderContext;
    className?: string;
    signatureDrag?: {
      enabled: boolean;
      onChange: (placement: SignaturePlacement) => void;
    };
  }
>(function MembershipCard({ context, className, signatureDrag }, ref) {
  const {
    member,
    associationName,
    associationAcronym,
    logoDataUrl,
    signatureDataUrl,
    presidentName,
    presidentTitle,
    cardSettings,
  } = context;

  const placement = cardSettings.signaturePlacement ?? null;
  const dragEnabled = Boolean(signatureDrag?.enabled && signatureDataUrl);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    mode: "move" | "resize";
    pointerId: number;
    startX: number;
    startY: number;
    start: SignaturePlacement;
    scale: number;
    aspect: number;
  } | null>(null);

  const setRootRef = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = node;
  };

  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

  const handleSignaturePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize"
  ) => {
    if (!dragEnabled || !signatureDrag) return;
    const root = rootRef.current;
    if (!root) return;
    const img =
      event.currentTarget instanceof HTMLImageElement
        ? event.currentTarget
        : ((event.currentTarget.querySelector("img") ??
            event.currentTarget.parentElement?.querySelector(
              "img"
            )) as HTMLImageElement | null);
    if (!img) return;
    event.preventDefault();
    const rootRect = root.getBoundingClientRect();
    const scale = rootRect.width / 600 || 1;
    const imgRect = img.getBoundingClientRect();
    const current: SignaturePlacement = placement ?? {
      x: (imgRect.left - rootRect.left) / scale,
      y: (imgRect.top - rootRect.top) / scale,
      width: imgRect.width / scale,
    };
    const height = imgRect.height / scale;
    dragState.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: current,
      scale,
      aspect: height > 0 ? current.width / height : 3,
    };
    setDragging(true);
    root.setPointerCapture(event.pointerId);
  };

  const handleRootPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st || !signatureDrag) return;
    if (event.pointerId !== st.pointerId) return;
    event.preventDefault();
    const dx = (event.clientX - st.startX) / st.scale;
    const dy = (event.clientY - st.startY) / st.scale;
    if (st.mode === "move") {
      const width = st.start.width;
      const height = width / st.aspect;
      signatureDrag.onChange({
        x: clamp(st.start.x + dx, 0, 600 - width),
        y: clamp(st.start.y + dy, 0, 378 - height),
        width,
      });
    } else {
      const width = clamp(st.start.width + dx, 60, 420);
      const height = width / st.aspect;
      signatureDrag.onChange({
        x: clamp(st.start.x, 0, 600 - width),
        y: clamp(st.start.y, 0, 378 - height),
        width,
      });
    }
  };

  const handleRootPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st || event.pointerId !== st.pointerId) return;
    dragState.current = null;
    setDragging(false);
    if (rootRef.current?.hasPointerCapture(event.pointerId)) {
      rootRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const sigCursor = dragging ? "cursor-grabbing" : "cursor-grab";

  const addressLine = [member.address, member.addressNumber]
    .filter(Boolean)
    .join(", ");

  const fullAddress = [
    addressLine,
    member.complement,
    member.district,
    [member.city, member.state].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      ref={setRootRef}
      data-card-root=""
      onPointerMove={dragEnabled ? handleRootPointerMove : undefined}
      onPointerUp={dragEnabled ? handleRootPointerEnd : undefined}
      onPointerCancel={dragEnabled ? handleRootPointerEnd : undefined}
      className={
        className ??
        "relative h-[378px] w-[600px] overflow-hidden rounded-[18px] bg-white"
      }
      style={{
        boxShadow:
          "0 24px 48px -16px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15,23,42,0.06)",
        fontFamily: "'Inter Variable', Inter, 'Segoe UI', sans-serif",
        touchAction: dragEnabled ? "none" : undefined,
      }}
    >
      {/* Marca d'água */}
      <img
        src={logoDataUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-[38%] -translate-y-[46%] object-contain opacity-[0.05]"
        draggable={false}
      />

      {/* Cabeçalho */}
      <div className="relative flex items-center gap-3.5 px-6 pb-4 pt-4" style={{
        background: "linear-gradient(120deg, #131a29 0%, #1d2537 55%, #2c354c 100%)",
      }}>
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-500/60">
          <img
            src={logoDataUrl}
            alt="Logo AMOCOC"
            className="h-full w-full object-cover"
            draggable={false}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[17px] font-extrabold leading-none tracking-[0.2em]"
            style={{ color: "#ffffff" }}
          >
            {associationAcronym}
          </p>
          <p className="mt-1.5 truncate text-[9.5px] font-medium leading-tight tracking-wide text-slate-300">
            {associationName.toUpperCase()}
          </p>
        </div>
        <div className="shrink-0 rounded-md px-2.5 py-1.5 text-center" style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.92), rgba(245,179,1,0.92))",
        }}>
          <p className="text-[8.5px] font-bold uppercase leading-none tracking-[0.14em] text-white/95">
            {cardSettings.title}
          </p>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 h-[3px]"
          style={{
            background: "linear-gradient(90deg, #f97316 0%, #f5b301 55%, #29abe2 100%)",
          }}
        />
      </div>

      {/* Corpo */}
      <div className="relative flex gap-5 px-6 pt-3">
        {/* Foto */}
        <div className="shrink-0">
          <div
            className="flex h-[124px] w-[104px] items-center justify-center overflow-hidden rounded-lg border-2"
            style={{ borderColor: "#f97316", background: "#f4f6fa" }}
          >
            {member.photoDataUrl ? (
              <img
                src={member.photoDataUrl}
                alt={`Foto de ${member.fullName}`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <span className="text-2xl font-bold tracking-wider text-ink-300">
                {initialsOf(member.fullName)}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-center text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Associado
          </p>
        </div>

        {/* Dados */}
        <div className="min-w-0 flex-1">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Nome completo
          </p>
          <p
            className="mt-0.5 truncate text-[19px] font-bold leading-tight"
            style={{ color: "#131a29" }}
          >
            {member.fullName}
          </p>

          <div className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-2">
            <Field label="Matrícula" value={member.membershipNumber} mono />
            <Field label="Nascimento" value={formatDate(member.birthDate)} />
            {cardSettings.showCpf && (
              <Field label="CPF" value={member.cpf || "—"} mono />
            )}
            {cardSettings.showPhone && (
              <Field
                label="WhatsApp"
                value={member.whatsapp || member.phone || "—"}
              />
            )}
          </div>

          {cardSettings.showAddress && fullAddress && (
            <p className="mt-1.5 truncate text-[9px] text-slate-500">
              {fullAddress}
            </p>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="flex items-end justify-between gap-4 px-6 pb-3 pt-2">
          <div className="min-w-0 flex-1">
            {/* Código da carteirinha */}
            <div
              className="flex w-full max-w-[280px] items-center justify-between gap-3 rounded-lg px-3 py-1.5"
              style={{
                background: "linear-gradient(135deg, #fff7ed, #fefce8)",
                border: "1px solid rgba(249,115,22,0.25)",
              }}
            >
              <div className="min-w-0">
                <p className="text-[7.5px] font-bold uppercase tracking-[0.16em] text-brand-600">
                  Código da carteirinha
                </p>
                <p
                  className="mt-0.5 truncate font-mono text-[13.5px] font-extrabold tracking-[0.06em]"
                  style={{ color: "#131a29" }}
                >
                  {member.cardCode}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-1 text-[7.5px] font-bold uppercase tracking-wider text-white"
                style={{ background: "#131a29" }}
              >
                {member.status === "ATIVO" ? "Válida" : "Inativa"}
              </span>
            </div>

            {cardSettings.showIssueDate && (
              <p className="mt-1.5 text-[8.5px] text-slate-400">
                Emitida em {formatDate(new Date().toISOString())}
              </p>
            )}
            <p className="mt-0.5 max-w-[280px] truncate text-[8.5px] text-slate-400">
              {cardSettings.footerText}
            </p>
          </div>

          {/* Assinatura oficial — inserida automaticamente.
              A caixa reserva o espaço mesmo com posição personalizada,
              mantendo a linha e o nome na mesma altura nos dois modos. */}
          <div className="flex w-[250px] shrink-0 flex-col items-center">
            <div className="flex h-[80px] w-full items-end justify-center">
              {!placement && signatureDataUrl && (
                <img
                  src={signatureDataUrl}
                  alt="Assinatura oficial do Presidente"
                  className={`max-h-[80px] max-w-full select-none object-contain object-bottom ${
                    dragEnabled ? sigCursor : ""
                  }`}
                  draggable={false}
                  onPointerDown={
                    dragEnabled
                      ? (e) => handleSignaturePointerDown(e, "move")
                      : undefined
                  }
                />
              )}
            </div>
            <div className="w-full border-t-2 border-slate-400" />
            <p className="mt-1 text-center text-[9.5px] font-bold leading-none text-ink-900">
              {presidentName || "Presidente da Diretoria"}
            </p>
            <p className="mt-0.5 text-center text-[7.5px] uppercase tracking-[0.14em] text-slate-400">
              {presidentTitle}
            </p>
          </div>
        </div>

        {/* Faixa inferior */}
        <div
          className="h-[7px] w-full"
          style={{
            background:
              "linear-gradient(90deg, #131a29 0%, #f97316 30%, #f5b301 65%, #29abe2 100%)",
          }}
        />
      </div>

      {/* Assinatura com posição personalizada (definida na prévia de
          Configurações → Carteirinha). Coordenadas em px lógicos 600×378. */}
      {placement && signatureDataUrl && (
        <div
          className="absolute"
          style={{ left: placement.x, top: placement.y, width: placement.width }}
        >
          <img
            src={signatureDataUrl}
            alt="Assinatura oficial do Presidente"
            draggable={false}
            className={`block w-full select-none ${dragEnabled ? sigCursor : ""}`}
            onPointerDown={
              dragEnabled ? (e) => handleSignaturePointerDown(e, "move") : undefined
            }
          />
          {dragEnabled && (
            <span
              title="Arraste para redimensionar"
              onPointerDown={(e) => handleSignaturePointerDown(e, "resize")}
              className="absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-white bg-brand-500 shadow-sm"
            />
          )}
        </div>
      )}
    </div>
  );
});

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-[12.5px] font-semibold text-ink-900 ${
          mono ? "font-mono tracking-wide" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
