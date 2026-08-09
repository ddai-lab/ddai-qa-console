// Beatrice · Selección de proveedor de IA.
// Un único punto donde se decide qué motor usa el cockpit. Hoy: heurístico determinista.
// Para enchufar un LLM real, crear otra impl de AIProvider y devolverla aquí según env.

import type { AIProvider } from "./types";
import { defaultProvider } from "./heuristic";

export function getProvider(): AIProvider {
  // Futuro: if (process.env.BEATRICE_AI_PROVIDER === "claude") return new ClaudeProvider();
  return defaultProvider;
}

export * from "./types";
