const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ---------- preparar datos temporales igual que en api.test.js ----------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-web-rl-"));
const dataFile = path.join(tmpDir, "tasks.json");
fs.copyFileSync(path.join(__dirname, "fixtures", "tasks.json"), dataFile);
process.env.DATA_FILE = dataFile;

// limite bajo para poder verificar el 429 (debe fijarse ANTES de cargar la app)
process.env.RATE_LIMIT_MAX = "3";

const app = require("../app");

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await app.volcarPendiente();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("rate limiting: al superar el limite responde 429 con JSON y cabeceras estandar", async () => {
  const estados = [];
  let cuerpo429 = null;

  for (let i = 0; i < 5; i++) {
    const res = await fetch(base + "/api/tasks");
    estados.push(res.status);

    if (i === 0) {
      // cabeceras draft-7 (formato combinado): RateLimit + RateLimit-Policy
      assert.equal(res.headers.get("ratelimit-policy"), "3;w=60");
      assert.equal(res.headers.get("ratelimit"), "limit=3, remaining=2, reset=60");
    }

    if (res.status === 429) {
      cuerpo429 = await res.json();
      assert.ok(res.headers.get("retry-after"), "el 429 incluye Retry-After");
    }
  }

  // las 3 primeras pasan; la 4a y 5a son rechazadas
  assert.deepEqual(estados, [200, 200, 200, 429, 429]);
  assert.ok(cuerpo429 && cuerpo429.error, "el 429 trae un mensaje JSON de error");
});
