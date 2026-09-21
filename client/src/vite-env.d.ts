/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL absoluta del backend (por ejemplo, https://clima-laboral-api.onrender.com). Vacío usa rutas relativas /api, para desarrollo local con el proxy de Vite. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
