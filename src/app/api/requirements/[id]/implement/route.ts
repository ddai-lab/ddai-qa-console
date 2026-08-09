import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import type { LevelDecision } from "@/lib/ai";
import { resolveActor, denyIfNotOperator, resolveChannel } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { advancePhase } from "@/lib/phases";

export const dynamic = "force-dynamic";

// POST /api/requirements/:id/implement  → Módulo 3: genera código de prueba por cada nivel.
// Requiere que la estrategia esté APROBADA por el humano.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = resolveActor(req);
  const denied = denyIfNotOperator(actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const requirement = await prisma.requirement.findUnique({
    where: { id: params.id },
    include: { strategy: { include: { decisions: true } } },
  });
  if (!requirement) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!requirement.strategy) {
    return NextResponse.json({ error: "el requerimiento no tiene estrategia todavía" }, { status: 409 });
  }
  if (!requirement.strategy.approved) {
    return NextResponse.json(
      { error: "la estrategia debe estar aprobada por un humano antes de implementar" },
      { status: 409 }
    );
  }

  const provider = getProvider();
  const created: any[] = [];

  for (const decision of requirement.strategy.decisions) {
    // No regenerar artefactos ya existentes para esa decisión.
    const exists = await prisma.testArtifact.count({ where: { decisionId: decision.id } });
    if (exists > 0) continue;

    const artifact = await provider.implement(
      { title: requirement.title, description: requirement.description },
      { level: decision.level, rationale: decision.rationale, priority: decision.priority } as LevelDecision
    );

    const saved = await prisma.testArtifact.create({
      data: {
        decisionId: decision.id,
        framework: artifact.framework,
        filePath: artifact.filePath,
        code: artifact.code,
        origin: "AI",
        generatedByModel: provider.name,
        validationStatus: "PENDING",
        // En la demo, el "ticket en el sistema de gestión" es una referencia a GitHub Issue.
        externalTicketRef: null,
      },
    });
    created.push(saved);
  }

  const channel = resolveChannel(req);
  await advancePhase(requirement.id, "DESIGN", "IMPLEMENTATION", channel);
  await audit({
    action: "artifacts.generated",
    actorType: "AI",
    channel,
    projectId: requirement.projectId,
    requirementId: requirement.id,
    payload: { model: provider.name, count: created.length },
  });

  return NextResponse.json({ ok: true, artifacts: created });
}
