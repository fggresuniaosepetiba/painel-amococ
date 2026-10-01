import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Save, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Alert, Skeleton, TriStateCheckbox, AvatarInitials } from "@/components/ui/misc";
import { ROLE_LABELS } from "@/components/shared/badges";
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  type Permission,
  type User,
} from "@amococ/shared";
import { authorizationService, userService } from "@/services";
import { cn } from "@/utils/cn";

export function PermissionsPage() {
  const { user: actor } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<User[]>([]);

  const load = useCallback(async () => {
    try {
      setUsers(await userService.getAll());
    } catch {
      // Mantém a lista atual.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [users]
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId]
  );

  useEffect(() => {
    if (!selectedId && users.length > 0) {
      const firstNonSuper = users.find((u) => u.role !== "SUPERADMIN");
      setSelectedId((firstNonSuper ?? users[0]).id);
    }
  }, [users, selectedId]);

  useEffect(() => {
    if (selected) setDraft([...selected.permissions]);
  }, [selected]);

  const isSuperAdmin = selected?.role === "SUPERADMIN";
  const effective = selected
    ? authorizationService.effectivePermissions(selected)
    : [];
  const dirty = useMemo(
    () =>
      Boolean(
        selected &&
          [...draft].sort().join() !== [...selected.permissions].sort().join()
      ),
    [draft, selected]
  );

  const toggle = (permission: Permission, value: boolean) => {
    setDraft((prev) =>
      value
        ? Array.from(new Set([...prev, permission]))
        : prev.filter((p) => p !== permission)
    );
  };

  const toggleGroup = (permissions: Permission[], value: boolean) => {
    setDraft((prev) => {
      const set = new Set(prev);
      permissions.forEach((p) => (value ? set.add(p) : set.delete(p)));
      return [...set];
    });
  };

  const save = async () => {
    if (!actor || !selected) return;
    setSaving(true);
    try {
      await userService.savePermissions(actor, selected.id, draft);
      await load();
      toast.success(
        "Permissões atualizadas",
        `${draft.length} permissões salvas para ${selected.name}.`
      );
    } catch {
      toast.error("Não foi possível salvar", "Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Permissões"
        description="Controle granular do que cada usuário pode fazer no painel."
        actions={
          <Button onClick={() => void save()} loading={saving} disabled={!dirty}>
            {!saving && <Save className="h-4 w-4" />}
            Salvar permissões
          </Button>
        }
      />

      {users.length === 0 ? (
        <Card>
          <Skeleton className="m-6 h-40 w-full" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px,1fr]">
          {/* Lista de usuários */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <ul className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
                {sortedUsers.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(u.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-3 text-left transition",
                        u.id === selectedId
                          ? "bg-brand-50/70"
                          : "hover:bg-slate-50"
                      )}
                    >
                      <AvatarInitials name={u.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-900">
                          {u.name}
                        </span>
                        <span className="block truncate font-mono text-2xs text-slate-500">
                          {u.login} ·{" "}
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </span>
                      {u.id === selectedId && (
                        <Check className="h-4 w-4 shrink-0 text-brand-600" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Matriz de permissões */}
          <div className="space-y-4">
            {selected && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <AvatarInitials
                    name={selected.name}
                    className="gradient-brand h-10 w-10 text-white"
                  />
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">
                      {selected.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      @{selected.login} · {effective.length} de{" "}
                      {ALL_PERMISSIONS.length} permissões efetivas
                    </p>
                  </div>
                </div>
                <Select
                  className="sm:w-64"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  aria-label="Selecionar usuário"
                >
                  {sortedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.login})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {isSuperAdmin ? (
              <Alert
                variant="info"
                title="Acesso total (SuperAdmin)"
                icon={<ShieldQuestion className="h-4 w-4" />}
              >
                Usuários SuperAdmin ignoram as permissões comuns e possuem
                acesso irrestrito a todas as áreas do sistema. As permissões
                abaixo são exibidas apenas para referência.
              </Alert>
            ) : (
              <Alert
                variant="info"
                title="Permissões granulares"
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                As alterações entram em vigor no próximo carregamento das
                telas. A autorização é validada também nos serviços, não apenas
                na interface.
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => {
                const groupChecked = group.permissions.every((p) =>
                  draft.includes(p.key)
                );
                const groupIndeterminate =
                  !groupChecked &&
                  group.permissions.some((p) => draft.includes(p.key));
                return (
                  <Card key={group.key}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>{group.label}</CardTitle>
                          <p className="mt-0.5 text-2xs text-slate-400">
                            {group.description}
                          </p>
                        </div>
                        {!isSuperAdmin && (
                          <TriStateCheckbox
                            label=""
                            checked={groupChecked}
                            indeterminate={groupIndeterminate}
                            onChange={(v) =>
                              toggleGroup(
                                group.permissions.map((p) => p.key),
                                v
                              )
                            }
                          />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 py-3">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission.key}
                          className={cn(
                            "flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition hover:bg-slate-50",
                            isSuperAdmin && "cursor-not-allowed opacity-70"
                          )}
                        >
                          <span className="text-[13px] text-slate-700">
                            {permission.label}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-2xs text-slate-400">
                              {permission.key}
                            </span>
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-orange-600"
                              checked={
                                isSuperAdmin
                                  ? effective.includes(permission.key)
                                  : draft.includes(permission.key)
                              }
                              disabled={isSuperAdmin}
                              onChange={(e) =>
                                toggle(permission.key, e.target.checked)
                              }
                            />
                          </span>
                        </label>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
