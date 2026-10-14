# Flujo de CI por instalar

Desde la sesión de desarrollo no se pueden subir archivos a `.github/workflows/` (la conexión con GitHub no tiene el
permiso `workflow`). CodeQL ya está instalado en `.github/workflows/codeql.yml`; falta el de CI:

1. En GitHub, en la rama `claude/contexto-proyecto`: **Add file → Create new file**.
2. En el nombre escribe exactamente `.github/workflows/ci.yml` (con el punto inicial: así GitHub crea las carpetas
   `.github` y `workflows`).
3. Pega el contenido de `docs/ci/ci.yml` y guarda.
4. Borra esta carpeta (`docs/ci/`) en el siguiente cambio.

`ci.yml` corre en cada pull request y en cada cambio a `main`: formato, lint, tipos, pruebas unitarias, pruebas de
punta a punta de la API con Postgres y Redis reales, build y búsqueda de secretos (gitleaks).
