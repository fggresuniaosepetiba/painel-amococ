import type { AppSettings } from "@amococ/shared";

// Espelho de DEFAULT_SETTINGS (apps/web/.../indexeddb/SettingsRepository.ts).
// Fonte da verdade do conteúdo; aqui serve para seed e merge de leitura.
export const DEFAULT_SETTINGS: AppSettings = {
  id: "general",
  association: {
    name: "Associação de Moradores do Conjunto Otacílio Câmara",
    acronym: "AMOCOC",
    address: "",
    phone: "",
    email: "",
    information:
      "Associação comunitária dedicada à representação e ao desenvolvimento dos moradores do Conjunto Otacílio Câmara.",
    customLogoDataUrl: null,
  },
  card: {
    title: "CARTEIRA DE ASSOCIADO",
    footerText: "Documento oficial de identificação do associado AMOCOC",
    showCpf: true,
    showBirthDate: true,
    showPhone: true,
    showAddress: false,
    showIssueDate: true,
    signaturePlacement: null,
  },
  signature: {
    presidentName: "",
    presidentTitle: "Presidente da Diretoria",
    imageDataUrl: null,
    mimeType: null,
    updatedAt: null,
  },
  security: {
    lastPasswordChangeAt: null,
  },
  updatedAt: new Date(0).toISOString(),
};

// Garante campos de versões novas (mesma regra do SettingsRepository.get).
export function mergeWithDefaults(stored: Partial<AppSettings>): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    id: "general",
    association: { ...DEFAULT_SETTINGS.association, ...stored.association },
    card: { ...DEFAULT_SETTINGS.card, ...stored.card },
    signature: { ...DEFAULT_SETTINGS.signature, ...stored.signature },
    security: { ...DEFAULT_SETTINGS.security, ...stored.security },
  };
}
