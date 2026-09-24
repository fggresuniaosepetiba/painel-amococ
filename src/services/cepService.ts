/**
 * Consulta de CEP pela API pública ViaCEP (sem chave de acesso).
 *
 * Qualquer falha (rede, CEP inexistente, timeout) retorna null — o
 * formulário mantém os campos de endereço livres para digitação manual.
 */
export interface CepInfo {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export const cepService = {
  async lookup(cep: string): Promise<CepInfo | null> {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { erro?: boolean } & Record<string, string>;
      if (data.erro) return null;
      return {
        cep: data.cep ?? "",
        logradouro: data.logradouro ?? "",
        bairro: data.bairro ?? "",
        localidade: data.localidade ?? "",
        uf: data.uf ?? "",
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  },
};
