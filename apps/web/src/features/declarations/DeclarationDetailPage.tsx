import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/badges";
import { declarationService, settingsService } from "@/services";
import { formatDate } from "@/utils/format";
import { ResidenceDeclarationDocument } from "./ResidenceDeclarationDocument";
import type { AppSettings, ResidenceDeclaration } from "@amococ/shared";

/**
 * Visualização da declaração emitida — reimpressão livre para quem tem
 * `declarations.view`. Cada impressão registra DECLARATION_PRINTED na
 * auditoria do servidor.
 */
export function DeclarationDetailPage() {
  const { id } = useParams();

  const [declaration, setDeclaration] = useState<ResidenceDeclaration | null>(
    null
  );
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [record, loaded] = await Promise.all([
          declarationService.getById(id ?? ""),
          settingsService.get(),
        ]);
        if (cancelled) return;
        if (!record) {
          setNotFound(true);
          return;
        }
        setDeclaration(record);
        setSettings(loaded);
      } catch {
        // Erros de rede tratados no botão de impressão/tela de retry.
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePrint = useCallback(async () => {
    if (!declaration) return;
    setPrinting(true);
    try {
      // Auditoria acessória: impressão nunca deve quebrar o fluxo.
      await declarationService
        .registerPrint(declaration.id)
        .catch(() => undefined);
      window.print();
    } finally {
      setPrinting(false);
    }
  }, [declaration]);

  if (notFound || !declaration) {
    if (notFound) {
      return (
        <PageContainer>
          <Card className="mx-auto max-w-lg p-8 text-center">
            <h1 className="text-lg font-bold text-slate-900">
              Declaração não encontrada
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              O registro solicitado não existe mais ou foi excluído.
            </p>
            <Button asChild className="mt-5">
              <Link to="/declaracoes">Voltar para declarações</Link>
            </Button>
          </Card>
        </PageContainer>
      );
    }
    return (
      <PageContainer>
        <Card className="p-6">
          <div className="skeleton h-96 w-full" />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Declaração de residência"
        description={`Emitida em ${formatDate(declaration.issuedAt)} por ${declaration.issuedByName}.`}
        actions={
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link to="/declaracoes">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button onClick={() => void handlePrint()} loading={printing}>
              {!printing && <Printer className="h-4 w-4" />}
              Imprimir
            </Button>
          </div>
        }
      />

      {declaration.status === "INATIVO" && (
        <div className="mb-5">
          <Alert variant="warning" title="Declaração inativada">
            Esta declaração está inativa desde{" "}
            {formatDate(declaration.inactivatedAt)} — pode ser reativada na
            lista de declarações.
            <span className="ml-1 inline-flex align-middle">
              <StatusBadge status={declaration.status} />
            </span>
          </Alert>
        </div>
      )}

      {settings && (
        <ResidenceDeclarationDocument data={declaration} settings={settings} />
      )}
    </PageContainer>
  );
}
