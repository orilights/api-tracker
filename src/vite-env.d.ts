/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_API_BASE_FALLBACK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
