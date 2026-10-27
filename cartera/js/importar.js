/* Atalaya · importación de movimientos desde CSV.
   Convierte el archivo de cada bróker en una lista de movimientos normalizados
   que luego procesa el libro (libro.js). Funciones puras, sin DOM.

   Trade Republic no publica la especificación de su «Exportación de
   transacciones». Las columnas y los tipos de abajo salen de los importadores
   de código abierto que ya la leen; si tu archivo trae algo distinto, la
   importación lo cuenta como «no reconocido» en lugar de inventarlo. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Importar = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- CSV ----------

  function detectarSeparador(texto) {
    const linea = texto.split(/\r?\n/, 1)[0] || "";
    let mejor = ",";
    let maximo = -1;
    [",", ";", "\t"].forEach((sep) => {
      let dentro = false;
      let cuenta = 0;
      for (const c of linea) {
        if (c === '"') dentro = !dentro;
        else if (c === sep && !dentro) cuenta += 1;
      }
      if (cuenta > maximo) {
        maximo = cuenta;
        mejor = sep;
      }
    });
    return mejor;
  }

  // CSV con comillas, comillas dobladas ("") y saltos de línea dentro de campos.
  function parsearCSV(texto) {
    const limpio = String(texto || "").replace(/^﻿/, "");
    const sep = detectarSeparador(limpio);
    const filas = [];
    let fila = [];
    let campo = "";
    let dentro = false;
    for (let i = 0; i < limpio.length; i++) {
      const c = limpio[i];
      if (dentro) {
        if (c === '"' && limpio[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else if (c === '"') {
          dentro = false;
        } else {
          campo += c;
        }
      } else if (c === '"') {
        dentro = true;
      } else if (c === sep) {
        fila.push(campo);
        campo = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && limpio[i + 1] === "\n") i += 1;
        fila.push(campo);
        filas.push(fila);
        fila = [];
        campo = "";
      } else {
        campo += c;
      }
    }
    if (campo !== "" || fila.length) {
      fila.push(campo);
      filas.push(fila);
    }
    const utiles = filas.filter((f) => f.some((v) => v.trim() !== ""));
    const cabeceras = (utiles.shift() || []).map((c) => c.trim().toLowerCase());
    return {
      separador: sep,
      cabeceras,
      filas: utiles.map((f) => {
        const obj = {};
        cabeceras.forEach((c, i) => {
          obj[c] = (f[i] == null ? "" : f[i]).trim();
        });
        return obj;
      }),
    };
  }

  // Acepta "1234.56", "-361.00", "1.234,56" y "1234,56".
  function numero(valor) {
    let s = String(valor == null ? "" : valor).replace(/[\s €$]/g, "");
    if (!s) return 0;
    const coma = s.lastIndexOf(",");
    const punto = s.lastIndexOf(".");
    if (coma > -1 && punto > -1) {
      s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    } else if (coma > -1) {
      s = s.replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  // Fechas ISO (2026-03-10, 2026-03-10T14:05:12Z) o españolas/alemanas (10/03/2026, 10.03.2026).
  function fecha(valor) {
    const s = String(valor || "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return "";
  }

  const RE_ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

  // ---------- clasificación del producto ----------

  const TIPO_POR_CLASE_TR = {
    STOCK: "accion",
    ETF: "etf",
    ETP: "etf",
    FUND: "fondo",
    CRYPTO: "cripto",
    BOND: "bono",
  };

  // Clase de activo a partir del tipo de producto y el nombre.
  function claseProbable(tipo, nombre) {
    const n = String(nombre || "");
    if (/\b(oro|gold|silver|plata|commodit|materias primas)\b/i.test(n)) return "alternativos";
    if (/money market|geldmarkt|monetari|overnight|€str|\bestr\b/i.test(n)) return "liquidez";
    if (/\b(bond|bonos?|anleihen?|treasur|govt|aggregate|renta fija|fixed income)\b/i.test(n)) return "rf";
    if (tipo === "bono") return "rf";
    if (tipo === "cripto") return "alternativos";
    return "rv";
  }

  // ---------- formatos ----------

  // Trade Republic: datetime, date, account_type, category, type, asset_class,
  // name, symbol, shares, price, amount, fee, tax, currency, …
  // Signos observados: compra con shares > 0 y amount < 0; venta con
  // shares < 0 y amount > 0; fee y tax negativos cuando son un cargo.
  function filaTradeRepublic(f) {
    const cuenta = String(f.account_type || "DEFAULT").toUpperCase();
    if (cuenta && cuenta !== "DEFAULT") return { ignorar: "Cuentas junior u otras cuentas" };

    const tipoTR = String(f.type || "").toUpperCase();
    const shares = numero(f.shares);
    const amount = numero(f.amount);
    const fee = numero(f.fee);
    const tax = numero(f.tax);
    const simbolo = String(f.symbol || f.isin || "").toUpperCase();
    const tipoProducto = TIPO_POR_CLASE_TR[String(f.asset_class || "").toUpperCase()] || "otro";
    const base = {
      fecha: fecha(f.date) || fecha(f.datetime),
      instante: String(f.datetime || f.date || ""),
      id: String(f.transaction_id || ""),
      original: tipoTR,
      isin: RE_ISIN.test(simbolo) ? simbolo : "",
      ticker: simbolo,
      nombre: String(f.name || f.description || "").trim(),
      tipoProducto,
      participaciones: Math.abs(shares),
      precio: Math.abs(numero(f.price)),
      bruto: Math.abs(amount),
      comision: -fee,
      impuestos: -tax,
      efectivo: amount + fee + tax,
    };

    const esCompra = /BUY|SAVINGS_PLAN|SAVEBACK|ROUND_UP/.test(tipoTR);
    if (tipoTR === "SPLIT") return { ...base, tipo: "split", participaciones: shares };
    if (/SELL/.test(tipoTR) || (shares < 0 && /TRADING/i.test(f.category || ""))) return { ...base, tipo: "venta" };
    if (esCompra || (shares > 0 && /TRADING/i.test(f.category || ""))) return { ...base, tipo: "compra" };
    if (/DIVIDEND|DISTRIBUTION/.test(tipoTR)) return { ...base, tipo: "dividendo" };
    if (/INTEREST/.test(tipoTR)) return { ...base, tipo: "interes" };
    if (/INBOUND|DEPOSIT/.test(tipoTR)) return { ...base, tipo: "ingreso" };
    if (/OUTBOUND|TRANSFER_OUT|WITHDRAW/.test(tipoTR)) return { ...base, tipo: "retirada" };
    if (/CARD/.test(tipoTR)) return { ...base, tipo: "gasto" };
    if (/TAX/.test(tipoTR)) return { ...base, tipo: "impuesto" };
    return { ...base, tipo: "otro" };
  }

  // Plantilla propia de Atalaya (también vale para otros brókeres):
  // fecha;tipo;nombre;isin;participaciones;precio;comision;impuestos
  // tipo: compra, venta, dividendo, interes, ingreso o retirada.
  const ALIAS = {
    fecha: ["fecha", "date", "datum", "datetime"],
    tipo: ["tipo", "type", "typ", "operacion", "operación"],
    nombre: ["nombre", "name", "producto", "descripcion", "descripción", "titel"],
    isin: ["isin", "symbol", "ticker"],
    participaciones: ["participaciones", "shares", "cantidad", "quantity", "titulos", "títulos", "stück", "anzahl"],
    precio: ["precio", "price", "kurs"],
    importe: ["importe", "amount", "betrag", "total"],
    comision: ["comision", "comisión", "fee", "fees", "gebühr", "gebuehr"],
    impuestos: ["impuestos", "tax", "taxes", "retencion", "retención", "steuer"],
  };

  function columna(cabeceras, campo) {
    return ALIAS[campo].find((a) => cabeceras.includes(a));
  }

  function tipoGenerico(texto) {
    const t = String(texto || "").toLowerCase();
    if (/venta|sell|verkauf/.test(t)) return "venta";
    if (/compra|buy|kauf|sparplan|aportaci/.test(t)) return "compra";
    if (/dividend|aussch|distribu/.test(t)) return "dividendo";
    if (/inter[eé]s|interest|zins/.test(t)) return "interes";
    if (/ingreso|deposit|einzahlung/.test(t)) return "ingreso";
    if (/retirada|withdraw|auszahlung/.test(t)) return "retirada";
    return "otro";
  }

  function filaGenerica(f, cabeceras) {
    const v = (campo) => {
      const c = columna(cabeceras, campo);
      return c ? f[c] : "";
    };
    const tipo = tipoGenerico(v("tipo"));
    const participaciones = Math.abs(numero(v("participaciones")));
    const precio = Math.abs(numero(v("precio")));
    const bruto = Math.abs(numero(v("importe"))) || participaciones * precio;
    const comision = Math.abs(numero(v("comision")));
    const impuestos = Math.abs(numero(v("impuestos")));
    const simbolo = String(v("isin") || "").toUpperCase();
    const signo = { compra: -1, retirada: -1, venta: 1, dividendo: 1, interes: 1, ingreso: 1 }[tipo] || 0;
    return {
      fecha: fecha(v("fecha")),
      instante: fecha(v("fecha")),
      id: "",
      original: String(v("tipo") || ""),
      isin: RE_ISIN.test(simbolo) ? simbolo : "",
      ticker: simbolo,
      nombre: String(v("nombre") || "").trim(),
      tipoProducto: "otro",
      tipo,
      participaciones,
      precio,
      bruto,
      comision,
      impuestos,
      efectivo: signo * bruto - comision - impuestos,
    };
  }

  const FORMATOS = [
    {
      id: "traderepublic",
      nombre: "Trade Republic",
      entidad: "Trade Republic",
      detectar: (c) => ["type", "shares", "amount"].every((x) => c.includes(x)) && (c.includes("datetime") || c.includes("account_type")),
      convertir: (f) => filaTradeRepublic(f),
    },
    {
      id: "plantilla",
      nombre: "Plantilla de Atalaya",
      entidad: "",
      detectar: (c) => ["fecha", "tipo", "participaciones", "precio"].every((campo) => columna(c, campo)),
      convertir: (f, c) => filaGenerica(f, c),
    },
  ];

  const ETIQUETA_TIPO = {
    compra: "Compras",
    venta: "Ventas",
    dividendo: "Dividendos",
    interes: "Intereses",
    ingreso: "Ingresos",
    retirada: "Retiradas",
    gasto: "Pagos con tarjeta",
    impuesto: "Ajustes de impuestos",
    split: "Splits",
    otro: "No reconocidos",
  };

  // Lee un CSV completo. Devuelve los movimientos y un recuento de lo descartado.
  function leerArchivo(texto) {
    const { cabeceras, filas, separador } = parsearCSV(texto);
    if (!cabeceras.length) throw new Error("El archivo está vacío.");
    const formato = FORMATOS.find((f) => f.detectar(cabeceras));
    if (!formato) {
      throw new Error(
        `No reconozco el formato. Columnas encontradas: ${cabeceras.slice(0, 12).join(", ")}. ` +
          "Usa la exportación de transacciones de Trade Republic o la plantilla de Atalaya."
      );
    }
    const movimientos = [];
    const ignoradas = {};
    const recuento = {};
    filas.forEach((f, i) => {
      const m = formato.convertir(f, cabeceras);
      if (m.ignorar) {
        ignoradas[m.ignorar] = (ignoradas[m.ignorar] || 0) + 1;
        return;
      }
      if (!m.fecha) {
        ignoradas["Filas sin fecha"] = (ignoradas["Filas sin fecha"] || 0) + 1;
        return;
      }
      if (m.tipo === "otro") {
        const clave = `No reconocidos (${m.original || "sin tipo"})`;
        ignoradas[clave] = (ignoradas[clave] || 0) + 1;
      }
      recuento[m.tipo] = (recuento[m.tipo] || 0) + 1;
      movimientos.push({ ...m, orden: i });
    });
    return { formato: formato.id, nombreFormato: formato.nombre, entidad: formato.entidad, separador, movimientos, recuento, ignoradas };
  }

  return {
    parsearCSV,
    detectarSeparador,
    numero,
    fecha,
    claseProbable,
    leerArchivo,
    FORMATOS,
    ETIQUETA_TIPO,
  };
});
