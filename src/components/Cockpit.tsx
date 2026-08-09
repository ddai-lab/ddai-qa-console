"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";

// ── Tema "centro de mando" · identidad Detrás del Algoritmo (azul-noche + gradientes) ──
const C = {
  bg: "#0b1120", panel: "#141c30", panel2: "#0f1626", line: "#243049", lineHi: "#31405f",
  text: "#eaf0fb", dim: "#8b98b5", faint: "#5a6785",
  ai: "#a855f7", human: "#34d399", pending: "#fbbf24", reject: "#fb5a76", accent: "#38bdf8",
  pass: "#34d399", glow: "rgba(56,189,248,.16)",
};
// Gradiente de marca (cian → azul → púrpura → naranja), como el sitio.
const BRAND = "linear-gradient(90deg,#22d3ee,#3b82f6,#a855f7,#f59e0b)";
// Fondo con glow superior para que no se sienta plano/negro.
const BG_STYLE: React.CSSProperties = {
  background: `radial-gradient(1200px 480px at 50% -140px, rgba(59,130,246,.18), transparent 60%), radial-gradient(900px 420px at 90% -80px, rgba(168,85,247,.12), transparent 55%), ${C.bg}`,
};
const MONO = "'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,monospace";
const SANS = "ui-sans-serif,system-ui,-apple-system,sans-serif";

const PHASES = ["ANALYSIS", "DESIGN", "IMPLEMENTATION", "EXECUTION", "CLOSURE"] as const;
const PHASE_LABEL: Record<string, string> = {
  ANALYSIS: "Análisis", DESIGN: "Diseño", IMPLEMENTATION: "Implementación", EXECUTION: "Ejecución", CLOSURE: "Cierre",
};

type Role = "QA_AGENTIC" | "CTO";
type Status = "PENDING" | "VALIDATED" | "CORRECTED" | "REJECTED";

// ── Helpers de red ────────────────────────────────────────────────────────────
function useActor(role: Role) {
  return useMemo(
    () => ({ "Content-Type": "application/json", "x-beatrice-actor": `${role === "CTO" ? "Líder" : "QA"}|${role}` }),
    [role]
  );
}

// ── Átomos visuales ────────────────────────────────────────────────────────────
function Badge({ origin, status }: { origin?: string; status?: string }) {
  if (!origin) return <span style={{ color: C.faint, fontFamily: MONO, fontSize: 10 }}>— sin generar</span>;
  const isAI = origin === "AI";
  const col = status === "VALIDATED" || status === "CORRECTED" ? C.human : status === "REJECTED" ? C.reject : C.pending;
  const label = status === "VALIDATED" ? "validado" : status === "CORRECTED" ? "corregido" : status === "REJECTED" ? "rechazado" : "pendiente";
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
      <span style={{ color: isAI ? C.ai : C.human }}>{isAI ? "◆ IA" : "● HUMANO"}</span>
      <span style={{ color: C.faint }}> · </span>
      <span style={{ color: col }}>{label}</span>
    </span>
  );
}

function Btn({ children, onClick, disabled, tone = "accent", title }: any) {
  const col = tone === "reject" ? C.reject : tone === "muted" ? C.dim : C.accent;
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        fontFamily: MONO, fontSize: 11, letterSpacing: 0.3, padding: "6px 12px", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "transparent" : "rgba(61,220,151,.06)", color: disabled ? C.faint : col,
        border: `1px solid ${disabled ? C.line : col}`, opacity: disabled ? 0.5 : 1, transition: "all .15s",
      }}>
      {children}
    </button>
  );
}

