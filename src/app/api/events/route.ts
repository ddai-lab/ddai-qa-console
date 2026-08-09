import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { resolveActor, resolveChannel } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/events?slug=<project>  → línea de tiempo de auditoría (lectura pública).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const project = slug ? await prisma.project.findUnique({ where: { slug } }) : null;
  const events = await prisma.auditEvent.findMany({
    where: project ? { projectId: project.id } : {},
    orderBy: { at: "desc" },
    take: 40,
    select: { id: true, action: true, actorType: true, channel: true, at: true, payload: true, requirementId: true },
  });
  return NextResponse.json({ events });
}

// POST /api/events  → registra un evento (ej. un comando de voz con su transcript).
// La trazabilidad no se pierde por usar voz: queda igual que un clic.
export async function POST(req: Request) {
  const actor = resolveActor(req);
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const project = body.slug ? await prisma.project.findUnique({ where: { slug: body.slug } }) : null;
  const ev = await audit({
    action: body.action || "voice.command",
    actorType: "HUMAN",
    channel: resolveChannel(req),
    projectId: project?.id ?? null,
    requirementId: body.requirementId ?? null,
    payload: { by: actor.name, transcript: body.transcript ?? null, ...(body.payload || {}) },
  });
  return NextResponse.json({ ok: true, id: ev.id });
}
