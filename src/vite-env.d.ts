/// <reference types="vite/client" />

// Tunable gameplay knobs, read from the environment at build time. All are
// optional strings (Vite only exposes VITE_-prefixed vars to the client); see
// src/lib/config.ts for parsing + defaults, and .env.example for docs.
interface ImportMetaEnv {
  readonly VITE_ROTATION_SPEED?: string;
  readonly VITE_SCRAMBLE_MOVES?: string;
  readonly VITE_LEARNING_SCRAMBLE_MOVES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
