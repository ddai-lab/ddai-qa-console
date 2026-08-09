import { prisma } from "@/lib/db";
import Cockpit from "@/components/Cockpit";

export const dynamic = "force-dynamic";

async function getInitial() {
  try {
    const project = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
    return { slug: project?.slug ?? null, projectName: project?.name ?? null, dbOk: true };
  } catch {
    return { slug: null, projectName: null, dbOk: false };
  }
}

export default async function Page() {
  const initial = await getInitial();
  return <Cockpit initialSlug={initial.slug} initialProjectName={initial.projectName} dbOk={initial.dbOk} />;
}
