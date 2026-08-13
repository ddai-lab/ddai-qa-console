# CLAUDE.md — Beatrice · Cockpit de QA agéntico

> **Léeme completo antes de tocar nada.** Este archivo existe porque el diseño de Beatrice
> es más grande de lo que cabe en un prompt corto. Aquí está el contexto, las decisiones ya
> tomadas y las convenciones. El diseño-visión original vive en
> `../beatrice-prompt-claude-code.md` (la raíz de ProyectosClaudePropios); este documento es
> la **fuente de verdad operativa** y le gana al prompt cuando haya diferencias.

---

## 0. Qué es Beatrice (y qué NO es)

Beatrice **no** es un agente de IA que reemplaza al QA. Es un **cockpit** que convierte a un
QA humano tradicional en un **"QA agéntico"**: un profesional que **dirige** modelos de IA por
cada fase del ciclo de calidad, con **criterio humano validando cada paso** — no un piloto
automático ciego.

Es un proyecto de María José (arquitecta QA / Agile Coach, chilena). Es una **base demostrable
públicamente** para luego venderla a clientes; el estándar de calidad es alto.

**La marca de la casa (lo más importante de todo):** nunca hay ambigüedad sobre *qué generó la
IA, qué validó un humano y qué quedó pendiente*. Si una decisión de diseño choca con esto,
gana la trazabilidad. Nada de cajas negras: cada decisión de la IA expone su razonamiento.

### Reglas inquebrantables
1. **Trazabilidad humano-IA primero.** Cada artefacto generable lleva procedencia embebida
   (`origin` AI/HUMAN, `validationStatus`, `validatedBy…`). No sacrificar esto por estética.
2. **El humano valida cada fase.** Una fase se bloquea hasta que el humano validó la anterior.
3. **Capa de IA y de voz intercambiables.** No casar el producto a un proveedor.
4. **Español neutro chileno (tú)** en toda la UI y el contenido. NUNCA voseo argentino
   (analiza/genera/aprueba, no analizá/generá/aprobá).

---

## 1. Estado actual (roadmap del prompt: core → panel → voz)

Todo esto está **construido, verificado end-to-end contra Postgres real, y commiteado** en la
rama `beatrice`:

- **F1 · Núcleo de datos + trazabilidad** — schema Prisma completo, capa de auth/roles, auditoría.
- **F2–F4 · Módulos 1–3** — Análisis, Diseño de estrategia (pirámide de Cohn), Implementación.
- **F5 · Módulo 4 (Ejecución)** — ingesta CI reusada + `simulate-run` para la demo.
- **F6 · Módulo 5 (KPIs)** — score de confianza, KPIs nativos, baselines.
- **F7 · Panel "Jarvis"** — cockpit interactivo (`src/components/Cockpit.tsx`).
- **F8 · Voz** — Web Speech API (STT+TTS), arquitectura abierta a Whisper/ElevenLabs.

**Pendiente:** deploy con dominio (María José lo indicará). Ideas futuras: proveedor LLM real,
más roles, integración Jira/Linear/GitHub Issues para el ingreso de tickets.

---

## 2. Correr en local

```bash
./scripts/local-db.sh start   # Postgres local persistente en ~/.beatrice/pgdata (start|stop|status|reset)
npm install                   # si es primera vez
npm run db:push               # aplica el schema
npm run seed                  # dataset demo end-to-end (trazabilidad + KPIs visibles)
npm run dev                   # http://localhost:3000
```

- **Verificación rápida = `npx tsc --noEmit`** (exit 0). El `npm run build` corre `prisma
  generate` y compila; sirve, pero para iterar usa tsc.
- `.env` local (gitignored) necesita `DATABASE_URL` e `INGEST_TOKEN` (genera el token con
  `openssl rand -hex 32`). El seed y el server los toman de ahí.
- La voz corre en el navegador (Chrome/Edge) y pide permiso de micrófono la primera vez.

---

## 3. Arquitectura y mapa de archivos

Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL. Nace del andamiaje de la QA
Console (por eso el repo se llama `ddai-qa-console`; ver §9).

