import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Hash,
  MapPin,
  PencilLine,
  Phone,
  PowerOff,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/badges";
import { CardPreviewDialog } from "@/features/cards/CardPreviewDialog";
import { cardGenerationService, memberService } from "@/services";
import { formatDate, initialsOf } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Member, MembershipCardRecord } from "@amococ/shared";

export function MemberDetailPage() {
  const { id } = useParams();
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [cardOpen, setCardOpen] = useState(false);
  const [member, setMember] = useState<Member | null | undefined>(undefined);
  const [issuedCard, setIssuedCard] = useState<
    MembershipCardRecord | null | undefined
  >(undefined);

  const reload = useCallback(async () => {
    if (!id) {
      setMember(null);
      setIssuedCard(null);
      return;
    }
    try {
      const [found, card] = await Promise.all([
        memberService.getById(id),
        cardGenerationService.getByMemberId(id),
      ]);
      setMember(found ?? null);
      setIssuedCard(card ?? null);
    } catch {
      setMember(null);
      setIssuedCard(null);
    }
  }, [id]);

  useEffect(() => {
    setMember(undefined);
    setIssuedCard(undefined);
    void reload();
  }, [id, reload]);

  if (member === undefined) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (member === null || !member) {
    return (
      <PageContainer>
        <Card className="mx-auto max-w-lg p-8 text-center">
          <EmptyState
            icon={<User className="h-6 w-6" />}
            title="Associado não encontrado"
            description="O registro solicitado não existe."
            action={
              <Button asChild>
                <Link to="/associados">Voltar para associados</Link>
              </Button>
            }
          />
        </Card>
      </PageContainer>
    );
  }

  const handleToggleStatus = async () => {
    if (!user) return;
    const inactivating = member.status === "ATIVO";
    const ok = await confirm({
      title: inactivating
        ? "Você deseja inativar este associado?"
        : "Reativar associado?",
      message: inactivating
        ? "O associado será movido para a lista de inativos. Seus dados, matrícula e código de carteirinha serão preservados e ele poderá ser reativado posteriormente."
        : "O associado voltará para a lista de ativos e continuará utilizando a mesma matrícula e o mesmo código de carteirinha.",
      confirmLabel: inactivating ? "Inativar" : "Reativar",
      variant: inactivating ? "danger" : "primary",
    });
    if (!ok) return;
    try {
      if (inactivating) {
        await memberService.inactivate(user, member.id);
        toast.success("Associado inativado com sucesso.");
      } else {
        await memberService.reactivate(user, member.id);
        toast.success("Associado reativado com sucesso.");
      }
      await reload();
    } catch {
      toast.error("Não foi possível concluir", "Tente novamente.");
    }
  };

  const addressLine = [member.address, member.addressNumber]
    .filter(Boolean)
    .join(", ");

  return (
    <PageContainer>
      <PageHeader
        title={member.fullName}
        description={`Matrícula ${member.membershipNumber} · Código ${member.cardCode}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/associados">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            {hasPermission("members.edit") && (
              <Button
                asChild
                variant="dark"
              >
                <Link to={`/associados/${member.id}/editar`}>
                  <PencilLine className="h-4 w-4" />
                  Editar
                </Link>
              </Button>
            )}
            {hasPermission("cards.generate") &&
              (member.status === "ATIVO" || Boolean(issuedCard)) && (
                <Button onClick={() => setCardOpen(true)}>
                  <CreditCard className="h-4 w-4" />
                  {issuedCard ? "Ver carteirinha" : "Gerar carteirinha"}
                </Button>
              )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Identificação</CardTitle>
              <StatusBadge status={member.status} />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6 sm:flex-row">
                <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-brand-400 bg-slate-50">
                  {member.photoDataUrl ? (
                    <img
                      src={member.photoDataUrl}
                      alt={`Foto de ${member.fullName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-ink-300">
                      {initialsOf(member.fullName)}
                    </span>
                  )}
                </div>

                <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <InfoItem
                    icon={<Hash className="h-4 w-4" />}
                    label="Matrícula"
                    value={member.membershipNumber}
                    mono
                    locked
                  />
                  <InfoItem
                    icon={<CreditCard className="h-4 w-4" />}
                    label="Código da carteirinha"
                    value={member.cardCode}
                    mono
                    locked
                  />
                  <InfoItem
                    icon={<User className="h-4 w-4" />}
                    label="CPF"
                    value={member.cpf || "Não informado"}
                  />
                  <InfoItem
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Nascimento"
                    value={
                      member.birthDate ? formatDate(member.birthDate) : "—"
                    }
                  />
                </dl>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contato e endereço</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <InfoItem
                  icon={<Phone className="h-4 w-4" />}
                  label="Telefone"
                  value={member.phone || "Não informado"}
                />
                <InfoItem
                  icon={<Phone className="h-4 w-4" />}
                  label="WhatsApp"
                  value={member.whatsapp || "Não informado"}
                />
                <InfoItem
                  icon={<MapPin className="h-4 w-4" />}
                  label="Endereço"
                  value={
                    addressLine
                      ? [
                          addressLine,
                          member.complement,
                          member.district,
                          [member.city, member.state]
                            .filter(Boolean)
                            .join(" - "),
                        ]
                          .filter(Boolean)
                          .join(", ")
                      : "Não informado"
                  }
                  className="sm:col-span-2"
                />
                <InfoItem
                  icon={<MapPin className="h-4 w-4" />}
                  label="CEP"
                  value={member.cep || "—"}
                />
              </dl>

              {member.notes && (
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
                    Observações
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">
                    {member.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Carteirinha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-gold-400/10 p-4">
                <p className="text-2xs font-semibold uppercase tracking-wider text-brand-600">
                  Código atual
                </p>
                <p className="mt-1 font-mono text-[15px] font-extrabold tracking-wide text-ink-900">
                  {member.cardCode}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {issuedCard
                    ? `Emitida em ${formatDate(issuedCard.generatedAt)}`
                    : "Ainda não emitida."}
                </p>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Matrícula e código são imutáveis e não serão reutilizados,
                  mesmo com a inativação do associado.
                </span>
              </div>

              {hasPermission("cards.generate") &&
                (member.status === "ATIVO" || Boolean(issuedCard)) && (
                  <Button className="w-full" onClick={() => setCardOpen(true)}>
                    <CreditCard className="h-4 w-4" />
                    {issuedCard ? "Visualizar carteirinha" : "Gerar carteirinha"}
                  </Button>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cadastro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Criado em</span>
                <span className="font-medium text-slate-800">
                  {formatDate(member.createdAt)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Atualizado em</span>
                <span className="font-medium text-slate-800">
                  {formatDate(member.updatedAt)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={member.status} />
              </div>
              {member.status === "INATIVO" && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Inativado em</span>
                  <span className="font-medium text-slate-800">
                    {member.inactivatedAt
                      ? formatDate(member.inactivatedAt)
                      : "—"}
                  </span>
                </div>
              )}

              {(member.status === "ATIVO"
                ? hasPermission("members.inactivate")
                : hasPermission("members.reactivate")) && (
                <div className="pt-3">
                  <Button
                    variant={member.status === "ATIVO" ? "outline" : "ghost"}
                    className={cn(
                      "w-full",
                      member.status === "ATIVO" &&
                        "border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
                    )}
                    onClick={() => void handleToggleStatus()}
                  >
                    <PowerOff className="h-4 w-4" />
                    {member.status === "ATIVO"
                      ? "Inativar associado"
                      : "Reativar associado"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {cardOpen && user && (
        <CardPreviewDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setCardOpen(false);
              void reload();
            }
          }}
          mode="generate"
          memberId={member.id}
        />
      )}
    </PageContainer>
  );
}

function InfoItem({
  icon,
  label,
  value,
  mono,
  locked,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  locked?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
        {locked && <span className="text-brand-500">🔒</span>}
      </dt>
      <dd
        className={cn(
          "mt-1 text-[13.5px] font-semibold text-slate-800",
          mono && "font-mono tracking-wide"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
