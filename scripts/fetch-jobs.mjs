// Consulta la API real de Adzuna (https://developer.adzuna.com/) y Jooble (https://jooble.org/api/about)
// y genera docs/ofertas.json. Solo ofertas reales devueltas por las APIs - nada simulado ni inventado.

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
const JOOBLE_API_KEY = process.env.JOOBLE_API_KEY;
const COUNTRY = "es";
const WHERE = "Madrid";
const MAX_DAYS_OLD = 10;
const RESULTS_PER_PAGE = 6;

if (!APP_ID || !APP_KEY) {
  console.error("Faltan ADZUNA_APP_ID / ADZUNA_APP_KEY como variables de entorno (secrets).");
  process.exit(1);
}
if (!JOOBLE_API_KEY) {
  console.error("Falta JOOBLE_API_KEY como variable de entorno (secret). Se continuará solo con Adzuna.");
}

// --- Utilidades de filtrado (para descartar ofertas fuera de ubicación o sin relación con el puesto) ---

function normalizar(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos
}

function esUbicacionValida(location) {
  const loc = normalizar(location);
  return loc.includes("madrid") || loc.includes("espana") || loc.includes("spain");
}

// Palabras "stopword" que no aportan para comprobar relevancia del título
const STOPWORDS = new Set(["de", "la", "el", "en", "y", "a", "para"]);

function esTituloRelevante(cat, title, description) {
  const texto = normalizar(`${title} ${description}`);
  const palabrasClave = normalizar(cat.what)
    .split(" ")
    .filter((p) => p.length > 2 && !STOPWORDS.has(p));
  if (palabrasClave.length === 0) return true;
  // Deben aparecer TODAS las palabras clave del puesto buscado (evita falsos positivos como
  // "Sales Manager" colándose en una búsqueda de "Supply Chain Manager")
  return palabrasClave.every((p) => texto.includes(p));
}

// Categorías priorizadas de Oscar (11 búsquedas x 3 ejecuciones/día ≈ 990 llamadas/mes,
// dentro de la cuota gratuita de Adzuna ~1000/mes)
const categorias = [
  { id: 1, name: "Demand Planning Manager", what: "demand planning" },
  { id: 2, name: "Supply Chain Manager", what: "supply chain manager" },
  { id: 3, name: "Responsable de Logística", what: "responsable logistica" },
  { id: 5, name: "Supply Chain Coordinator", what: "supply chain coordinator" },
  { id: 7, name: "Responsable de Compras", what: "responsable compras" },
  { id: 14, name: "Inventory Planning Specialist", what: "inventory planner" },
  { id: 20, name: "Data Analyst Supply Chain", what: "data analyst supply chain" },
  { id: 21, name: "Demand Planner", what: "demand planner" },
  { id: 22, name: "Planificador de Demanda", what: "planificador de demanda" },
  { id: 23, name: "Supply Chain Specialist", what: "supply chain specialist" },
  { id: 24, name: "Especialista Supply Chain", what: "especialista supply chain" },
];

