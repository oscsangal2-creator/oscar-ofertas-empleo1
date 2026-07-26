// Consulta la API real de Adzuna (https://developer.adzuna.com/) y genera docs/ofertas.json
// Solo ofertas reales devueltas por la API - nada simulado ni inventado.

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
const COUNTRY = "es";
const WHERE = "Madrid";
const MAX_DAYS_OLD = 10;
const RESULTS_PER_PAGE = 6;

if (!APP_ID || !APP_KEY) {
  console.error("Faltan ADZUNA_APP_ID / ADZUNA_APP_KEY como variables de entorno (secrets).");
  process.exit(1);
}

// Categorías priorizadas de Oscar (subconjunto para no agotar la cuota gratuita ~1000 llamadas/mes)
const categorias = [
  { id: 1, name: "Demand Planning Manager", what: "demand planning" },
  { id: 2, name: "Supply Chain Manager", what: "supply chain manager" },
  { id: 3, name: "Responsable de Logística", what: "responsable logistica" },
  { id: 5, name: "Supply Chain Coordinator", what: "supply chain coordinator" },
  { id: 7, name: "Responsable de Compras", what: "responsable compras" },
  { id: 9, name: "Coordinador Operaciones Logísticas", what: "coordinador operaciones logisticas" },
  { id: 11, name: "Operations Analyst", what: "operations analyst supply chain" },
  { id: 14, name: "Inventory Planning Specialist", what: "inventory planner" },
  { id: 17, name: "Category Manager Dispositivos", what: "category manager telecomunicaciones" },
  { id: 20, name: "Data Analyst Supply Chain", what: "data analyst supply chain" },
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
    console.error(`Adzuna error [${cat.name}]: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return (data.results || []).map((o) => ({
    cat: cat.id,
    catName: cat.name,
    title: o.title?.replace(/<[^>]+>/g, "") ?? "",
    company: o.company?.display_name ?? "Empresa no especificada",
    location: o.location?.display_name ?? WHERE,
    created: o.created,
    description: (o.description ?? "").replace(/<[^>]+>/g, "").slice(0, 220) + "…",
    url: o.redirect_url,
    salaryMin: o.salary_min ?? null,
    salaryMax: o.salary_max ?? null,
  }));
}

async function main() {
  const todas = [];
  for (const cat of categorias) {
    try {
      const ofertas = await buscarCategoria(cat);
      todas.push(...ofertas);
      // Pequeña pausa para no saturar la API
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`Fallo buscando ${cat.name}:`, e.message);
    }
  }

  const salida = {
    actualizado: new Date().toISOString(),
    totalOfertas: todas.length,
    categorias: categorias.map((c) => ({ id: c.id, name: c.name })),
    ofertas: todas,
  };

  const fs = await import("node:fs/promises");
  await fs.writeFile("docs/ofertas.json", JSON.stringify(salida, null, 2), "utf-8");
  console.log(`Guardadas ${todas.length} ofertas reales en docs/ofertas.json`);
}

main();
