# demo-web — Gestor de tareas

Proyecto de prueba para demostrar un flujo de trabajo completo:
crear codigo con bugs tipicos -> revisarlos con evidencia -> corregirlos -> verificarlos con tests.

## Stack

- Backend: Node 22 + Express 4
- Frontend: HTML/CSS/JS vanilla (sin build)
- Tests: runner integrado de Node (`node --test`, sin dependencias extra)

## Correr

```bash
npm install
npm start        # http://localhost:3000
```

## Tests

```bash
npm test
```

Cubren: validacion de entrada, busqueda (mayusculas/acentos/caracteres
especiales), errores 404/400, concurrencia sin perdida de datos y headers de seguridad.

## Estructura

| Ruta | Que es |
|---|---|
| `app.js` | La aplicacion Express (exportable, testeable) |
| `server.js` | Arranque del servidor |
| `public/` | Frontend (HTML/CSS/JS) |
| `data/tasks.json` | Persistencia (JSON, cache en memoria + escritura async con debounce) |
| `tests/` | Pruebas automatizadas |
| `demo_bugs.py` | Script de "ataques" usado durante la demo (antes/despues) |

## Medidas de seguridad aplicadas

- XSS: el frontend renderiza con `textContent`, nunca `innerHTML` con datos del usuario
- Validacion de entrada con mensajes 400 claros
- Sin stack traces al cliente (middleware central de errores)
- `helmet` (headers de seguridad) + limite de body 10kb
- IDs UUID (sin colisiones)
