import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LOGO_PATH } from "@/constants";
import type { AppSettings, SignaturePlacement } from "@amococ/shared";
import { dateIsoToBr, formatDate } from "@/utils/format";

/**
 * Área útil do A4 a 96 dpi: 170 × 261 mm (margens de 20 mm nas laterais e
 * 18 mm no topo/rodapé). É o espaço em que a assinatura pode ser posicionada.
 */
export const DECLARATION_CONTENT_WIDTH = 642.5;
export const DECLARATION_CONTENT_HEIGHT = 986.5;

/** Dados exibidos no documento — registro salvo ou rascunho do formulário. */
export interface DeclarationDocumentData {
  residentName: string;
  /** Data de nascimento em ISO yyyy-mm-dd. */
  birthDate: string;
  cpf: string;
  address: string;
  residenceYears: number;
  residenceMonths: number;
  /** ISO — vira o "RIO DE JANEIRO, dd/mm/aaaa" do rodapé (data de emissão). */
  issuedAt: string;
}

/**
 * Documento A4 da declaração de residência (Lei nº 7.115/82, art. 2º).
 *
 * Renderizado SEMPRE a partir dos dados (nunca congelado em imagem), o que
 * permite reimprimir quantas vezes a pessoa voltar à associação. O CNPJ vem
 * das Configurações da Associação; a assinatura do responsável é a mesma
 * cadastrada para a carteirinha; a do morador fica em branco — assina no
 * papel. O container carrega `print-area`: o CSS de impressão garante que
 * só este bloco vá para a página.
 */
