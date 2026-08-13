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

  // ── 18 requerimientos más, repartidos por fase y con validaciones variadas ────
  const EXTRA = [
    // CLOSURE
    { title: "Autenticación con refresh token", areas: ["API", "SECURITY"], dataSensitive: true, phase: "CLOSURE", days: 18, accept: "clean", securityFails: false, defect: { title: "El token no expiraba al cerrar sesión" } },
    { title: "Exportar reservas a CSV", areas: ["API"], phase: "CLOSURE", days: 16, accept: "clean" },
    { title: "Auditoría de cambios de reserva", areas: ["API"], phase: "CLOSURE", days: 15, accept: "mixed", defect: { title: "Un cambio no quedaba registrado", escaped: true } },
    // EXECUTION
    { title: "Búsqueda de disponibilidad con filtros", areas: ["API"], phase: "EXECUTION", days: 12, accept: "clean" },
    { title: "Cancelación de reserva con reembolso", areas: ["API", "INTEGRATION"], thirdParties: ["Stripe (pagos)"], dataSensitive: true, phase: "EXECUTION", days: 11, accept: "mixed", securityFails: true, defect: { title: "Reembolso parcial mal calculado" } },
    { title: "Rate limiting en endpoints públicos", areas: ["API", "SECURITY", "PERFORMANCE"], phase: "EXECUTION", days: 10, accept: "clean", securityFails: true },
    { title: "Carga masiva de inventario", areas: ["API", "PERFORMANCE"], phase: "EXECUTION", days: 9, accept: "pending" },
    // IMPLEMENTATION
    { title: "Notificación por email de confirmación", areas: ["INTEGRATION"], thirdParties: ["SendGrid (email)"], phase: "IMPLEMENTATION", days: 7, accept: "mixed" },
    { title: "Webhook de pagos de Stripe", areas: ["INTEGRATION", "API"], dataSensitive: true, thirdParties: ["Stripe (pagos)"], phase: "IMPLEMENTATION", days: 6, accept: "pending" },
    { title: "Historial de reservas paginado", areas: ["API", "UI"], phase: "IMPLEMENTATION", days: 6, accept: "clean" },
    { title: "Descuentos por cupón", areas: ["API"], phase: "IMPLEMENTATION", days: 5, accept: "rejected" },
    // DESIGN
    { title: "Panel de administración de reservas", areas: ["UI"], phase: "DESIGN", days: 4, strategyPending: true },
    { title: "Recuperación de contraseña", areas: ["API", "SECURITY", "INTEGRATION"], dataSensitive: true, thirdParties: ["SendGrid (email)"], phase: "DESIGN", days: 4 },
    { title: "Login con Google", areas: ["INTEGRATION", "SECURITY"], thirdParties: ["Google APIs", "Auth0 (identidad)"], phase: "DESIGN", days: 3, strategyPending: true },
    // ANALYSIS
    { title: "Perfil de usuario editable", areas: ["UI"], dataSensitive: true, phase: "ANALYSIS", days: 3 },
    { title: "Multi-idioma en la interfaz", areas: ["UI"], phase: "ANALYSIS", days: 2, analysisPending: true },
    { title: "Validación de datos de tarjeta", areas: ["API", "SECURITY"], dataSensitive: true, phase: "ANALYSIS", days: 2 },
    { title: "Dashboard de métricas para el cliente", areas: ["UI"], phase: "ANALYSIS", days: 1, analysisPending: true },
  ];
  for (const spec of EXTRA) await makeReq(project, qa.name, spec);

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

  console.log("Seed OK · proyecto:", project.slug, "· requerimientos:", 2 + EXTRA.length);
}

// ── Generador compacto de requerimientos según su fase objetivo ────────────────
const PHASE_ORDER = ["ANALYSIS", "DESIGN", "IMPLEMENTATION", "EXECUTION", "CLOSURE"];
const slugify = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "req";
const fwFor = (l) => (l === "UNIT" || l === "COMPONENT" ? "VITEST" : l === "PERFORMANCE" ? "K6" : "PLAYWRIGHT");
const folderFor = (l) => (l === "UI_E2E" ? "e2e" : l === "SECURITY" ? "security" : l === "PERFORMANCE" ? "perf" : l === "UNIT" ? "unit" : "api");
const extFor = (l) => (l === "UNIT" ? "test.ts" : l === "PERFORMANCE" ? "load.js" : "spec.ts");

function risksFor(areas, ds) {
  const r = [];
  if (ds) r.push("Exposición de datos personales / credenciales");
  if (areas.includes("INTEGRATION")) r.push("Dependencia de servicios externos");
  if (areas.includes("PERFORMANCE")) r.push("Degradación bajo carga");
  if (areas.includes("SECURITY")) r.push("Superficie de ataque (autenticación/autorización)");
  if (areas.includes("UI")) r.push("Regresiones visuales / flujo de usuario roto");
  if (!r.length) r.push("Errores de lógica de negocio en casos límite");
  return r;
}
function levelsFor(areas, ds) {
  const L = [{ level: "UNIT", rationale: "Lógica de negocio y casos límite: base de la pirámide, barato y rápido." }];
  if (areas.includes("API") || areas.includes("INTEGRATION")) L.push({ level: areas.includes("API") ? "API" : "INTEGRATION", rationale: "Contratos y códigos de estado; terceros mockeados para estabilidad." });
  if (ds || areas.includes("SECURITY")) L.push({ level: "SECURITY", rationale: "Datos sensibles/superficie de seguridad: autenticación e inyección no son opcionales." });
  if (areas.includes("UI")) L.push({ level: "UI_E2E", rationale: "Sólo el happy-path crítico; la punta de la pirámide es cara y frágil." });
  if (areas.includes("PERFORMANCE")) L.push({ level: "PERFORMANCE", rationale: "Verificar el SLA bajo concurrencia con k6." });
  return L.map((x, i) => ({ ...x, priority: i + 1 }));
}
function artifactStatuses(accept, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (accept === "mixed") out.push(i === 1 ? "CORRECTED" : "VALIDATED");
    else if (accept === "pending") out.push(i === n - 1 ? "PENDING" : "VALIDATED");
    else if (accept === "rejected") out.push(i === n - 1 ? "REJECTED" : "VALIDATED");
    else out.push("VALIDATED");
  }
  return out;
}

