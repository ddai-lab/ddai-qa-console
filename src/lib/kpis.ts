// Beatrice · Cálculo de KPIs (consultas nativas sobre el schema).
// Proceso · Calidad · Negocio · Confianza. Nada de números inflados: cada KPI es rastreable.

import { prisma } from "./db";
import { computeConfidence } from "./confidence";

export async function computeKpis(projectId: string) {
  const [artifacts, decisions, runs, defects, baseline, transitions] = await Promise.all([
    prisma.testArtifact.findMany({
      where: { decision: { strategy: { requirement: { projectId } } } },
      select: { validationStatus: true, origin: true },
    }),
    prisma.testLevelDecision.findMany({
      where: { strategy: { requirement: { projectId } } },
      select: { level: true, id: true },
    }),
    prisma.testRun.findMany({
      where: { projectId },
      orderBy: { timestamp: "desc" },
      take: 10,
      include: { results: { select: { status: true, artifact: { select: { decision: { select: { level: true } } } } } } },
    }),
    prisma.defect.findMany({
      where: { projectId },
      include: { requirement: { select: { createdAt: true } } },
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { client: { select: { baseline: true } } } }),
    prisma.phaseTransition.findMany({
      where: { requirement: { projectId } },
      select: { requirementId: true, toPhase: true, at: true },
    }),
  ]);

  const b = baseline?.client?.baseline;
  const avgIncidentCostUsd = Number(b?.avgIncidentCostUsd ?? 5000);
  const minutesSavedPerAcceptedCase = b?.minutesSavedPerAcceptedCase ?? 25;
  const escapedBaselinePerMonth = b?.escapedDefectsBaselinePerMonth ?? 4;

  // ── PROCESO ────────────────────────────────────────────────────────────────
  const total = artifacts.length;
  const validated = artifacts.filter((a) => a.validationStatus === "VALIDATED").length;
  const corrected = artifacts.filter((a) => a.validationStatus === "CORRECTED").length;
  const rejected = artifacts.filter((a) => a.validationStatus === "REJECTED").length;
  const pending = artifacts.filter((a) => a.validationStatus === "PENDING").length;
  const acceptedNoCorrection = validated;
  const acceptanceRate = total ? acceptedNoCorrection / total : 0;

  // Tiempo de análisis → plan de pruebas listo (ANALYSIS→DESIGN), promedio en minutos.
  const byReq: Record<string, { ANALYSIS?: Date; DESIGN?: Date }> = {};
  for (const t of transitions) {
    byReq[t.requirementId] = byReq[t.requirementId] || {};
    if (t.toPhase === "ANALYSIS") byReq[t.requirementId].ANALYSIS = t.at;
    if (t.toPhase === "DESIGN") byReq[t.requirementId].DESIGN = t.at;
  }
  const deltas = Object.values(byReq)
    .filter((r) => r.ANALYSIS && r.DESIGN)
    .map((r) => (r.DESIGN!.getTime() - r.ANALYSIS!.getTime()) / 60000);
  const avgAnalysisToPlanMin = deltas.length ? deltas.reduce((a, x) => a + x, 0) / deltas.length : null;

  // Cobertura real por nivel de pirámide: niveles con resultados vs niveles decididos.
  // Se agrega sobre los runs recientes (no solo el último) para reflejar el proyecto completo.
  const decidedLevels = new Set(decisions.map((d) => d.level));
  const executedLevels = new Set<string>();
  let passed = 0;
  let executed = 0;
  for (const run of runs) {
    for (const r of run.results) {
      executed++;
      if (r.status === "passed") passed++;
      const lvl = r.artifact?.decision?.level;
      if (lvl) executedLevels.add(lvl);
    }
  }
  const coverageByLevel = Array.from(decidedLevels).map((level) => ({
    level,
    decided: true,
    executed: executedLevels.has(level),
  }));
  const pyramidCoverage = decidedLevels.size ? executedLevels.size / decidedLevels.size : 0;
  const passRate = executed ? passed / executed : 0;

  // ── CALIDAD ──────────────────────────────────────────────────────────────────
  const escaped = defects.filter((d) => d.escapedToProd);
  const escapedOpen = escaped.filter((d) => !d.resolvedAt).length;
  const caughtEarly = defects.filter((d) => !d.escapedToProd).length;
  const detectTimes = defects
    .filter((d) => d.requirement?.createdAt)
    .map((d) => (d.detectedAt.getTime() - d.requirement!.createdAt.getTime()) / 3600000)
    .filter((h) => h >= 0); // descarta anomalías de datos (detección antes de crear el req)
  const meanTimeToDetectH = detectTimes.length ? detectTimes.reduce((a, x) => a + x, 0) / detectTimes.length : null;

  // ── NEGOCIO ──────────────────────────────────────────────────────────────────
  const qaHoursSaved = ((validated + corrected) * minutesSavedPerAcceptedCase) / 60;
  const costAvoidedUsd = caughtEarly * avgIncidentCostUsd;
  const escapedReductionVsBaseline = Math.max(0, escapedBaselinePerMonth - escaped.length);

  // ── CONFIANZA ────────────────────────────────────────────────────────────────
  const validationRate = total ? (validated + corrected) / total : 0;
  const confidence = computeConfidence({ passRate, pyramidCoverage, validationRate, escapedDefectsOpen: escapedOpen });

  return {
    process: {
      aiCases: { total, validated, corrected, rejected, pending, acceptanceRate },
      avgAnalysisToPlanMin,
      coverageByLevel,
      pyramidCoverage,
    },
    quality: {
      escapedToProd: escaped.length,
      escapedOpen,
      caughtEarly,
      meanTimeToDetectH,
    },
    business: {
      qaHoursSaved,
      costAvoidedUsd,
      escapedReductionVsBaseline,
      baselineEscapedPerMonth: escapedBaselinePerMonth,
    },
    confidence,
  };
}
