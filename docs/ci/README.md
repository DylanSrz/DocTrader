# Flujos de GitHub Actions por instalar

Desde la sesión de desarrollo no se pueden subir archivos a `.github/workflows/` (la conexión con GitHub no tiene el
permiso `workflow`). Estos dos flujos están listos; hay que copiarlos una vez a mano:

1. En GitHub, abrir el repositorio en la rama donde se quieran activar.
2. **Add file → Create new file**, con el nombre `.github/workflows/ci.yml`, y pegar el contenido de `ci.yml`.
3. Repetir con `.github/workflows/codeql.yml`.
4. Borrar esta carpeta (`docs/ci/`) en el siguiente cambio.

| Archivo | Qué hace |
|---|---|
| `ci.yml` | En cada pull request y en cada cambio a `main`: formato, lint, tipos, pruebas unitarias, pruebas de punta a punta de la API con Postgres y Redis reales, build y búsqueda de secretos (gitleaks) |
| `codeql.yml` | Análisis de seguridad del código (CodeQL) en cada pull request y cada lunes |

Dependabot (`.github/dependabot.yml`) ya está activo: no es un flujo de Actions.
