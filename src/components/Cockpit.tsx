"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRecognizer, getSpeaker } from "@/lib/voice";
import { CheckCircle2, Layers, Bug, DollarSign } from "lucide-react";

// ── Tema "centro de mando" · identidad Detrás del Algoritmo (azul-noche + gradientes) ──
const C = {
  bg: "#0b1120", panel: "#141c30", panel2: "#0f1626", line: "#243049", lineHi: "#31405f",
  text: "#eaf0fb", dim: "#8b98b5", faint: "#5a6785",
  ai: "#a855f7", human: "#34d399", pending: "#fbbf24", reject: "#fb5a76", accent: "#38bdf8",
  pass: "#34d399", glow: "rgba(56,189,248,.16)",
};
// Gradiente de marca (cian → azul → púrpura → naranja), como el sitio.
const BRAND = "linear-gradient(90deg,#22d3ee,#3b82f6,#a855f7,#f59e0b)";
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
    <button onClick={onClick} disabled={disabled} title={title} className="bt-btn"
      style={{
        fontFamily: MONO, fontSize: 11, letterSpacing: 0.3, padding: "6px 12px", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "transparent" : "rgba(56,189,248,.08)", color: disabled ? C.faint : col,
        border: `1px solid ${disabled ? C.line : col}`, opacity: disabled ? 0.5 : 1,
      }}>
      {children}
    </button>
  );
}

function Ring({ pct, size = 152 }: { pct: number; size?: number }) {
  const r = size / 2 - 11, circ = 2 * Math.PI * r;
  const col = pct >= 75 ? C.human : pct >= 45 ? C.pending : C.reject;
  return (
    <svg width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="btring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#btring)" strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s var(--ease-out)", filter: `drop-shadow(0 0 10px ${col}66)` }} />
      <text x="50%" y="48%" textAnchor="middle" fill={C.text} style={{ fontFamily: MONO, fontSize: 46, fontWeight: 800, letterSpacing: -1 }}>{pct}</text>
      <text x="50%" y="65%" textAnchor="middle" fill={C.dim} style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 3 }}>CONFIANZA</text>
    </svg>
  );
}

