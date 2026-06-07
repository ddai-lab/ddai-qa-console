"use client";
import React, { useState, useMemo, useRef } from "react";
import { Activity, CheckCircle2, XCircle, MinusCircle, Zap, Clock, Upload, ChevronRight } from "lucide-react";

const C = {
  bg: "#0a0c0f", panel: "#11151a", panel2: "#0d1116", line: "#1d242c",
  text: "#e6edf3", dim: "#7d8896", faint: "#4a5560",
  pass: "#3ddc97", fail: "#ff5470", skip: "#6b7785", flaky: "#ffb454", accent: "#3ddc97",
};
const MONO = "'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,monospace";
const STATUS: any = {
  passed: { c: C.pass, Icon: CheckCircle2, label: "PASS" },
  failed: { c: C.fail, Icon: XCircle, label: "FAIL" },
  skipped: { c: C.skip, Icon: MinusCircle, label: "SKIP" },
  flaky: { c: C.flaky, Icon: Zap, label: "FLAKY" },
};

type Test = { title: string; status: keyof typeof STATUS; durationMs: number; error?: string };
type Suite = { name: string; tests: Test[] };
type Run = { id: string; timestamp: string; durationMs: number; suites: Suite[] };
type Model = { project: string; slug?: string; runs: Run[] };

const flat = (r: Run) => r.suites.flatMap((s) => s.tests);
const tally = (ts: Test[]) => ts.reduce((a: any, t) => (a[t.status]++, a), { passed: 0, failed: 0, skipped: 0, flaky: 0 });
const passRate = (t: any) => { const run = t.passed + t.failed + t.flaky; return run ? Math.round((t.passed / run) * 100) : 0; };
const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

