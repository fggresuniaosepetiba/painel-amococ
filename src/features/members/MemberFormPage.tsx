import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Lock, Save, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { PageContainer, PageHeader, SectionTitle } from "@/components/shared/page";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FieldLabel } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/misc";
import { memberSchema } from "@/schemas/member";
import {
  cepService,
  memberService,
  membershipCardCodeService,
  membershipNumberService,
} from "@/services";
import {
  dateBrToIso,
  dateIsoToBr,
  formatCep,
  formatCpf,
  formatDateInput,
  formatPhone,
  formatWhatsapp,
} from "@/utils/format";
import { PhotoUploader } from "./PhotoUploader";
import type { Member } from "@/types";

interface FormFields extends FieldValues {
  membershipNumber: string;
  cardCode: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  phone: string;
  whatsapp: string;
  cep: string;
  address: string;
  addressNumber: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  photoDataUrl: string | null;
  notes: string;
}

export function MemberFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [previewNumber, setPreviewNumber] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [existing, setExisting] = useState<Member | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cepStatus, setCepStatus] = useState<
    "idle" | "loading" | "found" | "manual"
  >("idle");

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({
    resolver: zodResolver(memberSchema) as never,
    defaultValues: {
      membershipNumber: "",
      cardCode: "",
      fullName: "",
      cpf: "",
      birthDate: "",
      phone: "",
      whatsapp: "",
      cep: "",
      address: "",
      addressNumber: "",
      complement: "",
      district: "",
      city: "",
      state: "",
      photoDataUrl: null,
      notes: "",
    },
  });

  // Carrega dados (edição) ou gera prévia travada de matrícula/código (novo)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isEdit && id) {
        const member = await memberService.getById(id);
        if (cancelled) return;
        if (!member) {
          setNotFound(true);
          return;
        }
        setExisting(member);
        setPreviewNumber(member.membershipNumber);
        setPreviewCode(member.cardCode);
        setValue("membershipNumber", member.membershipNumber);
        setValue("cardCode", member.cardCode);
        setValue("fullName", member.fullName);
        setValue("cpf", member.cpf);
        setValue("birthDate", dateIsoToBr(member.birthDate));
        setValue("phone", member.phone);
        setValue("whatsapp", member.whatsapp);
        setValue("cep", member.cep);
        setValue("address", member.address);
        setValue("addressNumber", member.addressNumber);
        setValue("complement", member.complement);
        setValue("district", member.district);
        setValue("city", member.city);
        setValue("state", member.state);
        setValue("photoDataUrl", member.photoDataUrl);
        setValue("notes", member.notes);
      } else {
        const number = await membershipNumberService.previewNext();
        if (cancelled) return;
        const code = membershipCardCodeService.buildPreview(number);
        setPreviewNumber(number);
        setPreviewCode(code);
        setValue("membershipNumber", number);
        setValue("cardCode", code);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, setValue]);

  const photoValue = watch("photoDataUrl");

  /** Registra um campo aplicando um formatador (máscara) no change. */
  const registerFormatted = (
    name: keyof FormFields,
    formatter: (value: string) => string
  ) => {
    const registered = register(name as string);
    return {
      ...registered,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        event.target.value = formatter(event.target.value);
        registered.onChange(event);
      },
    };
  };

  /**
   * Ao sair do campo CEP completo, consulta a ViaCEP e preenche endereço,
   * bairro, cidade e estado. Número e complemento ficam sempre para a
   * pessoa. Se a consulta não trouxer logradouro (ou falhar), os campos
   * permanecem editáveis para digitação manual.
   */
  const handleCepBlur = async () => {
    const cep = getValues("cep") ?? "";
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setCepStatus("loading");
    const info = await cepService.lookup(cep);

    // Usuário continuou digitando enquanto consultava — descarta o resultado.
    if ((getValues("cep") ?? "").replace(/\D/g, "") !== digits) return;

    if (!info) {
      setCepStatus("manual");
      return;
    }
    if (info.logradouro) {
      setValue("address", info.logradouro, { shouldDirty: true });
    }
    if (info.bairro) {
      setValue("district", info.bairro, { shouldDirty: true });
    }
    if (info.localidade) {
      setValue("city", info.localidade, { shouldDirty: true });
    }
    if (info.uf) {
      setValue("state", info.uf.toUpperCase(), { shouldDirty: true });
    }
    setCepStatus(info.logradouro ? "found" : "manual");
  };

  const cepRegister = registerFormatted("cep", formatCep);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    try {
      const payload = {
        ...values,
        birthDate: dateBrToIso(values.birthDate),
        photoDataUrl: values.photoDataUrl ?? null,
        membershipNumber: previewNumber ?? "",
        cardCode: previewCode ?? "",
      };
      if (isEdit && existing) {
        await memberService.update(user, existing.id, payload);
        toast.success("Associado atualizado", "Matrícula e código preservados.");
        navigate(`/associados/${existing.id}`);
      } else {
        const created = await memberService.create(user, payload);
        toast.success(
          "Associado criado",
          `Matrícula ${created.membershipNumber} · Código ${created.cardCode}`
        );
        navigate(`/associados/${created.id}`);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "FORBIDDEN") {
        toast.error("Acesso restrito", "Você não tem permissão para esta ação.");
      } else if (
        code === "IDENTIFIER_ALREADY_USED" ||
        code === "MEMBERSHIP_NUMBER_TAKEN"
      ) {
        toast.error(
          "Identificador já utilizado",
          "Este identificador já foi utilizado e não pode ser reutilizado. Atualize a página para obter o próximo."
        );
      } else if (code === "LOGIN_ALREADY_EXISTS" || code === "CARD_CODE_TAKEN") {
        toast.error(
          "Conflito de identificação",
          "Atualize a página para obter uma nova matrícula/código."
        );
      } else {
        toast.error(
          "Não foi possível salvar",
          "Verifique os dados e tente novamente."
        );
      }
    }
  });

  const loadingPreview = !previewNumber || !previewCode;

  if (notFound) {
    return (
      <PageContainer>
        <Card className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900">
            Associado não encontrado
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            O registro solicitado não existe mais.
          </p>
          <Button asChild className="mt-5">
            <Link to="/associados">Voltar para associados</Link>
          </Button>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={isEdit ? "Editar associado" : "Novo associado"}
        description={
          isEdit
            ? "Atualize os dados cadastrais. Matrícula e código são imutáveis."
            : "Preencha os dados. Matrícula e código da carteirinha são gerados automaticamente."
        }
        actions={
          <Button
            asChild
            variant="outline"
          >
            <Link to={isEdit && existing ? `/associados/${existing.id}` : "/associados"}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {/* IDENTIFICAÇÃO */}
        <Card>
          <CardContent>
            <SectionTitle>Identificação</SectionTitle>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel required hint="Gerada automaticamente">
                  Matrícula
                </FieldLabel>
                <div className="relative">
                  {loadingPreview ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      readOnly
                      tabIndex={-1}
                      data-testid="membership-number"
                      className="pr-10 font-mono font-semibold tracking-widest"
                      {...register("membershipNumber")}
                    />
                  )}
                  <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="mt-1.5 text-2xs text-slate-400">
                  Campo imutável — não pode ser editado.
                </p>
              </div>

              <div>
                <FieldLabel required hint="Gerado automaticamente">
                  Código da carteirinha
                </FieldLabel>
                <div className="relative">
                  {loadingPreview ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      readOnly
                      tabIndex={-1}
                      data-testid="card-code"
                      className="pr-10 font-mono font-semibold tracking-wide"
                      {...register("cardCode")}
                    />
                  )}
                  <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="mt-1.5 text-2xs text-slate-400">
                  Campo imutável — não pode ser editado.
                </p>
              </div>

              <div className="sm:col-span-2">
                <FieldLabel required>Nome completo</FieldLabel>
                <Input
                  placeholder="Nome do associado"
                  invalid={Boolean(errors.fullName)}
                  {...register("fullName")}
                />
                <FieldError message={errors.fullName?.message} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DADOS PESSOAIS */}
        <Card>
          <CardContent>
            <SectionTitle>Dados pessoais</SectionTitle>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <FieldLabel>CPF</FieldLabel>
                <Input
                  placeholder="000.000.000-00"
                  invalid={Boolean(errors.cpf)}
                  {...registerFormatted("cpf", formatCpf)}
                />
                <FieldError message={errors.cpf?.message} />
              </div>
              <div>
                <FieldLabel>Data de nascimento</FieldLabel>
                <Input
                  placeholder="dd/mm/aaaa"
                  inputMode="numeric"
                  autoComplete="off"
                  invalid={Boolean(errors.birthDate)}
                  {...registerFormatted("birthDate", formatDateInput)}
                />
                <FieldError message={errors.birthDate?.message} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CONTATO */}
        <Card>
          <CardContent>
            <SectionTitle>Contato</SectionTitle>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel>Telefone</FieldLabel>
                <Input
                  placeholder="(00) 00000-0000"
                  invalid={Boolean(errors.phone)}
                  {...registerFormatted("phone", formatPhone)}
                />
                <FieldError message={errors.phone?.message} />
              </div>
              <div>
                <FieldLabel>WhatsApp</FieldLabel>
                <Input
                  placeholder="(00) 9.0000-0000"
                  inputMode="numeric"
                  invalid={Boolean(errors.whatsapp)}
                  {...registerFormatted("whatsapp", formatWhatsapp)}
                />
                <FieldError message={errors.whatsapp?.message} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ENDEREÇO */}
        <Card>
          <CardContent>
            <SectionTitle>Endereço</SectionTitle>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <FieldLabel hint="Preenchimento automático">CEP</FieldLabel>
                <Input
                  placeholder="00000-000"
                  inputMode="numeric"
                  {...cepRegister}
                  onChange={(event) => {
                    setCepStatus("idle");
                    cepRegister.onChange(event);
                  }}
                  onBlur={(event) => {
                    cepRegister.onBlur(event);
                    void handleCepBlur();
                  }}
                />
                {cepStatus === "loading" && (
                  <p className="mt-1.5 text-2xs text-slate-400">
                    Consultando CEP...
                  </p>
                )}
                {cepStatus === "found" && (
                  <p className="mt-1.5 text-2xs text-emerald-600">
                    Endereço preenchido automaticamente e bloqueado. Número e
                    complemento ficam com você.
                  </p>
                )}
                {cepStatus === "manual" && (
                  <p className="mt-1.5 text-2xs text-amber-600">
                    Não foi possível trazer o endereço deste CEP — preencha os
                    campos ao lado manualmente.
                  </p>
                )}
              </div>
              <div className="lg:col-span-3">
                <FieldLabel hint={cepStatus === "found" ? "Bloqueado (ViaCEP)" : undefined}>
                  Endereço
                </FieldLabel>
                <Input
                  placeholder="Rua, avenida..."
                  readOnly={cepStatus === "found"}
                  {...register("address")}
                />
              </div>
              <div>
                <FieldLabel>Número</FieldLabel>
                <Input placeholder="Nº" {...register("addressNumber")} />
              </div>
              <div className="lg:col-span-2">
                <FieldLabel>Complemento</FieldLabel>
                <Input placeholder="Bloco, casa..." {...register("complement")} />
              </div>
              <div className="lg:col-span-2">
                <FieldLabel>Bairro</FieldLabel>
                <Input
                  placeholder="Bairro"
                  readOnly={cepStatus === "found"}
                  {...register("district")}
                />
              </div>
              <div className="lg:col-span-2">
                <FieldLabel>Cidade</FieldLabel>
                <Input
                  placeholder="Cidade"
                  readOnly={cepStatus === "found"}
                  {...register("city")}
                />
              </div>
              <div>
                <FieldLabel>Estado</FieldLabel>
                <Input
                  placeholder="UF"
                  maxLength={2}
                  className="uppercase"
                  readOnly={cepStatus === "found"}
                  {...register("state")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOTO */}
        <Card>
          <CardContent>
            <SectionTitle>Foto</SectionTitle>
            <PhotoUploader
              value={photoValue ?? null}
              onChange={(dataUrl) => setValue("photoDataUrl", dataUrl)}
            />
          </CardContent>
        </Card>

        {/* ASSOCIAÇÃO */}
        <Card>
          <CardContent>
            <SectionTitle>Associação</SectionTitle>
            <div className="grid grid-cols-1 gap-5">
              <div>
                <FieldLabel hint={`${watch("notes")?.length ?? 0}/1000`}>
                  Observações
                </FieldLabel>
                <Textarea
                  placeholder="Informações adicionais sobre o associado..."
                  maxLength={1000}
                  {...register("notes")}
                />
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-azure-500/20 bg-azure-500/10 px-4 py-3 text-xs leading-relaxed text-azure-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Ao salvar, a matrícula e o código da carteirinha serão
                  reservados de forma definitiva para este associado — nunca
                  serão reutilizados, mesmo em caso de inativação.
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={loadingPreview}>
              {!isSubmitting && <Save className="h-4 w-4" />}
              {isSubmitting
                ? isEdit
                  ? "Salvando associado..."
                  : "Criando associado..."
                : isEdit
                  ? "Salvar alterações"
                  : "Criar associado"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </PageContainer>
  );
}
