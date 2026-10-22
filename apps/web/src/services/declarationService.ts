import { declarationsRepository } from "@/repositories";
import type { DeclarationFormValues } from "@/schemas/declaration";
import { dateBrToIso, formatCpf } from "@/utils/format";

/**
 * Serviço de declarações de residência. Dados SEMPRE manuais (nunca puxados
 * de associados); a impressão é feita pelo navegador (window.print) e o
 * registro do evento de impressão vai para a auditoria do servidor.
 */
export const declarationService = {
  getAll() {
    return declarationsRepository.getAll();
  },

  getById(id: string) {
    return declarationsRepository.getById(id);
  },

  /** Emite: salva a declaração na lista e devolve o registro. */
  create(values: DeclarationFormValues) {
    return declarationsRepository.create({
      residentName: values.residentName.trim(),
      birthDate: dateBrToIso(values.birthDate),
      cpf: formatCpf(values.cpf),
      address: values.address.trim(),
      residenceYears: values.residenceYears,
      residenceMonths: values.residenceMonths,
    });
  },

  /** Registra a impressão na auditoria (impressão e reimpressão). */
  registerPrint(id: string) {
    return declarationsRepository.registerPrint(id);
  },

  inactivate(id: string) {
    return declarationsRepository.setStatus(id, "INATIVO");
  },

  reactivate(id: string) {
    return declarationsRepository.setStatus(id, "ATIVO");
  },

  /** Exclusão definitiva — somente INATIVAS (validada no servidor). */
  delete(id: string) {
    return declarationsRepository.delete(id);
  },
};
