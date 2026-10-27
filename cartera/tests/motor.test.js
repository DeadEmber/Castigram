// Tests del motor de Atalaya. Ejecutar con: node --test cartera/tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/motor.js");
const { crearEjemplo } = require("../js/ejemplo.js");

const HOY = new Date(2026, 9, 27); // 27 de octubre de 2026

function cartera(posiciones, extra) {
  return M.normalizarEstado({ ...M.estadoVacio(), posiciones, ...extra });
}

function pos(id, clase, valor, otros) {
  return {
    id,
    nombre: id,
    tipo: "fondo",
    clase,
    participaciones: valor,
    precioMedio: 1,
    precioActual: 1,
    fechaPrecio: "2026-10-26",
    ...otros,
  };
}

const ids = (recs) => recs.map((r) => r.id);

test("resumen: valor, coste, rentabilidad y pesos por clase", () => {
  const est = cartera([
    pos("a", "rv", 100, { precioMedio: 8, precioActual: 10 }), // vale 1000, costó 800
    pos("b", "rf", 1000),
  ]);
  const r = M.resumen(est);
  assert.equal(r.valor, 2000);
  assert.equal(r.coste, 1800);
  assert.equal(r.ganancia, 200);
  assert.ok(Math.abs(r.rentabilidad - 11.111) < 0.01);
  const rv = r.clases.find((c) => c.id === "rv");
  assert.equal(rv.peso, 50);
  assert.equal(rv.desviacion, 50 - 55);
});

test("planAportacion: reparte toda la aportación hacia lo que falta", () => {
  const est = cartera([pos("a", "rv", 9000), pos("b", "rf", 1000)]);
  const plan = M.planAportacion(M.resumen(est), 500);
  const total = plan.reduce((s, x) => s + x.cantidad, 0);
  assert.equal(total, 500);
  assert.ok(!plan.some((x) => x.id === "rv"), "no debe aportar a la clase que sobra");
  assert.equal(plan[0].id, "rf");
});

test("planAportacion: sin aportación devuelve un plan vacío", () => {
  const est = cartera([pos("a", "rv", 1000)]);
  assert.deepEqual(M.planAportacion(M.resumen(est), 0), []);
});

test("planRebalanceo: compras y ventas suman cero", () => {
  const est = cartera([pos("a", "rv", 7000), pos("b", "rf", 2000), pos("c", "liquidez", 1000)]);
  const plan = M.planRebalanceo(M.resumen(est));
  assert.ok(Math.abs(plan.reduce((s, x) => s + x.importe, 0)) <= 2);
  assert.equal(plan.find((x) => x.id === "rv").importe, -1500);
});

test("repartirEnteros cuadra el total exacto", () => {
  assert.deepEqual(M.repartirEnteros([1, 1, 1], 100), [34, 33, 33]);
  assert.deepEqual(M.repartirEnteros([0, 0], 50), [0, 0]);
});

test("aplicarOperacion: la compra recalcula el precio medio", () => {
  const p = { participaciones: 10, precioMedio: 10, precioActual: 10 };
  const { posicion, ganancia } = M.aplicarOperacion(p, { tipo: "compra", participaciones: 10, precio: 20, fecha: "2026-10-01" });
  assert.equal(posicion.participaciones, 20);
  assert.equal(posicion.precioMedio, 15);
  assert.equal(posicion.precioActual, 20);
  assert.equal(posicion.fechaPrecio, "2026-10-01");
  assert.equal(ganancia, 0);
});

test("aplicarOperacion: la venta calcula la plusvalía y no cambia el precio medio", () => {
  const p = { participaciones: 10, precioMedio: 10, precioActual: 10 };
  const { posicion, ganancia } = M.aplicarOperacion(p, { tipo: "venta", participaciones: 4, precio: 15 });
  assert.equal(posicion.participaciones, 6);
  assert.equal(posicion.precioMedio, 10);
  assert.equal(ganancia, 20);
});

test("aplicarOperacion: rechaza vender más de lo que hay", () => {
  const p = { participaciones: 2, precioMedio: 10, precioActual: 10 };
  assert.throws(() => M.aplicarOperacion(p, { tipo: "venta", participaciones: 3, precio: 10 }), /Solo tienes/);
});

test("registrarFoto sustituye la foto del mismo día y ordena", () => {
  let h = M.registrarFoto([], { fecha: "2026-10-02", valor: 10, invertido: 9 });
  h = M.registrarFoto(h, { fecha: "2026-10-01", valor: 8, invertido: 9 });
  h = M.registrarFoto(h, { fecha: "2026-10-02", valor: 11, invertido: 9 });
  assert.deepEqual(h.map((f) => [f.fecha, f.valor]), [["2026-10-01", 8], ["2026-10-02", 11]]);
});

