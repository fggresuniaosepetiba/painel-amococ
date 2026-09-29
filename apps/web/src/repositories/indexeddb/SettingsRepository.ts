import { db } from "@/db/database";
import type { AppSettings } from "@amococ/shared";
import type { SettingsRepository } from "../types";

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
  updatedAt: new Date().toISOString(),
};

export class IndexedDbSettingsRepository implements SettingsRepository {
  async get(): Promise<AppSettings> {
    const stored = await db.settings.get("general");
    if (stored) {
      // Garante campos adicionados em versões novas
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        association: {
          ...DEFAULT_SETTINGS.association,
          ...stored.association,
        },
        card: { ...DEFAULT_SETTINGS.card, ...stored.card },
        signature: { ...DEFAULT_SETTINGS.signature, ...stored.signature },
        security: { ...DEFAULT_SETTINGS.security, ...stored.security },
      };
    }
    const initial = { ...DEFAULT_SETTINGS };
    await db.settings.put(initial);
    return initial;
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    const toSave: AppSettings = {
      ...settings,
      id: "general",
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(toSave);
    return toSave;
  }
}
