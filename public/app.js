const API = "/api/tasks";

const form = document.getElementById("form-tarea");
const input = document.getElementById("input-titulo");
const lista = document.getElementById("lista");
const buscador = document.getElementById("buscador");
const mensaje = document.getElementById("mensaje");
const vacio = document.getElementById("vacio");
const vacioTitulo = document.getElementById("vacio-titulo");
const vacioTexto = document.getElementById("vacio-texto");
const pestanas = document.getElementById("pestanas");
const progresoPct = document.getElementById("progreso-pct");
const progresoDetalle = document.getElementById("progreso-detalle");
const progresoRelleno = document.getElementById("progreso-relleno");

let debounceId = null;
let estadoActivo = ""; // "" (todas) | "pendientes" | "completadas"

// SVG estático propio (nunca contiene datos del usuario)
const ICONO_ELIMINAR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';

function mostrarMensaje(texto, tipo) {
  if (!texto) {
    mensaje.hidden = true;
    mensaje.textContent = "";
    return;
  }
  mensaje.hidden = false;
  mensaje.textContent = texto;
  mensaje.className = "mensaje mensaje--" + (tipo || "info");
}

// fetch con manejo de errores: lanza Error con el mensaje del servidor
async function pedir(url, opciones) {
  const res = await fetch(url, opciones);
  let datos = null;
  try {
    datos = await res.json();
  } catch (_) {
    /* respuesta sin JSON */
  }
  if (!res.ok) {
    throw new Error((datos && datos.error) || "Error " + res.status);
  }
  return datos;
}

function construirUrl(q, estado) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);
  const cadena = params.toString();
  return cadena ? API + "?" + cadena : API;
}

async function cargar() {
  const q = buscador.value.trim();
  try {
    let todas;
    let visibles;

    if (q || estadoActivo) {
      // una petición para el progreso (sin filtros) y otra para la lista visible
      [todas, visibles] = await Promise.all([
        pedir(API),
        pedir(construirUrl(q, estadoActivo)),
      ]);
    } else {
      todas = visibles = await pedir(API);
    }

    render(visibles);
    actualizarProgreso(todas);
    mostrarEstadoVacio(visibles, q);
    mostrarMensaje("");
  } catch (err) {
    mostrarMensaje("No se pudieron cargar las tareas: " + err.message, "error");
  }
}

function actualizarProgreso(todas) {
  const total = todas.length;
  const hechas = todas.filter((t) => t.completada).length;
  const pct = total === 0 ? 0 : Math.round((hechas / total) * 100);

  progresoRelleno.style.width = pct + "%";
  progresoPct.textContent = pct + "%";
  progresoDetalle.textContent =
    total === 0 ? "Aún no hay tareas" : hechas + " de " + total + " completadas";
}

function mostrarEstadoVacio(visibles, q) {
  if (visibles.length > 0) {
    vacio.hidden = true;
    return;
  }
  vacio.hidden = false;

  if (q) {
    vacioTitulo.textContent = "Sin resultados";
    vacioTexto.textContent = "No se encontraron tareas para «" + q + "».";
  } else if (estadoActivo === "pendientes") {
    vacioTitulo.textContent = "¡Todo al día!";
    vacioTexto.textContent = "No tienes tareas pendientes.";
  } else if (estadoActivo === "completadas") {
    vacioTitulo.textContent = "Nada por aquí";
    vacioTexto.textContent = "Aún no has completado ninguna tarea.";
  } else {
    vacioTitulo.textContent = "No hay tareas todavía";
    vacioTexto.textContent = "Agrega la primera con el formulario de arriba.";
  }
}

function render(tareas) {
  lista.innerHTML = ""; // aquí no se insertan datos del usuario, solo se limpia
  const frag = document.createDocumentFragment();

  tareas.forEach((t) => {
    const li = document.createElement("li");
    li.className = t.completada ? "completada" : "";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "check";
    checkbox.checked = t.completada;
    checkbox.setAttribute(
      "aria-label",
      t.completada ? "Marcar como pendiente" : "Marcar como completada"
    );
    checkbox.addEventListener("change", async () => {
      try {
        await pedir(API + "/" + encodeURIComponent(t.id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completada: checkbox.checked }),
        });
        cargar();
      } catch (err) {
        checkbox.checked = !checkbox.checked; // revertir cambio visual
        mostrarMensaje("No se pudo actualizar: " + err.message, "error");
      }
    });

    const span = document.createElement("span");
    span.textContent = t.titulo; // textContent: inmune a XSS

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "eliminar";
    boton.title = "Eliminar";
    boton.setAttribute("aria-label", "Eliminar tarea");
    boton.innerHTML = ICONO_ELIMINAR; // cadena estática propia, sin datos del usuario
    boton.addEventListener("click", async () => {
      try {
        await pedir(API + "/" + encodeURIComponent(t.id), { method: "DELETE" });
        cargar();
      } catch (err) {
        mostrarMensaje("No se pudo eliminar: " + err.message, "error");
      }
    });

    li.append(checkbox, span, boton);
    frag.appendChild(li);
  });

  lista.appendChild(frag);
}

// pestañas de filtro: usan ?estado= de la API
pestanas.addEventListener("click", (e) => {
  const boton = e.target.closest(".pestana");
  if (!boton || boton.classList.contains("activa")) return;

  estadoActivo = boton.dataset.estado || "";
  pestanas.querySelectorAll(".pestana").forEach((b) => {
    const activa = b === boton;
    b.classList.toggle("activa", activa);
    b.setAttribute("aria-pressed", activa ? "true" : "false");
  });
  cargar();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = input.value.trim();
  if (!titulo) {
    mostrarMensaje("Escribe un título para la tarea", "error");
    return;
  }
  try {
    await pedir(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    input.value = "";
    input.focus();
    cargar();
  } catch (err) {
    mostrarMensaje("No se pudo crear la tarea: " + err.message, "error");
  }
});

buscador.addEventListener("input", () => {
  clearTimeout(debounceId);
  debounceId = setTimeout(cargar, 300);
});

cargar();
