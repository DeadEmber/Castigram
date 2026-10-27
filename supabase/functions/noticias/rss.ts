// Lector mínimo de RSS y Atom: solo lo necesario para listar titulares.

export type Titular = {
  titulo: string;
  enlace: string;
  fuente: string;
  fecha: string; // ISO 8601, vacía si el feed no la trae
};

const ENTIDADES: Record<string, string> = {
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodificar(texto: string): string {
  return texto
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m: string, n: string) => (n.toLowerCase() === "amp" ? m : ENTIDADES[n.toLowerCase()] ?? m))
    .replace(/&amp;/gi, "&")
    .trim();
}

function etiqueta(bloque: string, nombre: string): string {
  const m = bloque.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`, "i"));
  return m ? decodificar(m[1]) : "";
}

function atributo(bloque: string, nombre: string, attr: string): string {
  const m = bloque.match(new RegExp(`<${nombre}\\s[^>]*${attr}="([^"]*)"`, "i"));
  return m ? decodificar(m[1]) : "";
}

export function parsearRss(xml: string): Titular[] {
  const bloques = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return bloques
    .map((b) => {
      const fuente = etiqueta(b, "source").replace(/<[^>]+>/g, "");
      let titulo = etiqueta(b, "title").replace(/<[^>]+>/g, "");
      // Google Noticias añade « - Medio» al final del titular.
      if (fuente && titulo.endsWith(` - ${fuente}`)) titulo = titulo.slice(0, -(fuente.length + 3));
      const enlace = etiqueta(b, "link") || atributo(b, "link", "href");
      const textoFecha = etiqueta(b, "pubDate") || etiqueta(b, "published") || etiqueta(b, "updated");
      const fecha = textoFecha ? new Date(textoFecha) : null;
      return {
        titulo,
        enlace,
        fuente,
        fecha: fecha && !Number.isNaN(fecha.getTime()) ? fecha.toISOString() : "",
      };
    })
    .filter((t) => t.titulo && /^https?:\/\//.test(t.enlace));
}
