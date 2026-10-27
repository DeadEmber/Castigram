/* Atalaya · motor de cálculo y recomendaciones.
   Solo funciones puras, sin DOM: se cargan en el navegador (global `Motor`)
   y en los tests de Node (require). */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Motor = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Clases de activo: deciden el reparto de la cartera.
  const CLASES = [
    { id: "rv", nombre: "Renta variable" },
    { id: "rf", nombre: "Renta fija" },
    { id: "liquidez", nombre: "Liquidez" },
    { id: "alternativos", nombre: "Alternativos" },
  ];

  // Tipos de producto: deciden la fiscalidad y el riesgo de concentración.
  // `individual`: depende de una sola empresa o activo.
  const TIPOS = {
    fondo: { nombre: "Fondo de inversión", clase: "rv", individual: false },
    etf: { nombre: "ETF", clase: "rv", individual: false },
    accion: { nombre: "Acción", clase: "rv", individual: true },
    bono: { nombre: "Bono o letra", clase: "rf", individual: false },
    cuenta: { nombre: "Cuenta o depósito", clase: "liquidez", individual: false },
    cripto: { nombre: "Criptomoneda", clase: "alternativos", individual: true },
    otro: { nombre: "Otro", clase: "alternativos", individual: true },
  };

  const PERFILES = {
    conservador: {
      nombre: "Conservador",
      descripcion: "Prioriza no perder dinero. Acepta crecer despacio.",
      objetivo: { rv: 25, rf: 55, liquidez: 15, alternativos: 5 },
      maxCripto: 2,
    },
    moderado: {
      nombre: "Moderado",
      descripcion: "Busca crecer y tolera caídas temporales del 15–20 %.",
      objetivo: { rv: 55, rf: 30, liquidez: 10, alternativos: 5 },
      maxCripto: 5,
    },
    dinamico: {
      nombre: "Dinámico",
      descripcion: "Horizonte de más de 10 años. Aguanta caídas del 40 %.",
      objetivo: { rv: 80, rf: 10, liquidez: 5, alternativos: 5 },
      maxCripto: 10,
    },
  };

  const LIMITES = {
    pesoIndividual: 10, // % máximo recomendable en una sola acción o cripto
    pesoIndividualAlto: 20,
    terAlto: 1, // % de comisión anual a partir del cual avisamos
    terReferencia: 0.3, // comisión típica de un fondo indexado
    diasPrecio: 7,
    diasPrecioMuyViejo: 30,
    perdidaRevisar: 20, // % de pérdida latente que merece una revisión
    fgd: 100000, // Fondo de Garantía de Depósitos, por titular y entidad
    mesesColchon: 3,
    mesesColchonMax: 6,
    cuotaIndividualesRv: 0.5, // parte de la renta variable en acciones sueltas
    accionesDiversificadas: 15,
  };

  const NIVELES = ["alta", "media", "info", "ok"];

  // ---------- utilidades ----------

  function num(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  function sumar(lista, f) {
    return lista.reduce((s, x) => s + f(x), 0);
  }

  const fmtEur = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  function eur(n) {
    return fmtEur.format(Math.round(num(n)));
  }

  function pct(n, decimales) {
    const d = decimales == null ? 1 : decimales;
    return (
      num(n).toLocaleString("es-ES", {
        minimumFractionDigits: 0,
        maximumFractionDigits: d,
      }) + " %"
    );
  }

  function fechaISO(fecha) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dia}`;
  }

  // Días naturales entre una fecha ISO (AAAA-MM-DD) y `hoy`.
  function diasDesde(iso, hoy) {
    if (!iso) return Infinity;
    const [a, m, d] = String(iso).split("-").map(Number);
    if (!a || !m || !d) return Infinity;
    const desde = Date.UTC(a, m - 1, d);
    const hasta = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return Math.round((hasta - desde) / 86400000);
  }

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function lista(nombres) {
    if (nombres.length <= 1) return nombres.join("");
    return nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1];
  }

  // Reparte `total` en euros enteros proporcionalmente a `pesos`
  // (método del mayor resto), de modo que la suma cuadre exacta.
  function repartirEnteros(pesos, total) {
    const suma = sumar(pesos, (p) => p);
    if (suma <= 0) return pesos.map(() => 0);
    const exactos = pesos.map((p) => (p / suma) * total);
    const enteros = exactos.map(Math.floor);
    let resto = Math.round(total - sumar(enteros, (x) => x));
    exactos
      .map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .sort((a, b) => b.frac - a.frac)
      .forEach(({ i }) => {
        if (resto > 0) {
          enteros[i] += 1;
          resto -= 1;
        }
      });
    return enteros;
  }

  // ---------- lotes (FIFO) ----------
  // Cada compra es un lote con su coste total (precio más comisiones).
  // Al vender se consumen primero los lotes más antiguos, como exige el IRPF.

  const CASI_CERO = 1e-9;

  function lotesDesde(participaciones, precioMedio, fecha) {
    const n = num(participaciones);
    if (n <= CASI_CERO) return [];
    return [{ fecha: fecha || "", participaciones: n, coste: n * num(precioMedio) }];
  }

  // Lotes de una posición; si faltan o no cuadran con las participaciones,
  // se rehacen como un único lote al precio medio.
  function lotesDe(p) {
    const lotes = Array.isArray(p.lotes)
      ? p.lotes
          .map((l) => ({ fecha: String(l.fecha || ""), participaciones: num(l.participaciones), coste: num(l.coste) }))
          .filter((l) => l.participaciones > CASI_CERO)
      : [];
    const total = sumar(lotes, (l) => l.participaciones);
    if (lotes.length && Math.abs(total - num(p.participaciones)) < 1e-6) return lotes;
    return lotesDesde(p.participaciones, p.precioMedio, p.fechaPrecio);
  }

  function resumirLotes(lotes) {
    const participaciones = sumar(lotes, (l) => l.participaciones);
    const coste = sumar(lotes, (l) => l.coste);
    return {
      participaciones,
      coste,
      precioMedio: participaciones > CASI_CERO ? coste / participaciones : 0,
    };
  }

  // Saca `n` participaciones de los lotes más antiguos.
  // Devuelve los lotes que quedan, el coste de lo vendido y lo que faltó.
  function consumirFIFO(lotes, n) {
    let pendiente = num(n);
    let coste = 0;
    const restantes = [];
    lotes.forEach((l) => {
      if (pendiente <= CASI_CERO) {
        restantes.push({ ...l });
        return;
      }
      const usadas = Math.min(l.participaciones, pendiente);
      const costeUnitario = l.participaciones > 0 ? l.coste / l.participaciones : 0;
      coste += usadas * costeUnitario;
      pendiente -= usadas;
      const quedan = l.participaciones - usadas;
      if (quedan > CASI_CERO) restantes.push({ ...l, participaciones: quedan, coste: quedan * costeUnitario });
    });
    return { restantes, coste, faltan: pendiente > 1e-6 ? pendiente : 0 };
  }

  // ---------- estado ----------

  const TEMAS_POR_DEFECTO = ["oro", "bce", "fed", "bolsa", "inflacion", "petroleo", "cripto"];

  function estadoVacio() {
    return {
      version: 2,
      perfil: "moderado",
      objetivo: { ...PERFILES.moderado.objetivo },
      umbral: 5,
      aportacionMensual: 0,
      gastosMensuales: 0,
      posiciones: [],
      operaciones: [],
      rendimientos: [],
      historial: [],
      noticias: { temas: [...TEMAS_POR_DEFECTO], fuente: "", clave: "" },
    };
  }

  // Valida y completa un estado leído de almacenamiento o importado.
  function normalizarEstado(entrada) {
    if (!entrada || typeof entrada !== "object" || !Array.isArray(entrada.posiciones)) {
      throw new Error("El archivo no es una copia de Atalaya: falta la lista de posiciones.");
    }
    const base = estadoVacio();
    const perfil = PERFILES[entrada.perfil] ? entrada.perfil : base.perfil;
    const objetivo = {};
    CLASES.forEach((c) => {
      const v = entrada.objetivo ? entrada.objetivo[c.id] : undefined;
      objetivo[c.id] = v == null ? PERFILES[perfil].objetivo[c.id] : num(v);
    });
    const posiciones = entrada.posiciones.map((p) => {
      const tipo = TIPOS[p.tipo] ? p.tipo : "otro";
      const clase = CLASES.some((c) => c.id === p.clase) ? p.clase : TIPOS[tipo].clase;
      const posicion = {
        id: p.id ? String(p.id) : nuevoId(),
        nombre: String(p.nombre || "Sin nombre").slice(0, 80),
        ticker: String(p.ticker || "").slice(0, 20),
        isin: String(p.isin || "").slice(0, 12),
        tipo,
        clase,
        entidad: String(p.entidad || "").slice(0, 60),
        origen: String(p.origen || "manual"),
        participaciones: num(p.participaciones),
        precioMedio: num(p.precioMedio),
        precioActual: num(p.precioActual),
        fechaPrecio: p.fechaPrecio ? String(p.fechaPrecio).slice(0, 10) : "",
        ter: num(p.ter),
      };
      if (tipo !== "cuenta") posicion.lotes = lotesDe({ ...posicion, lotes: p.lotes });
      return posicion;
    });
    const noticias = entrada.noticias || {};
    return {
      ...base,
      perfil,
      objetivo,
      umbral: entrada.umbral == null ? base.umbral : Math.max(1, num(entrada.umbral)),
      aportacionMensual: Math.max(0, num(entrada.aportacionMensual)),
      gastosMensuales: Math.max(0, num(entrada.gastosMensuales)),
      posiciones,
      operaciones: Array.isArray(entrada.operaciones) ? entrada.operaciones : [],
      rendimientos: Array.isArray(entrada.rendimientos) ? entrada.rendimientos : [],
      historial: Array.isArray(entrada.historial) ? entrada.historial : [],
      noticias: {
        temas: Array.isArray(noticias.temas) ? noticias.temas.map(String) : [...TEMAS_POR_DEFECTO],
        fuente: String(noticias.fuente || ""),
        clave: String(noticias.clave || ""),
      },
      ejemplo: Boolean(entrada.ejemplo),
    };
  }

  // ---------- cálculos ----------

  function valorPosicion(p) {
    return num(p.participaciones) * num(p.precioActual);
  }

  function costePosicion(p) {
    return num(p.participaciones) * num(p.precioMedio);
  }

  function resumen(estado) {
    const posiciones = (estado.posiciones || []).map((p) => {
      const valor = valorPosicion(p);
      const coste = costePosicion(p);
      return {
        ...p,
        valor,
        coste,
        ganancia: valor - coste,
        rentabilidad: coste > 0 ? ((valor - coste) / coste) * 100 : 0,
      };
    });
    const valor = sumar(posiciones, (p) => p.valor);
    const coste = sumar(posiciones, (p) => p.coste);
    posiciones.forEach((p) => {
      p.peso = valor > 0 ? (p.valor / valor) * 100 : 0;
    });
    const objetivo = estado.objetivo || PERFILES.moderado.objetivo;
    const clases = CLASES.map((c) => {
      const v = sumar(
        posiciones.filter((p) => p.clase === c.id),
        (p) => p.valor
      );
      const peso = valor > 0 ? (v / valor) * 100 : 0;
      const obj = num(objetivo[c.id]);
      return { id: c.id, nombre: c.nombre, valor: v, peso, objetivo: obj, desviacion: peso - obj };
    });
    const costeComisiones = sumar(posiciones, (p) => (p.valor * num(p.ter)) / 100);
    return {
      valor,
      coste,
      ganancia: valor - coste,
      rentabilidad: coste > 0 ? ((valor - coste) / coste) * 100 : 0,
      posiciones,
      clases,
      costeComisiones,
      terMedio: valor > 0 ? (costeComisiones / valor) * 100 : 0,
    };
  }

  // Objetivo reescalado para que sume 1 (por si el usuario no cuadra el 100 %).
  function pesosObjetivo(res) {
    const suma = sumar(res.clases, (c) => Math.max(0, c.objetivo));
    return res.clases.map((c) => (suma > 0 ? Math.max(0, c.objetivo) / suma : 0));
  }

  // Cómo repartir una aportación para acercarse al objetivo sin vender nada:
  // cada clase recibe en proporción a lo que le falta tras sumar la aportación.
  function planAportacion(res, importe) {
    const aportar = Math.max(0, Math.round(num(importe)));
    if (!aportar) return [];
    const pesos = pesosObjetivo(res);
    const total = res.valor + aportar;
    const faltas = res.clases.map((c, i) => Math.max(0, pesos[i] * total - c.valor));
    const base = sumar(faltas, (f) => f) > 0 ? faltas : pesos;
    const cantidades = repartirEnteros(base, aportar);
    return res.clases
      .map((c, i) => ({ id: c.id, nombre: c.nombre, cantidad: cantidades[i] }))
      .filter((x) => x.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad);
  }

  // Compraventas necesarias para volver exactamente al objetivo.
  // Positivo: comprar. Negativo: vender.
  function planRebalanceo(res) {
    const pesos = pesosObjetivo(res);
    return res.clases.map((c, i) => ({
      id: c.id,
      nombre: c.nombre,
      importe: Math.round(pesos[i] * res.valor - c.valor),
    }));
  }

  // Meses de aportaciones (sin vender) hasta que una clase sobreponderada
  // vuelva a estar dentro del margen. Supone precios constantes.
  function mesesParaDiluir(res, claseId, aportacion, umbral) {
    const aporte = num(aportacion);
    if (aporte <= 0) return null;
    const i = res.clases.findIndex((x) => x.id === claseId);
    if (i < 0) return null;
    const limite = pesosObjetivo(res)[i] + num(umbral) / 100;
    if (limite <= 0) return null;
    const totalNecesario = res.clases[i].valor / limite;
    return Math.max(0, Math.ceil((totalNecesario - res.valor) / aporte));
  }

  // Compra: añade un lote. Venta: consume lotes por FIFO y calcula la plusvalía
  // (importe de la venta menos el coste de los lotes más antiguos).
  function aplicarOperacion(posicion, op) {
    const n = num(op.participaciones);
    const precio = num(op.precio);
    const comision = Math.max(0, num(op.comision));
    if (n <= 0 || precio <= 0) {
      throw new Error("Indica participaciones y precio mayores que cero.");
    }
    const actuales = num(posicion.participaciones);
    const fecha = op.fecha || posicion.fechaPrecio;
    const lotes = lotesDe(posicion);
    let restantes;
    let ganancia = 0;
    let coste = 0;
    if (op.tipo === "venta") {
      if (n > actuales + CASI_CERO) {
        throw new Error(`Solo tienes ${actuales.toLocaleString("es-ES")} participaciones.`);
      }
      const fifo = consumirFIFO(lotes, n);
      restantes = fifo.restantes;
      coste = fifo.coste;
      ganancia = n * precio - comision - coste;
    } else {
      restantes = [...lotes, { fecha, participaciones: n, coste: n * precio + comision }];
    }
    const r = resumirLotes(restantes);
    return {
      posicion: {
        ...posicion,
        lotes: restantes,
        participaciones: r.participaciones,
        precioMedio: r.participaciones > CASI_CERO ? r.precioMedio : num(posicion.precioMedio),
        precioActual: precio,
        fechaPrecio: fecha,
      },
      ganancia,
      coste,
    };
  }

  function rendimientosDelAnio(estado, anio) {
    return sumar(
      (estado.rendimientos || []).filter((r) => String(r.fecha || "").startsWith(String(anio))),
      (r) => num(r.bruto)
    );
  }

  // Guarda una foto diaria del valor. Si ya hay una de ese día, la sustituye.
  function registrarFoto(historial, foto) {
    const resto = (historial || []).filter((f) => f.fecha !== foto.fecha);
    return [...resto, { fecha: foto.fecha, valor: Math.round(foto.valor), invertido: Math.round(foto.invertido) }]
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }

  // ---------- recomendaciones ----------

  function recomendaciones(estado, hoy) {
    hoy = hoy || new Date();
    const recs = [];
    const res = resumen(estado);
    const perfil = PERFILES[estado.perfil] || PERFILES.moderado;
    const umbral = num(estado.umbral) || 5;
    const aportacion = num(estado.aportacionMensual);
    const clase = (id) => res.clases.find((c) => c.id === id);

    if (!res.posiciones.length) {
      recs.push({
        id: "vacia",
        nivel: "info",
        titulo: "Añade tu primera posición",
        texto:
          "Con tus fondos, acciones y cuentas calcularemos cómo está repartida tu cartera y qué conviene ajustar.",
      });
      return recs;
    }

    // Objetivo mal cuadrado
    const sumaObjetivo = sumar(res.clases, (c) => c.objetivo);
    if (Math.abs(sumaObjetivo - 100) > 0.5) {
      recs.push({
        id: "objetivo-suma",
        nivel: "alta",
        titulo: `Tu reparto objetivo suma ${pct(sumaObjetivo)}`,
        texto:
          "Ajusta los porcentajes en Ajustes para que sumen 100 %. Mientras tanto, los cálculos los reescalan.",
      });
    }

    // Colchón de emergencia
    const gastos = num(estado.gastosMensuales);
    if (gastos > 0) {
      const liquidez = clase("liquidez").valor;
      const minimo = gastos * LIMITES.mesesColchon;
      if (liquidez < minimo) {
        const meses = (liquidez / gastos).toLocaleString("es-ES", { maximumFractionDigits: 1 });
        recs.push({
          id: "colchon",
          nivel: "alta",
          titulo: "Tu colchón de emergencia se queda corto",
          texto: `Tienes ${eur(liquidez)} en liquidez, unos ${meses} meses de gastos. Lo prudente es guardar entre ${LIMITES.mesesColchon} y ${LIMITES.mesesColchonMax} meses (${eur(minimo)}–${eur(gastos * LIMITES.mesesColchonMax)}) antes de invertir más.`,
          pasos: [
            `Completa el colchón con unos ${eur(minimo - liquidez)} en una cuenta remunerada o un fondo monetario.`,
          ],
        });
      }
    }

    // Desviaciones respecto al reparto objetivo
    res.clases
      .filter((c) => Math.abs(c.desviacion) > umbral)
      .sort((a, b) => Math.abs(b.desviacion) - Math.abs(a.desviacion))
      .forEach((c) => {
        const sobra = c.desviacion > 0;
        const importe = Math.abs(c.valor - (c.objetivo / 100) * res.valor);
        const enClase = res.posiciones.filter((p) => p.clase === c.id);
        const pasos = [];
        if (sobra) {
          const meses = mesesParaDiluir(res, c.id, aportacion, umbral);
          if (meses != null && meses <= 24) {
            pasos.push(
              `Sin vender nada: si aportas ${eur(aportacion)} al mes al resto de la cartera, volverás a tu margen en unos ${meses} ${meses === 1 ? "mes" : "meses"}.`
            );
          }
          const fondos = enClase.filter((p) => p.tipo === "fondo");
          if (fondos.length) {
            pasos.push(
              `Para ajustarlo ya, mueve dinero desde ${lista(fondos.map((p) => p.nombre))} con un traspaso: entre fondos de inversión no pagas impuestos hasta que reembolsas.`
            );
          }
          const tributan = enClase.filter(
            (p) => ["etf", "accion", "cripto"].includes(p.tipo) && p.ganancia > 0
          );
          if (tributan.length) {
            pasos.push(
              `Vender ${lista(tributan.map((p) => p.nombre))} tributa por la plusvalía en el IRPF (desde el 19 %). Rebalancear con aportaciones lo evita.`
            );
          }
        } else {
          pasos.push(`Dirige a ${c.nombre.toLowerCase()} tus próximas aportaciones.`);
        }
        recs.push({
          id: `desviacion-${c.id}`,
          nivel: Math.abs(c.desviacion) > 2 * umbral ? "alta" : "media",
          titulo: `${c.nombre}: ${pct(c.peso)} frente al ${pct(c.objetivo)} objetivo`,
          texto: sobra
            ? `Te sobran unos ${eur(importe)} respecto a tu reparto objetivo. Tu margen es de ±${umbral} puntos.`
            : `Te faltan unos ${eur(importe)} para llegar a tu reparto objetivo. Tu margen es de ±${umbral} puntos.`,
          pasos,
        });
      });

    // Reparto de la aportación del mes
    if (aportacion > 0) {
      const plan = planAportacion(res, aportacion);
      recs.push({
        id: "aportacion",
        nivel: "info",
        titulo: `Cómo repartir tus ${eur(aportacion)} de este mes`,
        texto: "Es el reparto que más te acerca a tu objetivo sin vender nada.",
        pasos: plan.map((x) => `${eur(x.cantidad)} a ${x.nombre.toLowerCase()}`),
      });
    }

    // Concentración en una sola empresa o activo
    res.posiciones
      .filter((p) => TIPOS[p.tipo] && TIPOS[p.tipo].individual && p.peso > LIMITES.pesoIndividual)
      .sort((a, b) => b.peso - a.peso)
      .forEach((p) => {
        const exceso = p.valor - (LIMITES.pesoIndividual / 100) * res.valor;
        recs.push({
          id: `concentracion-${p.id}`,
          nivel: p.peso > LIMITES.pesoIndividualAlto ? "alta" : "media",
          titulo: `${p.nombre} pesa el ${pct(p.peso)} de tu cartera`,
          texto: `Una sola empresa o activo no debería pasar del ${LIMITES.pesoIndividual} %. Si le va mal, arrastra a toda la cartera.`,
          pasos: [
            `Para bajar al ${LIMITES.pesoIndividual} % tendrías que reducir unos ${eur(exceso)}, o dejar que tus próximas aportaciones lo diluyan.`,
          ],
        });
      });

    // Criptomonedas por encima de lo que admite el perfil
    const pesoCripto = sumar(
      res.posiciones.filter((p) => p.tipo === "cripto"),
      (p) => p.peso
    );
    if (pesoCripto > perfil.maxCripto) {
      recs.push({
        id: "cripto",
        nivel: "media",
        titulo: `Criptomonedas: ${pct(pesoCripto)} de la cartera`,
        texto: `Para un perfil ${perfil.nombre.toLowerCase()} conviene no pasar del ${perfil.maxCripto} %. Su precio ha llegado a caer más de un 70 % en pocos meses.`,
      });
    }

    // Comisiones altas
    res.posiciones
      .filter((p) => ["fondo", "etf"].includes(p.tipo) && num(p.ter) > LIMITES.terAlto)
      .forEach((p) => {
        const ahorro = (p.valor * (num(p.ter) - LIMITES.terReferencia)) / 100;
        const pasos = [];
        if (p.tipo === "fondo") {
          pasos.push("Puedes cambiarlo por otro fondo con un traspaso, sin pasar por Hacienda.");
        }
        recs.push({
          id: `comision-${p.id}`,
          nivel: "media",
          titulo: `${p.nombre} cobra un ${pct(p.ter, 2)} al año`,
          texto: `Te cuesta unos ${eur((p.valor * p.ter) / 100)} al año. Un fondo indexado de la misma categoría suele cobrar menos del ${pct(LIMITES.terReferencia)}: ahorrarías unos ${eur(ahorro)} cada año.`,
          pasos,
        });
      });

    // Diversificación de la renta variable
    const rv = clase("rv");
    const sueltas = res.posiciones.filter((p) => p.clase === "rv" && p.tipo === "accion");
    if (
      rv.valor > 0 &&
      sumar(sueltas, (p) => p.valor) / rv.valor > LIMITES.cuotaIndividualesRv &&
      sueltas.length < LIMITES.accionesDiversificadas
    ) {
      recs.push({
        id: "diversificacion",
        nivel: "media",
        titulo: `Tu renta variable depende de ${sueltas.length} ${sueltas.length === 1 ? "empresa" : "empresas"}`,
        texto:
          "Un fondo indexado global reparte tu dinero entre más de 1.000 empresas de decenas de países con una sola compra.",
      });
    }

    // Garantía de depósitos
    const porEntidad = {};
    res.posiciones
      .filter((p) => p.tipo === "cuenta" && p.entidad)
      .forEach((p) => {
        porEntidad[p.entidad] = (porEntidad[p.entidad] || 0) + p.valor;
      });
    Object.keys(porEntidad)
      .filter((e) => porEntidad[e] > LIMITES.fgd)
      .forEach((e) => {
        recs.push({
          id: `fgd-${e}`,
          nivel: "media",
          titulo: `Tienes ${eur(porEntidad[e])} en cuentas de ${e}`,
          texto: `El Fondo de Garantía de Depósitos cubre hasta ${eur(LIMITES.fgd)} por titular y entidad. Lo que pase de ahí no está protegido si la entidad quiebra.`,
        });
      });

    // Posiciones con pérdidas fuertes
    res.posiciones
      .filter((p) => p.tipo !== "cuenta" && p.coste > 0 && p.rentabilidad <= -LIMITES.perdidaRevisar)
      .forEach((p) => {
        recs.push({
          id: `perdida-${p.id}`,
          nivel: "info",
          titulo: `${p.nombre} pierde un ${pct(-p.rentabilidad)}`,
          texto:
            "Comprueba si sigues teniendo motivos para mantenerla. Que haya caído no es razón para vender, pero sí para revisar por qué la compraste.",
        });
      });

    // Compensación fiscal de fin de año (octubre a diciembre)
    if (hoy.getMonth() >= 9) {
      const anio = String(hoy.getFullYear());
      const plusvalias = sumar(
        (estado.operaciones || []).filter(
          (o) => o.tipo === "venta" && !o.incompleta && String(o.fecha || "").startsWith(anio)
        ),
        (o) => num(o.ganancia)
      );
      const enPerdidas = res.posiciones.filter(
        (p) => ["accion", "etf"].includes(p.tipo) && p.ganancia < 0
      );
      if (plusvalias > 0 && enPerdidas.length) {
        const perdidas = -sumar(enPerdidas, (p) => p.ganancia);
        recs.push({
          id: "compensacion",
          nivel: "info",
          titulo: `Puedes compensar ${eur(Math.min(plusvalias, perdidas))} de plusvalías antes de fin de año`,
          texto: `Este año has ganado ${eur(plusvalias)} vendiendo. Si vendes antes del 31 de diciembre posiciones en pérdidas (${lista(enPerdidas.map((p) => p.nombre))}), esas pérdidas restan de lo que declaras.`,
          pasos: [
            "Si recompras el mismo valor en los dos meses anteriores o posteriores a la venta, Hacienda no te deja compensar esa pérdida.",
          ],
        });
      }
    }

    // Precios sin actualizar
    const viejas = res.posiciones
      .filter((p) => p.tipo !== "cuenta")
      .map((p) => ({ p, dias: diasDesde(p.fechaPrecio, hoy) }))
      .filter((x) => x.dias > LIMITES.diasPrecio)
      .sort((a, b) => b.dias - a.dias);
    if (viejas.length) {
      const n = viejas.length;
      recs.push({
        id: "precios",
        nivel: viejas[0].dias > LIMITES.diasPrecioMuyViejo ? "media" : "info",
        titulo: `${n} ${n === 1 ? "precio lleva" : "precios llevan"} más de una semana sin actualizar`,
        texto: "Las cifras y los consejos dependen de esos precios.",
        pasos: viejas.map((x) =>
          Number.isFinite(x.dias) ? `${x.p.nombre}: hace ${x.dias} días` : `${x.p.nombre}: sin fecha`
        ),
      });
    }

    if (!recs.some((r) => r.nivel === "alta" || r.nivel === "media")) {
      recs.push({
        id: "ok",
        nivel: "ok",
        titulo: "Tu cartera está en orden",
        texto: `Todas las clases de activo están dentro de tu margen de ±${umbral} puntos y no vemos riesgos de concentración ni comisiones altas.`,
      });
    }

    return recs.sort((a, b) => NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel));
  }

  return {
    CLASES,
    TIPOS,
    PERFILES,
    LIMITES,
    NIVELES,
    num,
    eur,
    pct,
    fechaISO,
    diasDesde,
    nuevoId,
    repartirEnteros,
    TEMAS_POR_DEFECTO,
    lotesDesde,
    lotesDe,
    resumirLotes,
    consumirFIFO,
    rendimientosDelAnio,
    estadoVacio,
    normalizarEstado,
    valorPosicion,
    costePosicion,
    resumen,
    planAportacion,
    planRebalanceo,
    mesesParaDiluir,
    aplicarOperacion,
    registrarFoto,
    recomendaciones,
  };
});