function Ring({ pct }: { pct: number }) {
  const size = 92, r = size / 2 - 8, circ = 2 * Math.PI * r;
  const col = pct >= 75 ? C.human : pct >= 45 ? C.pending : C.reject;
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)" }} />
      <text x="50%" y="52%" textAnchor="middle" fill={C.text} style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700 }}>{pct}</text>
      <text x="50%" y="70%" textAnchor="middle" fill={C.dim} style={{ fontFamily: MONO, fontSize: 7, letterSpacing: 1.5 }}>CONFIANZA</text>
    </svg>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 120 }}>
      <div style={{ color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: 1.3 }}>{label}</div>
      <div style={{ color: color || C.text, fontFamily: MONO, fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: C.faint, fontFamily: MONO, fontSize: 9, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Chip({ children, color }: any) {
  return <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 4, border: `1px solid ${color || C.lineHi}`, color: color || C.dim, background: C.panel2 }}>{children}</span>;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Cockpit({ initialSlug, initialProjectName, dbOk }: { initialSlug: string | null; initialProjectName: string | null; dbOk: boolean }) {
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [projectName, setProjectName] = useState<string | null>(initialProjectName);
  const [role, setRole] = useState<Role>("QA_AGENTIC");
  const [list, setList] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [cmd, setCmd] = useState("");
  const [showCode, setShowCode] = useState<Record<string, boolean>>({});
  const headers = useActor(role);
  const isCTO = role === "CTO";

  const flash = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3200); };

  const loadList = useCallback(async (s: string | null) => {
    if (!s) { setList([]); return; }
    const r = await fetch(`/api/requirements?slug=${s}`).then((x) => x.json());
    setProjectName(r.project ?? projectName);
    setList(r.requirements ?? []);
  }, [projectName]);

  const loadKpis = useCallback(async (s: string | null) => {
    if (!s) { setKpis(null); return; }
    const r = await fetch(`/api/kpis?slug=${s}`).then((x) => x.json());
    setKpis(r.kpis ?? null);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const r = await fetch(`/api/requirements/${id}`).then((x) => x.json());
    setDetail(r.requirement ?? null);
  }, []);

  useEffect(() => { if (dbOk) { loadList(slug); loadKpis(slug); } }, [dbOk, slug, loadList, loadKpis]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  const refresh = async () => {
    await Promise.all([loadList(slug), loadKpis(slug), selectedId ? loadDetail(selectedId) : Promise.resolve()]);
  };

  // ── Acciones ────────────────────────────────────────────────────────────────
  async function act(key: string, url: string, body?: any) {
    if (isCTO) { flash("El rol CTO sólo tiene visibilidad; no puede operar.", true); return; }
    setBusy(key);
    try {
      const res = await fetch(url, { method: "POST", headers, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) { flash(data.error || "Error", true); return; }
      await refresh();
      return data;
    } catch (e: any) { flash(String(e?.message || e), true); }
    finally { setBusy(null); }
  }

  const analyze = () => selectedId && act("analyze", `/api/requirements/${selectedId}/analyze`).then((d) => d && flash("Análisis generado por IA — pendiente de tu validación"));
  const strategy = () => selectedId && act("strategy", `/api/requirements/${selectedId}/strategy`).then((d) => d && flash("Estrategia (pirámide de Cohn) propuesta por IA"));
  const implement = () => selectedId && act("implement", `/api/requirements/${selectedId}/implement`).then((d) => d && flash(`Código generado: ${d.artifacts?.length ?? 0} artefacto(s)`));
  const validate = (kind: string, id: string, status: Status, note?: string) =>
    act(`v-${id}`, `/api/validate`, { kind, id, status, note }).then((d) => d && flash(`${kind} → ${status.toLowerCase()}`));

  async function createReq(title: string, description: string) {
    if (!title.trim()) return;
    const s = slug || "playwright-api";
    const d = await act("create", `/api/requirements`, { slug: s, title, description });
    if (d?.requirement) { setSlug(s); setSelectedId(d.requirement.id); flash("Requerimiento ingresado"); }
  }

  // ── Barra de comandos (precursora de la voz) ──────────────────────────────────
  function runCommand(text: string) {
    const t = text.toLowerCase();
    if (!selectedId && !/nuev|crea|ingres/.test(t)) { flash("Selecciona un requerimiento primero", true); return; }
    if (/analiz/.test(t)) return analyze();
    if (/estrategia|plan|diseñ|diseno|pir/.test(t)) return strategy();
    if (/aprob|acept/.test(t) && detail?.strategy) return validate("strategy", detail.strategy.id, "VALIDATED");
    if (/valida/.test(t) && detail?.analysis) return validate("analysis", detail.analysis.id, "VALIDATED");
    if (/implement|gener|cod/.test(t)) return implement();
    flash(`No entendí "${text}". Prueba: analiza / genera el plan / aprueba / implementa`, true);
  }

  const conf = kpis?.confidence?.score ?? 0;

  return (
    <main style={{ ...BG_STYLE, minHeight: "100vh", color: C.text, fontFamily: SANS, padding: "22px 26px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${C.line}`, paddingBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, letterSpacing: 1, background: BRAND, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>BEATRICE<span style={{ color: "#f59e0b", WebkitTextFillColor: "#f59e0b" }}>.</span></div>
        <div style={{ color: C.dim, fontFamily: MONO, fontSize: 11 }}>cockpit de QA agéntico</div>
        <div style={{ flex: 1 }} />
        <div style={{ color: C.dim, fontFamily: MONO, fontSize: 11 }}>{projectName ? `proyecto · ${projectName}` : "sin proyecto"}</div>
        {/* Cambio de vista por rol: QA agéntico opera; CTO sólo observa (KPIs y confianza). */}
        <span style={{ color: C.faint, fontFamily: MONO, fontSize: 10 }}>vista</span>
        <div style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden" }}>
          {(["QA_AGENTIC", "CTO"] as Role[]).map((r) => (
            <button key={r} onClick={() => setRole(r)} title={r === "CTO" ? "Solo lectura: KPIs y confianza" : "Vista operativa: dirige el flujo"} style={{
              fontFamily: MONO, fontSize: 10, padding: "5px 10px", cursor: "pointer", border: "none",
              background: role === r ? C.glow : "transparent", color: role === r ? C.accent : C.dim,
            }}>{r === "CTO" ? "CTO" : "QA agéntico"}</button>
          ))}
        </div>
      </div>

      {/* Command bar */}
      <form onSubmit={(e) => { e.preventDefault(); if (cmd.trim()) { runCommand(cmd); setCmd(""); } }}
        style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: C.panel, border: `1px solid ${C.lineHi}`, borderRadius: 8, padding: "8px 12px" }}>
          <span style={{ color: C.accent, fontFamily: MONO, fontSize: 13 }}>▮</span>
          <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder='Dile a Beatrice: "analiza este ticket", "genera el plan", "aprueba", "implementa"…'
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontFamily: MONO, fontSize: 12 }} />
          <span style={{ color: C.faint, fontFamily: MONO, fontSize: 9 }}>voz: F8</span>
        </div>
        <Btn tone="accent" disabled={!cmd.trim()}>ejecutar</Btn>
      </form>

      {!dbOk && <div style={{ marginTop: 18, color: C.pending, fontFamily: MONO, fontSize: 12 }}>Base de datos no conectada. Configura DATABASE_URL y corre las migraciones.</div>}

      {/* KPI strip */}
      {kpis && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "stretch" }}>
          <div style={{ background: `linear-gradient(180deg, rgba(56,189,248,.08), rgba(168,85,247,.05)), ${C.panel2}`, border: `1px solid ${C.lineHi}`, borderRadius: 8, padding: "8px 16px", display: "flex", alignItems: "center", boxShadow: `0 0 34px ${C.glow}` }}><Ring pct={conf} /></div>
          <Kpi label="CASOS IA ACEPTADOS" value={`${Math.round((kpis.process.aiCases.acceptanceRate || 0) * 100)}%`} sub={`${kpis.process.aiCases.validated}/${kpis.process.aiCases.total} sin corrección`} />
          <Kpi label="COBERTURA PIRÁMIDE" value={`${Math.round((kpis.process.pyramidCoverage || 0) * 100)}%`} sub="ejecutados / decididos" />
          <Kpi label="DEFECTOS ESCAPADOS" value={`${kpis.quality.escapedToProd}`} sub={`${kpis.quality.caughtEarly} atrapados temprano`} color={kpis.quality.escapedToProd ? C.reject : C.human} />
          <Kpi label="COSTO EVITADO" value={`$${Math.round(kpis.business.costAvoidedUsd || 0).toLocaleString()}`} sub={`${(kpis.business.qaHoursSaved || 0).toFixed(1)}h QA`} color={C.human} />
        </div>
      )}

      {/* Cuerpo: lista + detalle */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, marginTop: 18 }}>
        {/* Lista */}
        <div>
          <NewRequirement onCreate={createReq} disabled={isCTO} busy={busy === "create"} />
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 10, letterSpacing: 1.6, color: C.dim }}>REQUERIMIENTOS</div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {list.length === 0 && <div style={{ color: C.faint, fontFamily: MONO, fontSize: 11 }}>Ninguno todavía.</div>}
            {list.map((r) => {
              const active = r.id === selectedId;
              const idx = PHASES.indexOf(r.currentPhase);
              return (
                <div key={r.id} onClick={() => setSelectedId(r.id)} style={{
                  background: active ? C.panel : C.panel2, border: `1px solid ${active ? C.accent : C.line}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                  boxShadow: active ? `0 0 0 1px ${C.glow}` : "none",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{r.title}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    {PHASES.map((p, i) => (
                      <span key={p} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= idx ? C.accent : C.line }} />
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 9, color: C.dim }}>{PHASE_LABEL[r.currentPhase]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalle */}
        <div>
          {!detail && <div style={{ color: C.faint, fontFamily: MONO, fontSize: 12, padding: 20 }}>Selecciona un requerimiento para dirigir su ciclo de calidad.</div>}
          {detail && <Detail detail={detail} busy={busy} isCTO={isCTO} showCode={showCode} setShowCode={setShowCode}
            onAnalyze={analyze} onStrategy={strategy} onImplement={implement} onValidate={validate} />}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 22, right: 22, background: C.panel, border: `1px solid ${toast.err ? C.reject : C.accent}`, color: toast.err ? C.reject : C.text, fontFamily: MONO, fontSize: 12, padding: "10px 16px", borderRadius: 8, maxWidth: 420, boxShadow: "0 8px 30px rgba(0,0,0,.5)" }}>
          {toast.msg}
        </div>
      )}
    </main>
  );
}

// ── Formulario de nuevo requerimiento ─────────────────────────────────────────
function NewRequirement({ onCreate, disabled, busy }: any) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 12 }}>
      {!open ? (
        <Btn onClick={() => setOpen(true)} disabled={disabled} tone="accent">＋ nuevo requerimiento</Btn>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del ticket"
            style={inp} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción (qué toca, terceros, datos…)" rows={3} style={{ ...inp, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => { onCreate(title, desc); setTitle(""); setDesc(""); setOpen(false); }} disabled={disabled || busy || !title.trim()}>ingresar</Btn>
            <Btn onClick={() => setOpen(false)} tone="muted">cancelar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
const inp: React.CSSProperties = { background: C.bg, border: `1px solid ${C.lineHi}`, borderRadius: 6, color: C.text, fontFamily: MONO, fontSize: 12, padding: "8px 10px", outline: "none" };

// ── Panel de detalle: dirige cada fase ────────────────────────────────────────
function Detail({ detail, busy, isCTO, showCode, setShowCode, onAnalyze, onStrategy, onImplement, onValidate }: any) {
  const a = detail.analysis;
  const s = detail.strategy;
  const analysisOk = a && (a.validationStatus === "VALIDATED" || a.validationStatus === "CORRECTED");
  const idx = PHASES.indexOf(detail.currentPhase);
  const interp = a?.interpretation || {};
  const artifacts: any[] = (s?.decisions || []).flatMap((d: any) => (d.artifacts || []).map((art: any) => ({ ...art, level: d.level })));

  const ValidateRow = ({ kind, id, status }: { kind: string; id: string; status: string }) =>
    status === "PENDING" ? (
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Btn onClick={() => onValidate(kind, id, "VALIDATED")} disabled={isCTO || busy}>✓ validar</Btn>
        <Btn onClick={() => { const note = prompt("¿Qué corregiste?") || undefined; onValidate(kind, id, "CORRECTED", note); }} disabled={isCTO || busy} tone="muted">✎ corregir</Btn>
        <Btn onClick={() => { const note = prompt("Motivo del rechazo") || undefined; onValidate(kind, id, "REJECTED", note); }} disabled={isCTO || busy} tone="reject">✕ rechazar</Btn>
      </div>
    ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Cabecera + stepper */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.title}</div>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>{detail.description}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {PHASES.map((p, i) => (
            <span key={p} style={{ fontFamily: MONO, fontSize: 9, padding: "3px 8px", borderRadius: 4, border: `1px solid ${i <= idx ? C.accent : C.line}`, color: i <= idx ? C.accent : C.faint, background: i === idx ? C.glow : "transparent" }}>{PHASE_LABEL[p]}</span>
          ))}
        </div>
      </div>

      {/* M1 · Análisis */}
      <Section n={1} title="Análisis" subtitle="La IA interpreta el ticket; tú validas.">
        {!a ? (
          <Btn onClick={onAnalyze} disabled={isCTO || busy === "analyze"}>{busy === "analyze" ? "analizando…" : "▶ analizar con IA"}</Btn>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Badge origin={a.origin} status={a.validationStatus} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.faint }}>{a.generatedByModel}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {(interp.areas || []).map((x: string) => <Chip key={x} color={C.ai}>{x}</Chip>)}
              {interp.dataSensitive && <Chip color={C.reject}>datos sensibles</Chip>}
              {(interp.thirdParties || []).map((x: string) => <Chip key={x} color={C.pending}>{x}</Chip>)}
            </div>
            {interp.summary && <div style={{ marginTop: 10, fontSize: 13 }}>{interp.summary}</div>}
            {(interp.risks || []).length > 0 && (
              <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 11, color: C.dim }}>Riesgos: {interp.risks.join(" · ")}</div>
            )}
            <div style={{ marginTop: 10, padding: "8px 10px", background: C.panel2, borderLeft: `2px solid ${C.ai}`, borderRadius: 4, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
              <span style={{ color: C.ai, fontFamily: MONO, fontSize: 9 }}>RAZONAMIENTO IA · </span>{a.reasoning}
            </div>
            <ValidateRow kind="analysis" id={a.id} status={a.validationStatus} />
          </>
        )}
      </Section>

      {/* M2 · Diseño de estrategia */}
      <Section n={2} title="Diseño de estrategia" subtitle="Pirámide de Cohn con criterio explícito." locked={!analysisOk} lockMsg="Valida el análisis primero.">
        {!s ? (
          <Btn onClick={onStrategy} disabled={isCTO || !analysisOk || busy === "strategy"}>{busy === "strategy" ? "diseñando…" : "▶ diseñar estrategia"}</Btn>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Badge origin={s.origin} status={s.validationStatus} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: s.approved ? C.human : C.pending }}>{s.approved ? "aprobada" : "sin aprobar"}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>{s.summary}</div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {(s.decisions || []).map((d: any) => (
                <div key={d.id} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Chip color={C.accent}>{d.level}</Chip>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: C.faint }}>prioridad {d.priority}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: C.dim, lineHeight: 1.45 }}>{d.rationale}</div>
                </div>
              ))}
            </div>
            <ValidateRow kind="strategy" id={s.id} status={s.validationStatus} />
          </>
        )}
      </Section>

      {/* M3 · Implementación */}
      <Section n={3} title="Implementación" subtitle="Código de prueba por nivel, trazable." locked={!s?.approved} lockMsg="Aprueba la estrategia primero.">
        {artifacts.length === 0 ? (
          <Btn onClick={onImplement} disabled={isCTO || !s?.approved || busy === "implement"}>{busy === "implement" ? "generando…" : "▶ generar código"}</Btn>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {artifacts.map((art) => (
              <div key={art.id} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Chip color={C.accent}>{art.level}</Chip>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.text }}>{art.filePath}</span>
                  <div style={{ flex: 1 }} />
                  <Badge origin={art.origin} status={art.validationStatus} />
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => setShowCode((p: any) => ({ ...p, [art.id]: !p[art.id] }))}
                    style={{ background: "transparent", border: "none", color: C.dim, fontFamily: MONO, fontSize: 10, cursor: "pointer" }}>
                    {showCode[art.id] ? "▾ ocultar código" : "▸ ver código"}
                  </button>
                </div>
                {showCode[art.id] && (
                  <pre style={{ marginTop: 8, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: 10, overflow: "auto", fontFamily: MONO, fontSize: 11, color: C.text, maxHeight: 220 }}>{art.code}</pre>
                )}
                <ValidateRow kind="artifact" id={art.id} status={art.validationStatus} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* M4 · Ejecución (informativo; la ingesta llega por CI) */}
      <Section n={4} title="Ejecución" subtitle="Los resultados llegan del CI vía POST /api/runs.">
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>
          Conecta el pipeline (GitHub Actions) y los resultados se enlazan a estos artefactos automáticamente.
        </div>
      </Section>
    </div>
  );
}

function Section({ n, title, subtitle, children, locked, lockMsg }: any) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px", opacity: locked ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, padding: "1px 6px" }}>M{n}</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
        <span style={{ color: C.faint, fontFamily: MONO, fontSize: 10 }}>{subtitle}</span>
      </div>
      <div style={{ marginTop: 12 }}>
        {locked ? <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>🔒 {lockMsg}</div> : children}
      </div>
    </div>
  );
}
