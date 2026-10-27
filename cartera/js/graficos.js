/* Atalaya · gráfico de evolución (SVG a mano, sin librerías).
   Dos series sobre un mismo eje en euros: valor de mercado e importe invertido. */
(function (raiz) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const ALTO = 220;
  const M = { arriba: 12, derecha: 12, abajo: 26, izquierda: 64 };

  const fmtCompacto = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const fmtEje = new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" });
  const fmtFecha = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });

  function nodo(nombre, attrs, padre) {
    const n = document.createElementNS(NS, nombre);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (padre) padre.appendChild(n);
    return n;
  }

  function aFecha(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    return new Date(a, m - 1, d);
  }

  // Marcas "redondas" para el eje Y (1, 2, 2,5 o 5 × 10^n).
  function marcas(min, max, cuantas) {
    const bruto = (max - min) / Math.max(1, cuantas);
    const pot = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    const paso = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto) || pot * 10;
    const desde = Math.floor(min / paso) * paso;
    const hasta = Math.ceil(max / paso) * paso;
    const lista = [];
    for (let v = desde; v <= hasta + paso / 2; v += paso) lista.push(v);
    return lista;
  }

  function evolucion(contenedor, historial, formatoEuros) {
    contenedor.textContent = "";
    if (!historial || historial.length < 2) {
      const vacio = document.createElement("p");
      vacio.className = "g-vacio";
      vacio.textContent =
        "La evolución aparecerá cuando haya datos de al menos dos días distintos. Se guarda una foto de tu cartera cada día que la actualizas.";
      contenedor.appendChild(vacio);
      return;
    }

    const ancho = Math.max(280, contenedor.clientWidth || 0);
    const puntos = historial.map((f) => ({ ...f, t: aFecha(f.fecha).getTime() }));
    const t0 = puntos[0].t;
    const t1 = puntos[puntos.length - 1].t;
    const valores = puntos.flatMap((p) => [p.valor, p.invertido]);
    const ticks = marcas(Math.min(...valores), Math.max(...valores), 4);
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];

    const x = (t) => M.izquierda + ((t - t0) / (t1 - t0 || 1)) * (ancho - M.izquierda - M.derecha);
    const y = (v) => M.arriba + (1 - (v - y0) / (y1 - y0 || 1)) * (ALTO - M.arriba - M.abajo);

    const svg = nodo("svg", {
      viewBox: `0 0 ${ancho} ${ALTO}`,
      height: ALTO,
      tabindex: "0",
      role: "img",
      "aria-label": `Evolución del valor y de lo invertido entre ${fmtFecha.format(new Date(t0))} y ${fmtFecha.format(new Date(t1))}. Usa las flechas para recorrer las fechas.`,
    });

    // Rejilla y eje Y
    ticks.forEach((v, i) => {
      nodo("line", { x1: M.izquierda, x2: ancho - M.derecha, y1: y(v), y2: y(v), class: i === 0 ? "g-base" : "g-rejilla" }, svg);
      const etiqueta = nodo("text", { x: M.izquierda - 8, y: y(v) + 4, "text-anchor": "end" }, svg);
      etiqueta.textContent = fmtCompacto.format(v);
    });

    // Eje X: hasta 6 fechas repartidas, sin repetir mes
    const maxEtiquetas = Math.max(2, Math.min(6, Math.floor((ancho - M.izquierda) / 70)));
    const usados = new Set();
    for (let k = 0; k < maxEtiquetas; k++) {
      const i = Math.round((k / (maxEtiquetas - 1)) * (puntos.length - 1));
      const texto = fmtEje.format(new Date(puntos[i].t));
      if (usados.has(texto)) continue;
      usados.add(texto);
      const ancla = k === 0 ? "start" : k === maxEtiquetas - 1 ? "end" : "middle";
      const etiqueta = nodo("text", { x: x(puntos[i].t), y: ALTO - 6, "text-anchor": ancla }, svg);
      etiqueta.textContent = texto;
    }

    const linea = (clave) => puntos.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p[clave]).toFixed(1)}`).join("");
    const base = y(y0).toFixed(1);
    nodo("path", { d: `${linea("valor")}L${x(t1).toFixed(1)},${base}L${x(t0).toFixed(1)},${base}Z`, class: "g-area" }, svg);
    nodo("path", { d: linea("invertido"), class: "g-invertido" }, svg);
    nodo("path", { d: linea("valor"), class: "g-valor" }, svg);

    const ultimo = puntos[puntos.length - 1];
    nodo("circle", { cx: x(ultimo.t), cy: y(ultimo.invertido), r: 4, class: "g-punto g-punto-invertido" }, svg);
    nodo("circle", { cx: x(ultimo.t), cy: y(ultimo.valor), r: 4, class: "g-punto g-punto-valor" }, svg);

    // Capa interactiva: cruceta + puntos + tooltip
    const cruz = nodo("line", { y1: M.arriba, y2: ALTO - M.abajo, class: "g-cruz", visibility: "hidden" }, svg);
    const pInv = nodo("circle", { r: 4, class: "g-punto g-punto-invertido", visibility: "hidden" }, svg);
    const pVal = nodo("circle", { r: 4, class: "g-punto g-punto-valor", visibility: "hidden" }, svg);
    const captura = nodo("rect", {
      x: M.izquierda,
      y: 0,
      width: ancho - M.izquierda - M.derecha,
      height: ALTO,
      class: "g-captura",
    }, svg);

    const tip = document.createElement("div");
    tip.className = "tooltip";
    tip.hidden = true;
    contenedor.append(svg, tip);

    let actual = -1;

    function filaTip(color, valor, texto) {
      const fila = document.createElement("div");
      fila.className = "tooltip-fila";
      const clave = document.createElement("span");
      clave.className = "clave-linea";
      clave.style.setProperty("--c", color);
      const fuerte = document.createElement("strong");
      fuerte.textContent = formatoEuros(valor);
      const etiqueta = document.createElement("span");
      etiqueta.textContent = texto;
      fila.append(clave, fuerte, etiqueta);
      return fila;
    }

    function mostrar(i) {
      actual = i;
      const p = puntos[i];
      const px = x(p.t);
      cruz.setAttribute("x1", px);
      cruz.setAttribute("x2", px);
      pVal.setAttribute("cx", px);
      pVal.setAttribute("cy", y(p.valor));
      pInv.setAttribute("cx", px);
      pInv.setAttribute("cy", y(p.invertido));
      [cruz, pVal, pInv].forEach((n) => n.setAttribute("visibility", "visible"));

      tip.textContent = "";
      const fecha = document.createElement("div");
      fecha.className = "tooltip-fecha";
      fecha.textContent = fmtFecha.format(new Date(p.t));
      const ganancia = p.valor - p.invertido;
      const dif = document.createElement("div");
      dif.className = "tooltip-fila";
      dif.textContent = `${ganancia >= 0 ? "Ganancia" : "Pérdida"}: ${formatoEuros(Math.abs(ganancia))}`;
      tip.append(
        fecha,
        filaTip("var(--serie-1)", p.valor, "Valor"),
        filaTip("var(--tinta-3)", p.invertido, "Invertido"),
        dif
      );
      tip.hidden = false;

      // El SVG se escala con el ancho del contenedor: convertimos a píxeles reales.
      const escala = contenedor.clientWidth / ancho || 1;
      const anchoTip = tip.offsetWidth;
      let izquierda = px * escala + 12;
      if (izquierda + anchoTip > contenedor.clientWidth) izquierda = px * escala - anchoTip - 12;
      tip.style.transform = `translate(${Math.max(0, izquierda)}px, ${M.arriba}px)`;
    }

    function ocultar() {
      actual = -1;
      tip.hidden = true;
      [cruz, pVal, pInv].forEach((n) => n.setAttribute("visibility", "hidden"));
    }

    function masCercano(evento) {
      const caja = svg.getBoundingClientRect();
      const px = ((evento.clientX - caja.left) / caja.width) * ancho;
      let mejor = 0;
      puntos.forEach((p, i) => {
        if (Math.abs(x(p.t) - px) < Math.abs(x(puntos[mejor].t) - px)) mejor = i;
      });
      return mejor;
    }

    captura.addEventListener("pointermove", (e) => mostrar(masCercano(e)));
    captura.addEventListener("pointerdown", (e) => mostrar(masCercano(e)));
    captura.addEventListener("pointerleave", ocultar);
    svg.addEventListener("blur", ocultar);
    svg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const paso = e.key === "ArrowRight" ? 1 : -1;
        const inicio = actual < 0 ? (paso > 0 ? -1 : puntos.length) : actual;
        mostrar(Math.min(puntos.length - 1, Math.max(0, inicio + paso)));
      } else if (e.key === "Escape") {
        ocultar();
      }
    });
  }

  raiz.Graficos = { evolucion };
})(self);