async function buscarCategoria(cat) {
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/1`);
  url.searchParams.set("app_id", APP_ID);
  url.searchParams.set("app_key", APP_KEY);
  url.searchParams.set("what", cat.what);
  url.searchParams.set("where", WHERE);
  url.searchParams.set("max_days_old", String(MAX_DAYS_OLD));
  url.searchParams.set("results_per_page", String(RESULTS_PER_PAGE));
  url.searchParams.set("sort_by", "date");
  url.searchParams.set("content-type", "application/json");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error(`Adzuna error [${cat.name}]: ${res.status}`);
    return { ofertas: [], debug: { fuente: "Adzuna", status: res.status, count: 0, error: bodyText.slice(0, 200) } };
  }
  const data = await res.json();
  const ofertas = (data.results || [])
    .map((o) => ({
      cat: cat.id,
      catName: cat.name,
      fuente: "Adzuna",
      title: o.title?.replace(/<[^>]+>/g, "") ?? "",
      company: o.company?.display_name ?? "Empresa no especificada",
      location: o.location?.display_name ?? WHERE,
      created: o.created,
      description: (o.description ?? "").replace(/<[^>]+>/g, "").slice(0, 220) + "…",
      url: o.redirect_url,
      salaryMin: o.salary_min ?? null,
      salaryMax: o.salary_max ?? null,
    }))
    .filter((o) => esUbicacionValida(o.location) && esTituloRelevante(cat, o.title, o.description));
  return { ofertas, debug: { fuente: "Adzuna", status: res.status, count: data.count ?? null, returned: ofertas.length } };
}

async function buscarJoobleCategoria(cat) {
  if (!JOOBLE_API_KEY) return { ofertas: [], debug: { fuente: "Jooble", skipped: true } };

  const res = await fetch(`https://jooble.org/api/${JOOBLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keywords: cat.what,
      location: "Madrid, España",
      radius: "40",
      page: "1",
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error(`Jooble error [${cat.name}]: ${res.status}`);
    return { ofertas: [], debug: { fuente: "Jooble", status: res.status, count: 0, error: bodyText.slice(0, 200) } };
  }
  const data = await res.json();
  const jobsCrudos = data.jobs || [];
  const ofertas = jobsCrudos
    .map((o) => ({
      cat: cat.id,
      catName: cat.name,
      fuente: "Jooble",
      title: (o.title ?? "").replace(/<[^>]+>/g, ""),
      company: o.company || "Empresa no especificada",
      location: o.location || WHERE,
      created: o.updated || null,
      description: (o.snippet ?? "").replace(/<[^>]+>/g, "").slice(0, 220) + "…",
      url: o.link,
      salaryMin: null,
      salaryMax: null,
    }))
    .filter((o) => esUbicacionValida(o.location) && esTituloRelevante(cat, o.title, o.description))
    .slice(0, RESULTS_PER_PAGE);
  return {
    ofertas,
    debug: {
      fuente: "Jooble",
      status: res.status,
      count: data.totalCount ?? null,
      crudos: jobsCrudos.length,
      returned: ofertas.length,
    },
  };
}

async function main() {
  const todas = [];
  const debugInfo = [];
  for (const cat of categorias) {
    // Adzuna
    try {
      const { ofertas, debug } = await buscarCategoria(cat);
      todas.push(...ofertas);
      debugInfo.push({ id: cat.id, name: cat.name, what: cat.what, ...debug });
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`Fallo buscando (Adzuna) ${cat.name}:`, e.message);
      debugInfo.push({ id: cat.id, name: cat.name, what: cat.what, fuente: "Adzuna", error: e.message });
    }

    // Jooble
    try {
      const { ofertas, debug } = await buscarJoobleCategoria(cat);
      todas.push(...ofertas);
      debugInfo.push({ id: cat.id, name: cat.name, what: cat.what, ...debug });
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`Fallo buscando (Jooble) ${cat.name}:`, e.message);
      debugInfo.push({ id: cat.id, name: cat.name, what: cat.what, fuente: "Jooble", error: e.message });
    }
  }

  // Deduplicar por URL (algunas ofertas pueden aparecer en ambas fuentes)
  const vistos = new Set();
  const todasUnicas = todas.filter((o) => {
    if (!o.url || vistos.has(o.url)) return false;
    vistos.add(o.url);
    return true;
  });

  const salida = {
    actualizado: new Date().toISOString(),
    totalOfertas: todasUnicas.length,
    categorias: categorias.map((c) => ({ id: c.id, name: c.name })),
    ofertas: todasUnicas,
    debug: debugInfo,
  };

  const fs = await import("node:fs/promises");
  await fs.writeFile("docs/ofertas.json", JSON.stringify(salida, null, 2), "utf-8");
  console.log(`Guardadas ${todasUnicas.length} ofertas reales en docs/ofertas.json`);
}

main();
