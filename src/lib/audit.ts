// Beatrice · Auditoría transversal.
// TODA acción del cockpit (humana o de IA, por click o por voz) pasa por aquí.
// La trazabilidad no se pierde por usar voz: el canal queda registrado.

import { prisma } from "./db";

type Channel = "UI" | "VOICE" | "API" | "CI";
type ActorType = "AI" | "HUMAN";

export interface AuditInput {
  action: string; // ej "analysis.generated", "strategy.approved", "voice.command"
  actorType: ActorType;
  channel?: Channel;
  projectId?: string | null;
  requirementId?: string | null;
  actorId?: string | null;
  payload?: unknown;
}

export async function audit(e: AuditInput) {
  return prisma.auditEvent.create({
    data: {
      action: e.action,
      actorType: e.actorType,
      channel: e.channel ?? "UI",
      projectId: e.projectId ?? null,
      requirementId: e.requirementId ?? null,
      actorId: e.actorId ?? null,
      payload: (e.payload as any) ?? undefined,
    },
  });
}
