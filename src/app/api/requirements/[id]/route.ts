import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/requirements/:id  → detalle completo con toda la trazabilidad (lectura pública)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { slug: true, name: true } },
      analysis: true,
      strategy: { include: { decisions: { include: { artifacts: true }, orderBy: { priority: "asc" } } } },
      transitions: { orderBy: { at: "asc" } },
      defects: true,
    },
  });
  if (!requirement) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ requirement });
}
