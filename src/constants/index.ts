export const APP_NAME = "AMOCOC";
export const APP_FULL_NAME =
  "Associação de Moradores do Conjunto Otacílio Câmara";
export const APP_SUBTITLE = "Painel Administrativo";
export const APP_VERSION = "1.0.0";
export const APP_ENVIRONMENT = "Local (persistência local)";

export const LOGO_PATH = "/assets/images/logo-amococ.png";

export const SIDEBAR_STORAGE_KEY = "amococ.sidebar.collapsed";

export const MAX_PHOTO_SIZE = 4 * 1024 * 1024; // 4 MB
export const MAX_SIGNATURE_SIZE = 6 * 1024 * 1024; // 6 MB
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export const SESSION_STORAGE_KEY = "amococ.session";
export const SESSION_DURATION_DAYS = 7;
/**
 * REGRA OBRIGATÓRIA DE SEGURANÇA (LGPD): logout automático após este número
 * de minutos de inatividade. A sessão também é POR ABA (sessionStorage) —
 * fechar a aba encerra a sessão e a próxima abertura exige login.
 */
export const IDLE_TIMEOUT_MINUTES = 15;
/** Chave temporária com o motivo do encerramento (exibida em /login). */
export const SESSION_NOTICE_KEY = "amococ.sessionNotice";

export const EMPTY_STATE_DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
