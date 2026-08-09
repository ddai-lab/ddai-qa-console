# Beatrice · Cockpit de QA agéntico

Beatrice **no es un agente que reemplaza al QA**. Es un **cockpit** que convierte a un QA
humano tradicional en un **"QA agéntico"**: dirige modelos de IA por cada fase del ciclo de
calidad, con **criterio humano validando cada paso**. La marca de la casa: nunca hay
ambigüedad sobre *qué generó la IA, qué validó un humano y qué quedó pendiente*.

Construida sobre Next.js 14 + PostgreSQL (Prisma). Deploy en Coolify, mismo patrón que el
resto del lab.

---

## Marco de referencia

- **Ciclo ISTQB** — cada requerimiento recorre `Análisis → Diseño → Implementación → Ejecución → Cierre` de forma visible y trazable.
- **Pirámide de Cohn** — la IA decide *con criterio explícito* qué nivel de prueba aplica (unit, API, UI/E2E, performance, seguridad); nunca todo termina en E2E, y siempre muestra el porqué.

## Los 5 módulos (flujo core)

| # | Módulo | Endpoint | Qué hace |
|---|---|---|---|
| 1 | **Análisis** | `POST /api/requirements` · `POST /api/requirements/:id/analyze` | Ingresa un ticket; la IA interpreta qué toca (API/UI/datos sensibles/terceros) con su razonamiento. El humano valida/corrige. |
| 2 | **Diseño** | `POST /api/requirements/:id/strategy` | La IA propone la pirámide de Cohn con rationale por nivel. Plan editable que el QA aprueba. |
| 3 | **Implementación** | `POST /api/requirements/:id/implement` | Genera código de prueba (Playwright / k6 / Vitest) por nivel, con trazabilidad completa. |
| 4 | **Ejecución** | `POST /api/runs` (Bearer token) | CI (GitHub Actions) empuja resultados; se enlazan al artefacto que los produjo. |
| 5 | **Cierre** | `GET /api/kpis` | KPIs nativos + score de confianza por proyecto, con evolución en el tiempo. |

Validación humana transversal: `POST /api/validate` (`kind` = analysis \| strategy \| artifact;
`status` = VALIDATED \| CORRECTED \| REJECTED). Toda acción — de IA o humana, por click o voz —
queda en el log de auditoría (`AuditEvent`).

## La capa de IA es intercambiable

Hoy la implementa un **motor heurístico determinista en JS** (`src/lib/ai/heuristic.ts`,
`heuristic-v1`): liviano, sin API key, reproducible — ideal para la demo pública. Para
enchufar un LLM real basta otra implementación de `AIProvider` en `src/lib/ai/` y devolverla
en `getProvider()`. Los módulos no cambian.

## Score de confianza (auditable, no mágico)

```
score = 100 × passRate × coberturaPirámide × (0.5 + 0.5×tasaValidaciónHumana) − 10×defectosEscapadosAbiertos
```
Sin validación humana el techo es 50: la confianza requiere que un humano haya mirado. El
desglose se guarda en cada `ConfidenceSnapshot`.

## Roles

- **QA agéntico** — vista operativa: dirige el flujo, aprueba/corrige cada fase.
- **CTO** — solo visibilidad (KPIs y confianza), no opera. La arquitectura queda lista para PM/dev.

---

## Barreras de seguridad (no opcionales)

1. **Base de datos PROPIA** (`beatrice` / `beatrice_app`), nunca las credenciales de `ddai-web`.
2. **Ingesta autenticada.** `POST /api/runs` exige `Authorization: Bearer <INGEST_TOKEN>` → sin token, 401. La operación del cockpit rechaza al rol CTO (403). Lectura pública.
3. **Límite de recursos** en Coolify (CPU 0.5 / Mem 512M).

---

## Local

```bash
npm install
cp .env.example .env         # DATABASE_URL → Postgres local; INGEST_TOKEN → openssl rand -hex 32
npm run db:push
npm run seed                 # dataset de demo (flujo completo con trazabilidad y KPIs)
npm run dev                  # http://localhost:3000
```

## Deploy en Coolify

1. **DB separada:**
   ```sql
   CREATE DATABASE beatrice;
   CREATE USER beatrice_app WITH PASSWORD 'PON_UNA_PASSWORD_FUERTE';
   GRANT ALL PRIVILEGES ON DATABASE beatrice TO beatrice_app;
   ```
2. **Token:** `openssl rand -hex 32`
3. **Nueva App (Dockerfile)** con env `DATABASE_URL` e `INGEST_TOKEN`, dominio, healthcheck `/api/health`, límites CPU 0.5 / Mem 512M.
4. `git push` re-despliega.

## Conectar un proyecto de pruebas (Módulo 4)

El contrato de ingesta es **idéntico** al original, así que el workflow de `ddai-playwright-api`
sigue funcionando sin cambios:

```bash
QA_CONSOLE_URL=https://<beatrice> QA_INGEST_TOKEN=*** \
node scripts/push-results.mjs --slug playwright-api --name "Playwright API" --file results.json --playwright
```

`status` ∈ `passed | failed | skipped | flaky`. Los tests corren en GitHub Actions, no en el server.