```
prisma/schema.prisma          # modelo de datos (§4)
prisma/seed.mjs               # dataset demo
src/lib/db.ts                 # singleton Prisma
src/lib/ai/                   # capa de IA intercambiable (§5)
  types.ts                    #   interfaz AIProvider + tipos
  heuristic.ts                #   motor determinista "heuristic-v1" (default, sin API key)
  index.ts                    #   getProvider()
src/lib/voice/                # capa de voz intercambiable (§8-voz)
  types.ts, webspeech.ts, index.ts   # getRecognizer()/getSpeaker()
src/lib/confidence.ts         # fórmula del score de confianza (§6)
src/lib/kpis.ts               # KPIs nativos (§6)
src/lib/baselines… (BaselineConfig en schema)  # supuestos de negocio por cliente
src/lib/auth.ts               # roles + resolveChannel + checkIngestToken
src/lib/audit.ts              # audit(): registra TODA acción (incl. voz)
src/lib/phases.ts             # advancePhase(): avance ISTQB con sello de trazabilidad
src/lib/normalize.ts          # adaptador Playwright JSON (reusado del andamiaje)
src/app/api/…                 # endpoints (§7)
src/components/Cockpit.tsx     # panel Jarvis (client component, todo el front interactivo)
src/app/page.tsx              # server shell que monta <Cockpit>
```

---

## 4. Modelo de datos (Prisma) — dos principios

**(a) Procedencia uniforme.** Toda entidad generable (Analysis, TestStrategy,
TestLevelDecision, TestArtifact) lleva: `origin` (AI|HUMAN), `generatedByModel`,
`validationStatus` (PENDING|VALIDATED|CORRECTED|REJECTED), `validatedById/Name`,
`validatedAt`, `correctionNote`. Corregir algo lo pasa a `origin: HUMAN`.

**(b) KPIs como consulta nativa, no cálculo improvisado.** El schema modela lo necesario para
que cada KPI salga de una query.

Entidades: `Client` → `Project` → `Requirement` (ciclo ISTQB) → `Analysis` (M1),
`TestStrategy` + `TestLevelDecision` (M2, pirámide de Cohn con `rationale`), `TestArtifact`
(M3, código Playwright/k6/Vitest), `TestRun` + `TestCaseResult` (M4, enlazado al artefacto),
`Defect` + `ConfidenceSnapshot` (M5), `PhaseTransition` (timestamps de fase),
`AuditEvent` (auditoría transversal con `channel` UI|VOICE|API|CI), `User` +
`ProjectMembership` (roles), `BaselineConfig` (supuestos de negocio).

Enums clave: `Phase` (ANALYSIS→DESIGN→IMPLEMENTATION→EXECUTION→CLOSURE),
`PyramidLevel` (UNIT/COMPONENT/INTEGRATION/API/UI_E2E/PERFORMANCE/SECURITY),
`Role` (QA_AGENTIC/CTO/PM/DEVELOPER).

---

## 5. Capa de IA (hoy: motor heurístico determinista)

`src/lib/ai/heuristic.ts` = `heuristic-v1`: **JS liviano con reglas explícitas**, sin API key,
reproducible. Decisión de María José: la demo es pública, así que la IA se implementa con
código determinista (heurísticas reales, no maqueta muerta ni dependencia de una key).

- `analyze()` — detecta áreas por keywords (API/UI/datos sensibles/terceros), riesgos, y
  devuelve **razonamiento** explícito.
- `designStrategy()` — decide niveles de la **pirámide de Cohn** con `rationale` por nivel;
  prioriza la base (unit) y usa UI/E2E solo cuando aporta.
- `implement()` — genera esqueleto de test por nivel (Playwright/k6/Vitest).

Para enchufar un LLM real (Claude u otro): implementa `AIProvider` y devuélvelo en
`getProvider()`. Los módulos no cambian.

---

## 6. Score de confianza, KPIs y baselines

