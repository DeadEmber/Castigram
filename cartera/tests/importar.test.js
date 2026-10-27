// Tests de la importación CSV y del libro de operaciones (FIFO).
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/motor.js");
const I = require("../js/importar.js");
const L = require("../js/libro.js");

// Cabecera y filas con el formato documentado por otros importadores del
// CSV de Trade Republic (23 columnas). Datos inventados.
const CABECERA =
  '"datetime","date","account_type","category","type","asset_class","name","symbol","shares","price","amount","fee","tax","currency","original_amount","original_currency","fx_rate","description","transaction_id","counterparty_name","counterparty_iban","payment_reference","mcc_code"';

function fila(campos) {
  const d = {
    datetime: "",
    date: "",
    account_type: "DEFAULT",
    category: "TRADING",
    type: "",
    asset_class: "STOCK",
    name: "",
    symbol: "",
    shares: "",
    price: "",
    amount: "",
    fee: "",
    tax: "",
    currency: "EUR",
    original_amount: "",
    original_currency: "",
    fx_rate: "",
    description: "",
    transaction_id: "",
    counterparty_name: "",
    counterparty_iban: "",
    payment_reference: "",
    mcc_code: "",
    ...campos,
  };
  return Object.values(d).map((v) => `"${v}"`).join(",");
}

// Más reciente primero, como exporta Trade Republic.
const CSV_TR = [
  CABECERA,
  fila({ datetime: "2026-06-02T09:00:00.000Z", date: "2026-06-02", category: "CASH", type: "INTEREST_PAYMENT", asset_class: "", amount: "4.10", tax: "-0.78" }),
  fila({ datetime: "2026-05-20T10:00:00.000Z", date: "2026-05-20", type: "DIVIDEND", name: "Empresa Ejemplo", symbol: "US0000000001", amount: "0.52", tax: "-0.08" }),
  fila({ datetime: "2026-04-15T15:00:00.000Z", date: "2026-04-15", type: "SELL", name: "Empresa Ejemplo", symbol: "US0000000001", shares: "-3.0000000000", price: "210.00", amount: "630.00", fee: "-1.00", tax: "-30.00" }),
  fila({ datetime: "2026-04-01T08:00:00.000Z", date: "2026-04-01", type: "SAVINGS_PLAN_EXECUTED", asset_class: "ETF", name: "Core MSCI World", symbol: "IE0000000002", shares: "1.5", price: "100.00", amount: "-150.00" }),
  fila({ datetime: "2026-03-10T14:05:12.000Z", date: "2026-03-10", type: "BUY", name: "Empresa Ejemplo", symbol: "US0000000001", shares: "2.0000000000", price: "180.00", amount: "-360.00", fee: "-1.00" }),
  fila({ datetime: "2026-02-10T14:05:12.000Z", date: "2026-02-10", type: "BUY", name: "Empresa Ejemplo", symbol: "US0000000001", shares: "2.0000000000", price: "150.00", amount: "-300.00", fee: "-1.00" }),
  fila({ datetime: "2026-02-05T12:00:00.000Z", date: "2026-02-05", category: "CASH", type: "CARD_TRANSACTION", asset_class: "", amount: "-12.50", counterparty_name: "Panadería" }),
  fila({ datetime: "2026-02-01T12:00:00.000Z", date: "2026-02-01", category: "CASH", type: "CUSTOMER_INBOUND", asset_class: "", amount: "1000.00" }),
  fila({ datetime: "2026-02-01T13:00:00.000Z", date: "2026-02-01", account_type: "JUNIOR", type: "BUY", name: "Junior", symbol: "IE0000000003", shares: "1", price: "10", amount: "-10" }),
].join("\n");

test("parsearCSV: comillas, separador y saltos de línea dentro de campos", () => {
  const r = I.parsearCSV('a;b;c\r\n"1";"dos ""dos""";"tres\nlíneas"\n');
  assert.equal(r.separador, ";");
  assert.deepEqual(r.cabeceras, ["a", "b", "c"]);
  assert.equal(r.filas[0].b, 'dos "dos"');
  assert.equal(r.filas[0].c, "tres\nlíneas");
});

test("numero: formatos con punto y con coma decimal", () => {
  assert.equal(I.numero("-361.00"), -361);
  assert.equal(I.numero("1.234,56"), 1234.56);
  assert.equal(I.numero("1,234.56"), 1234.56);
  assert.equal(I.numero("12,5"), 12.5);
  assert.equal(I.numero(""), 0);
});

test("fecha: ISO y día/mes/año", () => {
  assert.equal(I.fecha("2026-03-10T14:05:12.000Z"), "2026-03-10");
  assert.equal(I.fecha("10/03/2026"), "2026-03-10");
  assert.equal(I.fecha("1.3.2026"), "2026-03-01");
});

test("Trade Republic: detecta el formato y clasifica cada fila", () => {
  const r = I.leerArchivo(CSV_TR);
  assert.equal(r.formato, "traderepublic");
  assert.equal(r.recuento.compra, 3);
  assert.equal(r.recuento.venta, 1);
  assert.equal(r.recuento.dividendo, 1);
  assert.equal(r.recuento.interes, 1);
  assert.equal(r.recuento.gasto, 1);
  assert.equal(r.recuento.ingreso, 1);
  assert.equal(r.ignoradas["Cuentas junior u otras cuentas"], 1);
});

