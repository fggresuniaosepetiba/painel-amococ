import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  KeyRound,
  MoreHorizontal,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  UserSquare2,
} from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FieldError, FieldLabel } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge, StatusBadge } from "@/components/shared/badges";
import {
  resetPasswordSchema,
  userCreateSchema,
  userEditSchema,
  type ResetPasswordFormValues,
  type UserCreateFormValues,
} from "@/schemas/user";
import { userService } from "@/services";
import { formatDateTime, initialsOf } from "@/utils/format";
import type { Permission } from "@amococ/shared";
import type { User } from "@amococ/shared";

type DialogMode = "create" | "edit" | null;

export function UsersPage() {
  const { user: actor, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState<User[]>([]);

  const load = useCallback(async () => {
    try {
      setUsers(await userService.getAll());
    } catch {
      // Mantém a lista atual; erros aparecem nas ações.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? users.filter((u) =>
          [u.name, u.login, u.email].some((v) => v.toLowerCase().includes(term))
        )
      : [...users];
    return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [users, search]);

  const total = filtered.length;
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const handleToggleStatus = async (target: User) => {
    if (!actor) return;
    const inactivating = target.status === "ATIVO";
    const ok = await confirm({
      title: inactivating
        ? `Inativar ${target.name}?`
        : `Reativar ${target.name}?`,
      message: inactivating
        ? `O login "${target.login}" será bloqueado imediatamente. As permissões e o histórico serão preservados.`
        : `O login "${target.login}" voltará a ter acesso ao painel.`,
      confirmLabel: inactivating ? "Inativar" : "Reativar",
      variant: inactivating ? "danger" : "primary",
    });
    if (!ok) return;
    try {
      await userService.setStatus(actor, target.id, inactivating ? "INATIVO" : "ATIVO");
      await load();
      toast.success(
        inactivating ? "Usuário inativado" : "Usuário reativado",
        inactivating ? "Login bloqueado." : "Login liberado."
      );
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "CANNOT_INACTIVATE_SELF") {
        toast.error(
          "Operação não permitida",
          "Você não pode inativar o próprio usuário."
        );
      } else {
        toast.error("Não foi possível concluir", "Tente novamente.");
      }
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Usuários"
        description="Usuários administrativos do painel, papéis e acesso."
        actions={
          hasPermission("users.create") ? (
            <Button
              onClick={() => {
                setEditingUser(null);
                setDialogMode("create");
              }}
            >
              <Plus className="h-4 w-4" />
              Novo usuário
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome, login ou e-mail..."
              className="pl-10"
              aria-label="Buscar usuários"
            />
          </div>
        </div>

        {users.length === 0 ? (
          <EmptyState
            icon={<UserSquare2 className="h-6 w-6" />}
            title="Nenhum usuário cadastrado"
            description="Crie o primeiro usuário administrativo."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Nenhum usuário encontrado"
            description="Ajuste a busca e tente novamente."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-12 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                          {initialsOf(u.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900">
                            {u.name}
                          </span>
                          <span className="block truncate text-2xs text-slate-400">
                            {u.email}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[13px] text-slate-600">
                      {u.login}
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDateTime(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserRowActions
                        target={u}
                        isSelf={u.id === actor?.id}
                        canEdit={hasPermission("users.edit")}
                        canInactivate={hasPermission("users.inactivate")}
                        canPermissions={hasPermission("users.permissions")}
                        onEdit={() => {
                          setEditingUser(u);
                          setDialogMode("edit");
                        }}
                        onReset={() => setResetUser(u)}
                        onToggle={() => void handleToggleStatus(u)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {dialogMode && (
        <UserFormDialog
          mode={dialogMode}
          user={editingUser}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDialogMode(null);
              setEditingUser(null);
            }
          }}
          onSaved={() => void load()}
        />
      )}

      {resetUser && (
        <ResetPasswordDialog
          target={resetUser}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setResetUser(null);
          }}
        />
      )}
    </PageContainer>
  );
}

function UserRowActions({
  target,
  isSelf,
  canEdit,
  canInactivate,
  onEdit,
  onReset,
  onToggle,
}: {
  target: User;
  isSelf: boolean;
  canEdit: boolean;
  canInactivate: boolean;
  canPermissions: boolean;
  onEdit: () => void;
  onReset: () => void;
  onToggle: () => void;
}) {
  void target;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-ring"
          aria-label="Ações do usuário"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={onEdit} disabled={!canEdit}>
          <PencilLine className="h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onReset} disabled={!canEdit}>
          <KeyRound className="h-4 w-4" />
          Redefinir senha
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          danger={!isSelf && target.status === "ATIVO"}
          disabled={!canInactivate || isSelf}
          onSelect={onToggle}
        >
          {target.status === "ATIVO" ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              Inativar
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Reativar
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ====================== Diálogo criar/editar ====================== */

function UserFormDialog({
  mode,
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  mode: "create" | "edit";
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { user: actor } = useAuth();
  const toast = useToast();
  const isCreate = mode === "create";

  const schema = isCreate ? userCreateSchema : userEditSchema;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: user?.name ?? "",
      login: user?.login ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "COLABORADOR",
      status: user?.status ?? "ATIVO",
      permissions: user?.permissions ?? [],
      initialPassword: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!actor) return;
    try {
      if (isCreate) {
        await userService.create(actor, {
          name: values.name,
          login: values.login,
          email: values.email,
          role: values.role,
          status: values.status,
          permissions: values.permissions as Permission[],
          initialPassword: values.initialPassword,
        });
        toast.success("Usuário criado", `Login: ${values.login}`);
      } else if (user) {
        await userService.update(actor, user.id, {
          name: values.name,
          login: values.login,
          email: values.email,
          role: values.role,
          status: values.status,
          permissions: values.permissions as Permission[],
        });
        toast.success("Usuário atualizado");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "LOGIN_ALREADY_EXISTS") {
        toast.error("Login indisponível", "Escolha outro login.");
      } else {
        toast.error("Não foi possível salvar", "Tente novamente.");
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "Novo usuário" : `Editar ${user?.name ?? ""}`}
          </DialogTitle>
        </DialogHeader>
        <DialogForm onSubmit={onSubmit} noValidate>
          <DialogBody className="space-y-4">
            <div>
              <FieldLabel required>Nome completo</FieldLabel>
              <Input
                placeholder="Nome do usuário"
                invalid={Boolean(errors.name)}
                {...register("name")}
              />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Login</FieldLabel>
                <Input
                  placeholder="ex.: maria.souza"
                  className="font-mono"
                  invalid={Boolean(errors.login)}
                  {...register("login")}
                />
                <FieldError message={errors.login?.message} />
              </div>
              <div>
                <FieldLabel required>E-mail</FieldLabel>
                <Input
                  type="email"
                  placeholder="usuario@email.com"
                  invalid={Boolean(errors.email)}
                  {...register("email")}
                />
                <FieldError message={errors.email?.message} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Perfil</FieldLabel>
                <Select {...register("role")}>
                  <option value="ADMINISTRADOR">Administrador</option>
                  <option value="COLABORADOR">Colaborador</option>
                  <option value="SUPERADMIN">SuperAdmin</option>
                </Select>
                <FieldError message={errors.role?.message} />
              </div>
              <div>
                <FieldLabel required>Status</FieldLabel>
                <Select {...register("status")}>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </Select>
              </div>
            </div>
            {isCreate && (
              <div>
                <FieldLabel required hint="Obrigatória no primeiro acesso">
                  Senha inicial
                </FieldLabel>
                <Input
                  type="text"
                  placeholder="Senha provisória"
                  invalid={Boolean(errors.initialPassword)}
                  {...register("initialPassword")}
                />
                <FieldError message={errors.initialPassword?.message} />
              </div>
            )}
            <Alert variant="info" title="Permissões">
              As permissões granulares podem ser configuradas na página
              <strong> Permissões</strong>. Usuários com perfil SuperAdmin possuem
              acesso total automático.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isCreate ? "Criar usuário" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

/* ====================== Redefinir senha ====================== */

function ResetPasswordDialog({
  target,
  open,
  onOpenChange,
}: {
  target: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user: actor } = useAuth();
  const toast = useToast();
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setDone(false);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!actor) return;
    try {
      await userService.resetPassword(actor, target.id, values.newPassword);
      setDone(true);
      toast.success("Senha redefinida", `Novo acesso: ${target.login}`);
    } catch {
      toast.error("Não foi possível redefinir", "Tente novamente.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Redefinir senha de {target.name}</DialogTitle>
        </DialogHeader>
        {done ? (
          <>
            <DialogBody>
              <Alert variant="success" title="Senha redefinida com sucesso">
                O usuário {target.login} já pode entrar com a nova senha.
              </Alert>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <DialogForm onSubmit={onSubmit} noValidate>
            <DialogBody className="space-y-4">
              <div>
                <FieldLabel required>Nova senha</FieldLabel>
                <Input
                  type="text"
                  placeholder="Senha provisória"
                  invalid={Boolean(errors.newPassword)}
                  {...register("newPassword")}
                />
                <FieldError message={errors.newPassword?.message} />
              </div>
              <div>
                <FieldLabel required>Confirmar nova senha</FieldLabel>
                <Input
                  type="password"
                  placeholder="Repita a senha"
                  invalid={Boolean(errors.confirmPassword)}
                  {...register("confirmPassword")}
                />
                <FieldError message={errors.confirmPassword?.message} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting}>
                <KeyRound className="h-4 w-4" />
                Redefinir senha
              </Button>
            </DialogFooter>
          </DialogForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
