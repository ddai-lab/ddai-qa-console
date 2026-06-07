#!/usr/bin/env node
/**
 * push-results.mjs · empuja resultados a la QA Console.
 * Uso en CI (tras correr los tests):
 *   QA_CONSOLE_URL=https://lab.detrasdelalgoritmo.com \
 *   QA_INGEST_TOKEN=*** \
 *   node push-results.mjs --slug playwright-api --name "Playwright API" --file results.json --playwright
 *
 * Sin --playwright, --file debe cumplir el contrato normalizado:
 *   { externalId, durationMs, suites: [{ name, tests:[{title,status,durationMs,error}] }] }
 */
import fs from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith("--") ? next : true]);
    }
    return acc;
  }, [])
);

const URL_BASE = process.env.QA_CONSOLE_URL;
const TOKEN = process.env.QA_INGEST_TOKEN;
if (!URL_BASE || !TOKEN) { console.error("Falta QA_CONSOLE_URL o QA_INGEST_TOKEN"); process.exit(1); }
if (!args.file) { console.error("Falta --file <results.json>"); process.exit(1); }

const raw = JSON.parse(fs.readFileSync(args.file, "utf8"));

let body;
if (args.playwright) {
  // Inyecta metadata para que el endpoint lo asocie al proyecto correcto
  raw.config = raw.config || {};
  raw.config.metadata = { ...(raw.config.metadata || {}), slug: args.slug, project: args.name || args.slug };
  body = raw;
} else {
  body = { project: args.name || args.slug, slug: args.slug, run: raw };
}

const res = await fetch(`${URL_BASE.replace(/\/$/, "")}/api/runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify(body),
});

const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error("Error:", res.status, out); process.exit(1); }
console.log("OK ->", out);
