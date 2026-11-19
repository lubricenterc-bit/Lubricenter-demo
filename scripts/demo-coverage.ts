// Cobertura de la muestra: cada RPC y tabla que usan las pantallas visibles debe
// tener su manejador en lib/demo. Uso: node scripts/demo-coverage.ts [--strict]
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const exts = [".tsx", ".ts", "/page.tsx", "/index.ts", "/index.tsx"];

function resolve(spec: string, from: string): string | null {
  let p: string;
  if (spec.startsWith("@/")) p = path.join(root, spec.slice(2));
  else if (spec.startsWith(".")) p = path.resolve(path.dirname(from), spec);
  else return null;
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  for (const e of exts) if (fs.existsSync(p + e)) return p + e;
  return null;
}

function walk(file: string, seen: Set<string>) {
  if (seen.has(file) || file.includes(`${path.sep}lib${path.sep}demo${path.sep}`)) return;
  seen.add(file);
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const r = resolve(m[1], file);
    if (r && /\.(ts|tsx)$/.test(r)) walk(r, seen);
  }
}

function pages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return pages(p);
    return d.name === "page.tsx" || d.name === "layout.tsx" ? [p] : [];
  });
}

// Los manejadores viven en lib/demo/rpc/<módulo>.ts como claves «nombre_rpc: (args, ctx) => …».
const handlersDir = path.join(root, "lib/demo/rpc");
const rpcHandlers = new Set(
  fs.existsSync(handlersDir)
    ? fs.readdirSync(handlersDir).filter(f => f.endsWith(".ts") && !["index.ts", "ctx.ts"].includes(f))
        .flatMap(f => [...fs.readFileSync(path.join(handlersDir, f), "utf8").matchAll(/^\s{2}([a-z0-9_]+):\s*(?:async\s*)?\(/gm)].map(m => m[1]))
    : [],
);
// RPC que se llaman con el nombre en una variable (lib/session-cache.ts).
const DYNAMIC_RPC = ["my_profile", "finance_role", "can_administer_orders"];
const tablesFile = path.join(root, "lib/demo/tables.ts");
const tableHandlers = new Set(
  fs.existsSync(tablesFile) ? [...fs.readFileSync(tablesFile, "utf8").matchAll(/^\s*"?([a-z0-9_]+)"?\s*:/gm)].map(m => m[1]) : [],
);

const missing = new Map<string, Set<string>>();
let rpcTotal = new Set<string>(DYNAMIC_RPC), tabTotal = new Set<string>();
for (const r of DYNAMIC_RPC) if (!rpcHandlers.has(r)) missing.set(`rpc ${r}`, new Set(["lib/session-cache.ts"]));
for (const page of pages(path.join(root, "app"))) {
  const src = fs.readFileSync(page, "utf8");
  if (src.includes("FullVersionOnly")) continue; // módulo fuera de la muestra
  const seen = new Set<string>();
  walk(page, seen);
  for (const f of seen) {
    const s = fs.readFileSync(f, "utf8");
    for (const m of s.matchAll(/\.rpc\(\s*['"`]([a-z0-9_]+)/g)) {
      rpcTotal.add(m[1]);
      if (!rpcHandlers.has(m[1])) (missing.get(`rpc ${m[1]}`) ?? missing.set(`rpc ${m[1]}`, new Set()).get(`rpc ${m[1]}`)!).add(path.relative(root, page));
    }
    for (const m of s.matchAll(/\.from\(\s*['"`]([a-z0-9_]+)/g)) {
      tabTotal.add(m[1]);
      if (!tableHandlers.has(m[1])) (missing.get(`tabla ${m[1]}`) ?? missing.set(`tabla ${m[1]}`, new Set()).get(`tabla ${m[1]}`)!).add(path.relative(root, page));
    }
  }
}

console.log(`RPC usadas: ${rpcTotal.size} · con manejador: ${[...rpcTotal].filter(r => rpcHandlers.has(r)).length}`);
console.log(`Tablas usadas: ${tabTotal.size} · con manejador: ${[...tabTotal].filter(t => tableHandlers.has(t)).length}`);
if (missing.size) {
  console.log(`\nSin manejador (${missing.size}):`);
  for (const [k, v] of [...missing].sort()) console.log(`  ${k}  ←  ${[...v].slice(0, 3).join(", ")}${v.size > 3 ? ` y ${v.size - 3} más` : ""}`);
}
if (strict && missing.size) process.exit(1);
