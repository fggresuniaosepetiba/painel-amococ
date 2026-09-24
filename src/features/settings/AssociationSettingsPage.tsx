import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { Building2, Image as ImageIcon, Save, Undo2 } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FieldLabel } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";
import {
  associationSettingsSchema,
  type AssociationSettingsFormValues,
} from "@/schemas/settings";
import { imageService, settingsService, auditService } from "@/services";
import { MAX_PHOTO_SIZE, LOGO_PATH } from "@/constants";

export function AssociationSettingsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const readOnly = !hasPermission("settings.edit");

  const settings = useLiveQuery(() => settingsService.get(), []);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AssociationSettingsFormValues>({
    resolver: zodResolver(associationSettingsSchema),
    defaultValues: {
      name: "",
      acronym: "",
      address: "",
      phone: "",
      email: "",
      information: "",
    },
  });

  useEffect(() => {
    if (!settings) return;
    reset({
      name: settings.association.name,
      acronym: settings.association.acronym,
      address: settings.association.address,
      phone: settings.association.phone,
      email: settings.association.email,
      information: settings.association.information,
    });
    setLogoPreview(settings.association.customLogoDataUrl);
  }, [settings, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    try {
      await settingsService.updateAssociation({
        ...values,
        customLogoDataUrl: logoPreview,
      });
      await auditService.log({
        userId: user.id,
        userName: user.name,
        action: "SETTINGS_UPDATED",
        entity: "settings",
        entityId: "association",
        details: "Dados institucionais da associação atualizados",
      });
      toast.success("Configurações salvas");
      reset(values);
    } catch {
      toast.error("Não foi possível salvar", "Tente novamente.");
    }
  });

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return;
    const validation = imageService.validate(file, MAX_PHOTO_SIZE);
    if (validation) {
      toast.error("Imagem inválida", validation);
      return;
    }
    try {
      const dataUrl = await imageService.read(file);
      setLogoPreview(dataUrl);
      toast.info("Logo alterada", "Salve as configurações para aplicar.");
    } catch {
      toast.error("Não foi possível ler a imagem");
    }
  };

  if (!settings) {
    return <Card className="p-6"><div className="skeleton h-64 w-full" /></Card>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-500" />
            Dados institucionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo */}
          <div className="flex items-start gap-5">
            <span className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <img
                src={logoPreview ?? LOGO_PATH}
                alt="Logo da associação"
                className="h-full w-full object-cover"
              />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-[13px] font-medium text-slate-700">
                Logo do sistema
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                A logo oficial da AMOCOC é usada por padrão. Você pode definir
                uma imagem personalizada.
              </p>
              {!readOnly && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Trocar logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        void handleLogoFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => setLogoPreview(null)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Usar logo oficial
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel required>Nome da associação</FieldLabel>
              <Input
                readOnly={readOnly}
                invalid={Boolean(errors.name)}
                {...register("name")}
              />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <FieldLabel required>Sigla</FieldLabel>
              <Input
                readOnly={readOnly}
                invalid={Boolean(errors.acronym)}
                {...register("acronym")}
              />
              <FieldError message={errors.acronym?.message} />
            </div>
            <div>
              <FieldLabel>Telefone</FieldLabel>
              <Input
                readOnly={readOnly}
                placeholder="(00) 00000-0000"
                {...register("phone")}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Endereço</FieldLabel>
              <Input readOnly={readOnly} {...register("address")} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>E-mail</FieldLabel>
              <Input
                readOnly={readOnly}
                type="email"
                invalid={Boolean(errors.email)}
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel hint="Exibido institucionalmente">
                Informações institucionais
              </FieldLabel>
              <Textarea readOnly={readOnly} rows={4} {...register("information")} />
              <FieldError message={errors.information?.message} />
            </div>
          </div>

          {readOnly && (
            <Alert variant="warning" title="Somente leitura">
              Você possui permissão para visualizar, mas não para editar estas
              configurações.
            </Alert>
          )}
        </CardContent>
        {!readOnly && (
          <CardFooter className="justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {!isSubmitting && <Save className="h-4 w-4" />}
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}
