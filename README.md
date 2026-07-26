# Ofertas de Empleo — Oscar Sánchez Gallardo (automático)

Web que se actualiza sola 3 veces al día con ofertas **reales** (API de Adzuna, sin
simulaciones ni scraping), 100% gratis.

## Cómo funciona
1. Un robot (GitHub Actions) llama a la API de Adzuna 3 veces al día (08:00, 14:00, 20:00 hora Madrid).
2. Guarda los resultados en `docs/ofertas.json`.
3. La web (`docs/index.html`) simplemente lee ese archivo y lo muestra.
4. Cada vez que entras en la web ves los últimos resultados guardados — sin gastar más cuota de la API.

Con esto, ~30 llamadas/día ≈ 900/mes, dentro del límite gratuito de Adzuna (~1.000/mes).

## Puesta en marcha (una sola vez, ~10 minutos)

### 1. Consigue tus claves gratuitas de Adzuna
- Ve a https://developer.adzuna.com/ → "Register" (gratis).
- Al terminar el registro te dan un `app_id` y un `app_key`. Guárdalos.

### 2. Crea el repositorio en GitHub
- En GitHub, "New repository" → nómbralo por ejemplo `oscar-ofertas-empleo`.
- Puede ser público o privado (con privado también funciona Pages, en cuentas normales de GitHub Pages puede requerir que sea público si no tienes GitHub Pro — si no estás seguro, hazlo público, no expone tus claves porque estas van como *secrets*, no en el código).
- Sube estos archivos manteniendo la misma estructura de carpetas:
  ```
  .github/workflows/actualizar-ofertas.yml
  docs/index.html
  scripts/fetch-jobs.mjs
  README.md
  ```
  (Puedes arrastrar los archivos directamente en la web de GitHub, respetando las carpetas.)

### 3. Añade tus claves como "Secrets"
- En el repo: Settings → Secrets and variables → Actions → "New repository secret".
- Crea dos secrets:
  - `ADZUNA_APP_ID` → tu app_id
  - `ADZUNA_APP_KEY` → tu app_key

### 4. Activa GitHub Pages
- Settings → Pages.
- En "Source" elige la rama `main` y la carpeta `/docs`.
- Guarda. GitHub te dará una URL tipo `https://tu-usuario.github.io/oscar-ofertas-empleo/`.

### 5. Lanza la primera búsqueda manualmente
- Ve a la pestaña "Actions" del repo → "Actualizar ofertas de empleo" → "Run workflow".
- Tarda ~30 segundos. Cuando termine, `docs/ofertas.json` ya tendrá ofertas reales
  y tu web las mostrará.

A partir de aquí, el robot se ejecuta solo 3 veces al día. No tienes que hacer nada más.

## Ajustar categorías o búsquedas
Edita el array `categorias` en `scripts/fetch-jobs.mjs` (puedes añadir, quitar o
cambiar los términos de búsqueda `what`). Cada categoría = 1 llamada a la API por
ejecución del robot.

## Límites a tener en cuenta
- Cuota gratuita de Adzuna: ~1.000 llamadas/mes. Con 10 categorías × 3 ejecuciones/día
  ≈ 900/mes, hay margen.
- Solo se muestran ofertas devueltas directamente por la API de Adzuna (reales, con
  enlace de aplicación real) — nunca se generan ni simulan ofertas.
