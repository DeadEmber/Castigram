/* Atalaya · cartera de ejemplo.
   Se muestra la primera vez para que la app no arranque vacía.
   Nombres genéricos y precios inventados: no es una cartera real. */
(function (raiz, fabrica) {
  const motor = raiz.Motor || (typeof require === "function" ? require("./motor.js") : null);
  const api = fabrica(motor);
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Ejemplo = api;
})(typeof self !== "undefined" ? self : this, function (Motor) {
  "use strict";

  function crearEjemplo(hoy) {
    hoy = hoy || new Date();
    const hace = (dias) =>
      Motor.fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias));

    const posiciones = [
      { id: "ej-world", nombre: "Fondo indexado MSCI World", tipo: "fondo", clase: "rv", entidad: "Bróker", participaciones: 812.4, precioMedio: 14.2, precioActual: 17.85, fechaPrecio: hace(1), ter: 0.12 },
      { id: "ej-emergentes", nombre: "Fondo indexado emergentes", tipo: "fondo", clase: "rv", entidad: "Bróker", participaciones: 150, precioMedio: 11.1, precioActual: 12.4, fechaPrecio: hace(1), ter: 0.2 },
      { id: "ej-espana", nombre: "Fondo de bolsa española", tipo: "fondo", clase: "rv", entidad: "Banco", participaciones: 95, precioMedio: 21.3, precioActual: 23.1, fechaPrecio: hace(3), ter: 1.85 },
      { id: "ej-tecnologica", nombre: "Acción tecnológica", tipo: "accion", clase: "rv", entidad: "Bróker", participaciones: 40, precioMedio: 95, precioActual: 138, fechaPrecio: hace(1) },
      { id: "ej-energetica", nombre: "Acción energética", tipo: "accion", clase: "rv", entidad: "Bróker", participaciones: 120, precioMedio: 18.4, precioActual: 13.9, fechaPrecio: hace(1) },
      { id: "ej-rf", nombre: "Fondo renta fija euro corto plazo", tipo: "fondo", clase: "rf", entidad: "Bróker", participaciones: 420, precioMedio: 10.05, precioActual: 10.32, fechaPrecio: hace(2), ter: 0.25 },
      { id: "ej-letras", nombre: "Letras del Tesoro a 12 meses", tipo: "bono", clase: "rf", entidad: "Banco de España", participaciones: 3, precioMedio: 970, precioActual: 985, fechaPrecio: hace(41) },
      { id: "ej-cuenta", nombre: "Cuenta remunerada", tipo: "cuenta", clase: "liquidez", entidad: "Banco", participaciones: 3200, precioMedio: 1, precioActual: 1, fechaPrecio: hace(0) },
      { id: "ej-oro", nombre: "ETF de oro físico", tipo: "etf", clase: "alternativos", entidad: "Bróker", participaciones: 25, precioMedio: 52, precioActual: 71, fechaPrecio: hace(1), ter: 0.12 },
      { id: "ej-bitcoin", nombre: "Bitcoin", ticker: "BTC", tipo: "cripto", clase: "alternativos", entidad: "Exchange", participaciones: 0.025, precioMedio: 38000, precioActual: 95000, fechaPrecio: hace(9) },
    ];

    const operaciones = [
      { id: "ej-op1", fecha: hace(18), tipo: "compra", posicionId: "ej-world", nombre: "Fondo indexado MSCI World", participaciones: 16.9, precio: 17.7, ganancia: 0 },
      { id: "ej-op2", fecha: hace(49), tipo: "compra", posicionId: "ej-rf", nombre: "Fondo renta fija euro corto plazo", participaciones: 29, precio: 10.28, ganancia: 0 },
      { id: "ej-op3", fecha: hace(160), tipo: "venta", posicionId: "ej-tecnologica", nombre: "Acción tecnológica", participaciones: 10, precio: 159, ganancia: 640 },
    ];

    const rendimientos = [
      { id: "ej-r1", fecha: hace(25), tipo: "interes", nombre: "Intereses de la cuenta", bruto: 6.4, retencion: 1.22 },
      { id: "ej-r2", fecha: hace(70), tipo: "dividendo", posicionId: "ej-energetica", nombre: "Acción energética", bruto: 42, retencion: 7.98 },
    ];

    // Un cierre por mes durante el último año, más el día de hoy.
    const objetivo = { ...Motor.PERFILES.moderado.objetivo };
    const actual = Motor.resumen({ posiciones, objetivo });
    const factores = [1.06, 1.04, 1.09, 1.11, 1.07, 1.02, 1.06, 1.1, 1.13, 1.12, 1.16];
    const historial = [];
    for (let i = 11; i >= 1; i--) {
      const finDeMes = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0);
      const invertido = actual.coste - 300 * i - (i > 6 ? 2000 : 0);
      historial.push({
        fecha: Motor.fechaISO(finDeMes),
        invertido: Math.round(invertido),
        valor: Math.round(invertido * factores[11 - i]),
      });
    }
    historial.push({
      fecha: Motor.fechaISO(hoy),
      invertido: Math.round(actual.coste),
      valor: Math.round(actual.valor),
    });

    return Motor.normalizarEstado({
      ...Motor.estadoVacio(),
      perfil: "moderado",
      objetivo,
      umbral: 5,
      aportacionMensual: 300,
      gastosMensuales: 1000,
      posiciones,
      operaciones,
      rendimientos,
      historial,
      ejemplo: true,
    });
  }

  return { crearEjemplo };
});
