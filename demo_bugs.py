"""Demo en vivo: explota los bugs sembrados en el proyecto de prueba."""
import json
import urllib.error
import urllib.request

BASE = "http://localhost:3000/api/tasks"


def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


print("=" * 70)
print("DEMO DE BUGS - antes de la revision")
print("=" * 70)

# 1) XSS: guardar HTML+JS como titulo
payload = {"titulo": "<img src=x onerror=\"document.title='XSS-DEMO'\">"}
st, body = req("POST", BASE, payload)
print(f"\n[1] POST con HTML/JS dentro del titulo => HTTP {st}")
print(f"    guardado como: {body[:150]}")

# 2) PUT a una tarea que no existe -> TypeError sin manejar
st, body = req("PUT", BASE + "/999999", {"titulo": "no existe"})
print(f"\n[2] PUT a tarea inexistente (id 999999) => HTTP {st}")
print(f"    respuesta (primeros 200 chars): {body[:200]!r}")

# 3) Busqueda sensible a mayusculas
_, b1 = req("GET", BASE + "?q=LOGIN")
_, b2 = req("GET", BASE + "?q=login")
n1, n2 = len(json.loads(b1)), len(json.loads(b2))
print(f"\n[3] Buscar 'LOGIN' => {n1} resultados | Buscar 'login' => {n2} resultados")

# 4) Crear tarea SIN titulo -> sin validacion
st, body = req("POST", BASE, {"otraCosa": "sin titulo"})
print(f"\n[4] POST sin campo 'titulo' => HTTP {st}")
print(f"    respuesta: {body[:150]}")

print("\n" + "=" * 70)
