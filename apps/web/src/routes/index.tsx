import { createBrowserRouter, Navigate } from "react-router-dom";
import type { Permission } from "@amococ/shared";
import { AppLayout } from "@/layouts/AppLayout";
import { RequireAuth, RequirePermission, RequireSuperAdmin } from "./guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { MembersPage } from "@/features/members/MembersPage";
import { MemberFormPage } from "@/features/members/MemberFormPage";
import { MemberDetailPage } from "@/features/members/MemberDetailPage";
import { CardsPage } from "@/features/cards/CardsPage";
import { DeclarationsPage } from "@/features/declarations/DeclarationsPage";
import { DeclarationFormPage } from "@/features/declarations/DeclarationFormPage";
import { DeclarationDetailPage } from "@/features/declarations/DeclarationDetailPage";
import { UsersPage } from "@/features/users/UsersPage";
import { PermissionsPage } from "@/features/users/PermissionsPage";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { AssociationSettingsPage } from "@/features/settings/AssociationSettingsPage";
import { CardSettingsPage } from "@/features/settings/CardSettingsPage";
import { SignatureSettingsPage } from "@/features/settings/SignatureSettingsPage";
import { SecuritySettingsPage } from "@/features/settings/SecuritySettingsPage";
import { SystemSettingsPage } from "@/features/settings/SystemSettingsPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { NotFoundPage } from "@/features/NotFoundPage";

/** Rota layout que exige uma permissão (Outlet encadeia o conteúdo). */
function PermissionRoute({ permission }: { permission: Permission }) {
  return <RequirePermission permission={permission} />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: "dashboard",
            element: <PermissionRoute permission="dashboard.view" />,
            children: [{ index: true, element: <DashboardPage /> }],
          },
          {
            path: "associados",
            children: [
              {
                element: <PermissionRoute permission="members.view" />,
                children: [{ index: true, element: <MembersPage /> }],
              },
              {
                path: "novo",
                element: <PermissionRoute permission="members.create" />,
                children: [{ index: true, element: <MemberFormPage /> }],
              },
              {
                path: ":id",
                element: <PermissionRoute permission="members.view" />,
                children: [{ index: true, element: <MemberDetailPage /> }],
              },
              {
                path: ":id/editar",
                element: <PermissionRoute permission="members.edit" />,
                children: [{ index: true, element: <MemberFormPage /> }],
              },
            ],
          },
          {
            path: "carteirinhas",
            element: <PermissionRoute permission="cards.view" />,
            children: [{ index: true, element: <CardsPage /> }],
          },
          {
            path: "declaracoes",
            children: [
              {
                element: <PermissionRoute permission="declarations.view" />,
                children: [{ index: true, element: <DeclarationsPage /> }],
              },
              {
                path: "nova",
                element: <PermissionRoute permission="declarations.create" />,
                children: [{ index: true, element: <DeclarationFormPage /> }],
              },
              {
                path: ":id",
                element: <PermissionRoute permission="declarations.view" />,
                children: [{ index: true, element: <DeclarationDetailPage /> }],
              },
            ],
          },
          {
            path: "usuarios",
            children: [
              {
                element: <RequireSuperAdmin />,
                children: [{ index: true, element: <UsersPage /> }],
              },
              {
                path: "permissoes",
                element: <RequireSuperAdmin />,
                children: [{ index: true, element: <PermissionsPage /> }],
              },
            ],
          },
          {
            path: "configuracoes",
            children: [
              { index: true, element: <Navigate to="associacao" replace /> },
              {
                element: <PermissionRoute permission="settings.view" />,
                children: [
                  {
                    element: <SettingsLayout />,
                    children: [
                      {
                        path: "associacao",
                        element: <AssociationSettingsPage />,
                      },
                      {
                        path: "carteirinha",
                        element: <CardSettingsPage />,
                      },
                      {
                        path: "assinatura",
                        element: <SignatureSettingsPage />,
                      },
                      {
                        path: "seguranca",
                        element: <SecuritySettingsPage />,
                      },
                      {
                        path: "sistema",
                        element: <SystemSettingsPage />,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            path: "auditoria",
            element: <PermissionRoute permission="audit.view" />,
            children: [{ index: true, element: <AuditPage /> }],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
