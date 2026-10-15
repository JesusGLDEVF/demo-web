# demo-web — Gestor de tareas

Gestor de tareas de demostración: un proyecto pequeño pero **completo** (backend, frontend, tests y seguridad) usado para practicar un flujo de trabajo real: `rama → cambios → tests → Pull Request → merge`.

## Stack

- **Backend**: Node 22 + Express 4
- **Frontend**: HTML/CSS/JS vanilla (sin build), con modo claro/oscuro automático
- **Tests**: runner integrado de Node (`node --test`) — **27 pruebas**
- **Calidad**: `helmet`, `compression`, `express-rate-limit`

## Correr

```bash
npm install
npm start        # http://localhost:3000
npm test         # 27 pruebas
```

Variables de entorno opcionales: `PORT`, `DATA_FILE`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`.

## Features

### 📋 Gestión de tareas (CRUD)
Crear, listar, completar/editar y eliminar tareas. Validación estricta (título obligatorio, máximo 120 caracteres, IDs UUID) con mensajes de error claros.

### 🔍 Búsqueda
`?q=` busca en el título de forma **insensible a mayúsculas y acentos** ("movil" encuentra "móvil"). La interfaz la aplica con *debounce* (300 ms).

### 🗂️ Filtro por estado
`?estado=pendientes|completadas` — es lo que usan las pestañas de la interfaz.

### 📄 Paginación
`?pagina=1&limite=10` — la API responde un **sobre con metadatos** y la interfaz añade el botón **"Cargar más"**:

- `limite` por defecto 50, máximo 100; parámetros inválidos → `400`
- `stats` (total / completadas / pendientes) siempre refleja **el global** aunque haya filtros — alimenta la barra de progreso
- Página fuera de rango → lista vacía (sin error)

### 🚦 Rate limiting (límite de peticiones)
`/api` acepta **120 peticiones por minuto y por IP** (configurable con `RATE_LIMIT_MAX`):

- Al superarlo responde `429` con `{ "error": "..." }` y cabecera `Retry-After`
- Incluye cabeceras estándar `RateLimit` y `RateLimit-Policy` (draft-7)
- Protege de floods y abuso accidental; en los tests se usa un límite bajo para verificar el 429

### 🔒 Seguridad
- `helmet` (headers de seguridad), body limitado a 10 kb, sin stack traces al cliente
- XSS: el frontend renderiza con `textContent`, nunca inserta datos del usuario con `innerHTML`

### 🎨 Interfaz
Tarjeta moderna con barra de progreso animada, pestañas de filtro, búsqueda, estados vacíos contextuales, modo oscuro automático y diseño responsive. Auditada con Lighthouse: **100 / 100 / 100**.

## API

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/tasks?q=&estado=&pagina=&limite=` | Lista paginada + stats globales |
| `POST` | `/api/tasks` | Crea tarea — body: `{ "titulo": "..." }` |
| `PUT` | `/api/tasks/:id` | Actualiza — body: `{ "titulo"?, "completada"? }` |
| `DELETE` | `/api/tasks/:id` | Elimina una tarea |

Respuesta de `GET /api/tasks`:

```json
{
  "tareas": [ { "id": "…", "titulo": "…", "completada": false, "creada": "…" } ],
  "total": 12,
  "pagina": 1,
  "limite": 10,
  "totalPaginas": 2,
  "stats": { "total": 12, "completadas": 5, "pendientes": 7 }
}
```

## Estructura

| Ruta | Qué es |
|---|---|
| `app.js` | La aplicación Express (exportable, testeable) |
| `server.js` | Arranque del servidor |
| `public/` | Frontend (HTML/CSS/JS + favicon) |
| `data/tasks.json` | Persistencia JSON (caché en memoria + escritura async con debounce) |
| `tests/` | Pruebas automatizadas (API + rate limiting) |
| `demo_bugs.py` | Script de "ataques" usado durante la demo inicial |

## Deploy (Render)

El repositorio incluye un blueprint de [Render](https://render.com) (`render.yaml`): al conectar el repo se crea el servicio y **cada push a `main` despliega automáticamente**.

1. Crea una cuenta en [render.com](https://render.com) usando tu cuenta de GitHub
2. **New +** → **Blueprint** → selecciona este repositorio → **Apply**
3. En ~2 minutos tendrás tu URL pública con HTTPS

Notas del plan gratuito: la instancia se duerme tras 15 minutos sin visitas (el primer acceso del día tarda ~1 min) y `data/tasks.json` se resetea en cada deploy — suficiente para una demo; para persistencia real haría falta un disco o una base de datos.

## Flujo de trabajo

Cada mejora viaja por su propia rama y Pull Request:

```bash
git checkout -b feat/mi-mejora
# ... cambios + npm test ...
git commit -m "feat: ..."
git push -u origin feat/mi-mejora
gh pr create     # → revisión → merge → limpieza de ramas
```
