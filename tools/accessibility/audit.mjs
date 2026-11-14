// Accessibility audit of the running app (docs/11-accesibilidad.md).
//
//   docker compose up -d && docker compose run --rm backend python manage.py seed_demo
//   cd tools/accessibility && npm install && npm run audit
//
// Needs Microsoft Edge or Google Chrome installed (set BROWSER_CHANNEL=chrome for Chrome). Exits with 1 when
// any screen has a problem, so it can also run in a pipeline.
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const CHANNEL = process.env.BROWSER_CHANNEL ?? "msedge";
const OWNER = { email: "canchas@demo.pe", password: "demo12345" };

const SCREENS = [
  ["inicio", "/", false],
  ["negocio", "/canchas-los-andes", false],
  ["ingreso", "/panel/entrar", false],
  ["panel", "/panel", true],
  ["reservas", "/panel/reservas", true],
  ["reglas", "/panel/ajustes/reglas", true],
];

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
let problems = 0;

for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-PE", colorScheme: scheme });
  const page = await context.newPage();
  let signedIn = false;

  for (const [name, path, needsLogin] of SCREENS) {
    if (needsLogin && !signedIn) {
      await page.goto(`${BASE}/panel/entrar`);
      await page.getByLabel("Correo").fill(OWNER.email);
      await page.getByLabel("Contraseña", { exact: true }).fill(OWNER.password);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.waitForURL((url) => !url.pathname.endsWith("/entrar"));
      signedIn = true;
    }
    await page.goto(BASE + path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await page.addScriptTag({ path: AXE });
    const found = await page.evaluate(async () => {
      const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
    });
    problems += found.length;
    console.log(`${scheme.padEnd(5)} ${name.padEnd(9)} ${found.length === 0 ? "sin problemas" : `${found.length} problema(s)`}`);
    for (const v of found) console.log(`   [${v.impact}] ${v.id}: ${v.help}\n     ${v.targets.join("\n     ")}`);
  }
  await context.close();
}

await browser.close();
process.exit(problems === 0 ? 0 : 1);
