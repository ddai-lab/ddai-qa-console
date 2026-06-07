import QAConsole from "@/components/QAConsole";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getModel() {
  try {
    const project = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
    if (!project) return { project: "QA Lab · sin datos", runs: [] };
    const runs = await prisma.run.findMany({
      where: { projectId: project.id },
      orderBy: { timestamp: "desc" },
      take: 15,
    });
    return {
      project: project.name,
      slug: project.slug,
      runs: runs.map((r) => ({
        id: r.externalId,
        timestamp: r.timestamp.toISOString(),
        durationMs: r.durationMs,
        suites: r.suites as any,
      })),
    };
  } catch {
    return { project: "QA Lab · DB no conectada", runs: [] };
  }
}

export default async function Page() {
  const model = await getModel();
  return <QAConsole initial={model} />;
}
