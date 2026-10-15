const API = "/api/tasks";

const form = document.getElementById("form-tarea");
const input = document.getElementById("input-titulo");
const lista = document.getElementById("lista");
const buscador = document.getElementById("buscador");
const mensaje = document.getElementById("mensaje");

let debounceId = null;

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

async function cargar(q) {
  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const url = params.toString() ? API + "?" + params.toString() : API;

    const tareas = await pedir(url);
    render(tareas);

    if (tareas.length === 0) {
      mostrarMensaje(
        q ? "Sin resultados para «" + q + "»" : "No hay tareas todavía. ¡Agrega la primera!",
        "info"
      );
    } else {
      mostrarMensaje("");
    }
  } catch (err) {
    mostrarMensaje("No se pudieron cargar las tareas: " + err.message, "error");
  }
}

function render(tareas) {
  lista.innerHTML = ""; // aqui no se insertan datos del usuario, solo se limpia
  const frag = document.createDocumentFragment();

  tareas.forEach((t) => {
    const li = document.createElement("li");
    li.className = t.completada ? "completada" : "";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = t.completada;
    checkbox.addEventListener("change", async () => {
      try {
        await pedir(API + "/" + encodeURIComponent(t.id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completada: checkbox.checked }),
        });
        cargar(buscador.value);
      } catch (err) {
        checkbox.checked = !checkbox.checked; // revertir cambio visual
        mostrarMensaje("No se pudo actualizar: " + err.message, "error");
      }
    });

    const span = document.createElement("span");
    span.textContent = t.titulo; // textContent: inmune a XSS

    const boton = document.createElement("button");
    boton.className = "eliminar";
    boton.title = "Eliminar";
    boton.textContent = "×";
    boton.addEventListener("click", async () => {
      try {
        await pedir(API + "/" + encodeURIComponent(t.id), { method: "DELETE" });
        cargar(buscador.value);
      } catch (err) {
        mostrarMensaje("No se pudo eliminar: " + err.message, "error");
      }
    });

    li.append(checkbox, span, boton);
    frag.appendChild(li);
  });

  lista.appendChild(frag);
}

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
    cargar(buscador.value);
  } catch (err) {
    mostrarMensaje("No se pudo crear la tarea: " + err.message, "error");
  }
});

buscador.addEventListener("input", () => {
  clearTimeout(debounceId);
  debounceId = setTimeout(() => cargar(buscador.value), 300);
});

cargar();
