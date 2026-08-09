// Beatrice · Capa de IA (abstracción de proveedor)
//
// El producto NO se casa con un proveedor. Toda fase que "usa IA" (Análisis, Diseño,
// Implementación) pasa por esta interfaz. Hoy la implementa un motor determinista en JS
// (heuristic-v1) — liviano, explicable y sin API key, ideal para la demo pública.
// Mañana se puede enchufar Claude u otro sin tocar los módulos: basta otra impl de AIProvider.

export type PyramidLevel =
  | "UNIT"
  | "COMPONENT"
  | "INTEGRATION"
  | "API"
  | "UI_E2E"
  | "PERFORMANCE"
  | "SECURITY";

export type Framework = "PLAYWRIGHT" | "K6" | "VITEST";

export interface RequirementInput {
  title: string;
  description: string;
}

// ── Módulo 1: Análisis ──────────────────────────────────────────────────────
export interface Interpretation {
  areas: string[]; // ej ["API", "UI", "DATOS_SENSIBLES"]
  dataSensitive: boolean;
  thirdParties: string[]; // integraciones con terceros detectadas
  risks: string[]; // riesgos de calidad identificados
  summary: string; // qué hay que probar, en una frase
}

export interface AnalysisResult {
  interpretation: Interpretation;
  reasoning: string; // POR QUÉ interpretó así — nunca caja negra
}

// ── Módulo 2: Diseño de estrategia (pirámide de Cohn) ───────────────────────
export interface LevelDecision {
  level: PyramidLevel;
  rationale: string; // POR QUÉ este nivel aplica a este requerimiento
  priority: number; // 1 = base de la pirámide (más pruebas), sube hacia la punta
}

export interface StrategyResult {
  summary: string;
  decisions: LevelDecision[];
}

// ── Módulo 3: Implementación ────────────────────────────────────────────────
export interface ArtifactResult {
  framework: Framework;
  filePath: string;
  code: string;
}

export interface AIProvider {
  readonly name: string; // ej "heuristic-v1" → queda registrado como generatedByModel
  analyze(req: RequirementInput): Promise<AnalysisResult>;
  designStrategy(req: RequirementInput, analysis: AnalysisResult): Promise<StrategyResult>;
  implement(
    req: RequirementInput,
    decision: LevelDecision
  ): Promise<ArtifactResult>;
}
