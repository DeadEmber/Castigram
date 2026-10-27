// Tests del módulo de noticias.
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/motor.js");
const N = require("../js/noticias.js");
const { crearEjemplo } = require("../js/ejemplo.js");

const HOY = new Date(2026, 9, 27);

test("terminosDeBusqueda quita palabras genéricas", () => {
  assert.equal(N.terminosDeBusqueda("Fondo indexado MSCI World"), "MSCI World");
  assert.equal(N.terminosDeBusqueda("iShares Core MSCI World USD (Acc)"), "iShares MSCI World");
  assert.equal(N.terminosDeBusqueda("Bitcoin"), "Bitcoin");
});

test("exposicion: el oro cuenta aunque no esté en la clase alternativos por nombre", () => {
  const res = M.resumen(crearEjemplo(HOY));
  const oro = N.exposicion(N.TEMAS.find((t) => t.id === "oro"), res);
  assert.deepEqual(oro.nombres, ["ETF de oro físico"]);
  assert.ok(oro.peso > 4 && oro.peso < 5);
});

test("exposicion: sin oro en cartera el tema sigue apareciendo, con exposición cero", () => {
  const estado = M.normalizarEstado({
    ...M.estadoVacio(),
    posiciones: [{ nombre: "Fondo indexado MSCI World", tipo: "fondo", clase: "rv", participaciones: 10, precioMedio: 10, precioActual: 10 }],
  });
  const { mercado } = N.organizar([], estado);
  const oro = mercado.find((b) => b.tema.id === "oro");
  assert.ok(oro);
  assert.equal(N.textoExposicion(oro.exposicion), "No tienes exposición");
});

test("consultas: posiciones principales y temas seguidos", () => {
  const estado = crearEjemplo(HOY);
  const cs = N.consultas(estado);
  assert.ok(cs.some((c) => c.tipo === "posicion" && c.q === "MSCI World"));
  assert.ok(!cs.some((c) => c.tipo === "posicion" && /Cuenta/.test(c.q)));
  assert.deepEqual(
    cs.filter((c) => c.tipo === "tema").map((c) => c.id),
    M.TEMAS_POR_DEFECTO
  );
});

test("organizar: reparte, deduplica y ordena por fecha", () => {
  const estado = crearEjemplo(HOY);
  const items = [
    { titulo: "El oro sube", fecha: "2026-10-26T08:00:00Z", consulta: { tipo: "tema", id: "oro" } },
    { titulo: "El oro sube", fecha: "2026-10-25T08:00:00Z", consulta: { tipo: "tema", id: "oro" } },
    { titulo: "Bitcoin cae", fecha: "2026-10-26T09:00:00Z", consulta: { tipo: "posicion", id: "ej-bitcoin" } },
    { titulo: "Noticia de un tema no seguido", fecha: "2026-10-26T09:00:00Z", consulta: { tipo: "tema", id: "ibex" } },
  ];
  const { cartera, mercado } = N.organizar(items, estado);
  assert.equal(cartera.length, 1);
  assert.match(cartera[0].motivo, /Tienes Bitcoin/);
  assert.equal(mercado.find((b) => b.tema.id === "oro").items.length, 1);
  assert.ok(!mercado.some((b) => b.tema.id === "ibex"));
});
