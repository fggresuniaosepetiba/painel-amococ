import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  FileText,
  Printer,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/ToastProvider";
import {
  PageContainer,
  PageHeader,
  SectionTitle,
} from "@/components/shared/page";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FieldLabel } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";
import { ApiError } from "@/lib/apiClient";
import {
  declarationSchema,
  type DeclarationFormValues,
} from "@/schemas/declaration";
import { cepService, declarationService, settingsService } from "@/services";
import {
  dateBrToIso,
  formatCep,
  formatCpf,
  formatDateInput,
} from "@/utils/format";
import { ResidenceDeclarationDocument } from "./ResidenceDeclarationDocument";
import type { AppSettings } from "@amococ/shared";

/** Junta os campos do endereço na linha única impressa no documento A4. */
function composeAddress(values: DeclarationFormValues) {
  const complement = values.complement.trim();
  const cep = values.cep.trim();
  const parts = [
    `${values.address.trim()}, ${values.addressNumber.trim()}`,
    complement ? ` - ${complement}` : "",
    ` - ${values.district.trim()}, ${values.city.trim()} - ${values.state.trim().toUpperCase()}`,
    cep ? ` - CEP ${cep}` : "",
  ];
  return parts.join("");
}


/**
 * FLUXO DA DECLARAÇÃO (definido com a diretoria):
 * 1. formulário manual — nunca busca em associados;
 * 2. "Finalizar" abre o documento A4 para a pessoa conferir;
 * 3. "Imprimir e salvar" grava + abre a impressão do navegador;
 *    "Salvar" grava apenas (fica na lista para reimprimir depois).
 */
