import { settingsRepository } from "@/repositories";
import type { AppSettings, SignatureSettings } from "@amococ/shared";

/**
 * Assinatura oficial do Presidente.
 * REGRA ABSOLUTA: a assinatura é inserida automaticamente na carteirinha.
 * O usuário não edita, não troca, não move e não remove na carteirinha.
 */
export const signatureService = {
  async get(): Promise<SignatureSettings> {
    const settings = await settingsRepository.get();
    return settings.signature;
  },

  async isConfigured(): Promise<boolean> {
    const signature = await this.get();
    return Boolean(signature.imageDataUrl);
  },

  async save(
    patch: Partial<Omit<SignatureSettings, "imageDataUrl">> & {
      imageDataUrl?: string | null;
      mimeType?: string | null;
    }
  ): Promise<AppSettings> {
    const current = await settingsRepository.get();
    const imageDataUrl =
      patch.imageDataUrl !== undefined
        ? patch.imageDataUrl
        : current.signature.imageDataUrl;
    return settingsRepository.save({
      ...current,
      signature: {
        ...current.signature,
        ...patch,
        imageDataUrl,
        updatedAt: imageDataUrl ? new Date().toISOString() : null,
      },
    });
  },

  /** Mensagem exibida quando a assinatura oficial não foi cadastrada. */
  missingMessage():
    "Não é possível gerar a carteirinha porque a assinatura oficial do Presidente ainda não foi cadastrada." {
    return "Não é possível gerar a carteirinha porque a assinatura oficial do Presidente ainda não foi cadastrada.";
  },
};
