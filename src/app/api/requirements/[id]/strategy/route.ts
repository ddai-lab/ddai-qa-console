import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import type { Interpretation } from "@/lib/ai";
import { resolveActor, denyIfNotOperator, resolveChannel } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { advancePhase } from "@/lib/phases";

export const dynamic = "force-dynamic";

// POST /api/requirements/:id/strategy  → Módulo 2: la IA propone la pirámide de Cohn.
// Requiere que el Análisis esté VALIDADO/CORREGIDO (no se diseña sobre algo sin validar).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = resolveActor(req);
  const denied = denyIfNotOperator(actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const requirement = await prisma.requirement.findUnique({
    where: { id: params.id },
    include: { analysis: true },
  });
  if (!requirement) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!requirement.analysis) {
    return NextResponse.json({ error: "el requerimiento no tiene análisis todavía" }, { status: 409 });
  }
  if (!["VALIDATED", "CORRECTED"].includes(requirement.analysis.validationStatus)) {
    return NextResponse.json(
      { error: "el análisis debe estar validado por un humano antes de diseñar la estrategia" },
      { status: 409 }
    );
  }

  const provider = getProvider();
  const result = await provider.designStrategy(
    { title: requirement.title, description: requirement.description },
    {
      interpretation: requirement.analysis.interpretation as unknown as Interpretation,
      reasoning: requirement.analysis.reasoning,
    }
  );

  // Reemplaza la estrategia anterior (y sus decisiones/artefactos) si se regenera.
  await prisma.testStrategy.deleteMany({ where: { requirementId: requirement.id } });
  const strategy = await prisma.testStrategy.create({
    data: {
      requirementId: requirement.id,
      summary: result.summary,
      origin: "AI",
      generatedByModel: provider.name,
      validationStatus: "PENDING",
      decisions: {
        create: result.decisions.map((d) => ({
          level: d.level,
          rationale: d.rationale,
          priority: d.priority,
          origin: "AI",
        })),
      },
    },
    include: { decisions: { orderBy: { priority: "asc" } } },
  });

  const channel = resolveChannel(req);
  await advancePhase(requirement.id, "ANALYSIS", "DESIGN", channel);
  await audit({
    action: "strategy.generated",
    actorType: "AI",
    channel,
    projectId: requirement.projectId,
    requirementId: requirement.id,
    payload: { model: provider.name, levels: result.decisions.map((d) => d.level) },
  });

  return NextResponse.json({ ok: true, strategy });
}