export function ResidenceDeclarationDocument({
  data,
  settings,
  signatureDrag,
}: {
  data: DeclarationDocumentData;
  settings: AppSettings;
  /** Habilita arrastar/redimensionar a assinatura na prévia de Configurações. */
  signatureDrag?: {
    enabled: boolean;
    onChange: (placement: SignaturePlacement) => void;
  };
}) {
  const logo = settings.association.customLogoDataUrl ?? LOGO_PATH;
  const cnpj = settings.association.cnpj.trim();
  const signature = settings.signature.imageDataUrl;
  const placement = settings.declaration?.signaturePlacement ?? null;
  const dragEnabled = Boolean(signatureDrag?.enabled && signature);
  const rootRef = useRef<HTMLElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
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
  const presidentName = settings.signature.presidentName.trim();
  const presidentTitle = settings.signature.presidentTitle.trim();
  const responsibleLine = [presidentName, presidentTitle]
    .filter(Boolean)
    .join(" – ");
  const birthDate = dateIsoToBr(data.birthDate);
  const yearsText = `${data.residenceYears} ${data.residenceYears === 1 ? "ANO" : "ANOS"}`;
  const monthsText = `${data.residenceMonths} ${data.residenceMonths === 1 ? "MÊS" : "MESES"}`;

  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

  const handleSignaturePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize"
  ) => {
    if (!dragEnabled || !signatureDrag) return;
    const layer = layerRef.current;
    const root = rootRef.current;
    if (!layer || !root) return;
    const img =
      event.currentTarget instanceof HTMLImageElement
        ? event.currentTarget
        : (event.currentTarget
            .closest(".declaration-placement-box")
            ?.querySelector("img") as HTMLImageElement | null);
    if (!img) return;
    event.preventDefault();
    const layerRect = layer.getBoundingClientRect();
    const scale = layerRect.width / DECLARATION_CONTENT_WIDTH || 1;
    const imgRect = img.getBoundingClientRect();
    const current: SignaturePlacement = placement ?? {
      x: (imgRect.left - layerRect.left) / scale,
      y: (imgRect.top - layerRect.top) / scale,
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

  const handleRootPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const st = dragState.current;
    if (!st || !signatureDrag) return;
    if (event.pointerId !== st.pointerId) return;
    event.preventDefault();
    const dx = (event.clientX - st.startX) / st.scale;
    const dy = (event.clientY - st.startY) / st.scale;
    const pageWidth = DECLARATION_CONTENT_WIDTH;
    const pageHeight = DECLARATION_CONTENT_HEIGHT;
    if (st.mode === "move") {
      const width = st.start.width;
      const height = width / st.aspect;
      signatureDrag.onChange({
        x: clamp(st.start.x + dx, 0, pageWidth - width),
        y: clamp(st.start.y + dy, 0, pageHeight - Math.min(height, pageHeight)),
        width,
      });
    } else {
      const width = clamp(st.start.width + dx, 40, pageWidth);
      const height = width / st.aspect;
      signatureDrag.onChange({
        x: clamp(st.start.x, 0, pageWidth - width),
        y: clamp(st.start.y, 0, pageHeight - Math.min(height, pageHeight)),
        width,
      });
    }
  };

  const handleRootPointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    const st = dragState.current;
    if (!st || event.pointerId !== st.pointerId) return;
    dragState.current = null;
    setDragging(false);
    if (rootRef.current?.hasPointerCapture(event.pointerId)) {
      rootRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const sigCursor = dragging ? "cursor-grabbing" : "cursor-grab";

  return (
    <article
      ref={rootRef}
      className="declaration-sheet print-area"
      data-testid="declaration-document"
      onPointerMove={dragEnabled ? handleRootPointerMove : undefined}
      onPointerUp={dragEnabled ? handleRootPointerEnd : undefined}
      onPointerCancel={dragEnabled ? handleRootPointerEnd : undefined}
      style={{ touchAction: dragEnabled ? "none" : undefined }}
    >
      <img src={logo} alt="Logo da associação" className="declaration-logo" />

      <h1 className="declaration-title">DECLARAÇÃO DE RESIDÊNCIA</h1>
      {cnpj && <p className="declaration-cnpj">CNPJ: {cnpj}</p>}

      <p className="declaration-paragraph">
        DECLARO PARA OS DEVIDOS FINS DE COMPROVAÇÃO DE RESIDÊNCIA, SOB PENA DA
        LEI Nº 7.115/82, NO ART. 2º, QUE{" "}
        <span className="declaration-que-name">{data.residentName}</span>
      </p>

      <p className="declaration-paragraph">
        DATA DE NASCIMENTO:{" "}
        <span className="declaration-data">
          {birthDate || "____/____/________"}
        </span>
        {"   "}CPF:{" "}
        <span className="declaration-data">
          {data.cpf || "_________________"}
        </span>
      </p>

      <p className="declaration-paragraph">
        RESIDENTE NO ENDEREÇO:{" "}
        <span className="declaration-data">{data.address}</span> HÁ{" "}
        <span className="declaration-data">{yearsText}</span> E{" "}
        <span className="declaration-data">{monthsText}</span>
      </p>

      <p className="declaration-paragraph">
        EU,{" "}
        <span className="declaration-data declaration-data--italic">
          {data.residentName}
        </span>
        , DECLARO AINDA ESTAR CIENTE DE QUE A FALSIFICAÇÃO DA PRESENTE
        DECLARAÇÃO PODERÁ IMPLICAR NA SEÇÃO PENAL PREVISTA NO ART. 299 DO
        CÓDIGO PENAL.
      </p>

      {/* Linha em branco — o morador assina no papel após a impressão. */}
      <div className="declaration-signature-block">
        <div className="declaration-signature-line declaration-signature-line--resident" />
        <p className="declaration-signature-label">ASSINATURA DO MORADOR</p>
      </div>

      <div className="declaration-spacer" />

      {/* Responsável — assinatura pré-preenchida (mesma da carteirinha). */}
      <div className="declaration-responsible">
        {signature && !placement ? (
          <img
            src={signature}
            alt="Assinatura do responsável"
            className={`declaration-signature-img ${
              dragEnabled ? `declaration-draggable ${sigCursor}` : ""
            }`}
            draggable={false}
            onPointerDown={
              dragEnabled
                ? (e) => handleSignaturePointerDown(e, "move")
                : undefined
            }
          />
        ) : (
          <div className="declaration-signature-img-placeholder" />
        )}
        <div className="declaration-signature-line" />
        <p className="declaration-signature-label">RESPONSÁVEL DA ASSOCIAÇÃO</p>
        {responsibleLine && (
          <p className="declaration-president">{responsibleLine}</p>
        )}
        <p className="declaration-footer">
          RIO DE JANEIRO, {formatDate(data.issuedAt)}
        </p>
      </div>

      {/* Espaço reservado para o presidente carimbar e rubricar. */}
      <div className="declaration-stamp-space" aria-hidden="true" />

      {/* Posição personalizada da assinatura (Configurações → Assinatura).
          A camada cobre exatamente a área útil do A4; as coordenadas são
          relativas a ela e valem igualmente na prévia e na impressão. */}
      <div ref={layerRef} className="declaration-placement-layer">
        {placement && signature && (
          <div
            className="declaration-placement-box"
            style={{
              left: `${(placement.x / DECLARATION_CONTENT_WIDTH) * 100}%`,
              top: placement.y,
              width: `${(placement.width / DECLARATION_CONTENT_WIDTH) * 100}%`,
            }}
          >
            <img
              src={signature}
              alt="Assinatura do responsável"
              draggable={false}
              className={`declaration-signature-img-placed ${
                dragEnabled ? `declaration-draggable ${sigCursor}` : ""
              }`}
              onPointerDown={
                dragEnabled
                  ? (e) => handleSignaturePointerDown(e, "move")
                  : undefined
              }
            />
            {dragEnabled && (
              <span
                title="Arraste para redimensionar"
                onPointerDown={(e) => handleSignaturePointerDown(e, "resize")}
                className={`declaration-drag-handle ${
                  dragging ? "cursor-grabbing" : "cursor-nwse-resize"
                }`}
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