test("libro: FIFO en la venta, comisiones en el coste y posiciones restantes", () => {
  const { libro } = L.prepararImportacion(CSV_TR);
  const venta = libro.operaciones.find((o) => o.tipo === "venta");
  // Vende 3: 2 del lote de febrero (301 €) + 1 del de marzo (361/2 = 180,5 €).
  // Neto de la venta: 630 − 1 = 629 → plusvalía 629 − 481,5 = 147,5
  assert.equal(venta.ganancia, 147.5);
  assert.equal(venta.incompleta, false);

  const empresa = libro.posiciones.find((p) => p.isin === "US0000000001");
  assert.equal(empresa.participaciones, 1);
  assert.equal(empresa.precioMedio, 180.5);
  assert.equal(empresa.ultimoPrecio, 210);

  const etf = libro.posiciones.find((p) => p.isin === "IE0000000002");
  assert.equal(etf.participaciones, 1.5);
  assert.equal(etf.tipoProducto, "etf");

  assert.equal(libro.rendimientos.length, 2);
  assert.equal(libro.rendimientos.find((r) => r.tipo === "dividendo").retencion, 0.08);
  // 1000 − 12,5 − 301 − 361 − 150 + 599 (630 − 1 − 30) + 0,44 + 3,32
  assert.equal(libro.efectivo, 778.26);
});

test("libro: avisa si se vende más de lo comprado (historial incompleto)", () => {
  const csv = [CABECERA, fila({ datetime: "2026-04-15T15:00:00Z", date: "2026-04-15", type: "SELL", name: "X", symbol: "US0000000009", shares: "-2", price: "10", amount: "20" })].join("\n");
  const { libro } = L.prepararImportacion(csv);
  assert.equal(libro.operaciones[0].incompleta, true);
  assert.equal(libro.avisos.length, 1);
});

test("libro: un split multiplica participaciones sin cambiar el coste", () => {
  const csv = [
    CABECERA,
    fila({ datetime: "2026-05-01T00:00:00Z", date: "2026-05-01", category: "CORPORATE_ACTION", type: "SPLIT", name: "S", symbol: "US0000000010", shares: "3", amount: "0" }),
    fila({ datetime: "2026-04-01T00:00:00Z", date: "2026-04-01", type: "BUY", name: "S", symbol: "US0000000010", shares: "1", price: "100", amount: "-100" }),
  ].join("\n");
  const { libro } = L.prepararImportacion(csv);
  assert.equal(libro.posiciones[0].participaciones, 4);
  assert.equal(libro.posiciones[0].coste, 100);
  assert.equal(libro.posiciones[0].ultimoPrecio, 25);
});

test("fusionar: sustituye lo importado antes y conserva lo manual y los ajustes del usuario", () => {
  const { libro } = L.prepararImportacion(CSV_TR);
  let estado = M.normalizarEstado({
    ...M.estadoVacio(),
    posiciones: [{ id: "m1", nombre: "Cuenta del banco", tipo: "cuenta", clase: "liquidez", participaciones: 500, precioMedio: 1, precioActual: 1 }],
  });
  estado = L.fusionar(estado, libro, "traderepublic", { entidad: "Trade Republic", hoy: "2026-06-03" });
  assert.equal(estado.posiciones.length, 4); // manual + 2 valores + efectivo
  const etf = estado.posiciones.find((p) => p.isin === "IE0000000002");
  assert.equal(etf.clase, "rv");
  assert.equal(etf.lotes.length, 1);

  // El usuario corrige la clase y actualiza el precio; reimportar lo respeta.
  estado.posiciones = estado.posiciones.map((p) =>
    p.id === etf.id ? { ...p, clase: "alternativos", precioActual: 120, fechaPrecio: "2026-07-01" } : p
  );
  estado = L.fusionar(estado, libro, "traderepublic", { entidad: "Trade Republic" });
  const otra = estado.posiciones.find((p) => p.isin === "IE0000000002");
  assert.equal(otra.id, etf.id);
  assert.equal(otra.clase, "alternativos");
  assert.equal(otra.precioActual, 120);
  assert.equal(estado.posiciones.length, 4);
  assert.equal(estado.operaciones.filter((o) => o.origen === "traderepublic").length, 4);
  assert.equal(estado.rendimientos.length, 2);
});

test("plantilla de Atalaya con coma decimal y punto y coma", () => {
  const csv = "fecha;tipo;nombre;isin;participaciones;precio;comision\n01/02/2026;compra;Fondo X;ES0000000003;10;12,50;0\n01/03/2026;venta;Fondo X;ES0000000003;4;15;1\n";
  const { libro, formato } = L.prepararImportacion(csv);
  assert.equal(formato, "plantilla");
  assert.equal(libro.posiciones[0].participaciones, 6);
  assert.equal(libro.operaciones[1].ganancia, 4 * 15 - 1 - 4 * 12.5);
});

test("formato desconocido explica qué columnas ha encontrado", () => {
  assert.throws(() => I.leerArchivo("foo,bar\n1,2\n"), /Columnas encontradas: foo, bar/);
});

test("aplicarOperacion usa FIFO cuando hay varios lotes", () => {
  let p = { participaciones: 10, precioMedio: 10, precioActual: 10, fechaPrecio: "2026-01-01" };
  p = M.aplicarOperacion(p, { tipo: "compra", participaciones: 10, precio: 20, fecha: "2026-02-01" }).posicion;
  const r = M.aplicarOperacion(p, { tipo: "venta", participaciones: 12, precio: 25 });
  // FIFO: 10 a 10 € + 2 a 20 € = 140 € de coste → 300 − 140 = 160
  assert.equal(r.ganancia, 160);
  assert.equal(r.posicion.participaciones, 8);
  assert.equal(r.posicion.precioMedio, 20);
});
