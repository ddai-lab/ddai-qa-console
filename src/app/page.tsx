import { prisma } from "@/lib/db";
import { computeKpis } from "@/lib/kpis";

export const dynamic = "force-dynamic";

// Paleta "centro de mando" (reusada del andamiaje original).
const C = {
  bg: "#0a0c0f", panel: "#11151a", panel2: "#0d1116", line: "#1d242c",
  text: "#e6edf3", dim: "#7d8896", faint: "#4a5560",
  ai: "#8b7dff", human: "#3ddc97", pending: "#ffb454", reject: "#ff5470", accent: "#3ddc97",
};
const MONO = "'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,monospace";

const PHASES = ["ANALYSIS", "DESIGN", "IMPLEMENTATION", "EXECUTION", "CLOSURE"] as const;
const PHASE_LABEL: Record<string, string> = {
  ANALYSIS: "Análisis", DESIGN: "Diseño", IMPLEMENTATION: "Implementación",
  EXECUTION: "Ejecución", CLOSURE: "Cierre",
};

async function getData() {
  try {
    const project = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
    if (!project) return { project: null as any, requirements: [], kpis: null as any };
    const requirements = await prisma.requirement.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      include: {
        analysis: { select: { origin: true, validationStatus: true, generatedByModel: true } },
        strategy: {
          select: {
            origin: true, validationStatus: true, approved: true,
            decisions: { select: { level: true, validationStatus: true, artifacts: { select: { validationStatus: true, origin: true } } } },
          },
        },
      },
    });
    const kpis = await computeKpis(project.id);
    return { project, requirements, kpis };
  } catch {
    return { project: null as any, requirements: [], kpis: null as any, dbError: true };
  }
}

