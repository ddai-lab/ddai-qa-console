// Beatrice · Motor heurístico determinista (heuristic-v1)
//
// Implementa AIProvider con reglas explícitas en JS: liviano, sin API key, reproducible.
// Cada decisión expone SU RAZONAMIENTO — el QA humano puede auditar por qué la "IA" decidió así.
// Esta es la pieza que un cliente puede reemplazar por un LLM real sin tocar el resto del cockpit.

import type {
  AIProvider,
  AnalysisResult,
  ArtifactResult,
  Interpretation,
  LevelDecision,
  PyramidLevel,
  RequirementInput,
  StrategyResult,
} from "./types";

// ── Diccionarios de señales (keywords → área) ───────────────────────────────
const SIGNALS: Record<string, string[]> = {
  API: ["api", "endpoint", "rest", "graphql", "servicio", "webhook", "microservicio", "request", "response", "http", "crud", "post ", "get ", "put ", "delete", "patch"],
  UI: ["pantalla", "ui", "boton", "botón", "formulario", "form", "página", "pagina", "vista", "front", "interfaz", "modal", "menu", "menú", "navegar", "click", "usuario final"],
  INTEGRATION: ["integra", "tercero", "terceros", "pasarela", "gateway", "sincroniza", "importa", "exporta", "cola", "queue", "evento", "notificación", "notificacion"],
  DATA_SENSITIVE: ["contraseña", "password", "tarjeta", "pii", "gdpr", "datos personales", "datos sensibles", "token", "auth", "login", "sesión", "sesion", "credencial", "kyc", "dni", "cuenta bancaria"],
  PERFORMANCE: ["carga", "performance", "rendimiento", "concurren", "latencia", "escala", "throughput", "tiempo de respuesta", "picos", "estrés", "estres", "sla"],
  SECURITY: ["seguridad", "vulnerab", "inyección", "inyeccion", "sql injection", "xss", "csrf", "autoriz", "permiso", "rol", "acceso", "cifrado", "encripta"],
};

const THIRD_PARTIES: Record<string, string> = {
  stripe: "Stripe (pagos)",
  paypal: "PayPal (pagos)",
  mercadopago: "MercadoPago (pagos)",
  twilio: "Twilio (SMS)",
  sendgrid: "SendGrid (email)",
  mailchimp: "Mailchimp (email)",
  s3: "AWS S3 (storage)",
  firebase: "Firebase",
  auth0: "Auth0 (identidad)",
  google: "Google APIs",
};

function haystack(req: RequirementInput): string {
  return `${req.title}\n${req.description}`.toLowerCase();
}

function detectAreas(text: string): string[] {
  const areas: string[] = [];
  for (const [area, words] of Object.entries(SIGNALS)) {
    if (words.some((w) => text.includes(w))) areas.push(area);
  }
  // Un requerimiento sin señales claras se asume lógica de negocio pura → nivel unitario.
  if (areas.length === 0) areas.push("LOGICA");
  return areas;
}

function detectThirdParties(text: string): string[] {
  return Object.entries(THIRD_PARTIES)
    .filter(([key]) => text.includes(key))
    .map(([, label]) => label);
}

export class HeuristicProvider implements AIProvider {
  readonly name = "heuristic-v1";

