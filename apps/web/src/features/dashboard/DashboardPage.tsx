import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CreditCard,
  UserPlus,
  Users,
  Activity,
  BadgeCheck,
} from "lucide-react";
import type {
  AuditLog,
  Member,
  MembershipCardRecord,
} from "@amococ/shared";
import { useAuth } from "@/hooks/AuthProvider";
import {
  auditService,
  cardGenerationService,
  memberService,
} from "@/services";
import { PageHeader, PageContainer } from "@/components/shared/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/misc";
import { ActionBadge, StatusBadge } from "@/components/shared/badges";
import { formatDate, formatRelativeTime, initialsOf } from "@/utils/format";
import { cn } from "@/utils/cn";

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  loading,
  to,
}: {
  label: string;
  value: number | undefined;
  icon: typeof Users;
  accent: "brand" | "emerald" | "slate" | "gold";
  loading?: boolean;
  to?: string;
}) {
  const accents: Record<string, string> = {
    brand: "from-brand-500 to-gold-500 shadow-brand-500/25",
    emerald: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
    slate: "from-ink-700 to-ink-900 shadow-ink-900/25",
    gold: "from-gold-500 to-brand-500 shadow-gold-500/25",
  };
  const iconAccents: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-ink-900/5 text-ink-700",
    gold: "bg-gold-400/15 text-gold-600",
  };

  const content = (
    <div className="surface-card group relative overflow-hidden p-5 transition-shadow hover:shadow-card-hover">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80",
          accents[accent]
        )}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900">
              {value ?? 0}
            </p>
          )}
        </div>
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            iconAccents[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {to && (
        <Link
          to={to}
          className="absolute inset-0"
          aria-label={`Abrir ${label}`}
        >
          <span className="sr-only">{label}</span>
        </Link>
      )}
    </div>
  );
  return content;
}

export function DashboardPage() {
  const { user, hasPermission } = useAuth();

  const [stats, setStats] = useState<
    { total: number; active: number; inactive: number; cards: number } | undefined
  >(undefined);
  const [recentMembers, setRecentMembers] = useState<Member[] | undefined>(
    undefined
  );
  const [recentCards, setRecentCards] = useState<
    MembershipCardRecord[] | undefined
  >(undefined);
  const [recentActivity, setRecentActivity] = useState<AuditLog[] | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [members, cards, activity] = await Promise.all([
          memberService.getAll(),
          cardGenerationService.getIssuedCards(),
          auditService.getAll(),
        ]);
        if (cancelled) return;
        setStats({
          total: members.length,
          active: members.filter((m) => m.status === "ATIVO").length,
          inactive: members.filter((m) => m.status === "INATIVO").length,
          cards: cards.length,
        });
        setRecentMembers(members.slice(0, 5));
        setRecentCards(cards.slice(0, 5));
        setRecentActivity(activity.slice(0, 8));
      } catch {
        if (!cancelled) setStats({ total: 0, active: 0, inactive: 0, cards: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = !stats;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting}, ${user?.name.split(" ")[0] ?? ""}`}
        description="Visão geral da associação, associados e carteirinhas."
        actions={
          hasPermission("members.create") ? (
            <Button asChild>
              <Link to="/associados/novo">
                <UserPlus className="h-4 w-4" />
                Novo associado
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total de associados"
          value={stats?.total}
          icon={Users}
          accent="slate"
          loading={loading}
          to="/associados"
        />
        <KpiCard
          label="Associados ativos"
          value={stats?.active}
          icon={BadgeCheck}
          accent="emerald"
          loading={loading}
          to="/associados"
        />
        <KpiCard
          label="Associados inativos"
          value={stats?.inactive}
          icon={Users}
          accent="gold"
          loading={loading}
          to="/associados"
        />
        <KpiCard
          label="Carteirinhas emitidas"
          value={stats?.cards}
          icon={CreditCard}
          accent="brand"
          loading={loading}
          to="/carteirinhas"
        />
      </div>

      {/* Colunas */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Associados recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Associados recentes</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/associados">
                Ver todos
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {!recentMembers ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentMembers.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="Nenhum associado ainda"
                description="Cadastre o primeiro associado para começar."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentMembers.map((member) => (
                  <li key={member.id}>
                    <Link
                      to={`/associados/${member.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                        {initialsOf(member.fullName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-800">
                          {member.fullName}
                        </span>
                        <span className="block text-2xs text-slate-500">
                          Matrícula {member.membershipNumber} ·{" "}
                          {formatRelativeTime(member.createdAt)}
                        </span>
                      </span>
                      <StatusBadge status={member.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Últimas carteirinhas */}
        <Card>
          <CardHeader>
            <CardTitle>Últimas carteirinhas</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/carteirinhas">
                Ver todas
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {!recentCards ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentCards.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="h-6 w-6" />}
                title="Nenhuma carteirinha emitida"
                description="Gere carteirinas a partir da tela do associado."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentCards.map((card) => (
                  <li key={card.id}>
                    <Link
                      to="/carteirinhas"
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-800">
                          {card.memberName}
                        </span>
                        <span className="block font-mono text-2xs tracking-wide text-slate-500">
                          {card.cardCode}
                        </span>
                      </span>
                      <span className="shrink-0 text-2xs text-slate-400">
                        {formatDate(card.generatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Atividade recente */}
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-500" />
              Atividade recente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {!recentActivity ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-6 w-6" />}
                title="Sem atividade registrada"
                description="As ações do sistema aparecerão aqui."
              />
            ) : (
              <ul className="max-h-[320px] divide-y divide-slate-100 overflow-y-auto">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <ActionBadge action={entry.action} />
                      <span className="shrink-0 text-2xs text-slate-400">
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {entry.details}
                    </p>
                    <p className="mt-0.5 text-2xs text-slate-400">
                      por {entry.userName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
