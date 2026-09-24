import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { CreditCard, Save } from "lucide-react";
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
import { Alert, SwitchField } from "@/components/ui/misc";
import {
  cardSettingsSchema,
  type CardSettingsFormValues,
} from "@/schemas/settings";
import { auditService, settingsService } from "@/services";

export function CardSettingsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const readOnly = !hasPermission("settings.edit");

  const settings = useLiveQuery(() => settingsService.get(), []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CardSettingsFormValues>({
    resolver: zodResolver(cardSettingsSchema),
    defaultValues: {
      title: "CARTEIRA DE ASSOCIADO",
      footerText: "",
      showCpf: true,
      showBirthDate: true,
      showPhone: true,
      showAddress: false,
      showIssueDate: true,
      signaturePlacement: null,
    },
  });

  useEffect(() => {
    if (!settings) return;
    reset({
      ...settings.card,
      signaturePlacement: settings.card.signaturePlacement ?? null,
    });
  }, [settings, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    try {
      await settingsService.updateCard(values);
      await auditService.log({
        userId: user.id,
        userName: user.name,
        action: "SETTINGS_UPDATED",
        entity: "settings",
        entityId: "card",
        details: "Configurações visuais da carteirinha atualizadas",
      });
      toast.success("Configurações da carteirinha salvas");
      reset(values);
    } catch {
      toast.error("Não foi possível salvar", "Tente novamente.");
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
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-brand-500" />
            Aparência da carteirinha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel required>Título exibido</FieldLabel>
              <Input
                readOnly={readOnly}
                invalid={Boolean(errors.title)}
                {...register("title")}
              />
              <FieldError message={errors.title?.message} />
            </div>
            <div>
              <FieldLabel>Rodapé</FieldLabel>
              <Input
                readOnly={readOnly}
                placeholder="Texto informativo do rodapé"
                {...register("footerText")}
              />
              <FieldError message={errors.footerText?.message} />
            </div>
          </div>

          <div>
            <p className="mb-1 text-[13px] font-medium text-slate-700">
              Informações exibidas
            </p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
              <SwitchField
                label="Exibir CPF"
                description="Mostra o CPF do associado na carteirinha"
                checked={watch("showCpf")}
                onCheckedChange={(v) => setValue("showCpf", v, { shouldDirty: true })}
                disabled={readOnly}
              />
              <SwitchField
                label="Exibir data de nascimento"
                checked={watch("showBirthDate")}
                onCheckedChange={(v) =>
                  setValue("showBirthDate", v, { shouldDirty: true })
                }
                disabled={readOnly}
              />
              <SwitchField
                label="Exibir WhatsApp"
                description="Mostra o WhatsApp do associado; sem WhatsApp, usa o telefone"
                checked={watch("showPhone")}
                onCheckedChange={(v) => setValue("showPhone", v, { shouldDirty: true })}
                disabled={readOnly}
              />
              <SwitchField
                label="Exibir endereço"
                description="Recomendado apenas para impressão"
                checked={watch("showAddress")}
                onCheckedChange={(v) =>
                  setValue("showAddress", v, { shouldDirty: true })
                }
                disabled={readOnly}
              />
              <SwitchField
                label="Exibir data de emissão"
                checked={watch("showIssueDate")}
                onCheckedChange={(v) =>
                  setValue("showIssueDate", v, { shouldDirty: true })
                }
                disabled={readOnly}
              />
            </div>
          </div>

          <Alert variant="info" title="Identidade visual preservada">
            A composição, cores e elementos da carteirinha seguem a identidade
            oficial da AMOCOC e não podem ser alterados livremente.
          </Alert>

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