**Score de confianza** (0–100, auditable, `src/lib/confidence.ts`):
```
score = 100 × passRate × coberturaPirámide × (0.5 + 0.5×tasaValidaciónHumana) − 10×defectosEscapadosAbiertos
```
Sin validación humana el techo es 50: la confianza requiere que un humano haya mirado. El
desglose se guarda en `ConfidenceSnapshot.breakdown`.

**KPIs** (`src/lib/kpis.ts`): proceso (aceptación IA, cobertura por nivel, tiempo análisis→plan),
calidad (defectos escapados, MTTD), negocio (horas QA ahorradas, costo evitado). **Baselines
best-practice** en `BaselineConfig` (por cliente): costo incidente $5.000, hora QA $40, etc.

---

## 7. El flujo (5 módulos) y endpoints

| Módulo | Endpoint | Gating |
|---|---|---|
| 1 Análisis | `POST /api/requirements` (ingresa) · `POST /api/requirements/:id/analyze` | — |
| 2 Diseño | `POST /api/requirements/:id/strategy` | requiere análisis VALIDATED/CORRECTED |
| 3 Implementación | `POST /api/requirements/:id/implement` | requiere estrategia aprobada |
| 4 Ejecución | `POST /api/runs` (CI, Bearer) · `POST /api/requirements/:id/simulate-run` (demo) | requiere artefactos |
| 5 Cierre | `GET /api/kpis?slug=` | — |
| Validación | `POST /api/validate` (kind: analysis\|strategy\|artifact; status; note) | — |
| Auditoría | `GET/POST /api/events` (incl. `voice.command` con transcript) | — |

Guardas: rol CTO → 403 en operaciones; ingesta sin token → 401. El canal (UI/VOICE) se
propaga por header `x-beatrice-channel` hasta el `AuditEvent`.

---

## 8. Comandos del cockpit (texto y voz)

`Cockpit.tsx` → `runCommand()` entiende lenguaje natural en español: crear/seleccionar
requerimientos (por nombre, primero/último/siguiente/anterior), analizar, diseñar, aprobar,
corregir, rechazar, implementar, **ejecutar pruebas**, **"haz todo el ciclo"**, reportes
hablados (confianza/KPIs/riesgos/estado), ayuda, silenciar voz, cambiar vista.

**Voz (F8):** botón 🎤 (STT) alimenta el mismo `runCommand`; Beatrice **responde hablando**
(confirma acciones, **alerta riesgos**), toggle 🔊 para silenciar. Cada comando de voz se
audita con `channel: VOICE`. Capa abierta a Whisper/ElevenLabs (implementar
`VoiceRecognizer`/`VoiceSpeaker`).

---

## 9. Convenciones de trabajo (IMPORTANTE)

- **Git:** Beatrice vive en la rama **`beatrice`**. La rama `main` de este repo es la **QA
  Console de producción** — **NUNCA hacer push de Beatrice a `main`** (main auto-despliega en
  Coolify y rompería el sitio existente). Commits directos a `beatrice`; commitear/pushear
  solo cuando María José lo pida.
- **GitHub:** el repo está en la org `ddai-lab`. Para pushear usa la cuenta gh **`mjadrianf`**
  (`gh auth switch --user mjadrianf`); `mariaa-hash` NO tiene acceso.
- **Preservar el contrato de `/api/runs`** (Bearer + Playwright raw/normalizado): es la demo
  del Módulo 4 y lo consume el workflow de `ddai-playwright-api` sin cambios.
- **No inventar secretos** ni cifras. Para un LLM real se necesitará `ANTHROPIC_API_KEY`
  (`[dato de María José]`), pero el default heurístico no requiere key.

---

## 10. Identidad visual

Paleta **azul-noche** (no negro puro) con la identidad de detrasdelalgoritmo.com: fondo con
glow superior y gradiente de marca (cian→azul→púrpura→naranja), logo con gradiente. Estética
de **centro de mando** ("Jarvis"), no de spreadsheet. Vista **QA agéntico** (opera) vs
**Métricas** (solo lectura, KPIs y confianza). Todo el texto en español neutro chileno.