export function DeclarationFormPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<"form" | "preview">("form");
  const [draft, setDraft] = useState<DeclarationFormValues | null>(null);
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [cepStatus, setCepStatus] = useState<
    "idle" | "loading" | "found" | "manual"
  >("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await settingsService.get();
        if (!cancelled) setSettings(loaded);
      } catch {
        // Sem configurações o preview usa o logo padrão do sistema.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<DeclarationFormValues>({
    resolver: zodResolver(declarationSchema),
    defaultValues: {
      residentName: "",
      birthDate: "",
      cpf: "",
      cep: "",
      address: "",
      addressNumber: "",
      complement: "",
      district: "",
      city: "",
      state: "",
      residenceYears: 0,
      residenceMonths: 0,
    },
  });

  /** Registra um campo aplicando um formatador (máscara) no change. */
  const registerFormatted = (
    name: "birthDate" | "cpf" | "cep",
    formatter: (value: string) => string
  ) => {
    const registered = register(name);
    return {
      ...registered,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        event.target.value = formatter(event.target.value);
        registered.onChange(event);
      },
    };
  };

  /**
   * Ao sair do CEP completo consulta a ViaCEP e preenche endereço, bairro,
   * cidade e estado — mesmos campos e comportamento do cadastro de associado.
   * Se a consulta não trouxer logradouro (ou falhar), tudo continua editável
   * para digitação manual.
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
  const cpfRegister = registerFormatted("cpf", formatCpf);

  const onSubmit = handleSubmit((values) => {
    setDraft({ ...values, address: composeAddress(values) });
    setStep("preview");
  });

  /** Salva (e opcionalmente imprime) a partir do documento conferido. */
  const handleSave = async (print: boolean) => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const created = await declarationService.create(draft);
      if (print) {
        // Auditoria acessória: impressão nunca deve quebrar o fluxo.
        await declarationService.registerPrint(created.id).catch(() => undefined);
        window.print();
      }
      toast.success(
        print
          ? "Declaração salva e enviada para impressão."
          : "Declaração salva na lista de declarações."
      );
      navigate("/declaracoes");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "SIGNATURE_MISSING") {
        toast.error(
          "Assinatura oficial necessária",
          "Cadastre a assinatura do presidente em Configurações → Assinatura para emitir declarações."
        );
      } else if (code === "FORBIDDEN") {
        toast.error(
          "Acesso restrito",
          "Você não tem permissão para esta ação."
        );
      } else {
        toast.error(
          "Não foi possível salvar a declaração",
          "Verifique os dados e tente novamente."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const signatureMissing =
    settings !== undefined && !settings.signature.imageDataUrl;

  if (step === "preview" && draft && settings) {
    return (
      <PageContainer>
        <PageHeader
          title="Conferir declaração"
          description="Confira os dados antes de confirmar. A declaração só entra na lista ao salvar ou imprimir."
          actions={
            <Button asChild variant="outline">
              <Link to="/declaracoes">
                <ArrowLeft className="h-4 w-4" />
                Cancelar
              </Link>
            </Button>
          }
        />

        {signatureMissing && (
          <div className="mb-5">
            <Alert variant="warning" title="Assinatura oficial não cadastrada">
              A assinatura do presidente é obrigatória para emitir declarações.
              Cadastre em Configurações → Assinatura e tente novamente.
            </Alert>
          </div>
        )}

        <ResidenceDeclarationDocument
          data={{
            residentName: draft.residentName,
            birthDate: dateBrToIso(draft.birthDate),
            cpf: draft.cpf,
            address: draft.address,
            residenceYears: draft.residenceYears,
            residenceMonths: draft.residenceMonths,
            issuedAt: new Date().toISOString(),
          }}
          settings={settings}
        />

        <Card className="mt-6">
          <CardFooter className="justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("form")}
              disabled={saving}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar e editar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSave(false)}
              loading={saving}
              disabled={signatureMissing}
            >
              {!saving && <Save className="h-4 w-4" />}
              Salvar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave(true)}
              loading={saving}
              disabled={signatureMissing}
            >
              {!saving && <Printer className="h-4 w-4" />}
              Imprimir e salvar
            </Button>
          </CardFooter>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Nova declaração"
        description="Preencha os dados do morador. Ao finalizar, o documento A4 será aberto para conferência."
        actions={
          <Button asChild variant="outline">
            <Link to="/declaracoes">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <Card>
          <CardContent>
            <SectionTitle>Dados do morador</SectionTitle>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel required>Nome completo</FieldLabel>
                <Input
                  placeholder="Nome do morador"
                  invalid={Boolean(errors.residentName)}
                  {...register("residentName")}
                />
                <FieldError message={errors.residentName?.message} />
              </div>

              <div>
                <FieldLabel required>Data de nascimento</FieldLabel>
                <Input
                  placeholder="dd/mm/aaaa"
                  inputMode="numeric"
                  autoComplete="off"
                  invalid={Boolean(errors.birthDate)}
                  {...registerFormatted("birthDate", formatDateInput)}
                />
                <FieldError message={errors.birthDate?.message} />
              </div>

              <div>
                <FieldLabel hint="Opcional">CPF</FieldLabel>
                <Input
                  placeholder="000.000.000-00"
                  invalid={Boolean(errors.cpf)}
                  {...cpfRegister}
                  onBlur={(event) => {
                    cpfRegister.onBlur(event);
                    void trigger("cpf");
                  }}
                />
                <FieldError message={errors.cpf?.message} />
              </div>

              <div>
                <FieldLabel required>Anos residindo</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={130}
                  inputMode="numeric"
                  invalid={Boolean(errors.residenceYears)}
                  {...register("residenceYears", { valueAsNumber: true })}
                />
                <FieldError message={errors.residenceYears?.message} />
              </div>

              <div>
                <FieldLabel required hint="De 0 a 11">
                  Meses residindo
                </FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={11}
                  inputMode="numeric"
                  invalid={Boolean(errors.residenceMonths)}
                  {...register("residenceMonths", { valueAsNumber: true })}
                />
                <FieldError message={errors.residenceMonths?.message} />
              </div>
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-azure-500/20 bg-azure-500/10 px-4 py-3 text-xs leading-relaxed text-azure-600">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Os dados são preenchidos manualmente — nada é buscado em
                associados. Ao finalizar, o documento será aberto para a pessoa
                conferir; depois é só imprimir (que já salva na lista) ou salvar
                apenas e imprimir quando quiser.
              </span>
            </div>

            <div className="mt-7 border-t border-slate-100 pt-6">
              <SectionTitle>Endereço</SectionTitle>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
                <div className="lg:col-span-2">
                  <FieldLabel hint="Preenchimento automático">CEP</FieldLabel>
                  <Input
                    placeholder="00000-000"
                    inputMode="numeric"
                    autoComplete="off"
                    invalid={Boolean(errors.cep)}
                    {...cepRegister}
                    onChange={(event) => {
                      setCepStatus("idle");
                      cepRegister.onChange(event);
                    }}
                    onBlur={(event) => {
                      cepRegister.onBlur(event);
                      void trigger("cep");
                      void handleCepBlur();
                    }}
                  />
                  <FieldError message={errors.cep?.message} />
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
                  <FieldLabel
                    required
                    hint={cepStatus === "found" ? "Bloqueado (ViaCEP)" : undefined}
                  >
                    Endereço
                  </FieldLabel>
                  <Input
                    placeholder="Rua, avenida..."
                    readOnly={cepStatus === "found"}
                    invalid={Boolean(errors.address)}
                    {...register("address")}
                  />
                  <FieldError message={errors.address?.message} />
                </div>
                <div>
                  <FieldLabel required>Número</FieldLabel>
                  <Input
                    placeholder="Nº"
                    invalid={Boolean(errors.addressNumber)}
                    {...register("addressNumber")}
                  />
                  <FieldError message={errors.addressNumber?.message} />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Complemento</FieldLabel>
                  <Input
                    placeholder="Bloco, casa..."
                    invalid={Boolean(errors.complement)}
                    {...register("complement")}
                  />
                  <FieldError message={errors.complement?.message} />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel required>Bairro</FieldLabel>
                  <Input
                    placeholder="Bairro"
                    readOnly={cepStatus === "found"}
                    invalid={Boolean(errors.district)}
                    {...register("district")}
                  />
                  <FieldError message={errors.district?.message} />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel required>Cidade</FieldLabel>
                  <Input
                    placeholder="Cidade"
                    readOnly={cepStatus === "found"}
                    invalid={Boolean(errors.city)}
                    {...register("city")}
                  />
                  <FieldError message={errors.city?.message} />
                </div>
                <div>
                  <FieldLabel required>Estado</FieldLabel>
                  <Input
                    placeholder="UF"
                    maxLength={2}
                    className="uppercase"
                    readOnly={cepStatus === "found"}
                    invalid={Boolean(errors.state)}
                    {...register("state")}
                  />
                  <FieldError message={errors.state?.message} />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/declaracoes")}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {!isSubmitting && <ShieldCheck className="h-4 w-4" />}
              {isSubmitting ? "Conferindo..." : "Finalizar"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </PageContainer>
  );
}