test("normalizarEstado rechaza lo que no es una copia de Atalaya", () => {
  assert.throws(() => M.normalizarEstado({ hola: 1 }), /posiciones/);
  const est = M.normalizarEstado({ posiciones: [{ nombre: "X", tipo: "raro", participaciones: "3" }] });
  assert.equal(est.posiciones[0].tipo, "otro");
  assert.equal(est.posiciones[0].participaciones, 3);
  assert.equal(est.perfil, "moderado");
});

test("recomendaciones: cartera vacía pide la primera posición", () => {
  assert.deepEqual(ids(M.recomendaciones(cartera([]), HOY)), ["vacia"]);
});

test("recomendaciones: cartera equilibrada da el visto bueno", () => {
  const est = cartera([
    pos("a", "rv", 5500),
    pos("b", "rf", 3000),
    pos("c", "liquidez", 1000, { tipo: "cuenta" }),
    pos("d", "alternativos", 500, { tipo: "etf" }),
  ]);
  assert.deepEqual(ids(M.recomendaciones(est, HOY)), ["ok"]);
});

test("recomendaciones: desviación grande es prioridad alta y propone traspaso", () => {
  const est = cartera([pos("Fondo RV", "rv", 9000), pos("b", "rf", 1000)]);
  const recs = M.recomendaciones(est, HOY);
  const rv = recs.find((r) => r.id === "desviacion-rv");
  assert.equal(rv.nivel, "alta");
  assert.ok(rv.pasos.some((p) => p.includes("traspaso")));
  assert.equal(recs[0].nivel, "alta", "las prioridades altas van primero");
});

test("recomendaciones: concentración en una acción", () => {
  const est = cartera([
    pos("acc", "rv", 1500, { tipo: "accion" }),
    pos("a", "rv", 4000),
    pos("b", "rf", 3000),
    pos("c", "liquidez", 1000, { tipo: "cuenta" }),
    pos("d", "alternativos", 500, { tipo: "etf" }),
  ]);
  const rec = M.recomendaciones(est, HOY).find((r) => r.id === "concentracion-acc");
  assert.ok(rec);
  assert.equal(rec.nivel, "media");
});

test("recomendaciones: comisión alta y precio sin actualizar", () => {
  const est = cartera([
    pos("caro", "rv", 5500, { ter: 1.8, fechaPrecio: "2026-08-01" }),
    pos("b", "rf", 3000),
    pos("c", "liquidez", 1000, { tipo: "cuenta" }),
    pos("d", "alternativos", 500, { tipo: "etf" }),
  ]);
  const recs = M.recomendaciones(est, HOY);
  assert.ok(ids(recs).includes("comision-caro"));
  const precios = recs.find((r) => r.id === "precios");
  assert.equal(precios.nivel, "media");
});

test("recomendaciones: colchón de emergencia corto", () => {
  const est = cartera(
    [pos("a", "rv", 5500), pos("b", "rf", 3000), pos("c", "liquidez", 1000, { tipo: "cuenta" }), pos("d", "alternativos", 500, { tipo: "etf" })],
    { gastosMensuales: 1000 }
  );
  assert.ok(ids(M.recomendaciones(est, HOY)).includes("colchon"));
});

test("recomendaciones: más de 100.000 € en cuentas de una misma entidad", () => {
  const est = cartera(
    [pos("c1", "liquidez", 70000, { tipo: "cuenta", entidad: "Banco X" }), pos("c2", "liquidez", 40000, { tipo: "cuenta", entidad: "Banco X" })],
    { objetivo: { rv: 0, rf: 0, liquidez: 100, alternativos: 0 } }
  );
  assert.ok(ids(M.recomendaciones(est, HOY)).includes("fgd-Banco X"));
});

test("recomendaciones: compensación fiscal solo en el último trimestre", () => {
  const est = cartera(
    [
      pos("perdedora", "rv", 100, { tipo: "accion", precioMedio: 20, precioActual: 10 }),
      pos("a", "rv", 4500),
      pos("b", "rf", 3000),
      pos("c", "liquidez", 1000, { tipo: "cuenta" }),
      pos("d", "alternativos", 500, { tipo: "etf" }),
    ],
    { operaciones: [{ tipo: "venta", fecha: "2026-03-10", ganancia: 600 }] }
  );
  const otono = M.recomendaciones(est, HOY).find((r) => r.id === "compensacion");
  assert.ok(otono);
  assert.match(otono.titulo, /600/);
  assert.ok(!ids(M.recomendaciones(est, new Date(2026, 4, 10))).includes("compensacion"));
});

test("ejemplo: se genera coherente y con consejos variados", () => {
  const est = crearEjemplo(HOY);
  assert.equal(est.ejemplo, true);
  assert.equal(est.historial.at(-1).fecha, "2026-10-27");
  const recs = M.recomendaciones(est, HOY);
  const niveles = new Set(recs.map((r) => r.nivel));
  assert.ok(niveles.has("alta") && niveles.has("media") && niveles.has("info"));
});