function Badge({ origin, status }: { origin?: string; status?: string }) {
  if (!origin) return <span style={{ color: C.faint, fontFamily: MONO, fontSize: 10 }}>— sin generar</span>;
  const isAI = origin === "AI";
  const col = status === "VALIDATED" ? C.human : status === "CORRECTED" ? C.human
    : status === "REJECTED" ? C.reject : C.pending;
  const label = status === "VALIDATED" ? "validado" : status === "CORRECTED" ? "corregido"
    : status === "REJECTED" ? "rechazado" : "pendiente de validación";
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5 }}>
      <span style={{ color: isAI ? C.ai : C.human }}>{isAI ? "◆ IA" : "● HUMANO"}</span>
      <span style={{ color: C.faint }}> · </span>
      <span style={{ color: col }}>{label}</span>
    </span>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "14px 16px", flex: 1, minWidth: 150 }}>
      <div style={{ color: C.dim, fontFamily: MONO, fontSize: 10, letterSpacing: 1.5 }}>{label}</div>
      <div style={{ color: color || C.text, fontFamily: MONO, fontSize: 28, fontWeight: 700, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ color: C.faint, fontFamily: MONO, fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default async function Page() {
  const { project, requirements, kpis, dbError } = (await getData()) as any;
  const conf = kpis?.confidence?.score ?? 0;
  const confColor = conf >= 75 ? C.human : conf >= 45 ? C.pending : C.reject;

  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "ui-sans-serif,system-ui,sans-serif", padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, borderBottom: `1px solid ${C.line}`, paddingBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, letterSpacing: 1 }}>
          BEATRICE<span style={{ color: C.accent }}>.</span>
        </div>
        <div style={{ color: C.dim, fontFamily: MONO, fontSize: 12 }}>cockpit de QA agéntico</div>
        <div style={{ flex: 1 }} />
        <div style={{ color: C.dim, fontFamily: MONO, fontSize: 12 }}>
          {project ? `proyecto · ${project.name}` : "sin proyecto"}
        </div>
      </div>

      {dbError && (
        <div style={{ marginTop: 20, color: C.pending, fontFamily: MONO, fontSize: 13 }}>
          Base de datos no conectada. Configura DATABASE_URL y corre las migraciones.
        </div>
      )}

      {!dbError && !project && (
        <div style={{ marginTop: 40, color: C.dim, fontFamily: MONO }}>
          Sin datos todavía. Ingresa un requerimiento vía <code>POST /api/requirements</code> o corre el seed.
        </div>
      )}

      {kpis && (
        <>
          {/* KPI strip */}
          <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
            <Kpi label="SCORE DE CONFIANZA" value={`${conf}`} sub="0–100 · auditable" color={confColor} />
            <Kpi label="CASOS IA ACEPTADOS" value={`${Math.round(kpis.process.aiCases.acceptanceRate * 100)}%`}
              sub={`${kpis.process.aiCases.validated}/${kpis.process.aiCases.total} sin corrección`} />
            <Kpi label="COBERTURA PIRÁMIDE" value={`${Math.round(kpis.process.pyramidCoverage * 100)}%`}
              sub="niveles ejecutados / decididos" />
            <Kpi label="DEFECTOS ESCAPADOS" value={`${kpis.quality.escapedToProd}`}
              sub={`${kpis.quality.caughtEarly} atrapados temprano`} color={kpis.quality.escapedToProd ? C.reject : C.human} />
            <Kpi label="COSTO EVITADO" value={`$${Math.round(kpis.business.costAvoidedUsd).toLocaleString()}`}
              sub={`${kpis.business.qaHoursSaved.toFixed(1)}h QA ahorradas`} color={C.human} />
          </div>

          {/* Requerimientos con trazabilidad y fase ISTQB */}
          <div style={{ marginTop: 30, fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.dim }}>
            REQUERIMIENTOS · CICLO ISTQB
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {requirements.length === 0 && (
              <div style={{ color: C.faint, fontFamily: MONO, fontSize: 12 }}>Ningún requerimiento ingresado.</div>
            )}
            {requirements.map((r: any) => {
              const phaseIdx = PHASES.indexOf(r.currentPhase);
              return (
                <div key={r.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                    <div style={{ flex: 1 }} />
                    {/* Stepper de fases */}
                    <div style={{ display: "flex", gap: 6 }}>
                      {PHASES.map((p, i) => (
                        <span key={p} title={PHASE_LABEL[p]}
                          style={{
                            fontFamily: MONO, fontSize: 9, padding: "2px 7px", borderRadius: 4,
                            border: `1px solid ${i <= phaseIdx ? C.accent : C.line}`,
                            color: i <= phaseIdx ? C.accent : C.faint,
                            background: i === phaseIdx ? "rgba(61,220,151,.08)" : "transparent",
                          }}>{PHASE_LABEL[p]}</span>
                      ))}
                    </div>
                  </div>
                  {/* Trazabilidad por artefacto */}
                  <div style={{ display: "flex", gap: 26, marginTop: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: 1 }}>ANÁLISIS</div>
                      <div style={{ marginTop: 3 }}><Badge origin={r.analysis?.origin} status={r.analysis?.validationStatus} /></div>
                    </div>
                    <div>
                      <div style={{ color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: 1 }}>ESTRATEGIA</div>
                      <div style={{ marginTop: 3 }}><Badge origin={r.strategy?.origin} status={r.strategy?.validationStatus} /></div>
                    </div>
                    <div>
                      <div style={{ color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: 1 }}>PIRÁMIDE</div>
                      <div style={{ marginTop: 3, fontFamily: MONO, fontSize: 10, color: C.text }}>
                        {r.strategy?.decisions?.length
                          ? r.strategy.decisions.map((d: any) => d.level).join(" · ")
                          : <span style={{ color: C.faint }}>—</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: 1 }}>ARTEFACTOS</div>
                      <div style={{ marginTop: 3, fontFamily: MONO, fontSize: 10, color: C.text }}>
                        {(r.strategy?.decisions || []).reduce((n: number, d: any) => n + (d.artifacts?.length || 0), 0)} generados
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