  async analyze(req: RequirementInput): Promise<AnalysisResult> {
    const text = haystack(req);
    const areas = detectAreas(text);
    const thirdParties = detectThirdParties(text);
    const dataSensitive = areas.includes("DATA_SENSITIVE");

    const risks: string[] = [];
    if (dataSensitive) risks.push("Exposición de datos personales / credenciales");
    if (thirdParties.length) risks.push("Dependencia de servicios externos (fallos y latencia fuera de control)");
    if (areas.includes("PERFORMANCE")) risks.push("Degradación bajo carga");
    if (areas.includes("SECURITY")) risks.push("Superficie de ataque (autenticación/autorización)");
    if (areas.includes("UI")) risks.push("Regresiones visuales / flujo de usuario roto");
    if (risks.length === 0) risks.push("Errores de lógica de negocio en casos límite");

    const interpretation: Interpretation = {
      areas,
      dataSensitive,
      thirdParties,
      risks,
      summary: buildSummary(areas, thirdParties, dataSensitive),
    };

    const reasoning =
      `Detecté las áreas [${areas.join(", ")}] a partir de palabras clave en el título y la descripción. ` +
      (thirdParties.length
        ? `Identifiqué integración con terceros: ${thirdParties.join(", ")}. `
        : "No detecté integraciones con terceros. ") +
      (dataSensitive
        ? "El requerimiento maneja datos sensibles, así que la seguridad y la validación de entradas suben de prioridad. "
        : "No detecté manejo de datos sensibles. ") +
      "Este análisis es una propuesta: el QA humano debe validar o corregir antes de avanzar a diseño.";

    return { interpretation, reasoning };
  }

  async designStrategy(
    req: RequirementInput,
    analysis: AnalysisResult
  ): Promise<StrategyResult> {
    const { areas, dataSensitive, thirdParties } = analysis.interpretation;
    const decisions: LevelDecision[] = [];

    // Pirámide de Cohn: SIEMPRE priorizar la base (unit) y subir sólo cuando aporta valor real.
    decisions.push({
      level: "UNIT",
      rationale:
        "Base de la pirámide: la lógica de negocio y los casos límite se cubren más barato y rápido a nivel unitario. Es el mayor volumen de pruebas por diseño.",
      priority: 1,
    });

    if (areas.includes("API") || areas.includes("INTEGRATION") || thirdParties.length) {
      decisions.push({
        level: areas.includes("API") ? "API" : "INTEGRATION",
        rationale: thirdParties.length
          ? `Hay integración con terceros (${thirdParties.join(", ")}); las pruebas de API/integración validan el contrato sin pagar el costo de E2E. Los terceros se mockean para estabilidad.`
          : "El requerimiento expone/consume servicios; las pruebas de API validan contratos y códigos de estado de forma estable y veloz.",
        priority: 2,
      });
    }

    if (dataSensitive || areas.includes("SECURITY")) {
      decisions.push({
        level: "SECURITY",
        rationale:
          "Maneja datos sensibles o superficie de seguridad: se agregan pruebas específicas de autenticación/autorización e inyección. No es opcional cuando hay PII o credenciales.",
        priority: 3,
      });
    }

    if (areas.includes("UI")) {
      decisions.push({
        level: "UI_E2E",
        rationale:
          "Sólo UN puñado de pruebas UI/E2E sobre el happy-path crítico. La punta de la pirámide es cara y frágil: se usa para validar el flujo de usuario completo, no para cubrir lógica que ya se probó abajo.",
        priority: 4,
      });
    }

    if (areas.includes("PERFORMANCE")) {
      decisions.push({
        level: "PERFORMANCE",
        rationale:
          "El requerimiento menciona carga/rendimiento: se añade una prueba de performance con k6 para verificar el SLA bajo concurrencia. Fuera de la pirámide funcional, pero necesaria.",
        priority: 5,
      });
    }

    const summary =
      `Estrategia propuesta con ${decisions.length} nivel(es), priorizando la base de la pirámide. ` +
      `Se evita deliberadamente llevar todo a UI/E2E: ${decisions.map((d) => d.level).join(" → ")}.`;

    return { summary, decisions };
  }

