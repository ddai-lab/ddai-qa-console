// Beatrice · Seed de demostración.
// Crea un dataset end-to-end que hace visible la marca de la casa:
// qué generó la IA, qué validó un humano, qué quedó pendiente — y KPIs reales.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Cliente + baseline (best practices QA, configurable).
  const client = await prisma.client.create({ data: { name: "Acme Corp" } });
  await prisma.baselineConfig.create({ data: { clientId: client.id } });

  const project = await prisma.project.upsert({
    where: { slug: "playwright-api" },
    update: { clientId: client.id },
    create: { slug: "playwright-api", name: "Playwright API", clientId: client.id },
  });

  const qa = await prisma.user.upsert({
    where: { email: "mariajose@thefirst.qa" },
    update: {},
    create: { email: "mariajose@thefirst.qa", name: "María José", role: "QA_AGENTIC" },
  });

  // ── Requerimiento 1: completo hasta ejecución, todo validado ─────────────────
  const r1 = await prisma.requirement.create({
    data: {
      projectId: project.id,
      title: "Booking: crear reserva vía API con pago",
      description:
        "Endpoint POST /booking que crea una reserva y cobra con Stripe. Maneja token de sesión y datos de tarjeta.",
      source: "MANUAL",
      currentPhase: "EXECUTION",
      createdAt: daysAgo(6),
      transitions: {
        create: [
          { fromPhase: null, toPhase: "ANALYSIS", at: daysAgo(6) },
          { fromPhase: "ANALYSIS", toPhase: "DESIGN", at: minsAfter(daysAgo(6), 18) },
          { fromPhase: "DESIGN", toPhase: "IMPLEMENTATION", at: daysAgo(5) },
          { fromPhase: "IMPLEMENTATION", toPhase: "EXECUTION", at: daysAgo(4) },
        ],
      },
      analysis: {
        create: {
          interpretation: {
            areas: ["API", "INTEGRATION", "DATA_SENSITIVE"],
            dataSensitive: true,
            thirdParties: ["Stripe (pagos)"],
            risks: ["Exposición de datos personales / credenciales", "Dependencia de servicios externos"],
            summary: "Hay que probar: contratos de API, integraciones, seguridad de datos.",
          },
          reasoning:
            "Detecté áreas [API, INTEGRATION, DATA_SENSITIVE] por 'POST /booking', 'Stripe' y 'tarjeta/token'. Sube la prioridad de seguridad.",
          origin: "AI",
          generatedByModel: "heuristic-v1",
          validationStatus: "VALIDATED",
          validatedByName: "María José",
          validatedAt: minsAfter(daysAgo(6), 15),
        },
      },
    },
  });

  const s1 = await prisma.testStrategy.create({
    data: {
      requirementId: r1.id,
      summary: "Estrategia con 3 niveles priorizando la base: UNIT → API → SECURITY.",
      approved: true,
      origin: "AI",
      generatedByModel: "heuristic-v1",
      validationStatus: "VALIDATED",
      validatedByName: "María José",
      validatedAt: daysAgo(5),
      decisions: {
        create: [
          { level: "UNIT", rationale: "Reglas de cálculo de precio y validación de fechas: barato y rápido a nivel unitario.", priority: 1, origin: "AI", validationStatus: "VALIDATED" },
          { level: "API", rationale: "Contrato de POST /booking y códigos de estado; Stripe mockeado para estabilidad.", priority: 2, origin: "AI", validationStatus: "VALIDATED" },
          { level: "SECURITY", rationale: "Maneja tarjeta y token de sesión: pruebas de autenticación e inyección no son opcionales.", priority: 3, origin: "AI", validationStatus: "VALIDATED" },
        ],
      },
    },
    include: { decisions: true },
  });

  // Artefactos: 2 validados, 1 corregido por el humano.
  const dApi = s1.decisions.find((d) => d.level === "API");
  const dUnit = s1.decisions.find((d) => d.level === "UNIT");
  const dSec = s1.decisions.find((d) => d.level === "SECURITY");
  const aUnit = await prisma.testArtifact.create({ data: artifact(dUnit.id, "VITEST", "unit/booking-precio.test.ts", "VALIDATED", "María José") });
  const aApi = await prisma.testArtifact.create({ data: artifact(dApi.id, "PLAYWRIGHT", "api/booking-crea-reserva.spec.ts", "CORRECTED", "María José", "Ajusté las aserciones al esquema real de la respuesta.") });
  const aSec = await prisma.testArtifact.create({ data: artifact(dSec.id, "PLAYWRIGHT", "api/booking-seguridad.spec.ts", "VALIDATED", "María José") });

  // Run de ejecución con resultados enlazados a artefactos.
  await prisma.testRun.create({
    data: {
      projectId: project.id,
      externalId: "run-0042",
      durationMs: 48230,
      passed: 8, failed: 1, skipped: 0, flaky: 0,
      suites: [
        { name: "booking-crud.spec.ts", tests: [
          { title: "POST crea un booking", status: "passed", durationMs: 1340 },
          { title: "PUT actualiza", status: "failed", durationMs: 1870, error: "expected 200, got 500" },
        ] },
      ],
      results: {
        create: [
          { title: "precio se calcula correctamente", status: "passed", durationMs: 12, artifactId: aUnit.id },
          { title: "rechaza fechas inválidas", status: "passed", durationMs: 9, artifactId: aUnit.id },
          { title: "POST /booking responde 201", status: "passed", durationMs: 1340, artifactId: aApi.id },
          { title: "POST /booking rechaza payload vacío", status: "passed", durationMs: 410, artifactId: aApi.id },
          { title: "sin token → 401", status: "passed", durationMs: 220, artifactId: aSec.id },
          { title: "inyección en query → sanitizada", status: "failed", durationMs: 300, error: "500 en payload malicioso", artifactId: aSec.id },
        ],
      },
    },
  });

  // Defecto atrapado temprano (no escapó a prod) → cuenta como costo evitado.
  await prisma.defect.create({
    data: { projectId: project.id, requirementId: r1.id, title: "500 ante inyección en query de búsqueda", phaseDetected: "EXECUTION", escapedToProd: false, detectedAt: daysAgo(4) },
  });

  // ── Requerimiento 2: en diseño, estrategia PENDIENTE de validación ───────────
  const r2 = await prisma.requirement.create({
    data: {
      projectId: project.id,
      title: "UI: pantalla de listado de reservas con filtros",
      description: "Vista con formulario de filtros y tabla paginada. Flujo de usuario final.",
      currentPhase: "DESIGN",
      createdAt: daysAgo(1),
      transitions: { create: [
        { fromPhase: null, toPhase: "ANALYSIS", at: daysAgo(1) },
        { fromPhase: "ANALYSIS", toPhase: "DESIGN", at: minsAfter(daysAgo(1), 22) },
      ] },
      analysis: { create: {
        interpretation: { areas: ["UI"], dataSensitive: false, thirdParties: [], risks: ["Regresiones visuales / flujo de usuario roto"], summary: "Hay que probar: flujo de UI." },
        reasoning: "Detecté área [UI] por 'pantalla', 'formulario', 'tabla', 'usuario final'.",
        origin: "AI", generatedByModel: "heuristic-v1", validationStatus: "VALIDATED", validatedByName: "María José", validatedAt: minsAfter(daysAgo(1), 20),
      } },
    },
  });
  await prisma.testStrategy.create({
    data: {
      requirementId: r2.id,
      summary: "UNIT (base) + un único UI_E2E sobre el happy-path crítico.",
      approved: false,
      origin: "AI", generatedByModel: "heuristic-v1", validationStatus: "PENDING",
      decisions: { create: [
        { level: "UNIT", rationale: "Lógica de filtros y paginación se cubre barato abajo.", priority: 1, origin: "AI", validationStatus: "PENDING" },
        { level: "UI_E2E", rationale: "Sólo el flujo crítico de filtrar y ver resultados; la punta de la pirámide es cara.", priority: 2, origin: "AI", validationStatus: "PENDING" },
      ] },
    },
  });

  // Snapshots de confianza (evolución en el tiempo).
  for (let i = 5; i >= 0; i--) {
    await prisma.confidenceSnapshot.create({
      data: { projectId: project.id, score: 40 + (5 - i) * 8, breakdown: {}, computedAt: daysAgo(i) },
    });
  }

  await prisma.auditEvent.createMany({
    data: [
      { projectId: project.id, requirementId: r1.id, actorType: "AI", channel: "UI", action: "analysis.generated", at: daysAgo(6) },
      { projectId: project.id, requirementId: r1.id, actorType: "HUMAN", channel: "UI", action: "analysis.validated", at: minsAfter(daysAgo(6), 15) },
      { projectId: project.id, requirementId: r1.id, actorType: "HUMAN", channel: "UI", action: "artifact.corrected", at: daysAgo(5) },
      { projectId: project.id, actorType: "AI", channel: "CI", action: "run.ingested", at: daysAgo(4) },
    ],
  });

  console.log("Seed OK · proyecto:", project.slug, "· requerimientos:", 2);
}

function artifact(decisionId, framework, filePath, status, by, note) {
  return {
    decisionId, framework, filePath,
    code: `// [Beatrice · GENERADO POR IA · heuristic-v1]\n// ${filePath}\n`,
    origin: status === "CORRECTED" ? "HUMAN" : "AI",
    generatedByModel: "heuristic-v1",
    validationStatus: status, validatedByName: by, validatedAt: new Date(), correctionNote: note || null,
  };
}
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function minsAfter(date, m) { return new Date(date.getTime() + m * 60000); }

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
