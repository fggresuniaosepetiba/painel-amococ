import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { PageContainer } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function NotFoundPage() {
  return (
    <PageContainer>
      <div className="surface-card mx-auto mt-8 max-w-lg p-8">
        <EmptyState
          icon={<FileQuestion className="h-6 w-6" />}
          title="Página não encontrada"
          description="O endereço acessado não existe ou foi movido."
          action={
            <Button asChild>
              <Link to="/dashboard">Ir para o dashboard</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  );
}
