// Beatrice · Avance de fase del ciclo ISTQB con sello de trazabilidad.
import { prisma } from "./db";

type Phase = "ANALYSIS" | "DESIGN" | "IMPLEMENTATION" | "EXECUTION" | "CLOSURE";
type Channel = "UI" | "VOICE" | "API" | "CI";

// Avanza el requerimiento a `to` sólo si aún no llegó, sellando el timestamp de la transición.
export async function advancePhase(
  requirementId: string,
  from: Phase,
  to: Phase,
  channel: Channel = "UI"
) {
  const req = await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!req) return;
  if (req.currentPhase !== from) return; // idempotente: no retrocede ni re-sella
  await prisma.$transaction([
    prisma.requirement.update({ where: { id: requirementId }, data: { currentPhase: to } }),
    prisma.phaseTransition.create({ data: { requirementId, fromPhase: from, toPhase: to, channel } }),
  ]);
}
