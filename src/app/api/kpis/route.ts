import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeKpis } from "@/lib/kpis";

export const dynamic = "force-dynamic";

// GET /api/kpis?slug=<project>[&snapshot=1]  → KPIs del proyecto (lectura pública, vista CTO).
// Con snapshot=1 además persiste el score de confianza (serie temporal).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const project = slug
    ? await prisma.project.findUnique({ where: { slug } })
    : await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (!project) return NextResponse.json({ project: null, kpis: null });

  const kpis = await computeKpis(project.id);

  if (url.searchParams.get("snapshot") === "1") {
    await prisma.confidenceSnapshot.create({
      data: {
        projectId: project.id,
        score: kpis.confidence.score,
        breakdown: kpis.confidence.breakdown as any,
      },
    });
  }

  const series = await prisma.confidenceSnapshot.findMany({
    where: { projectId: project.id },
    orderBy: { computedAt: "asc" },
    take: 60,
    select: { score: true, computedAt: true },
  });

  return NextResponse.json({ project: project.name, slug: project.slug, kpis, confidenceSeries: series });
}
