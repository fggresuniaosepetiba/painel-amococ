import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgeCheck,
  CircleAlert,
  FileText,
  Move,
  PenLine,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FieldLabel } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";
import {
  signatureSettingsSchema,
  type SignatureSettingsFormValues,
} from "@/schemas/settings";
import {
  imageService,
  settingsService,
  signatureService,
} from "@/services";
import { MAX_SIGNATURE_SIZE } from "@/constants";
import { formatDate } from "@/utils/format";
import { MembershipCard } from "@/features/cards/MembershipCard";
import {
  ResidenceDeclarationDocument,
  type DeclarationDocumentData,
} from "@/features/declarations/ResidenceDeclarationDocument";
import type { CardRenderContext } from "@/services/cardGenerationService";
import type { AppSettings, Member, SignaturePlacement } from "@amococ/shared";

/** Imagem selecionada pelo usuário, ainda em rascunho (não aplicada). */
interface DraftImage {
  dataUrl: string;
  mimeType: string;
}

/** Membro de exemplo usado apenas na prévia da carteirinha. */
const previewMember: Member = {
  id: "preview",
  membershipNumber: "000001",
  cardCode: "AMOCOC-000001-A8ZK",
  fullName: "Associado Exemplo",
  cpf: "",
  birthDate: "1985-04-12",
  phone: "",
  whatsapp: "(85) 98811-2233",
  cep: "",
  address: "Rua das Acácias",
  addressNumber: "120",
  complement: "",
  district: "Conjunto Otacílio Câmara",
  city: "Fortaleza",
  state: "CE",
  photoDataUrl: null,
  notes: "",
  status: "ATIVO",
  inactivatedAt: null,
  createdAt: "",
  updatedAt: "",
};

/** Dados de exemplo só para a prévia do A4 (não são gravados). */
const previewDeclaration: DeclarationDocumentData = {
  residentName: "Maria Aparecida de Souza",
  birthDate: "1985-04-12",
  cpf: "111.444.777-35",
  address:
    "Rua Otacílio Câmara, 45 - Conjunto Otacílio Câmara, Rio de Janeiro - RJ - CEP 21230-000",
  residenceYears: 12,
  residenceMonths: 6,
  issuedAt: "2026-10-22T12:00:00.000Z",
};

/** Escala da prévia do A4 (210 × 297 mm ≈ 794 × 1123 px). */
const DECLARATION_PREVIEW_SCALE = 0.62;
const DECLARATION_PREVIEW_WIDTH = 794;
const DECLARATION_PREVIEW_HEIGHT = 1123;

/**
 * Configurações → Assinatura.
 *
 * Fluxo em rascunho: enviar imagem → as prévias aparecem na hora →
 * arrastar/redimensionar → **Salvar assinatura**. Enquanto não salvar, a
 * imagem e as posições NÃO valem para as carteirinhas nem declarações (o
 * banco não é tocado).
 */
