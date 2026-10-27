/* Atalaya · libro de operaciones.
   A partir de los movimientos importados reconstruye las posiciones (lotes
   FIFO), las ventas con su plusvalía, los dividendos e intereses y el
   efectivo. Después lo fusiona con la cartera que ya existe. */
(function (raiz, fabrica) {
  const motor = raiz.Motor || (typeof require === "function" ? require("./motor.js") : null);
  const importar = raiz.Importar || (typeof require === "function" ? require("./importar.js") : null);
  const api = fabrica(motor, importar);
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Libro = api;
})(typeof self !== "undefined" ? self : this, function (Motor, Importar) {
  "use strict";

  const CASI_CERO = 1e-9;

  function clave(m) {
    return m.isin || m.ticker || m.nombre.toLowerCase();
  }

  // Orden cronológico; a igualdad de instante se respeta el orden del archivo.
  // Trade Republic exporta del más reciente al más antiguo, así que si el
  // archivo viene al revés lo detectamos por las fechas.
  function ordenar(movimientos) {
    const lista = movimientos.slice();
    const alReves = lista.length > 1 && lista[0].instante > lista[lista.length - 1].instante;
    return lista.sort((a, b) => {
      if (a.instante !== b.instante) return a.instante < b.instante ? -1 : 1;
      return alReves ? b.orden - a.orden : a.orden - b.orden;
    });
  }

  function construir(movimientos) {
    const activos = new Map();
    const operaciones = [];
    const rendimientos = [];
    const avisos = [];
    let efectivo = 0;

    const activo = (m) => {
      const k = clave(m);
      if (!activos.has(k)) {
        activos.set(k, {
          clave: k,
          isin: m.isin,
          ticker: m.ticker,
          nombre: m.nombre || m.ticker || "Sin nombre",
          tipoProducto: m.tipoProducto,
          lotes: [],
          ultimoPrecio: 0,
          fechaPrecio: "",
        });
      }
      const a = activos.get(k);
      if (m.nombre) a.nombre = m.nombre;
      if (m.tipoProducto && m.tipoProducto !== "otro") a.tipoProducto = m.tipoProducto;
      return a;
    };

    ordenar(movimientos).forEach((m) => {
      efectivo += m.efectivo || 0;

      if (m.tipo === "compra" && m.participaciones > CASI_CERO) {
        const a = activo(m);
        const bruto = m.bruto || m.participaciones * m.precio;
        a.lotes.push({ fecha: m.fecha, participaciones: m.participaciones, coste: bruto + Math.max(0, m.comision) });
        a.ultimoPrecio = m.precio || bruto / m.participaciones;
        a.fechaPrecio = m.fecha;
        operaciones.push({
          fecha: m.fecha,
          tipo: "compra",
          clave: a.clave,
          nombre: a.nombre,
          participaciones: m.participaciones,
          precio: a.ultimoPrecio,
          comision: Math.max(0, m.comision),
          ganancia: 0,
        });
      } else if (m.tipo === "venta" && m.participaciones > CASI_CERO) {
        const a = activo(m);
        const fifo = Motor.consumirFIFO(a.lotes, m.participaciones);
        a.lotes = fifo.restantes;
        const bruto = m.bruto || m.participaciones * m.precio;
        const neto = bruto - Math.max(0, m.comision);
        const incompleta = fifo.faltan > 0;
        if (incompleta) {
          avisos.push(
            `${a.nombre}: el ${m.fecha} vendiste más participaciones de las que constan compradas. Puede que el archivo no incluya todo tu historial.`
          );
        }
        a.ultimoPrecio = m.precio || bruto / m.participaciones;
        a.fechaPrecio = m.fecha;
        operaciones.push({
          fecha: m.fecha,
          tipo: "venta",
          clave: a.clave,
          nombre: a.nombre,
          participaciones: m.participaciones,
          precio: a.ultimoPrecio,
          comision: Math.max(0, m.comision),
          ganancia: Math.round((neto - fifo.coste) * 100) / 100,
          incompleta,
        });
      } else if (m.tipo === "split") {
        const a = activo(m);
        const r = Motor.resumirLotes(a.lotes);
        if (r.participaciones > CASI_CERO) {
          const factor = (r.participaciones + m.participaciones) / r.participaciones;
          a.lotes = a.lotes.map((l) => ({ ...l, participaciones: l.participaciones * factor }));
          if (a.ultimoPrecio) a.ultimoPrecio /= factor;
        }
      } else if (m.tipo === "dividendo" || m.tipo === "interes") {
        rendimientos.push({
          fecha: m.fecha,
          tipo: m.tipo,
          clave: m.tipo === "dividendo" ? clave(m) : "",
          nombre: m.tipo === "dividendo" ? m.nombre || m.ticker : "Intereses de la cuenta",
          bruto: Math.round(m.bruto * 100) / 100,
          retencion: Math.round(Math.max(0, m.impuestos) * 100) / 100,
        });
      }
    });

    const posiciones = Array.from(activos.values())
      .map((a) => ({ ...a, ...Motor.resumirLotes(a.lotes) }))
      .filter((a) => a.participaciones > 1e-6);

    return { posiciones, operaciones, rendimientos, efectivo: Math.round(efectivo * 100) / 100, avisos };
  }

  // Sustituye todo lo que vino antes del mismo origen y conserva lo demás.
  // De la importación anterior se respetan los cambios del usuario: clase y
  // tipo corregidos, comisión anual y precios actualizados después.
  function fusionar(estado, libro, origen, opciones) {
    const op = opciones || {};
    const entidad = op.entidad || "";
    const hoy = op.hoy || Motor.fechaISO(new Date());
    const anteriores = estado.posiciones.filter((p) => p.origen === origen);
    const previa = (p) => anteriores.find((x) => (p.isin && x.isin === p.isin) || x.nombre === p.nombre);

    const nuevas = libro.posiciones.map((a) => {
      const prev = previa(a);
      const tipo = prev ? prev.tipo : a.tipoProducto && a.tipoProducto !== "otro" ? a.tipoProducto : "otro";
      const precioPosterior = prev && prev.fechaPrecio > a.fechaPrecio;
      return {
        id: prev ? prev.id : `${origen}-${a.clave}`,
        nombre: prev ? prev.nombre : a.nombre,
        ticker: a.isin || a.ticker,
        isin: a.isin,
        tipo,
        clase: prev ? prev.clase : Importar.claseProbable(tipo, a.nombre),
        entidad,
        origen,
        participaciones: a.participaciones,
        precioMedio: a.precioMedio,
        precioActual: precioPosterior ? prev.precioActual : a.ultimoPrecio,
        fechaPrecio: precioPosterior ? prev.fechaPrecio : a.fechaPrecio,
        ter: prev ? prev.ter : 0,
        lotes: a.lotes,
      };
    });

    if (libro.efectivo > 0.01) {
      const prev = anteriores.find((p) => p.tipo === "cuenta");
      nuevas.push({
        id: prev ? prev.id : `${origen}-efectivo`,
        nombre: prev ? prev.nombre : `Efectivo en ${entidad || "el bróker"}`,
        ticker: "",
        isin: "",
        tipo: "cuenta",
        clase: "liquidez",
        entidad,
        origen,
        participaciones: libro.efectivo,
        precioMedio: 1,
        precioActual: 1,
        fechaPrecio: hoy,
        ter: 0,
      });
    }

    const idPorClave = {};
    libro.posiciones.forEach((a, i) => {
      idPorClave[a.clave] = nuevas[i].id;
    });
    const etiquetar = (x) => ({ ...x, id: Motor.nuevoId(), origen, posicionId: idPorClave[x.clave] || "" });

    return Motor.normalizarEstado({
      ...estado,
      ejemplo: false,
      posiciones: [...estado.posiciones.filter((p) => p.origen !== origen), ...nuevas],
      operaciones: [...(estado.operaciones || []).filter((o) => o.origen !== origen), ...libro.operaciones.map(etiquetar)],
      rendimientos: [...(estado.rendimientos || []).filter((r) => r.origen !== origen), ...libro.rendimientos.map(etiquetar)],
    });
  }

  // Atajo: texto CSV → vista previa lista para confirmar.
  function prepararImportacion(texto) {
    const archivo = Importar.leerArchivo(texto);
    const libro = construir(archivo.movimientos);
    return { ...archivo, libro };
  }

  return { construir, fusionar, prepararImportacion, ordenar };
});
