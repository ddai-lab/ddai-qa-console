// Contrato normalizado y adaptador para el JSON reporter de Playwright.
export type Status = "passed" | "failed" | "skipped" | "flaky";
export interface TestT { title: string; status: Status; durationMs: number; error?: string }
export interface SuiteT { name: string; tests: TestT[] }
export interface RunT {
  externalId: string; timestamp?: string; durationMs?: number; suites: SuiteT[];
}
export interface Payload { project: string; slug: string; run: RunT }

export function tally(tests: TestT[]) {
  return tests.reduce(
    (a, t) => { a[t.status]++; return a; },
    { passed: 0, failed: 0, skipped: 0, flaky: 0 }
  );
}

// Detecta y convierte JSON reporter de Playwright -> SuiteT[]
export function adaptPlaywright(json: any): SuiteT[] | null {
  if (!json || !Array.isArray(json.suites)) return null;
  const out: SuiteT[] = [];
  const walk = (suites: any[]) => {
    for (const s of suites) {
      const tests: TestT[] = [];
      for (const spec of s.specs || []) {
        for (const t of spec.tests || []) {
          const res = (t.results || [])[0] || {};
          const status: Status =
            res.status === "passed" ? "passed"
            : res.status === "skipped" ? "skipped"
            : t.status === "flaky" ? "flaky" : "failed";
          tests.push({
            title: spec.title,
            status,
            durationMs: res.duration || 0,
            error: res.error?.message,
          });
        }
      }
      if (tests.length) out.push({ name: s.title || s.file || "suite", tests });
      if (s.suites) walk(s.suites);
    }
  };
  walk(json.suites);
  return out;
}
