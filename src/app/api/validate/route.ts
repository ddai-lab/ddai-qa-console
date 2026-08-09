import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveActor, denyIfNotOperator } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Kind = "analysis" | "strategy" | "artifact";
const VALID_STATUS = ["VALIDATED", "CORRECTED", "REJECTED"] as const;

// POST /api/validate  → un humano valida / corrige / rechaza un artefacto generado por IA.
// body: { kind, id, status, note?, patch? }
//   patch (opcional, sólo con CORRECTED): campos a sobrescribir del artefacto.
export async function POST(req: Request) {
  const actor = resolveActor(req);
  const denied = denyIfNotOperator(actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const kind = body.kind as Kind;
  if (!body.id || !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: "missing id or invalid status" }, { status: 400 });
  }

  const stamp = {
    validationStatus: body.status,
    validatedById: actor.id,
    validatedByName: actor.name,
    validatedAt: new Date(),
    correctionNote: body.note || null,
    // Cuando un humano corrige, el origen del artefacto pasa a reflejar intervención humana.
    ...(body.status === "CORRECTED" ? { origin: "HUMAN" as const } : {}),
  };

  let projectId: string | null = null;
  let requirementId: string | null = null;
  let updated: any;

  if (kind === "analysis") {
    const a = await prisma.analysis.findUnique({ where: { id: body.id }, include: { requirement: true } });
    if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
    updated = await prisma.analysis.update({
      where: { id: body.id },
      data: {
        ...stamp,
        ...(body.patch?.interpretation ? { interpretation: body.patch.interpretation } : {}),
        ...(body.patch?.reasoning ? { reasoning: body.patch.reasoning } : {}),
      },
    });
    projectId = a.requirement.projectId;
    requirementId = a.requirementId;
  } else if (kind === "strategy") {
    const s = await prisma.testStrategy.findUnique({ where: { id: body.id }, include: { requirement: true } });
    if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
    updated = await prisma.testStrategy.update({
      where: { id: body.id },
      data: {
        ...stamp,
        // Validar o corregir una estrategia = aprobarla. Rechazarla la deja sin aprobar.
        approved: body.status !== "REJECTED",
        ...(body.patch?.summary ? { summary: body.patch.summary } : {}),
      },
    });
    projectId = s.requirement.projectId;
    requirementId = s.requirementId;
  } else if (kind === "artifact") {
    const art = await prisma.testArtifact.findUnique({
      where: { id: body.id },
      include: { decision: { include: { strategy: { include: { requirement: true } } } } },
    });
    if (!art) return NextResponse.json({ error: "not found" }, { status: 404 });
    updated = await prisma.testArtifact.update({
      where: { id: body.id },
      data: { ...stamp, ...(body.patch?.code ? { code: body.patch.code } : {}) },
    });
    projectId = art.decision.strategy.requirement.projectId;
    requirementId = art.decision.strategy.requirementId;
  } else {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }

  await audit({
    action: `${kind}.${body.status.toLowerCase()}`,
    actorType: "HUMAN",
    channel: body.channel || "UI",
    projectId,
    requirementId,
    payload: { by: actor.name, note: body.note || null },
  });

  return NextResponse.json({ ok: true, updated });
}
