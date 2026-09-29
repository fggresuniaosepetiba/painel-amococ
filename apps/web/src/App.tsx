import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/hooks/AuthProvider";
import { ToastProvider } from "@/hooks/ToastProvider";
import { ConfirmProvider } from "@/hooks/ConfirmProvider";
import { router } from "@/routes";

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
