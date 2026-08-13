import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/projects  → lista de proyectos con su cliente (para el selector multi-proyecto).
export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: [{ clientId: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, client: { select: { name: true } } },
  });
  return NextResponse.json({
    projects: projects.map((p) => ({ slug: p.slug, name: p.name, client: p.client?.name ?? "Sin cliente" })),
  });
}
