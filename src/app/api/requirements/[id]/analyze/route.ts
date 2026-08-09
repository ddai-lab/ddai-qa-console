import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import { resolveActor, denyIfNotOperator } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/requirements/:id/analyze  → Módulo 1: la IA interpreta el ticket.
// Deja el análisis en estado PENDING para que el humano lo valide/corrija.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = resolveActor(req);
  const denied = denyIfNotOperator(actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const requirement = await prisma.requirement.findUnique({ where: { id: params.id } });
  if (!requirement) return NextResponse.json({ error: "not found" }, { status: 404 });

  const provider = getProvider();
  const result = await provider.analyze({
    title: requirement.title,
    description: requirement.description,
  });

  const analysis = await prisma.analysis.upsert({
    where: { requirementId: requirement.id },
    update: {
      interpretation: result.interpretation as any,
      reasoning: result.reasoning,
      origin: "AI",
      generatedByModel: provider.name,
      validationStatus: "PENDING",
      validatedById: null,
      validatedByName: null,
      validatedAt: null,
      correctionNote: null,
    },
    create: {
      requirementId: requirement.id,
      interpretation: result.interpretation as any,
      reasoning: result.reasoning,
      origin: "AI",
      generatedByModel: provider.name,
    },
  });

  await audit({
    action: "analysis.generated",
    actorType: "AI",
    projectId: requirement.projectId,
    requirementId: requirement.id,
    payload: { model: provider.name, areas: result.interpretation.areas },
  });

  return NextResponse.json({ ok: true, analysis });
}
