// Beatrice · Autenticación y permisos (base, extensible).
//
// Dos planos, como pide el diseño:
//  1) Ingesta de CI (POST /api/runs): cerrada con Bearer <INGEST_TOKEN> — igual que el original.
//  2) Operación del cockpit (analizar, diseñar, implementar, validar): acción de un QA humano.
//     Para la demo resolvemos el actor desde un header simple; la arquitectura queda lista para
//     enchufar sesiones reales sin tocar los módulos.
//
//  Regla de rol: el CTO tiene SOLO visibilidad (KPIs y confianza), nunca opera el flujo.

export type Role = "QA_AGENTIC" | "CTO" | "PM" | "DEVELOPER";

export interface Actor {
  id: string | null;
  name: string;
  role: Role;
}

// ── Ingesta de CI ────────────────────────────────────────────────────────────
export function checkIngestToken(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return !!process.env.INGEST_TOKEN && token === process.env.INGEST_TOKEN;
}

// ── Operación del cockpit ─────────────────────────────────────────────────────
// Demo: el header `x-beatrice-actor` trae "nombre|ROL". Sin header → QA por defecto.
export function resolveActor(req: Request): Actor {
  const raw = req.headers.get("x-beatrice-actor");
  if (raw) {
    const [name, role] = raw.split("|");
    return { id: null, name: name || "QA", role: (role as Role) || "QA_AGENTIC" };
  }
  return { id: null, name: "QA (demo)", role: "QA_AGENTIC" };
}

const OPERATORS: Role[] = ["QA_AGENTIC", "PM", "DEVELOPER"];

// Devuelve un mensaje de error si el actor NO puede operar; null si puede.
export function denyIfNotOperator(actor: Actor): string | null {
  if (!OPERATORS.includes(actor.role)) {
    return `El rol ${actor.role} sólo tiene visibilidad; no puede operar el flujo.`;
  }
  return null;
}