async function makeReq(project, qaName, spec) {
  const tgt = PHASE_ORDER.indexOf(spec.phase);
  const created = daysAgo(spec.days);
  const trans = [{ fromPhase: null, toPhase: "ANALYSIS", at: created }];
  // Análisis→Diseño en minutos (realista); las fases siguientes, espaciadas por días.
  const stamps = [created, minsAfter(created, 20 + Math.floor(Math.random() * 30))];
  for (let i = 2; i <= tgt; i++) stamps.push(daysAgo(Math.max(0, spec.days - i)));
  for (let i = 1; i <= tgt; i++) trans.push({ fromPhase: PHASE_ORDER[i - 1], toPhase: PHASE_ORDER[i], at: stamps[i] });
  const areas = spec.areas;
  const analysisPending = spec.phase === "ANALYSIS" && spec.analysisPending;

  const req = await prisma.requirement.create({
    data: {
      projectId: project.id, title: spec.title, description: spec.desc || spec.title,
      source: "MANUAL", currentPhase: spec.phase, createdAt: created,
      transitions: { create: trans },
      analysis: { create: {
        interpretation: { areas, dataSensitive: !!spec.dataSensitive, thirdParties: spec.thirdParties || [], risks: risksFor(areas, spec.dataSensitive), summary: "Áreas a probar: " + areas.join(", ") + "." },
        reasoning: "Detecté áreas [" + areas.join(", ") + "] a partir de palabras clave del título y la descripción.",
        origin: "AI", generatedByModel: "heuristic-v1",
        validationStatus: analysisPending ? "PENDING" : "VALIDATED",
        validatedByName: analysisPending ? null : qaName,
        validatedAt: analysisPending ? null : minsAfter(created, 15),
      } },
    },
  });
  if (tgt < 1) return req;

  const levels = levelsFor(areas, spec.dataSensitive);
  const stratValidated = tgt >= 2 || !spec.strategyPending;
  const strat = await prisma.testStrategy.create({
    data: {
      requirementId: req.id, summary: "Pirámide: " + levels.map((l) => l.level).join(" → ") + ".",
      approved: stratValidated, origin: "AI", generatedByModel: "heuristic-v1",
      validationStatus: stratValidated ? "VALIDATED" : "PENDING",
      validatedByName: stratValidated ? qaName : null,
      decisions: { create: levels.map((l) => ({ level: l.level, rationale: l.rationale, priority: l.priority, origin: "AI", validationStatus: stratValidated ? "VALIDATED" : "PENDING" })) },
    },
    include: { decisions: true },
  });
  if (tgt < 2) return req;

  const statuses = artifactStatuses(spec.accept, strat.decisions.length);
  const arts = [];
  for (let i = 0; i < strat.decisions.length; i++) {
    const d = strat.decisions[i], st = statuses[i];
    const a = await prisma.testArtifact.create({
      data: artifact(d.id, fwFor(d.level), `${folderFor(d.level)}/${slugify(spec.title)}.${extFor(d.level)}`, st, st === "PENDING" ? null : qaName, st === "CORRECTED" ? "Ajuste de aserciones tras revisión." : null),
    });
    arts.push({ id: a.id, level: d.level });
  }
  if (tgt < 3) return req;

  const results = []; let passed = 0, failed = 0;
  for (const { id, level } of arts) {
    results.push({ title: `${slugify(spec.title)} · caso feliz`, status: "passed", durationMs: 120 + Math.floor(Math.random() * 300), artifactId: id }); passed++;
    if (level === "SECURITY" && spec.securityFails) { results.push({ title: `${slugify(spec.title)} · inyección`, status: "failed", durationMs: 280, error: "500 ante payload malicioso", artifactId: id }); failed++; }
    else { results.push({ title: `${slugify(spec.title)} · caso límite`, status: "passed", durationMs: 90 + Math.floor(Math.random() * 180), artifactId: id }); passed++; }
  }
  await prisma.testRun.create({
    data: {
      projectId: project.id, externalId: `run-${slugify(spec.title).slice(0, 10)}`,
      timestamp: daysAgo(Math.max(0, spec.days - 3)), durationMs: results.reduce((s, r) => s + r.durationMs, 0),
      passed, failed, skipped: 0, flaky: 0,
      suites: [{ name: spec.title, tests: results.map((r) => ({ title: r.title, status: r.status, durationMs: r.durationMs, error: r.error })) }],
      results: { create: results },
    },
  });
  if (spec.defect) {
    await prisma.defect.create({ data: { projectId: project.id, requirementId: req.id, title: spec.defect.title, phaseDetected: spec.defect.escaped ? "CLOSURE" : "EXECUTION", escapedToProd: !!spec.defect.escaped, detectedAt: daysAgo(Math.max(0, spec.days - 3)) } });
  }
  return req;
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
