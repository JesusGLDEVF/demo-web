const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ---------- preparar un archivo de datos temporal (no toca los reales) ----------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-web-test-"));
const dataFile = path.join(tmpDir, "tasks.json");
fs.copyFileSync(path.join(__dirname, "fixtures", "tasks.json"), dataFile);
process.env.DATA_FILE = dataFile;

const app = require("../app");

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve); // puerto aleatorio libre
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await app.volcarPendiente(); // esperar escrituras pendientes antes de limpiar
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------- helper ----------
async function api(ruta, { method = "GET", body, rawBody } = {}) {
  const res = await fetch(base + ruta, {
    method,
    headers: body !== undefined || rawBody !== undefined
      ? { "Content-Type": "application/json" }
      : undefined,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    /* sin cuerpo JSON */
  }
  return { status: res.status, body: json, headers: res.headers };
}

// ---------- lectura y busqueda ----------
test("GET /api/tasks devuelve las tareas e incluye headers de seguridad", async () => {
  const { status, body, headers } = await api("/api/tasks");
  assert.equal(status, 200);
  assert.equal(body.length, 5);
  assert.equal(headers.get("x-content-type-options"), "nosniff"); // helmet activo
});

test("busqueda insensible a mayusculas", async () => {
  const { body } = await api("/api/tasks?q=LOGIN");
  assert.equal(body.length, 1);
});

test("busqueda insensible a acentos (movil encuentra movil con acento)", async () => {
  const { body } = await api("/api/tasks?q=movil");
  assert.equal(body.length, 1);
});

test("busqueda con caracteres especiales (&) no rompe la query", async () => {
  const { body } = await api("/api/tasks?q=" + encodeURIComponent("tarjeta & PayPal"));
  assert.equal(body.length, 1);
});

// ---------- filtro por estado ----------
test("?estado=completadas devuelve solo las completadas", async () => {
  const { body } = await api("/api/tasks?estado=completadas");
  assert.equal(body.length, 2);
  assert.ok(body.every((t) => t.completada === true));
});

test("?estado=pendientes devuelve solo las pendientes", async () => {
  const { body } = await api("/api/tasks?estado=pendientes");
  assert.equal(body.length, 3);
  assert.ok(body.every((t) => t.completada === false));
});

test("?estado se combina con la busqueda (q)", async () => {
  const { body } = await api("/api/tasks?estado=completadas&q=PROYECTO");
  assert.equal(body.length, 1);
  assert.equal(body[0].completada, true);
});

test("?estado con valor desconocido no filtra (devuelve todo)", async () => {
  const { body } = await api("/api/tasks?estado=loquesea");
  assert.equal(body.length, 5);
});

// ---------- creacion y validacion ----------
test("POST valido crea tarea con UUID y recorta espacios", async () => {
  const { status, body } = await api("/api/tasks", {
    method: "POST",
    body: { titulo: "   Comprar cafe con leche   " },
  });
  assert.equal(status, 201);
  assert.equal(body.titulo, "Comprar cafe con leche");
  assert.match(body.id, /^[0-9a-f-]{36}$/);
  assert.equal(body.completada, false);
});

test("POST sin titulo -> 400", async () => {
  const { status, body } = await api("/api/tasks", { method: "POST", body: {} });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test("POST con titulo vacio o solo espacios -> 400", async () => {
  const { status } = await api("/api/tasks", { method: "POST", body: { titulo: "   " } });
  assert.equal(status, 400);
});

test("POST con titulo gigante -> 400", async () => {
  const { status } = await api("/api/tasks", {
    method: "POST",
    body: { titulo: "x".repeat(500) },
  });
  assert.equal(status, 400);
});

test("POST con JSON malformado -> 400 (no 500 con stack trace)", async () => {
  const { status, body } = await api("/api/tasks", { method: "POST", rawBody: "{esto no es json" });
  assert.equal(status, 400);
  assert.ok(body.error);
});

// ---------- actualizacion ----------
test("PUT a id inexistente -> 404 JSON", async () => {
  const { status, body } = await api("/api/tasks/no-existe-123", {
    method: "PUT",
    body: { titulo: "x" },
  });
  assert.equal(status, 404);
  assert.equal(body.error, "Tarea no encontrada");
});

test("PUT cambia completada y titulo", async () => {
  const creada = (await api("/api/tasks", { method: "POST", body: { titulo: "tarea para editar" } })).body;
  const { status, body } = await api("/api/tasks/" + creada.id, {
    method: "PUT",
    body: { completada: true, titulo: "tarea editada" },
  });
  assert.equal(status, 200);
  assert.equal(body.completada, true);
  assert.equal(body.titulo, "tarea editada");
});

test("PUT con completada no booleana -> 400", async () => {
  const creada = (await api("/api/tasks", { method: "POST", body: { titulo: "otra tarea" } })).body;
  const { status } = await api("/api/tasks/" + creada.id, {
    method: "PUT",
    body: { completada: "si" },
  });
  assert.equal(status, 400);
});

// ---------- eliminacion ----------
test("DELETE inexistente -> 404; DELETE real -> desaparece", async () => {
  const fake = await api("/api/tasks/no-existe-999", { method: "DELETE" });
  assert.equal(fake.status, 404);

  const creada = (await api("/api/tasks", { method: "POST", body: { titulo: "para borrar" } })).body;
  const del = await api("/api/tasks/" + creada.id, { method: "DELETE" });
  assert.equal(del.status, 200);

  const lista = (await api("/api/tasks?q=" + encodeURIComponent("para borrar"))).body;
  assert.equal(lista.length, 0);
});

// ---------- rutas y errores ----------
test("ruta API desconocida -> 404 JSON", async () => {
  const { status, body } = await api("/api/no-existe");
  assert.equal(status, 404);
  assert.ok(body.error);
});

// ---------- concurrencia ----------
test("5 POST concurrentes: ninguno se pierde (sin condicion de carrera)", async () => {
  await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      api("/api/tasks", { method: "POST", body: { titulo: `concurrente ${i}` } })
    )
  );
  const { body } = await api("/api/tasks?q=concurrente");
  assert.equal(body.length, 5);
});

// ---------- datos peligrosos ----------
test("titulo con HTML se guarda como texto plano (el escape es del frontend)", async () => {
  const { status, body } = await api("/api/tasks", {
    method: "POST",
    body: { titulo: "<b>negrita</b>" },
  });
  assert.equal(status, 201);
  assert.equal(body.titulo, "<b>negrita</b>");
});
