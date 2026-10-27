// Tests del lector RSS de la función de noticias (TypeScript sin compilar:
// Node elimina los tipos al importarlo).
import test from "node:test";
import assert from "node:assert/strict";
import { parsearRss, decodificar } from "../../supabase/functions/noticias/rss.ts";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Búsqueda</title>
<item>
  <title>El oro marca máximos &amp; sube un 2 % - Medio Uno</title>
  <link>https://news.google.com/rss/articles/abc?oc=5</link>
  <pubDate>Mon, 26 Oct 2026 08:30:00 GMT</pubDate>
  <description>&lt;a href="x"&gt;texto&lt;/a&gt;</description>
  <source url="https://www.medio-uno.es">Medio Uno</source>
</item>
<item>
  <title><![CDATA[El BCE mantiene los tipos]]></title>
  <link>https://ejemplo.es/bce</link>
  <pubDate>fecha rota</pubDate>
</item>
<item><title>Sin enlace</title></item>
</channel></rss>`;

test("parsearRss: titular, enlace, medio y fecha", () => {
  const items = parsearRss(RSS);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    titulo: "El oro marca máximos & sube un 2 %",
    enlace: "https://news.google.com/rss/articles/abc?oc=5",
    fuente: "Medio Uno",
    fecha: "2026-10-26T08:30:00.000Z",
  });
  assert.equal(items[1].titulo, "El BCE mantiene los tipos");
  assert.equal(items[1].fecha, "");
});

test("parsearRss: Atom con enlace en atributo", () => {
  const atom = `<feed><entry><title>Titular</title><link href="https://a.es/1"/><updated>2026-10-01T10:00:00Z</updated></entry></feed>`;
  assert.deepEqual(parsearRss(atom), [{ titulo: "Titular", enlace: "https://a.es/1", fuente: "", fecha: "2026-10-01T10:00:00.000Z" }]);
});

test("decodificar: entidades numéricas y con nombre", () => {
  assert.equal(decodificar("Caf&#233; &#x2014; &quot;ok&quot; &amp;lt;"), 'Café — "ok" &lt;');
});
