# QA Console · DDAI

Dashboard de resultados de pruebas del QA Lab (The QAlliance). Mismo patrón que `ddai-web`:
repo → push → deploy automático en Coolify. Pensada para vivir en el **mismo servidor**
(Hetzner CPX32) **sin exponer la web principal** y **sin costo adicional**.

---

## Qué hace

- Muestra pass rate, totales, historial de runs y suites con sus errores.
- Recibe resultados de los 6 proyectos del lab vía `POST /api/runs` (autenticado por token).
- Lectura pública (vitrina), escritura cerrada.

## Las 3 barreras de seguridad (no opcionales)

1. **Base de datos PROPIA.** La consola usa su base `qaconsole` y su usuario `qaconsole_app`,
   nunca las credenciales de `ddai-web`. Un fallo aquí no toca los datos del sitio.
2. **Ingesta autenticada.** `POST /api/runs` exige `Authorization: Bearer <INGEST_TOKEN>`.
   Sin token válido → 401. La consola pública es solo de lectura.
3. **Límite de recursos** en Coolify (abajo) para que la consola no ahogue al sitio principal.

> El vault de Obsidian va aparte y **privado** (Cloudflare Access / Tailscale). No se sirve desde aquí.

---

## Despliegue en Coolify (paso a paso)

### 1. Crear la base de datos separada
En el PostgreSQL del servidor (consola SQL de Coolify o `psql`):

```sql
CREATE DATABASE qaconsole;
CREATE USER qaconsole_app WITH PASSWORD 'PON_UNA_PASSWORD_FUERTE';
GRANT ALL PRIVILEGES ON DATABASE qaconsole TO qaconsole_app;
```
(Hardening opcional: tras el primer arranque, limitar a `SELECT, INSERT` en las tablas.)

### 2. Crear el token de ingesta
```bash
openssl rand -hex 32
```

### 3. Nueva aplicación en Coolify
- **+ New Resource → Application → desde repo Git** (conecta `mjadrianf/ddai-qa-console`).
- **Build Pack: Dockerfile** (este repo lo trae).
- **Variables de entorno:**
  - `DATABASE_URL = postgresql://qaconsole_app:PASSWORD@<host-postgres>:5432/qaconsole?schema=public`
  - `INGEST_TOKEN = <el token del paso 2>`
- **Dominio:** `lab.detrasdelalgoritmo.com` (añade el CNAME en Cloudflare como con el sitio; SSL automático).
- **Healthcheck:** `/api/health`
- **Límites (pestaña de recursos):** CPU `0.5`, Memoria `512M` — suficiente para un dashboard y evita el efecto "vecino ruidoso".

### 4. Deploy
Coolify construye, sincroniza el esquema en `qaconsole` y publica. Cada `git push` re-despliega.

---

## Conectar cada proyecto del lab (en su CI)

Tras correr los tests, empuja el `results.json` con el helper:

```bash
QA_CONSOLE_URL=https://lab.detrasdelalgoritmo.com \
QA_INGEST_TOKEN=*** \
node scripts/push-results.mjs --slug playwright-api --name "Playwright API" --file results.json --playwright
```

- `--playwright`: el archivo es el JSON reporter de Playwright (se adapta solo).
- Sin `--playwright`: el archivo cumple el **contrato normalizado**:

```json
{
  "externalId": "run-0042",
  "durationMs": 48230,
  "suites": [
    { "name": "auth/token.spec.ts",
      "tests": [{ "title": "obtiene token", "status": "passed", "durationMs": 1120 }] }
  ]
}
```
`status` ∈ `passed | failed | skipped | flaky`.

> Los tests **se ejecutan en GitHub Actions (gratis)**, no en el servidor. El server solo
> recibe y muestra el JSON: por eso el costo no sube y la caja casi ni se entera.

---

## Local (opcional)
```bash
npm install
cp .env.example .env   # apunta DATABASE_URL a un Postgres local
npm run db:push
npm run dev            # http://localhost:3000
```