export function SignatureSettingsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const readOnly = !hasPermission("settings.edit");
  const fileRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [draftImage, setDraftImage] = useState<DraftImage | null>(null);
  const [placement, setPlacement] = useState<SignaturePlacement | null>(null);
  const [declarationPlacement, setDeclarationPlacement] =
    useState<SignaturePlacement | null>(null);
  const [trimmedPreview, setTrimmedPreview] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<SignatureSettingsFormValues>({
    resolver: zodResolver(signatureSettingsSchema),
    defaultValues: { presidentName: "", presidentTitle: "" },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await settingsService.get();
        if (!cancelled) setSettings(loaded);
      } catch {
        // A tela mostra o erro ao salvar; aqui mantém o esqueleto.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadSettings = async () => {
    try {
      setSettings(await settingsService.get());
    } catch {
      // Mantém o estado atual.
    }
  };

  useEffect(() => {
    if (!settings) return;
    reset({
      presidentName: settings.signature.presidentName,
      presidentTitle: settings.signature.presidentTitle,
    });
    setPlacement(settings.card.signaturePlacement ?? null);
    setDeclarationPlacement(settings.declaration.signaturePlacement ?? null);
  }, [settings, reset]);

  const signature = settings?.signature ?? null;
  const configured = Boolean(signature?.imageDataUrl);
  const savedPlacement = settings?.card.signaturePlacement ?? null;

  /** O que a prévia mostra: rascunho (não salvo) ou a assinatura ativa. */
  const previewSource = draftImage?.dataUrl ?? signature?.imageDataUrl ?? null;

  // Recorte de fundo (mesmo processo da geração real) para a prévia ser
  // idêntica à carteirinha final.
  useEffect(() => {
    if (!previewSource) {
      setTrimmedPreview("");
      return;
    }
    let cancelled = false;
    void imageService.trimSignature(previewSource).then((value) => {
      if (!cancelled) setTrimmedPreview(value);
    });
    return () => {
      cancelled = true;
    };
  }, [previewSource]);

  const watched = watch();
  const cardPlacementDirty =
    JSON.stringify(placement ?? null) !== JSON.stringify(savedPlacement);
  const savedDeclarationPlacement =
    settings?.declaration.signaturePlacement ?? null;
  const declarationPlacementDirty =
    JSON.stringify(declarationPlacement ?? null) !==
    JSON.stringify(savedDeclarationPlacement);
  const canSave =
    !readOnly &&
    (isDirty ||
      Boolean(draftImage) ||
      cardPlacementDirty ||
      declarationPlacementDirty);

  const previewContext: CardRenderContext | null = useMemo(() => {
    if (!settings) return null;
    return {
      member: previewMember,
      associationName: settings.association.name,
      associationAcronym: settings.association.acronym || "AMOCOC",
      associationAddress: settings.association.address,
      associationPhone: settings.association.phone,
      logoDataUrl:
        settings.association.customLogoDataUrl ?? "/assets/images/logo-amococ.png",
      signatureDataUrl: trimmedPreview,
      presidentName:
        watched.presidentName || settings.signature.presidentName,
      presidentTitle:
        watched.presidentTitle ||
        settings.signature.presidentTitle ||
        "Presidente da Diretoria",
      cardSettings: { ...settings.card, signaturePlacement: placement },
    };
  }, [settings, watched, trimmedPreview, placement]);

  /**
   * Configurações da prévia do A4: mesma assinatura oficial (ou o rascunho
   * recém-enviado) com a posição que está sendo ajustada na tela.
   */
  const declarationPreviewSettings: AppSettings | null = useMemo(() => {
    if (!settings) return null;
    return {
      ...settings,
      signature: {
        ...settings.signature,
        presidentName:
          watched.presidentName || settings.signature.presidentName,
        presidentTitle:
          watched.presidentTitle ||
          settings.signature.presidentTitle ||
          "Presidente da Diretoria",
        imageDataUrl: previewSource,
        mimeType: draftImage?.mimeType ?? settings.signature.mimeType,
      },
      declaration: {
        ...settings.declaration,
        signaturePlacement: declarationPlacement,
      },
    };
  }, [
    settings,
    watched.presidentName,
    watched.presidentTitle,
    previewSource,
    draftImage?.mimeType,
    declarationPlacement,
  ]);

  /** Envio do arquivo apenas cria o RASCUNHO — nada é gravado no banco. */
  const handleFile = async (file: File | undefined) => {
    if (!file || readOnly) return;
    const validation = imageService.validate(file, MAX_SIGNATURE_SIZE);
    if (validation) {
      toast.error("Imagem inválida", validation);
      return;
    }
    setBusy(true);
    try {
      const processed = await imageService.resizeSignature(file, 700);
      setDraftImage({ dataUrl: processed.dataUrl, mimeType: processed.mimeType });
      toast.info(
        "Prévia pronta",
        'Ajuste a posição na carteirinha e na declaração e clique em "Salvar assinatura" para aplicar.'
      );
    } catch {
      toast.error("Não foi possível ler a imagem", "Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (readOnly) return;
    setBusy(true);
    try {
      await signatureService.save({ imageDataUrl: null, mimeType: null });
      if (savedPlacement) {
        await settingsService.updateCard({ signaturePlacement: null });
      }
      if (savedDeclarationPlacement) {
        await settingsService.updateDeclaration({ signaturePlacement: null });
      }
      setDraftImage(null);
      setPlacement(null);
      setDeclarationPlacement(null);
      // Auditoria (SIGNATURE_UPDATED + SETTINGS_UPDATED) no servidor.
      await reloadSettings();
      toast.info(
        "Assinatura removida",
        "Novas carteirinhas e declarações ficarão bloqueadas."
      );
    } finally {
      setBusy(false);
    }
  };

  /** Único ponto em que rascunho + posição passam a valer. */
  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    setBusy(true);
    try {
      if (isDirty || draftImage) {
        await signatureService.save({
          presidentName: values.presidentName,
          presidentTitle: values.presidentTitle,
          ...(draftImage
            ? { imageDataUrl: draftImage.dataUrl, mimeType: draftImage.mimeType }
            : {}),
        });
      }
      if (cardPlacementDirty) {
        await settingsService.updateCard({ signaturePlacement: placement });
      }
      if (declarationPlacementDirty) {
        await settingsService.updateDeclaration({
          signaturePlacement: declarationPlacement,
        });
      }
      // Auditoria (SIGNATURE_UPDATED / SETTINGS_UPDATED) no servidor.
      await reloadSettings();
      const hadDraft = Boolean(draftImage);
      setDraftImage(null);
      reset(values);
      toast.success(
        "Assinatura salva",
        hadDraft
          ? "Imagem e posições já valem para as próximas carteirinhas e declarações."
          : "Alterações aplicadas às próximas carteirinhas e declarações."
      );
    } catch {
      toast.error("Não foi possível salvar a assinatura", "Tente novamente.");
    } finally {
      setBusy(false);
    }
  });

  if (!settings) {
    return (
      <Card className="p-6">
        <div className="skeleton h-64 w-full" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status + envio (rascunho) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-brand-500" />
            Assinatura oficial do Presidente
          </CardTitle>
          {draftImage && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-2xs font-semibold text-amber-800">
              <CircleAlert className="h-3.5 w-3.5" />
              RASCUNHO — NÃO SALVO
            </span>
          )}
          {configured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-2xs font-semibold text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" />
              ASSINATURA CONFIGURADA
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-2xs font-semibold text-amber-700">
              <CircleAlert className="h-3.5 w-3.5" />
              ASSINATURA NÃO CONFIGURADA
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-start gap-5 sm:flex-row">
            <div className="flex h-36 w-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-[repeating-conic-gradient(#f8fafc_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] px-6 sm:w-auto">
              {previewSource ? (
                <img
                  src={previewSource}
                  alt="Pré-visualização da assinatura oficial"
                  className="max-h-28 object-contain"
                />
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">
                  Nenhuma assinatura carregada
                </p>
              )}
            </div>

            <div className="w-full shrink-0 sm:w-56">
              <p className="text-[13px] font-medium text-slate-700">
                Arquivo da assinatura
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                PNG, JPG ou JPEG. A transparência do PNG é preservada e o fundo
                em branco é recortado automaticamente. Depois do envio, arraste
                a assinatura nas prévias abaixo e clique em{" "}
                <strong>Salvar assinatura</strong> – sem salvar, nada é
                aplicado.
              </p>
              {!readOnly && (
                <div className="mt-3 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    loading={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    {!busy && <Upload className="h-4 w-4" />}
                    {previewSource ? "Substituir assinatura" : "Enviar assinatura"}
                  </Button>
                  {draftImage && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDraftImage(null)}
                      disabled={busy}
                    >
                      Descartar rascunho
                    </Button>
                  )}
                  {signature?.imageDataUrl && (
                    <Button
                      type="button"
                      variant="ghost-danger"
                      onClick={() => void handleRemove()}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover assinatura
                    </Button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      void handleFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {draftImage && (
            <Alert variant="warning" title="Rascunho – ainda não aplicado">
              A assinatura aparece nas prévias abaixo, mas só passa a valer nas
              carteirinhas e declarações depois que você clicar em "Salvar
              assinatura".
            </Alert>
          )}

          {signature?.updatedAt && !draftImage && (
            <p className="text-2xs text-slate-400">
              Última atualização: {formatDate(signature.updatedAt)}
            </p>
          )}

          {!configured && (
            <Alert variant="warning" title="Geração bloqueada">
              Enquanto a assinatura não for salva, não será possível gerar
              carteirinhas nem declarações.
            </Alert>
          )}
        </CardContent>
      </Card>

      <form onSubmit={onSubmit} noValidate>
        {/* Signatário */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Signatário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel>Nome do Presidente</FieldLabel>
                <Input
                  readOnly={readOnly}
                  placeholder="Nome exibido abaixo da assinatura"
                  invalid={Boolean(errors.presidentName)}
                  {...register("presidentName")}
                />
                <FieldError message={errors.presidentName?.message} />
              </div>
              <div>
                <FieldLabel>Cargo</FieldLabel>
                <Input
                  readOnly={readOnly}
                  placeholder="Presidente da Diretoria"
                  invalid={Boolean(errors.presidentTitle)}
                  {...register("presidentTitle")}
                />
                <FieldError message={errors.presidentTitle?.message} />
              </div>
            </div>

            {readOnly && (
              <Alert variant="warning" title="Somente leitura">
                Você não possui permissão para editar configurações.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Prévia na carteirinha: arrastar/redimensionar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Move className="h-4 w-4 text-brand-500" />
              Prévia na carteirinha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-500">
              Envie a assinatura, arraste-a sobre a prévia para escolher onde
              ela fica e puxe o pontinho laranja do canto para redimensionar.
              Nada é aplicado até você salvar.
            </p>
            {previewContext && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
                <div className="mx-auto w-[600px]">
                  <MembershipCard
                    context={previewContext}
                    signatureDrag={{
                      enabled: !readOnly,
                      onChange: setPlacement,
                    }}
                  />
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-2xs text-slate-400">
                {draftImage
                  ? "Rascunho não aplicado – clique em Salvar assinatura para valer."
                  : cardPlacementDirty
                    ? "Posição alterada – clique em Salvar assinatura para aplicar."
                    : savedPlacement
                      ? "Posição personalizada salva."
                      : "Posição padrão: colada na linha, à direita."}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlacement(null)}
                disabled={readOnly || !placement}
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar posição padrão
              </Button>
            </div>
          </CardContent>
          {!readOnly && (
            <CardFooter className="flex-wrap items-center justify-between gap-3">
              <p className="text-2xs text-slate-500">
                Salvar aplica o signatário, a imagem e as posições das duas
                prévias.
              </p>
              <Button type="submit" loading={busy} disabled={!canSave}>
                {!busy && <Save className="h-4 w-4" />}
                {busy ? "Salvando..." : "Salvar assinatura"}
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Prévia na declaração: arrastar/redimensionar */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-500" />
              Prévia na declaração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-500">
              A declaração usa a mesma assinatura oficial. Arraste-a sobre o
              papel A4 para posicionar e puxe o pontinho laranja do canto para
              aumentar ou diminuir o tamanho. Nada é aplicado até você salvar.
            </p>
            {!previewSource && (
              <Alert variant="warning" title="Envie a assinatura primeiro">
                Sem a imagem oficial, a declaração fica bloqueada e não há o
                que posicionar.
              </Alert>
            )}
            {declarationPreviewSettings && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
                <div
                  className="mx-auto overflow-hidden"
                  style={{
                    width:
                      DECLARATION_PREVIEW_WIDTH * DECLARATION_PREVIEW_SCALE,
                    height:
                      DECLARATION_PREVIEW_HEIGHT * DECLARATION_PREVIEW_SCALE,
                  }}
                >
                  <div
                    style={{
                      width: DECLARATION_PREVIEW_WIDTH,
                      transform: `scale(${DECLARATION_PREVIEW_SCALE})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <ResidenceDeclarationDocument
                      data={previewDeclaration}
                      settings={declarationPreviewSettings}
                      signatureDrag={{
                        enabled: !readOnly,
                        onChange: setDeclarationPlacement,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-2xs text-slate-400">
                {draftImage
                  ? "Rascunho não aplicado – clique em Salvar assinatura para valer."
                  : declarationPlacementDirty
                    ? "Posição alterada – clique em Salvar assinatura para aplicar."
                    : savedDeclarationPlacement
                      ? "Posição personalizada salva."
                      : "Posição padrão: centralizada acima da linha."}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeclarationPlacement(null)}
                disabled={readOnly || !declarationPlacement}
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar posição padrão
              </Button>
            </div>
          </CardContent>
          {!readOnly && (
            <CardFooter className="flex-wrap items-center justify-between gap-3">
              <p className="text-2xs text-slate-500">
                Salvar aplica o signatário, a imagem e as posições das duas
                prévias.
              </p>
              <Button type="submit" loading={busy} disabled={!canSave}>
                {!busy && <Save className="h-4 w-4" />}
                {busy ? "Salvando..." : "Salvar assinatura"}
              </Button>
            </CardFooter>
          )}
        </Card>
      </form>
    </div>
  );
}