function Kpi({ label, value, sub, color, Icon }: { label: string; value: string; sub?: string; color?: string; Icon?: any }) {
  return (
    <div className="bt-kpi bt-glass" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,0)), rgba(17,21,32,.55)", border: `1px solid ${C.lineHi}`, borderRadius: 12, padding: "14px 16px", flex: 1, minWidth: 150 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {Icon && <Icon size={13} color={color || C.accent} />}
        <div style={{ color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: 1.4 }}>{label}</div>
      </div>
      <div style={{ color: color || C.text, fontFamily: MONO, fontSize: 30, fontWeight: 800, marginTop: 8, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ color: C.faint, fontFamily: MONO, fontSize: 9, marginTop: 3 }}>{sub}</div>}
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
  const [series, setSeries] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [cmd, setCmd] = useState("");
  const [showCode, setShowCode] = useState<Record<string, boolean>>({});
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [voiceOk, setVoiceOk] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const headers = useActor(role);
  const isCTO = role === "CTO";
  const chan = useRef<"UI" | "VOICE">("UI"); // canal de la acción en curso (clic vs voz)

  const flash = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 4000); };
  // Responde a la persona: toast + (si la voz está activa o vino por voz) lo dice en voz alta.
  const respond = useCallback((msg: string, err = false) => {
    flash(msg, err);
    if (chan.current === "VOICE" || speakOn) getSpeaker().speak(msg);
  }, [speakOn]);

  useEffect(() => {
    setVoiceOk(getRecognizer().supported() && getSpeaker().supported());
    // Precarga las voces del navegador (algunas las cargan de forma diferida).
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
  }, []);

  const loadList = useCallback(async (s: string | null) => {
    if (!s) { setList([]); return; }
    const r = await fetch(`/api/requirements?slug=${s}`).then((x) => x.json());
    setProjectName(r.project ?? projectName);
    setList(r.requirements ?? []);
  }, [projectName]);

  const loadKpis = useCallback(async (s: string | null) => {
    if (!s) { setKpis(null); setSeries([]); return; }
    const r = await fetch(`/api/kpis?slug=${s}`).then((x) => x.json());
    setKpis(r.kpis ?? null);
    setSeries(r.confidenceSeries ?? []);
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
    if (isCTO) { respond("La vista Métricas es solo lectura; cambia a QA agéntico para operar.", true); return; }
    setBusy(key);
    try {
      const reqHeaders = { ...headers, "x-beatrice-channel": chan.current };
      const payload = body ? { ...body, channel: chan.current } : undefined;
      const res = await fetch(url, { method: "POST", headers: reqHeaders, body: payload ? JSON.stringify(payload) : undefined });
      const data = await res.json();
      if (!res.ok) { respond(data.error || "Error", true); return; }
      await refresh();
      return data;
    } catch (e: any) { respond(String(e?.message || e), true); }
    finally { setBusy(null); }
  }

  const analyze = () => selectedId && act("analyze", `/api/requirements/${selectedId}/analyze`).then((d) => {
    if (!d) return;
    const it = d.analysis?.interpretation || {};
    const risk = it.dataSensitive ? " Atención: maneja datos sensibles." : "";
    respond(`Análisis listo. Detecté ${(it.areas || []).join(", ") || "lógica de negocio"}.${risk} Pendiente de tu validación.`);
  });
  const strategy = () => selectedId && act("strategy", `/api/requirements/${selectedId}/strategy`).then((d) => {
    if (!d) return;
    const lv = (d.strategy?.decisions || []).map((x: any) => x.level).join(", ");
    respond(`Estrategia propuesta según la pirámide de Cohn: ${lv}. Apruébala para continuar.`);
  });
  const implement = () => selectedId && act("implement", `/api/requirements/${selectedId}/implement`).then((d) => {
    if (!d) return;
    respond(`Generé ${d.artifacts?.length ?? 0} artefacto(s) de prueba. Revísalos y valídalos.`);
  });
  const executeRun = () => selectedId && act("run", `/api/requirements/${selectedId}/simulate-run`).then((d) => {
    if (!d) return;
    respond(`Ejecución lista: ${d.passed} de ${d.total} pruebas pasaron${d.failed ? `, ${d.failed} fallaron` : ""}.`);
  });
  const validate = (kind: string, id: string, status: Status, note?: string) =>
    act(`v-${id}`, `/api/validate`, { kind, id, status, note }).then((d) => {
      if (!d) return;
      const es: Record<string, string> = { VALIDATED: "validado", CORRECTED: "corregido", REJECTED: "rechazado" };
      const nm: Record<string, string> = { analysis: "El análisis", strategy: "La estrategia", artifact: "El artefacto" };
      respond(`${nm[kind] || kind} quedó ${es[status] || status.toLowerCase()}.`);
    });

  async function createReq(title: string, description: string) {
    if (!title.trim()) return;
    const s = slug || "playwright-api";
    const d = await act("create", `/api/requirements`, { slug: s, title, description });
    if (d?.requirement) { setSlug(s); setSelectedId(d.requirement.id); respond(`Requerimiento ingresado: ${title}. Puedes decir "analiza este ticket".`); }
  }

  // ── Helpers de comandos ───────────────────────────────────────────────────────
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const getDetail = async (id: string) => (await fetch(`/api/requirements/${id}`).then((x) => x.json())).requirement;

  function selectByFragment(fragment: string) {
    const f = norm(fragment);
    const hit = list.find((r) => norm(r.title).includes(f));
    if (hit) { setSelectedId(hit.id); return respond(`Abrí: ${hit.title}.`); }
    return respond(`No encontré un requerimiento que diga "${fragment}".`, true);
  }
  function selectRelative(which: "first" | "last" | "next" | "prev") {
    if (list.length === 0) return respond("No hay requerimientos.", true);
    const i = Math.max(0, list.findIndex((r) => r.id === selectedId));
    const idx = which === "first" ? 0 : which === "last" ? list.length - 1 : which === "next" ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1);
    const r = list[idx]; setSelectedId(r.id); return respond(`Abrí: ${r.title}.`);
  }
  function report(kind: "confidence" | "kpis" | "risks" | "status") {
    if (!kpis) return respond("Todavía no hay métricas.", true);
    if (kind === "confidence") return respond(`El score de confianza es ${kpis.confidence.score} sobre 100.`);
    if (kind === "kpis") return respond(`Aceptación de IA ${Math.round((kpis.process.aiCases.acceptanceRate || 0) * 100)} por ciento. Cobertura de pirámide ${Math.round((kpis.process.pyramidCoverage || 0) * 100)} por ciento. Defectos escapados ${kpis.quality.escapedToProd}. Costo evitado ${Math.round(kpis.business.costAvoidedUsd || 0)} dólares.`);
    if (kind === "risks") {
      const rk = detail?.analysis?.interpretation?.risks || [];
      return respond(rk.length ? `Riesgos detectados: ${rk.join(", ")}.` : "Aún no hay un análisis con riesgos para este requerimiento.");
    }
    if (detail) {
      const nArt = (detail.strategy?.decisions || []).reduce((n: number, d: any) => n + (d.artifacts?.length || 0), 0);
      return respond(`${detail.title}. Fase: ${detail.currentPhase}. Análisis: ${detail.analysis?.validationStatus || "sin generar"}. Estrategia: ${detail.strategy ? (detail.strategy.approved ? "aprobada" : detail.strategy.validationStatus) : "sin generar"}. ${nArt} artefactos.`);
    }
    return respond(`Hay ${list.length} requerimiento(s). Confianza ${kpis.confidence.score}. Selecciona uno para ver su detalle.`);
  }
  function helpText() {
    return respond('Puedes decir: "analiza este ticket", "genera el plan", "aprueba", "corrige el análisis", "implementa", "ejecuta las pruebas", "haz todo el ciclo", "crea un requerimiento: …", "abre el de login", "el siguiente", "¿cuál es el score de confianza?", "dame los KPIs", "qué riesgos hay", "vista métricas", "silencio".');
  }
  async function runFullPipeline() {
    if (isCTO) return respond("La vista Métricas es solo lectura; cambia a QA agéntico para operar.", true);
    const id = selectedId; if (!id) return;
    respond("Ejecutando el ciclo completo de calidad…");
    await analyze();
    let d = await getDetail(id);
    if (d?.analysis) await validate("analysis", d.analysis.id, "VALIDATED");
    await strategy();
    d = await getDetail(id);
    if (d?.strategy) await validate("strategy", d.strategy.id, "VALIDATED");
    await implement();
    await executeRun();
    respond("Ciclo completo. Revisa el score de confianza y la cobertura.");
  }

  // ── Barra de comandos / voz: entiende lenguaje natural en español ──────────────
  async function runCommand(raw: string) {
    const t = norm(raw);
    // Ayuda
    if (/\b(ayuda|help)\b|que puedes hacer|comandos|opciones/.test(t)) return helpText();
    // Control de voz
    if (/(silencio|mutea|callate|no hables)/.test(t)) { setSpeakOn(false); getSpeaker().cancel(); return flash("Voz silenciada."); }
    if (/(activa la voz|responde en voz|habla)/.test(t)) { setSpeakOn(true); return respond("Voz activada."); }
    // Cambiar vista
    if (/(vista|modo)\s*(metrica|cto|kpi|solo lectura)/.test(t)) { setRole("CTO"); return respond("Cambié a la vista Métricas."); }
    if (/(vista|modo)\s*(qa|operativ|agentic)/.test(t)) { setRole("QA_AGENTIC"); return respond("Cambié a la vista QA agéntico."); }
    // Reportes hablados (funcionan también en la vista Métricas)
    if (/(confianza|score)/.test(t)) return report("confidence");
    if (/(kpi|metrica|indicador)/.test(t)) return report("kpis");
    if (/riesgo/.test(t)) return report("risks");
    if (/(estado|resumen|resume|como va|status)/.test(t)) return report("status");
    // Crear requerimiento
    if (/\b(crea|nuevo|nueva|ingresa|agrega|anade)\b/.test(t)) {
      const m = raw.match(/(?:crea|nuevo|nueva|ingresa|agrega|añade|anade)\b[^:]*:?\s*(.+)/i);
      if (m && m[1] && m[1].trim().length > 2) return createReq(m[1].trim(), "");
      return respond('Dime el título, por ejemplo: "crea un requerimiento: login con dos factores".', true);
    }
    // Selección
    if (/\b(primer|primero)\b/.test(t)) return selectRelative("first");
    if (/\b(ultimo)\b/.test(t)) return selectRelative("last");
    if (/(siguiente|proximo)/.test(t)) return selectRelative("next");
    if (/(anterior|previo)/.test(t)) return selectRelative("prev");
    if (/\b(selecciona|abre|abrir|ve a|ir a|elige|muestra el|muestrame el)\b/.test(t)) {
      const m = raw.match(/(?:selecciona|abre|abrir|ve a|ir a|elige|muestra(?:me)? el)\s+(?:el\s+|la\s+)?(?:requerimiento\s+|ticket\s+|de\s+)?(.+)/i);
      if (m && m[1]) return selectByFragment(m[1].trim());
    }
    // A partir de aquí se necesita un requerimiento seleccionado
    if (!selectedId) return respond('Primero selecciona o crea un requerimiento. Di "ayuda" para ver los comandos.', true);
    // Pipeline completo
    if (/(haz todo|ciclo completo|de principio a fin|automatiza|corre todo|flujo completo)/.test(t)) return runFullPipeline();
    // Fases del ciclo
    if (/(corrige|corregi)/.test(t)) {
      if (/estrategia|plan/.test(t) && detail?.strategy) return validate("strategy", detail.strategy.id, "CORRECTED");
      if (detail?.analysis) return validate("analysis", detail.analysis.id, "CORRECTED");
    }
    if (/(rechaza|descarta)/.test(t)) {
      if (/estrategia|plan/.test(t) && detail?.strategy) return validate("strategy", detail.strategy.id, "REJECTED");
      if (detail?.analysis) return validate("analysis", detail.analysis.id, "REJECTED");
    }
    if (/analiz|interpreta/.test(t)) return analyze();
    if (/estrategia|plan de prueba|diseñ|disen|piramide|cohn/.test(t)) return strategy();
    if (/aprob|acept/.test(t)) { if (detail?.strategy) return validate("strategy", detail.strategy.id, "VALIDATED"); return respond("Aún no hay estrategia para aprobar.", true); }
    if (/valida/.test(t)) { if (detail?.analysis) return validate("analysis", detail.analysis.id, "VALIDATED"); return respond("Aún no hay análisis para validar.", true); }
    if (/implement|codigo|escribe.*prueba|genera.*prueba/.test(t)) return implement();
    if (/(ejecuta|corre|corre la suite|lanza).*(prueba|suite|test|integracion)?/.test(t)) return executeRun();
    return respond(`No entendí "${raw}". Di "ayuda" para ver lo que puedo hacer.`, true);
  }

  // Comando llegado por voz: se audita (canal VOICE) y se ejecuta igual que un clic.
  async function handleVoice(transcript: string) {
    chan.current = "VOICE";
    try {
      // Registra el comando de voz en el log de auditoría (traza el transcript).
      fetch("/api/events", {
        method: "POST",
        headers: { ...headers, "x-beatrice-channel": "VOICE" },
        body: JSON.stringify({ action: "voice.command", slug, requirementId: selectedId, transcript }),
      }).catch(() => {});
      await runCommand(transcript);
    } finally {
      chan.current = "UI";
    }
  }

  function toggleMic() {
    const rec = getRecognizer();
    if (listening) { rec.stop(); setListening(false); return; }
    if (!rec.supported()) { respond("Tu navegador no soporta reconocimiento de voz.", true); return; }
    setListening(true);
    rec.start({
      onResult: (text, isFinal) => {
        setCmd(text);
        if (isFinal) { setListening(false); setCmd(""); handleVoice(text); }
      },
      onEnd: () => setListening(false),
      onError: (m) => { setListening(false); respond(`Voz: ${m}`, true); },
    });
  }

  const conf = kpis?.confidence?.score ?? 0;

  return (
    <main style={{ position: "relative", overflowX: "hidden", minHeight: "100vh", color: C.text, fontFamily: SANS, padding: "22px 26px" }}>
      <div className="bt-aurora" aria-hidden><i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" /><span className="grid" /></div>
      {/* Header */}
      <div className="bt-header" style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${C.line}`, padding: "16px 26px 14px", margin: "-22px -26px 0" }}>
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
            }}>{r === "CTO" ? "Métricas" : "QA agéntico"}</button>
          ))}
        </div>
      </div>

      {/* Command bar */}
      <form onSubmit={(e) => { e.preventDefault(); if (cmd.trim()) { runCommand(cmd); setCmd(""); } }}
        style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div className="bt-cmdbar" style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(17,21,32,.72)", border: `1px solid ${listening ? C.reject : C.lineHi}`, borderRadius: 8, padding: "8px 12px", boxShadow: listening ? `0 0 0 3px rgba(251,90,118,.15)` : "none" }}>
          <span style={{ color: listening ? C.reject : C.accent, fontFamily: MONO, fontSize: 13 }}>{listening ? "●" : "▮"}</span>
          <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={listening ? "Escuchando…" : 'Dile a Beatrice: "analiza este ticket", "genera el plan", "aprueba", "implementa"…'}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontFamily: MONO, fontSize: 12 }} />
          {voiceOk ? (
            <>
              <button type="button" onClick={toggleMic} disabled={isCTO} className={listening ? "bt-mic-live" : "bt-btn"} title={isCTO ? "La vista Métricas no opera" : listening ? "Detener" : "Hablar a Beatrice"}
                style={{ border: "none", background: "transparent", cursor: isCTO ? "not-allowed" : "pointer", color: listening ? C.reject : C.accent, fontSize: 15, opacity: isCTO ? 0.4 : 1 }}>
                {listening ? "◼" : "🎤"}
              </button>
              <button type="button" onClick={() => { setSpeakOn((v) => { if (v) getSpeaker().cancel(); return !v; }); }} title={speakOn ? "Silenciar voz de Beatrice" : "Activar voz de Beatrice"}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: speakOn ? C.accent : C.faint, fontSize: 14 }}>
                {speakOn ? "🔊" : "🔇"}
              </button>
            </>
          ) : (
            <span style={{ color: C.faint, fontFamily: MONO, fontSize: 9 }}>voz no disponible</span>
          )}
        </div>
        <Btn tone="accent" disabled={!cmd.trim()}>ejecutar</Btn>
      </form>

      {/* Ayuda de comandos (chips ejecutables) */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setShowHelp((v) => !v)}
          style={{ border: "none", background: "transparent", color: C.dim, fontFamily: MONO, fontSize: 10, cursor: "pointer", letterSpacing: 0.5 }}>
          {showHelp ? "▾ comandos" : "▸ ¿qué puedo decir?"}
        </button>
        {showHelp && ["analiza este ticket", "genera el plan", "aprueba", "implementa", "ejecuta las pruebas", "haz todo el ciclo", "dame los KPIs", "qué riesgos hay", "el siguiente", "ayuda"].map((ex) => (
          <button key={ex} type="button" onClick={() => runCommand(ex)} className="bt-chip"
            style={{ fontFamily: MONO, fontSize: 10, padding: "3px 9px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel2, color: C.dim, cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>

      {!dbOk && <div style={{ marginTop: 18, color: C.pending, fontFamily: MONO, fontSize: 12 }}>Base de datos no conectada. Configura DATABASE_URL y corre las migraciones.</div>}

      {/* ── Vista MÉTRICAS: dashboard completo ─────────────────────────────────── */}
      {kpis && isCTO && <MetricsDashboard kpis={kpis} series={series} conf={conf} onOperate={() => setRole("QA_AGENTIC")} />}

      {/* ── Vista QA AGÉNTICO: requerimientos + fases del ciclo ────────────────── */}
      {!isCTO && (
        <>
          {kpis && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, fontFamily: MONO, fontSize: 11, color: C.dim }}>
              <span>confianza <b style={{ color: conf >= 75 ? C.human : conf >= 45 ? C.pending : C.reject, fontSize: 13 }}>{conf}</b></span>
              <span style={{ color: C.faint }}>·</span>
              <span>{list.length} requerimiento(s)</span>
              <span style={{ color: C.faint }}>·</span>
              <span>aceptación IA {Math.round((kpis.process.aiCases.acceptanceRate || 0) * 100)}%</span>
              <span style={{ flex: 1 }} />
              <button className="bt-chip" onClick={() => setRole("CTO")} style={{ fontFamily: MONO, fontSize: 10, padding: "4px 10px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel2, color: C.dim, cursor: "pointer" }}>ver métricas →</button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, marginTop: 14 }}>
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
                    <div key={r.id} onClick={() => setSelectedId(r.id)} className="bt-card" style={{
                      background: active ? C.panel : C.panel2, border: `1px solid ${active ? C.accent : C.line}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                      boxShadow: active ? `0 0 0 1px ${C.glow}, 0 8px 24px rgba(0,0,0,.3)` : "none",
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
                onAnalyze={analyze} onStrategy={strategy} onImplement={implement} onValidate={validate} onExecute={executeRun} />}
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="bt-toast" style={{ position: "fixed", bottom: 22, right: 22, background: "rgba(17,21,32,.9)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: `1px solid ${toast.err ? C.reject : C.accent}`, color: toast.err ? C.reject : C.text, fontFamily: MONO, fontSize: 12, padding: "10px 16px", borderRadius: 8, maxWidth: 420, boxShadow: "0 8px 30px rgba(0,0,0,.5)" }}>
          {toast.msg}
        </div>
      )}
    </main>
  );
}