function Ring({ pct, size = 168 }: { pct: number; size?: number }) {
  const r = size / 2 - 12, circ = 2 * Math.PI * r;
  const col = pct >= 90 ? C.pass : pct >= 70 ? C.flaky : C.fail;
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)" }} />
      <text x="50%" y="46%" textAnchor="middle" fill={C.text} style={{ fontFamily: MONO, fontSize: 38, fontWeight: 700 }}>
        {pct}<tspan fontSize="18" fill={C.dim}>%</tspan></text>
      <text x="50%" y="62%" textAnchor="middle" fill={C.dim} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2 }}>PASS RATE</text>
    </svg>
  );
}
function Stat({ Icon, label, value, color }: any) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "12px 14px", flex: 1, minWidth: 96 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.dim, fontFamily: MONO, fontSize: 10, letterSpacing: 1.5 }}>
        <Icon size={13} color={color} /> {label}</div>
      <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function QAConsole({ initial }: { initial: Model }) {
  const [model, setModel] = useState<Model>(initial);
  const [runIdx, setRunIdx] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const empty = !model?.runs?.length;
  const run = empty ? null : model.runs[runIdx];
  const tests = useMemo(() => (run ? flat(run) : []), [run]);
  const t = useMemo(() => tally(tests), [tests]);
  const pr = passRate(t);
  const history = useMemo(() => model.runs.map((r) => passRate(tally(flat(r)))).slice().reverse(), [model]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(String(rd.result));
        if (Array.isArray(j.runs)) { setModel(j); setRunIdx(0); setErr(""); }
        else setErr("Para previsualizar aquí usa el contrato normalizado { project, runs[] }.");
      } catch { setErr("JSON inválido."); }
    };
    rd.readAsText(f);
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: MONO, padding: "24px 22px",
      backgroundImage: `radial-gradient(${C.line} 1px, transparent 1px)`, backgroundSize: "22px 22px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={18} color={C.accent} />
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>QA CONSOLE</span>
            </div>
            <div style={{ color: C.faint, fontSize: 11, letterSpacing: 2, marginTop: 2 }}>THE QALLIANCE · CALIDAD EN ACCIÓN</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.dim, fontSize: 11 }}>{model.project}</div>
            {run && <div style={{ color: C.faint, fontSize: 11 }}>{new Date(run.timestamp).toLocaleString()}</div>}
          </div>
        </div>

        {empty ? (
          <div style={{ marginTop: 40, textAlign: "center", color: C.dim, fontSize: 13 }}>
            Sin runs todavía. Empuja resultados con <span style={{ color: C.accent }}>POST /api/runs</span> o previsualiza un JSON abajo.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
              {model.runs.map((r, i) => (
                <button key={r.id + i} onClick={() => setRunIdx(i)}
                  style={{ fontFamily: MONO, fontSize: 11, padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                    border: `1px solid ${i === runIdx ? C.accent : C.line}`, color: i === runIdx ? C.bg : C.dim,
                    background: i === runIdx ? C.accent : "transparent" }}>{r.id}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 18,
                display: "flex", alignItems: "center", justifyContent: "center", minWidth: 200 }}><Ring pct={pr} /></div>
              <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Stat Icon={CheckCircle2} label="PASSED" value={t.passed} color={C.pass} />
                  <Stat Icon={XCircle} label="FAILED" value={t.failed} color={C.fail} />
                  <Stat Icon={Zap} label="FLAKY" value={t.flaky} color={C.flaky} />
                  <Stat Icon={MinusCircle} label="SKIPPED" value={t.skipped} color={C.skip} />
                  <Stat Icon={Clock} label="DURATION" value={fmtMs(run!.durationMs)} color={C.dim} />
                </div>
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ color: C.dim, fontSize: 10, letterSpacing: 1.5, marginBottom: 10 }}>PASS RATE · ÚLTIMOS RUNS</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64 }}>
                    {history.map((h, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: "100%", height: `${Math.max(h, 3)}%`, borderRadius: 3,
                          background: h >= 90 ? C.pass : h >= 70 ? C.flaky : C.fail, transition: "height .6s" }} />
                        <span style={{ color: C.faint, fontSize: 9 }}>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              {run!.suites.map((s) => {
                const st = tally(s.tests), srate = passRate(st), isOpen = open[s.name];
                const col = srate >= 90 ? C.pass : srate >= 70 ? C.flaky : C.fail;
                return (
                  <div key={s.name} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
                    <button onClick={() => setOpen((o) => ({ ...o, [s.name]: !o[s.name] }))}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                        background: "transparent", border: "none", cursor: "pointer", color: C.text, fontFamily: MONO, textAlign: "left" }}>
                      <ChevronRight size={15} color={C.dim} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{s.name}</span>
                      <span style={{ fontSize: 11, color: col }}>{srate}%</span>
                      <div style={{ width: 90, height: 5, background: C.line, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${srate}%`, height: "100%", background: col }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${C.line}` }}>
                        {s.tests.map((tt, i) => {
                          const cfg = STATUS[tt.status];
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 14px 9px 38px",
                              borderTop: i ? `1px solid ${C.panel2}` : "none" }}>
                              <cfg.Icon size={14} color={cfg.c} style={{ marginTop: 2, flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12.5, color: C.text }}>{tt.title}</div>
                                {tt.error && <div style={{ fontSize: 11, color: C.fail, marginTop: 4, whiteSpace: "pre-wrap",
                                  background: C.panel2, padding: "6px 8px", borderRadius: 4, borderLeft: `2px solid ${C.fail}` }}>{tt.error}</div>}
                              </div>
                              <span style={{ fontSize: 10, color: cfg.c, letterSpacing: 1 }}>{cfg.label}</span>
                              <span style={{ fontSize: 10, color: C.faint, minWidth: 44, textAlign: "right" }}>{fmtMs(tt.durationMs)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: 18, background: C.panel2, border: `1px dashed ${C.line}`, borderRadius: 8, padding: 16 }}>
          <div style={{ color: C.dim, fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>PREVISUALIZAR RESULTS.JSON (local, no se guarda)</div>
          <button onClick={() => fileRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 12, padding: "8px 14px",
              borderRadius: 6, border: `1px solid ${C.accent}`, background: C.accent, color: C.bg, cursor: "pointer" }}>
            <Upload size={14} /> Subir archivo
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
          {err && <div style={{ color: C.fail, fontSize: 11, marginTop: 10 }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}
