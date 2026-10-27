// Atalaya · función «noticias».
// Busca titulares de los últimos 7 días en prensa económica especializada usando
// el RSS de búsqueda de Google Noticias, limitado a una lista fija de medios.
// Solo consulta news.google.com: no sirve como proxy para otras direcciones.
//
// Petición:  POST { "consultas": [{ "tipo": "tema", "id": "oro", "q": "precio del oro" }, …] }
// Respuesta: { generado, medios, items: [{ titulo, enlace, fuente, fecha, consulta }], errores }

import { parsearRss, type Titular } from "./rss.ts";

// Prensa económica y de inversión en español. Para añadir un medio basta con
// su dominio; Google Noticias tiene que indexarlo.
const MEDIOS = [
  "expansion.com",
  "cincodias.elpais.com",
  "eleconomista.es",
  "elconfidencial.com",
  "bolsamania.com",
  "es.investing.com",
  "morningstar.es",
  "europapress.es",
  "finanzas.com",
  "elespanol.com",
];

const MAX_CONSULTAS = 20;
const MAX_POR_CONSULTA = 8;
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { hasta: number; items: Titular[] }>();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

type Consulta = { tipo: "posicion" | "tema"; id: string; q: string };

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function urlBusqueda(q: string): string {
  const sitios = MEDIOS.map((m) => `site:${m}`).join(" OR ");
  const texto = `${q} (${sitios}) when:7d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(texto)}&hl=es&gl=ES&ceid=ES:es`;
}

async function buscar(q: string): Promise<Titular[]> {
  const url = urlBusqueda(q);
  const guardado = cache.get(url);
  if (guardado && guardado.hasta > Date.now()) return guardado.items;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Atalaya/1.0 (lector de titulares)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`Google Noticias respondió ${resp.status}`);
  const items = parsearRss(await resp.text()).slice(0, MAX_POR_CONSULTA);
  cache.set(url, { hasta: Date.now() + CACHE_MS, items });
  return items;
}

function validar(cuerpo: unknown): Consulta[] {
  const lista = (cuerpo as { consultas?: unknown })?.consultas;
  if (!Array.isArray(lista) || !lista.length) throw new Error("Falta la lista de consultas.");
  return lista.slice(0, MAX_CONSULTAS).map((c) => {
    const { tipo, id, q } = (c ?? {}) as Record<string, unknown>;
    if ((tipo !== "posicion" && tipo !== "tema") || typeof id !== "string" || typeof q !== "string") {
      throw new Error("Cada consulta necesita tipo (posicion o tema), id y q.");
    }
    const texto = q.replace(/[^\p{L}\p{N}\s.&'-]/gu, " ").trim().slice(0, 80);
    if (texto.length < 2) throw new Error(`La consulta «${id}» está vacía.`);
    return { tipo, id: id.slice(0, 64), q: texto };
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Usa POST con { consultas: [...] }." }, 405);

  let consultas: Consulta[];
  try {
    consultas = validar(await req.json());
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Petición no válida." }, 400);
  }

  const resultados = await Promise.allSettled(consultas.map((c) => buscar(c.q)));
  const items: Array<Titular & { consulta: { tipo: string; id: string } }> = [];
  const errores: string[] = [];
  resultados.forEach((r, i) => {
    const { tipo, id } = consultas[i];
    if (r.status === "fulfilled") r.value.forEach((t) => items.push({ ...t, consulta: { tipo, id } }));
    else errores.push(`${id}: ${r.reason instanceof Error ? r.reason.message : "error desconocido"}`);
  });

  return json({ generado: new Date().toISOString(), medios: MEDIOS, items, errores });
});
