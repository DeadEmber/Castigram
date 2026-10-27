/* Atalaya · noticias.
   Dos bloques: noticias de lo que tienes en cartera y noticias de los temas
   de mercado que sigues aunque no tengas nada invertido en ellos (el oro, el
   BCE…). Aquí se decide qué buscar y cómo ordenar lo que llega; los titulares
   los trae la función `noticias` (supabase/functions/noticias). */
(function (raiz, fabrica) {
  const motor = raiz.Motor || (typeof require === "function" ? require("./motor.js") : null);
  const api = fabrica(motor);
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Noticias = api;
})(typeof self !== "undefined" ? self : this, function (Motor) {
  "use strict";

  // `exposicion` dice qué parte de la cartera queda afectada por el tema:
  // por clase de activo, por tipo de producto, por nombre o por país del ISIN.
  const TEMAS = [
    {
      id: "oro",
      nombre: "Oro",
      descripcion: "Activo refugio: suele subir con la incertidumbre y cuando bajan los tipos de interés reales.",
      consulta: "precio del oro",
      exposicion: { nombre: /\b(oro|gold)\b/i },
    },
    {
      id: "bce",
      nombre: "BCE y tipos de interés",
      descripcion: "Los tipos del Banco Central Europeo mueven el precio de los bonos y lo que pagan las cuentas remuneradas.",
      consulta: "BCE tipos de interés",
      exposicion: { clases: ["rf", "liquidez"] },
    },
    {
      id: "fed",
      nombre: "Reserva Federal",
      descripcion: "Sus decisiones marcan el rumbo de la bolsa estadounidense, que pesa más de la mitad del MSCI World, y del dólar.",
      consulta: "Reserva Federal tipos de interés",
      exposicion: { clases: ["rv"] },
    },
    {
      id: "bolsa",
      nombre: "Bolsas mundiales",
      descripcion: "Wall Street, Europa y el MSCI World: el termómetro de la renta variable global.",
      consulta: "bolsas mundiales Wall Street",
      exposicion: { clases: ["rv"] },
    },
    {
      id: "ibex",
      nombre: "Ibex 35",
      descripcion: "El índice de referencia de la bolsa española.",
      consulta: "Ibex 35",
      exposicion: { nombre: /españ|spain|ibex/i, pais: "ES" },
    },
    {
      id: "inflacion",
      nombre: "Inflación",
      descripcion: "Resta poder de compra a la liquidez y condiciona lo que hacen los bancos centrales.",
      consulta: "inflación IPC eurozona",
      exposicion: { clases: ["liquidez", "rf"] },
    },
    {
      id: "petroleo",
      nombre: "Petróleo y energía",
      descripcion: "Influye en la inflación y en los resultados de las empresas energéticas.",
      consulta: "petróleo Brent",
      exposicion: { nombre: /energ|petr[oó]le|oil|gas natural/i },
    },
    {
      id: "cripto",
      nombre: "Criptomonedas",
      descripcion: "Mercado muy volátil y con regulación todavía en cambio.",
      consulta: "bitcoin criptomonedas",
      exposicion: { tipos: ["cripto"] },
    },
    {
      id: "emergentes",
      nombre: "Mercados emergentes",
      descripcion: "China, India o Latinoamérica: más crecimiento esperado y más riesgo.",
      consulta: "mercados emergentes bolsa",
      exposicion: { nombre: /emergent|emerging|china|india|latam/i },
    },
    {
      id: "fiscalidad",
      nombre: "Fiscalidad del inversor",
      descripcion: "Cambios en el IRPF, en la tributación del ahorro y en los traspasos.",
      consulta: "IRPF inversores ahorro Hacienda",
      exposicion: null,
    },
  ];

  // Palabras que no ayudan a buscar noticias de un producto concreto.
  const GENERICAS = new Set(
    "fondo fondos indexado index acción accion acciones etf etc ucits acc dist usd eur class clase cl de del la el los las y the a b c core físico fisico cuenta".split(" ")
  );

  function terminosDeBusqueda(nombre) {
    const palabras = String(nombre || "")
      .replace(/\(.*?\)/g, " ")
      .split(/[\s,.;:/-]+/)
      .filter((p) => p && !GENERICAS.has(p.toLowerCase()));
    return palabras.slice(0, 4).join(" ");
  }

  function exposicion(tema, res) {
    const regla = tema.exposicion;
    if (!regla) return { peso: 0, nombres: [], aplicable: false };
    const afectadas = res.posiciones.filter(
      (p) =>
        (regla.clases && regla.clases.includes(p.clase)) ||
        (regla.tipos && regla.tipos.includes(p.tipo)) ||
        (regla.nombre && regla.nombre.test(p.nombre)) ||
        (regla.pais && p.tipo === "accion" && String(p.isin || "").startsWith(regla.pais))
    );
    return {
      peso: afectadas.reduce((s, p) => s + p.peso, 0),
      nombres: afectadas.map((p) => p.nombre),
      aplicable: true,
    };
  }

  // Lo que se pide a la fuente: un término por posición importante y uno por tema seguido.
  function consultas(estado) {
    const res = Motor.resumen(estado);
    const posiciones = res.posiciones
      .filter((p) => p.tipo !== "cuenta" && p.peso >= 1)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
      .map((p) => ({ tipo: "posicion", id: p.id, q: terminosDeBusqueda(p.nombre) }))
      .filter((c) => c.q.length >= 3);
    const seguidos = (estado.noticias && estado.noticias.temas) || Motor.TEMAS_POR_DEFECTO;
    const temas = TEMAS.filter((t) => seguidos.includes(t.id)).map((t) => ({ tipo: "tema", id: t.id, q: t.consulta }));
    return [...posiciones, ...temas];
  }

  function normalizarTitulo(t) {
    return String(t || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function deduplicar(items) {
    const vistos = new Set();
    return items.filter((n) => {
      const k = normalizarTitulo(n.titulo);
      if (!k || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }

  const porFecha = (a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);

  // Reparte los titulares en los dos bloques.
  function organizar(items, estado) {
    const res = Motor.resumen(estado);
    const lista = deduplicar((items || []).slice().sort(porFecha));
    const seguidos = (estado.noticias && estado.noticias.temas) || Motor.TEMAS_POR_DEFECTO;

    const cartera = lista
      .filter((n) => n.consulta && n.consulta.tipo === "posicion")
      .map((n) => {
        const p = res.posiciones.find((x) => x.id === n.consulta.id);
        return p ? { ...n, motivo: `Tienes ${p.nombre} (${Motor.pct(p.peso)} de tu cartera)` } : null;
      })
      .filter(Boolean)
      .slice(0, 20);

    const mercado = TEMAS.filter((t) => seguidos.includes(t.id)).map((t) => ({
      tema: t,
      exposicion: exposicion(t, res),
      items: lista.filter((n) => n.consulta && n.consulta.tipo === "tema" && n.consulta.id === t.id).slice(0, 4),
    }));

    return { cartera, mercado };
  }

  function textoExposicion(e) {
    if (!e.aplicable) return "Afecta a cualquier inversor";
    if (e.peso < 0.05) return "No tienes exposición";
    return `Te afecta: ${Motor.pct(e.peso)} de tu cartera`;
  }

  return { TEMAS, terminosDeBusqueda, exposicion, consultas, organizar, deduplicar, textoExposicion };
});
