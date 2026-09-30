import { api } from "@/lib/apiClient";
import type {
  AppSettings,
  SignatureSettings,
} from "@amococ/shared";
import type { SettingsRepository } from "../types";

/** Padrão de primeira utilização (espelha o seed do servidor). */
export const DEFAULT_SETTINGS: AppSettings = {
  id: "general",
  association: {
    name: "Associação de Moradores do Camorim — AMOCOC",
    acronym: "AMOCOC",
    address: "",
    phone: "",
    email: "",
    information: "",
    customLogoDataUrl: null,
  },
  card: {
    title: "CARTEIRA DE ASSOCIADO",
    footerText: "",
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
  security: { lastPasswordChangeAt: null },
  updatedAt: new Date().toISOString(),
};

/** Merge defensivo — garante campos de versões novas (como o Dexie fazia). */
function withDefaults(stored: Partial<AppSettings>): AppSettings {
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

export class ApiSettingsRepository implements SettingsRepository {
  async get(): Promise<AppSettings> {
    return withDefaults(await api<Partial<AppSettings>>("/api/settings"));
  }

  /**
   * Put completo: grava só as fatias que mudaram (1 escrita = 1 auditoria
   * no servidor) e relê — last-write-wins, como antes.
   *
   * Detalhe: os 3 PATCHs validam com o `settingsSaveSchema` inteiro
   * (blocos association/card/security obrigatórios), então cada chamada
   * leva os 3 blocos — o servidor grava só a fatia do endpoint.
   */
  async save(settings: AppSettings): Promise<AppSettings> {
    const current = await this.get();
    const changed = (a: unknown, b: unknown) =>
      JSON.stringify(a) !== JSON.stringify(b);
    const blocks = {
      association: { ...settings.association },
      card: { ...settings.card },
      security: { ...settings.security },
    };
    if (changed(settings.association, current.association)) {
      await api("/api/settings/association", {
        method: "PATCH",
        body: { ...blocks },
      });
    }
    if (changed(settings.card, current.card)) {
      await api("/api/settings/card", {
        method: "PATCH",
        body: { ...blocks },
      });
    }
    if (changed(settings.security, current.security)) {
      await api("/api/settings/security", {
        method: "PATCH",
        body: { ...blocks },
      });
    }
    if (changed(settings.signature, current.signature)) {
      const signature: SignatureSettings = settings.signature;
      await api("/api/settings/signature", {
        method: "PUT",
        body: {
          presidentName: signature.presidentName,
          presidentTitle: signature.presidentTitle,
          imageDataUrl: signature.imageDataUrl,
          mimeType: signature.mimeType,
        },
      });
    }
    return this.get();
  }
}
