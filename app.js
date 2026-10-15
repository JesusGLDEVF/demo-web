const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const helmet = require("helmet");
const compression = require("compression");

const app = express();
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data", "tasks.json");
const MAX_TITULO = 120;

app.use(helmet());
app.use(compression({ threshold: 512 }));
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- estado en memoria (sin I/O por request) ----------
let tareas = null;
let guardadoPendiente = null;

async function cargarTareas() {
  if (tareas) return tareas;
  const raw = await fs.readFile(DATA_FILE, "utf8");
  tareas = JSON.parse(raw).map((t) => ({ ...t, id: String(t.id) }));
  return tareas;
}

// debounce: varias mutaciones seguidas = una sola escritura en disco
function programarGuardado() {
  if (guardadoPendiente) clearTimeout(guardadoPendiente);
  guardadoPendiente = setTimeout(async () => {
    guardadoPendiente = null;
    if (!tareas) return;
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(tareas, null, 2));
    } catch (err) {
      console.error("Error al guardar tareas:", err);
    }
  }, 80);
}

// vuelca escrituras pendientes (se usa en SIGINT y en los tests)
async function volcarPendiente() {
  if (!guardadoPendiente || !tareas) return;
  clearTimeout(guardadoPendiente);
  guardadoPendiente = null;
  await fs.writeFile(DATA_FILE, JSON.stringify(tareas, null, 2));
}

// vuelca escrituras pendientes al salir (Ctrl+C)
process.on("SIGINT", async () => {
  await volcarPendiente();
  process.exit(0);
});

// ---------- validacion ----------
function validarTitulo(valor) {
  if (typeof valor !== "string") {
    return { error: "'titulo' debe ser un texto" };
  }
  const limpio = valor.trim();
  if (limpio.length === 0) {
    return { error: "'titulo' no puede estar vacio" };
  }
  if (limpio.length > MAX_TITULO) {
    return { error: `'titulo' supera el maximo de ${MAX_TITULO} caracteres` };
  }
  return { valor: limpio };
}

// busqueda insensible a mayusculas y acentos ("movil" encuentra "móvil")
function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

// ---------- rutas API ----------
app.get("/api/tasks", async (req, res, next) => {
  try {
    const lista = await cargarTareas();
    const q = (req.query.q || "").toString().trim();
    if (!q) return res.json(lista);
    const objetivo = normalizar(q);
    res.json(lista.filter((t) => normalizar(t.titulo).includes(objetivo)));
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    const { valor, error } = validarTitulo(req.body?.titulo);
    if (error) return res.status(400).json({ error });

    const lista = await cargarTareas();
    const nueva = {
      id: crypto.randomUUID(),
      titulo: valor,
      completada: false,
      creada: new Date().toISOString(),
    };
    lista.push(nueva);
    programarGuardado();
    res.status(201).json(nueva);
  } catch (err) {
    next(err);
  }
});

app.put("/api/tasks/:id", async (req, res, next) => {
  try {
    const lista = await cargarTareas();
    const tarea = lista.find((t) => t.id === req.params.id);
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

    if (req.body?.titulo !== undefined) {
      const { valor, error } = validarTitulo(req.body.titulo);
      if (error) return res.status(400).json({ error });
      tarea.titulo = valor;
    }

    if (req.body?.completada !== undefined) {
      if (typeof req.body.completada !== "boolean") {
        return res.status(400).json({ error: "'completada' debe ser true o false" });
      }
      tarea.completada = req.body.completada;
    }

    programarGuardado();
    res.json(tarea);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const lista = await cargarTareas();
    const idx = lista.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Tarea no encontrada" });

    const [eliminada] = lista.splice(idx, 1);
    programarGuardado();
    res.json({ ok: true, eliminada });
  } catch (err) {
    next(err);
  }
});

// 404 solo para rutas /api
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// manejador central de errores: nunca filtra stack traces al cliente
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.statusCode || err.status || 500;
  if (status >= 500) console.error("Error interno:", err);
  const mensaje =
    status === 413 ? "Cuerpo demasiado grande" :
    status === 400 ? "JSON invalido" :
    status >= 500 ? "Error interno del servidor" : "Solicitud invalida";
  res.status(status).json({ error: mensaje });
});

module.exports = app;
module.exports.volcarPendiente = volcarPendiente;