// ── Vista MÉTRICAS: dashboard ──────────────────────────────────────────────────
const LEVEL_LABEL: Record<string, string> = {
  UNIT: "Unitario", COMPONENT: "Componente", INTEGRATION: "Integración", API: "API",
  UI_E2E: "UI / E2E", PERFORMANCE: "Performance", SECURITY: "Seguridad",
};

function Panel({ title, children, hint }: any) {
  return (
    <div className="bt-section bt-glass" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,0)), rgba(17,21,32,.5)", border: `1px solid ${C.lineHi}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.6, color: C.dim }}>{title}</div>
        {hint && <div style={{ fontFamily: MONO, fontSize: 9, color: C.faint }}>{hint}</div>}
      </div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, color: C.dim, marginBottom: 5 }}>
        <span>{label}</span><span style={{ color: C.text }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: C.panel2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, background: color || "linear-gradient(90deg,#22d3ee,#3b82f6,#a855f7)", transition: "width 900ms var(--ease-out)" }} />
      </div>
    </div>
  );
}

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>Sin historial todavía.</div>;
  const w = 340, h = 80, pad = 6;
  const max = 100, min = 0;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return [x, y];
  });
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const last = data[data.length - 1];
  const col = last >= 75 ? C.human : last >= 45 ? C.pending : C.reject;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="btspark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.28" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#btspark)" />
      <polyline points={line} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={col} />
    </svg>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 130 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, color: C.dim }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: color || C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function MetricsDashboard({ kpis, series, conf, onOperate }: any) {
  const b = kpis.confidence.breakdown || {};
  const ai = kpis.process.aiCases;
  const cov = kpis.process.coverageByLevel || [];
  const seg = [
    { k: "validated", n: ai.validated, c: C.human, label: "validados" },
    { k: "corrected", n: ai.corrected, c: C.accent, label: "corregidos" },
    { k: "rejected", n: ai.rejected, c: C.reject, label: "rechazados" },
    { k: "pending", n: ai.pending, c: C.pending, label: "pendientes" },
  ];
  const total = Math.max(1, ai.total);
  const fmtH = (h: number | null) => (h == null ? "—" : h < 24 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Hero: medidor + KPIs */}
      <div className="bt-stagger" style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
        <div className="bt-kpi bt-glass" style={{ background: "linear-gradient(150deg, rgba(56,189,248,.14), rgba(168,85,247,.10) 55%, rgba(245,158,11,.06)), rgba(17,21,32,.5)", border: `1px solid ${C.lineHi}`, borderRadius: 16, padding: "18px 28px", display: "flex", alignItems: "center", gap: 20, boxShadow: `0 0 60px rgba(56,189,248,.18)` }}>
          <Ring pct={conf} />
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: C.dim }}>SCORE DE CONFIANZA</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, maxWidth: 190, lineHeight: 1.35 }}>Un número, auditable, del estado real de calidad.</div>
            <button className="bt-chip" onClick={onOperate} style={{ marginTop: 10, fontFamily: MONO, fontSize: 10, padding: "4px 10px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel2, color: C.dim, cursor: "pointer" }}>← operar en QA</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1 }}>
          <Kpi Icon={CheckCircle2} label="CASOS IA ACEPTADOS" value={`${Math.round((ai.acceptanceRate || 0) * 100)}%`} sub={`${ai.validated}/${ai.total} sin corrección`} />
          <Kpi Icon={Layers} label="COBERTURA PIRÁMIDE" value={`${Math.round((kpis.process.pyramidCoverage || 0) * 100)}%`} sub="ejecutados / decididos" />
          <Kpi Icon={Bug} label="DEFECTOS ESCAPADOS" value={`${kpis.quality.escapedToProd}`} sub={`${kpis.quality.caughtEarly} atrapados temprano`} color={kpis.quality.escapedToProd ? C.reject : C.human} />
          <Kpi Icon={DollarSign} label="COSTO EVITADO" value={`$${Math.round(kpis.business.costAvoidedUsd || 0).toLocaleString()}`} sub={`${(kpis.business.qaHoursSaved || 0).toFixed(1)}h QA ahorradas`} color={C.human} />
        </div>
      </div>

      {/* Fila: desglose del score + aceptación IA */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Panel title="DESGLOSE DEL SCORE DE CONFIANZA" hint="cómo se forma el número">
          <Bar label="Pruebas que pasan (pass rate)" value={b.passRate ?? 0} />
          <Bar label="Cobertura de la pirámide" value={b.pyramidCoverage ?? 0} />
          <Bar label="Validación humana" value={b.validationRate ?? 0} />
          <div style={{ fontFamily: MONO, fontSize: 10, color: b.escapedPenalty ? C.reject : C.faint, marginTop: 4 }}>
            Penalización por defectos escapados: −{b.escapedPenalty ?? 0}
          </div>
        </Panel>
        <Panel title="ACEPTACIÓN DE CASOS GENERADOS POR IA" hint={`${ai.total} artefacto(s)`}>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: C.panel2 }}>
            {seg.map((s) => s.n > 0 && (
              <div key={s.k} title={`${s.label}: ${s.n}`} style={{ width: `${(s.n / total) * 100}%`, background: s.c, transition: "width 900ms var(--ease-out)" }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
            {seg.map((s) => (
              <span key={s.k} style={{ fontFamily: MONO, fontSize: 10, color: C.dim, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} /> {s.label} <b style={{ color: C.text }}>{s.n}</b>
              </span>
            ))}
          </div>
        </Panel>
      </div>

      {/* Fila: cobertura por nivel + evolución */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Panel title="COBERTURA POR NIVEL — PIRÁMIDE DE COHN" hint="decidido vs ejecutado">
          {cov.length === 0 && <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>Sin estrategia todavía.</div>}
          {cov.map((c: any) => (
            <div key={c.level} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 120, fontFamily: MONO, fontSize: 11, color: C.text }}>{LEVEL_LABEL[c.level] || c.level}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 10, border: `1px solid ${C.accent}`, color: C.accent }}>decidido</span>
              <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 10, border: `1px solid ${c.executed ? C.human : C.line}`, color: c.executed ? C.human : C.faint }}>
                {c.executed ? "✓ ejecutado" : "sin ejecutar"}
              </span>
            </div>
          ))}
        </Panel>
        <Panel title="EVOLUCIÓN DE LA CONFIANZA" hint="en el tiempo">
          <Spark data={(series || []).map((s: any) => s.score)} />
        </Panel>
      </div>

      {/* Fila: proceso / calidad / negocio */}
      <Panel title="PROCESO · CALIDAD · NEGOCIO">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <MiniStat label="ANÁLISIS → PLAN" value={kpis.process.avgAnalysisToPlanMin != null ? `${Math.round(kpis.process.avgAnalysisToPlanMin)} min` : "—"} />
          <MiniStat label="T. MEDIO DETECCIÓN" value={fmtH(kpis.quality.meanTimeToDetectH)} />
          <MiniStat label="DEFECTOS TEMPRANOS" value={`${kpis.quality.caughtEarly}`} color={C.human} />
          <MiniStat label="HORAS QA AHORRADAS" value={`${(kpis.business.qaHoursSaved || 0).toFixed(1)} h`} color={C.human} />
          <MiniStat label="REDUCCIÓN vs BASELINE" value={`${kpis.business.escapedReductionVsBaseline}/${kpis.business.baselineEscapedPerMonth} mes`} />
        </div>
      </Panel>
    </div>
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
function Detail({ detail, busy, isCTO, showCode, setShowCode, onAnalyze, onStrategy, onImplement, onValidate, onExecute }: any) {
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

      {/* M4 · Ejecución (en la demo se simula; en prod la ingesta llega por CI) */}
      <Section n={4} title="Ejecución" subtitle="En producción llega del CI; aquí puedes simularla." locked={artifacts.length === 0} lockMsg="Genera el código primero.">
        <Btn onClick={onExecute} disabled={isCTO || busy === "run"}>{busy === "run" ? "ejecutando…" : "▶ ejecutar pruebas (demo)"}</Btn>
        <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 10, color: C.faint }}>
          En producción, GitHub Actions envía resultados a POST /api/runs y se enlazan a estos artefactos.
        </div>
      </Section>
    </div>
  );
}

function Section({ n, title, subtitle, children, locked, lockMsg }: any) {
  return (
    <div className="bt-section" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px", opacity: locked ? 0.6 : 1 }}>
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
