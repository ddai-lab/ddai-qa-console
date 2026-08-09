import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tally, adaptPlaywright, type SuiteT, type Payload } from "@/lib/normalize";
import { checkIngestToken } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/runs?slug=playwright-api  -> últimos runs (lectura pública)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const project = slug
    ? await prisma.project.findUnique({ where: { slug } })
    : await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (!project) return NextResponse.json({ project: null, runs: [] });

  const runs = await prisma.testRun.findMany({
    where: { projectId: project.id },
    orderBy: { timestamp: "desc" },
    take: 15,
  });
  return NextResponse.json({
    project: project.name,
    slug: project.slug,
    runs: runs.map((r) => ({
      id: r.externalId, timestamp: r.timestamp, durationMs: r.durationMs,
      suites: r.suites,
    })),
  });
}

// POST /api/runs  -> Módulo 4 (Ejecución). Ingesta autenticada desde CI (GitHub Actions).
// Header: Authorization: Bearer <INGEST_TOKEN>.  CONTRATO IDÉNTICO al original — no romper.
export async function POST(req: Request) {
  if (!checkIngestToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  // Acepta contrato normalizado { project, slug, run:{...} } o Playwright crudo
  let slug: string, name: string, run: any;
  const pw = adaptPlaywright(body);
  if (pw) {
    slug = body.config?.metadata?.slug || "playwright";
    name = body.config?.metadata?.project || "Playwright run";
    run = { externalId: `pw-${Date.now()}`, durationMs: body.stats?.duration || 0, suites: pw };
  } else {
    const p = body as Payload;
    if (!p.slug || !p.run?.suites) {
      return NextResponse.json({ error: "missing slug or run.suites" }, { status: 400 });
    }
    slug = p.slug; name = p.project || p.slug; run = p.run;
  }

  const suites: SuiteT[] = run.suites;
  const flatTests = suites.flatMap((s) => s.tests);
  const t = tally(flatTests);

  const project = await prisma.project.upsert({
    where: { slug }, update: { name }, create: { slug, name },
  });

  // Intento de enlace trazable: casar cada resultado con el artefacto que lo produjo (por título).
  const artifacts = await prisma.testArtifact.findMany({
    where: { decision: { strategy: { requirement: { projectId: project.id } } } },
    select: { id: true, filePath: true },
  });

  const saved = await prisma.testRun.create({
    data: {
      externalId: run.externalId || `run-${Date.now()}`,
      projectId: project.id,
      timestamp: run.timestamp ? new Date(run.timestamp) : new Date(),
      durationMs: run.durationMs || 0,
      passed: t.passed, failed: t.failed, skipped: t.skipped, flaky: t.flaky,
      suites: suites as any,
      results: {
        create: flatTests.map((test) => ({
          title: test.title,
          status: test.status,
          durationMs: test.durationMs || 0,
          error: test.error || null,
          artifactId: matchArtifact(artifacts, test.title),
        })),
      },
    },
  });

  await audit({
    action: "run.ingested",
    actorType: "AI",
    channel: "CI",
    projectId: project.id,
    payload: { externalId: saved.externalId, tally: t },
  });

  return NextResponse.json({ ok: true, id: saved.id, tally: t });
}

// Enlaza por coincidencia laxa de título con el nombre de archivo del artefacto.
function matchArtifact(
  artifacts: { id: string; filePath: string }[],
  title: string
): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = norm(title);
  const hit = artifacts.find((a) => t.includes(norm(a.filePath.split("/").pop()?.replace(/\.\w+$/, "") || "")));
  return hit?.id ?? null;
}
