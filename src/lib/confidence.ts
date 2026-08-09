// Beatrice · Score de confianza
//
// Número único (0..100) entendible por un no-técnico en 5 segundos, pero NO mágico:
// cada factor es auditable y se guarda el desglose en ConfidenceSnapshot.breakdown.
//
//   score = 100 × passRate × pyramidCoverage × (0.5 + 0.5×validationRate) − escapedPenalty
//
//  · passRate        — % de pruebas que pasan (calidad ejecutada)
//  · pyramidCoverage — % de niveles decididos que tienen artefactos con resultados reales
//  · validationRate  — % de artefactos generados por IA que un humano validó (no pendientes/rechazados)
//                      Entra como (0.5 + 0.5×rate): sin validación humana el techo es 50.
//  · escapedPenalty  — 10 puntos por cada defecto abierto escapado a producción

export interface ConfidenceInputs {
  passRate: number; // 0..1
  pyramidCoverage: number; // 0..1
  validationRate: number; // 0..1
  escapedDefectsOpen: number; // conteo
}

export interface ConfidenceResult {
  score: number; // 0..100 entero
  breakdown: ConfidenceInputs & { escapedPenalty: number };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function computeConfidence(i: ConfidenceInputs): ConfidenceResult {
  const passRate = clamp01(i.passRate);
  const pyramidCoverage = clamp01(i.pyramidCoverage);
  const validationRate = clamp01(i.validationRate);
  const escapedPenalty = Math.max(0, i.escapedDefectsOpen) * 10;

  const raw =
    100 * passRate * pyramidCoverage * (0.5 + 0.5 * validationRate) - escapedPenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    breakdown: { passRate, pyramidCoverage, validationRate, escapedDefectsOpen: Math.max(0, i.escapedDefectsOpen), escapedPenalty },
  };
}
