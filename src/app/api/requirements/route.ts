import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveActor, denyIfNotOperator, resolveChannel } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/requirements?slug=<project>  → lista de requerimientos del proyecto (lectura pública)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const project = slug
    ? await prisma.project.findUnique({ where: { slug } })
    : await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (!project) return NextResponse.json({ project: null, requirements: [] });

  const requirements = await prisma.requirement.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      analysis: { select: { validationStatus: true, origin: true } },
      strategy: { select: { approved: true, validationStatus: true } },
    },
  });

  return NextResponse.json({
    project: project.name,
    slug: project.slug,
    requirements,
  });
}

// POST /api/requirements  → ingresa un ticket/requerimiento (Módulo 1: Análisis, entrada)
// body: { slug, projectName?, title, description, source? }
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
  if (!body.slug || !body.title) {
    return NextResponse.json({ error: "missing slug or title" }, { status: 400 });
  }

  const channel = resolveChannel(req);
  const project = await prisma.project.upsert({
    where: { slug: body.slug },
    update: { name: body.projectName || undefined },
    create: { slug: body.slug, name: body.projectName || body.slug },
  });

  const requirement = await prisma.requirement.create({
    data: {
      projectId: project.id,
      title: body.title,
      description: body.description || "",
      source: body.source || "MANUAL",
      externalRef: body.externalRef || null,
      currentPhase: "ANALYSIS",
      transitions: { create: { fromPhase: null, toPhase: "ANALYSIS", channel } },
    },
  });

  await audit({
    action: "requirement.created",
    actorType: "HUMAN",
    channel,
    projectId: project.id,
    requirementId: requirement.id,
    payload: { title: requirement.title, source: requirement.source },
  });

  return NextResponse.json({ ok: true, requirement });
}
