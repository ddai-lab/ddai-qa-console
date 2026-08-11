import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveActor, denyIfNotOperator, resolveChannel } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { advancePhase } from "@/lib/phases";

export const dynamic = "force-dynamic";

// POST /api/requirements/:id/simulate-run  → Módulo 4 (demo): simula una corrida de pruebas
// sobre los artefactos del requerimiento y enlaza los resultados. En producción esto llega
// del CI vía POST /api/runs; aquí es para poder demostrar el ciclo completo sin pipeline.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = resolveActor(req);
  const denied = denyIfNotOperator(actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const requirement = await prisma.requirement.findUnique({
    where: { id: params.id },
    include: { strategy: { include: { decisions: { include: { artifacts: true } } } } },
  });
  if (!requirement) return NextResponse.json({ error: "not found" }, { status: 404 });

  const artifacts = (requirement.strategy?.decisions || []).flatMap((d) =>
    d.artifacts.map((a) => ({ ...a, level: d.level }))
  );
  if (artifacts.length === 0) {
    return NextResponse.json({ error: "genera el código (implementa) antes de ejecutar" }, { status: 409 });
  }

  // Resultados deterministas: casi todo pasa; una prueba de seguridad falla para que sea realista.
  const results: { title: string; status: "passed" | "failed"; durationMs: number; error?: string; artifactId: string }[] = [];
  for (const a of artifacts) {
    const base = a.filePath.split("/").pop() || a.filePath;
    results.push({ title: `${base} · caso feliz`, status: "passed", durationMs: 120 + Math.floor(Math.random() * 400), artifactId: a.id });
    if (a.level === "SECURITY") {
      results.push({ title: `${base} · inyección`, status: "failed", durationMs: 300, error: "500 ante payload malicioso", artifactId: a.id });
    } else {
      results.push({ title: `${base} · caso límite`, status: "passed", durationMs: 90 + Math.floor(Math.random() * 200), artifactId: a.id });
    }
  }
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.length - passed;

  const run = await prisma.testRun.create({
    data: {
      projectId: requirement.projectId,
      externalId: `sim-${Date.now()}`,
      durationMs: results.reduce((s, r) => s + r.durationMs, 0),
      passed, failed, skipped: 0, flaky: 0,
      suites: [{ name: requirement.title, tests: results.map((r) => ({ title: r.title, status: r.status, durationMs: r.durationMs, error: r.error })) }] as any,
      results: { create: results.map((r) => ({ title: r.title, status: r.status, durationMs: r.durationMs, error: r.error || null, artifactId: r.artifactId })) },
    },
  });

  const channel = resolveChannel(req);
  await advancePhase(requirement.id, "IMPLEMENTATION", "EXECUTION", channel);
  await audit({
    action: "run.simulated", actorType: "AI", channel,
    projectId: requirement.projectId, requirementId: requirement.id,
    payload: { runId: run.id, passed, failed },
  });

  return NextResponse.json({ ok: true, runId: run.id, passed, failed, total: results.length });
}
