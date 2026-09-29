import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BadgeCheck,
  CircleAlert,
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
  auditService,
  imageService,
  settingsService,
  signatureService,
} from "@/services";
import { MAX_SIGNATURE_SIZE } from "@/constants";
import { formatDate } from "@/utils/format";
import { MembershipCard } from "@/features/cards/MembershipCard";
import type { CardRenderContext } from "@/services/cardGenerationService";
import type { Member, SignaturePlacement } from "@amococ/shared";

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

/**
 * Configurações → Assinatura.
 *
 * Fluxo em rascunho: enviar imagem → a prévia da carteirinha aparece na hora →
 * arrastar/redimensionar → **Salvar assinatura**. Enquanto não salvar, a
 * imagem e a posição NÃO valem para as carteirinhas (o banco não é tocado).
 */
export function SignatureSettingsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const readOnly = !hasPermission("settings.edit");
  const fileRef = useRef<HTMLInputElement>(null);

  const settings = useLiveQuery(() => settingsService.get(), []);
  const [busy, setBusy] = useState(false);
  const [draftImage, setDraftImage] = useState<DraftImage | null>(null);
  const [placement, setPlacement] = useState<SignaturePlacement | null>(null);
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
    if (!settings) return;
    reset({
      presidentName: settings.signature.presidentName,
      presidentTitle: settings.signature.presidentTitle,
    });
    setPlacement(settings.card.signaturePlacement ?? null);
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
  const placementDirty =
    JSON.stringify(placement ?? null) !== JSON.stringify(savedPlacement);
  const canSave = !readOnly && (isDirty || Boolean(draftImage) || placementDirty);

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
        'Ajuste a posição na carteirinha e clique em "Salvar assinatura" para aplicar.'
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
      await settingsService.updateCard({ signaturePlacement: null });
      setDraftImage(null);
      setPlacement(null);
      if (user) {
        await auditService.log({
          userId: user.id,
          userName: user.name,
          action: "SIGNATURE_UPDATED",
          entity: "settings",
          entityId: "signature",
          details: "Assinatura oficial removida",
        });
      }
      toast.info("Assinatura removida", "Novas carteirinhas ficarão bloqueadas.");
    } finally {
      setBusy(false);
    }
  };

  /** Único ponto em que rascunho + posição passam a valer. */
  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    setBusy(true);
    try {
      await signatureService.save({
        presidentName: values.presidentName,
        presidentTitle: values.presidentTitle,
        ...(draftImage
          ? { imageDataUrl: draftImage.dataUrl, mimeType: draftImage.mimeType }
          : {}),
      });
      await settingsService.updateCard({ signaturePlacement: placement });
      await auditService.log({
        userId: user.id,
        userName: user.name,
        action: draftImage ? "SIGNATURE_UPDATED" : "SETTINGS_UPDATED",
        entity: "settings",
        entityId: "signature",
        details: draftImage
          ? "Assinatura oficial do Presidente atualizada (imagem + posição)"
          : "Dados/posição da assinatura oficial atualizados",
      });
      const hadDraft = Boolean(draftImage);
      setDraftImage(null);
      reset(values);
      toast.success(
        "Assinatura salva",
        hadDraft
          ? "Imagem e posição já valem para as próximas carteirinhas."
          : "Alterações aplicadas às próximas carteirinhas."
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
                a assinatura na prévia abaixo e clique em{" "}
                <strong>Salvar assinatura</strong> — sem salvar, nada é
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
            <Alert variant="warning" title="Rascunho — ainda não aplicado">
              A assinatura aparece na prévia abaixo, mas só passa a valer nas
              carteirinhas depois que você clicar em "Salvar assinatura".
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
              carteirinhas.
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
                  ? "Rascunho não aplicado — clique em Salvar assinatura para valer."
                  : placementDirty
                    ? "Posição alterada — clique em Salvar assinatura para aplicar."
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
            <CardFooter className="justify-end">
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