  async implement(
    req: RequirementInput,
    decision: LevelDecision
  ): Promise<ArtifactResult> {
    const slug = slugify(req.title);
    switch (decision.level) {
      case "PERFORMANCE":
        return { framework: "K6", filePath: `perf/${slug}.load.js`, code: k6Template(req) };
      case "UNIT":
      case "COMPONENT":
        return { framework: "VITEST", filePath: `unit/${slug}.test.ts`, code: vitestTemplate(req, decision.level) };
      case "UI_E2E":
        return { framework: "PLAYWRIGHT", filePath: `e2e/${slug}.spec.ts`, code: playwrightUiTemplate(req) };
      case "SECURITY":
        return { framework: "PLAYWRIGHT", filePath: `security/${slug}.spec.ts`, code: playwrightApiTemplate(req, "SECURITY") };
      default: // API / INTEGRATION
        return { framework: "PLAYWRIGHT", filePath: `api/${slug}.spec.ts`, code: playwrightApiTemplate(req, decision.level) };
    }
  }
}

// ── Helpers de contenido ────────────────────────────────────────────────────

function buildSummary(areas: string[], thirdParties: string[], dataSensitive: boolean): string {
  const parts: string[] = [];
  if (areas.includes("API")) parts.push("contratos de API");
  if (areas.includes("UI")) parts.push("flujo de UI");
  if (areas.includes("INTEGRATION") || thirdParties.length) parts.push("integraciones");
  if (dataSensitive) parts.push("seguridad de datos");
  if (areas.includes("PERFORMANCE")) parts.push("rendimiento bajo carga");
  if (parts.length === 0) parts.push("lógica de negocio");
  return `Hay que probar: ${parts.join(", ")}.`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "requerimiento";
}

function playwrightApiTemplate(req: RequirementInput, level: PyramidLevel): string {
  return `import { test, expect } from "@playwright/test";

// [Beatrice · GENERADO POR IA · heuristic-v1] Nivel: ${level}
// Requerimiento: ${req.title}
// ⚠️ Esqueleto para validación humana — el QA debe completar aserciones y datos reales.

test.describe("${req.title}", () => {
  test("responde con el contrato esperado", async ({ request }) => {
    const res = await request.get("/api/recurso");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ /* campos esperados */ });
  });

  test("rechaza entradas inválidas", async ({ request }) => {
    const res = await request.post("/api/recurso", { data: {} });
    expect([400, 422]).toContain(res.status());
  });
});
`;
}

function playwrightUiTemplate(req: RequirementInput): string {
  return `import { test, expect } from "@playwright/test";

// [Beatrice · GENERADO POR IA · heuristic-v1] Nivel: UI_E2E (happy-path crítico)
// Requerimiento: ${req.title}
// ⚠️ Sólo el flujo crítico. No repetir aquí lógica ya cubierta en niveles inferiores.

test("${req.title} — flujo principal", async ({ page }) => {
  await page.goto("/");
  // TODO: pasos del usuario
  await expect(page.getByRole("heading")).toBeVisible();
});
`;
}

function vitestTemplate(req: RequirementInput, level: PyramidLevel): string {
  return `import { describe, it, expect } from "vitest";

// [Beatrice · GENERADO POR IA · heuristic-v1] Nivel: ${level} (base de la pirámide)
// Requerimiento: ${req.title}

describe("${req.title}", () => {
  it("cumple la regla de negocio en el caso feliz", () => {
    expect(true).toBe(true); // TODO: importar la unidad y aseverar
  });

  it("maneja los casos límite", () => {
    expect(true).toBe(true); // TODO: null, vacío, valores extremos
  });
});
`;
}

function k6Template(req: RequirementInput): string {
  return `import http from "k6/http";
import { check, sleep } from "k6";

// [Beatrice · GENERADO POR IA · heuristic-v1] Nivel: PERFORMANCE (k6)
// Requerimiento: ${req.title}

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: { http_req_duration: ["p(95)<500"] }, // SLA: p95 < 500ms
};

export default function () {
  const res = http.get(__ENV.TARGET_URL || "http://localhost:3000/api/recurso");
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1);
}
`;
}

// Provider por defecto de la demo. Cambiar aquí (o vía env) para enchufar un LLM real.
export const defaultProvider = new HeuristicProvider();
