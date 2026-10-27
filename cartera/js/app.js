/* Atalaya · interfaz. Pinta el estado y escucha al usuario.
   Los cálculos viven en motor.js; aquí solo hay DOM y almacenamiento. */
(function () {
  "use strict";

  const M = window.Motor;
  const CLAVE = "atalaya.cartera.v1";
  const CLAVE_NOTICIAS = "atalaya.noticias.v1";
  const MINUTOS_NOTICIAS = 30;
  const VISTAS = ["resumen", "posiciones", "consejos", "noticias", "ajustes"];
  const COLOR_CLASE = {
    rv: "var(--serie-1)",
    rf: "var(--serie-2)",
    liquidez: "var(--serie-3)",
    alternativos: "var(--serie-4)",
  };
  const NIVEL = {
    alta: "Prioridad alta",
    media: "Conviene revisar",
    info: "Para saber",
    ok: "En orden",
  };
  // Cada nivel tiene su forma, para no depender solo del color.
  const ICONO = {
    alta: '<path d="M8 1.8 15 14.2H1z" fill="currentColor"/>',
    media: '<path d="M8 1.5 14.5 8 8 14.5 1.5 8z" fill="currentColor"/>',
    info: '<circle cx="8" cy="8" r="6" fill="currentColor"/>',
    ok: '<path d="M2.5 8.5 6.2 12 13.5 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  const $ = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

  const fmtPrecio = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  const fmtFecha = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const fmtRelativo = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });

  function haceTiempo(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    const minutos = Math.round((Date.now() - t) / 60000);
    if (minutos < 60) return fmtRelativo.format(-Math.max(1, minutos), "minute");
    if (minutos < 48 * 60) return fmtRelativo.format(-Math.round(minutos / 60), "hour");
    return fmtRelativo.format(-Math.round(minutos / 1440), "day");
  }

  function esc(texto) {
    return String(texto == null ? "" : texto).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  function conSigno(n, formato) {
    if (Math.abs(n) < 0.005) return formato(0);
    return (n > 0 ? "+" : "−") + formato(Math.abs(n));
  }

  function claseSigno(n) {
    return n > 0.005 ? "positivo" : n < -0.005 ? "negativo" : "";
  }

  function fechaCorta(iso) {
    if (!iso) return "sin fecha";
    const [a, m, d] = iso.split("-").map(Number);
    return fmtFecha.format(new Date(a, m - 1, d));
  }

  function haceDias(iso) {
    const dias = M.diasDesde(iso, new Date());
    if (!Number.isFinite(dias)) return "sin fecha";
    if (dias <= 0) return "hoy";
    if (dias === 1) return "ayer";
    return `hace ${dias} días`;
  }

  function icono(nivel) {
    return `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONO[nivel]}</svg>`;
  }

  function numero(id) {
    const v = $(id).valueAsNumber;
    return Number.isFinite(v) ? v : NaN;
  }

  // ---------- almacenamiento ----------

  function cargar() {
    let guardado = null;
    try {
      guardado = localStorage.getItem(CLAVE);
      if (guardado) return M.normalizarEstado(JSON.parse(guardado));
    } catch (e) {
      // Datos ilegibles: los apartamos para no pisarlos y empezamos con el ejemplo.
      try {
        if (guardado) localStorage.setItem(CLAVE + ".ilegible", guardado);
      } catch (e2) {
        /* sin almacenamiento */
      }
    }
    return Ejemplo.crearEjemplo(new Date());
  }

  let sinAlmacenamientoAvisado = false;

  function guardar() {
    if (estado.posiciones.length) {
      const r = M.resumen(estado);
      estado.historial = M.registrarFoto(estado.historial, {
        fecha: M.fechaISO(new Date()),
        valor: r.valor,
        invertido: r.coste,
      });
    }
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) {
      if (!sinAlmacenamientoAvisado) {
        sinAlmacenamientoAvisado = true;
        avisar("Este navegador no permite guardar. Copia tu cartera desde Ajustes antes de cerrar.");
      }
    }
  }

  let estado = cargar();

  // ---------- aviso flotante ----------

  let temporizadorAviso;
  function avisar(texto) {
    const aviso = $("#aviso");
    aviso.textContent = texto;
    aviso.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => {
      aviso.hidden = true;
    }, 3500);
  }

  // ---------- pintado ----------

  function pintar() {
    const res = M.resumen(estado);
    const recs = M.recomendaciones(estado, new Date());
    $("#aviso-ejemplo").hidden = !estado.ejemplo;
    pintarCifra(res);
    pintarReparto(res);
    pintarEvolucion();
    pintarDestacados(recs);
    pintarPosiciones(res);
    pintarOperaciones();
    pintarConsejos(recs, res);
    pintarNoticias();
    pintarAjustes();

    const importantes = recs.filter((r) => r.nivel === "alta" || r.nivel === "media").length;
    const contador = $("#contador-consejos");
    contador.hidden = importantes === 0;
    contador.textContent = importantes;
    contador.setAttribute("aria-label", `${importantes} por revisar`);
  }

  function pintarCifra(res) {
    $("#valor-total").textContent = M.eur(res.valor);
    const delta = $("#ganancia-total");
    if (!res.posiciones.length) {
      delta.innerHTML = '<span class="nota">Añade tu primera posición para empezar.</span>';
    } else {
      delta.innerHTML = `
        <span class="${claseSigno(res.ganancia)}">${esc(conSigno(res.ganancia, M.eur))} (${esc(conSigno(res.rentabilidad, M.pct))})</span>
        <span class="nota">sobre lo invertido</span>`;
    }
    const preciosViejos = res.posiciones
      .filter((p) => p.tipo !== "cuenta")
      .map((p) => p.fechaPrecio)
      .filter(Boolean)
      .sort()[0];
    const anio = new Date().getFullYear();
    const datos = [
      ["Invertido", M.eur(res.coste)],
      [`Dividendos e intereses ${anio}`, M.eur(M.rendimientosDelAnio(estado, anio))],
      ["Comisiones al año", `${M.eur(res.costeComisiones)} · ${M.pct(res.terMedio, 2)}`],
      ["Posiciones", String(res.posiciones.length)],
      ["Precio más antiguo", preciosViejos ? fechaCorta(preciosViejos) : "—"],
    ];
    $("#datos-cartera").innerHTML = datos
      .map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd class="num">${esc(dd)}</dd></div>`)
      .join("");
  }

  function pintarReparto(res) {
    const umbral = M.num(estado.umbral) || 5;
    $("#reparto").innerHTML = res.clases
      .map((c) => {
        const desv = c.desviacion;
        const nivel = Math.abs(desv) > 2 * umbral ? "alta" : Math.abs(desv) > umbral ? "media" : "ok";
        const textoDesv =
          nivel === "ok"
            ? "Dentro de tu margen"
            : `${conSigno(desv, (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 }))} puntos`;
        const ancho = Math.min(100, Math.max(0, c.peso));
        const objetivo = Math.min(100, Math.max(0, c.objetivo));
        return `
          <li class="reparto-fila">
            <div class="reparto-cab">
              <span class="reparto-nombre"><span class="muestra" style="--c:${COLOR_CLASE[c.id]}"></span>${esc(c.nombre)}</span>
              <span class="reparto-cifras"><strong>${esc(M.pct(c.peso))}</strong> <span class="nota">objetivo ${esc(M.pct(c.objetivo))}</span></span>
            </div>
            <div class="barra" role="img" aria-label="${esc(`${c.nombre}: ${M.pct(c.peso)} de la cartera; objetivo ${M.pct(c.objetivo)}`)}">
              <span class="barra-relleno" style="--c:${COLOR_CLASE[c.id]};width:${ancho.toFixed(2)}%"></span>
              <span class="barra-objetivo" style="left:${objetivo.toFixed(2)}%"></span>
            </div>
            <div class="reparto-pie">
              <span>${esc(M.eur(c.valor))}</span>
              <span class="estado estado-${nivel}">${icono(nivel)}${esc(textoDesv)}</span>
            </div>
          </li>`;
      })
      .join("");
    const perfil = M.PERFILES[estado.perfil];
    $("#reparto-pie").innerHTML = `Perfil ${esc(perfil.nombre.toLowerCase())} · margen de ±${esc(umbral)} puntos · <a href="#ajustes">Cambiar</a>`;
  }

  function pintarEvolucion() {
    const historial = estado.historial || [];
    const ultimo = historial[historial.length - 1];
    $("#leyenda-evolucion").innerHTML = ultimo
      ? `<li><span class="clave-linea" style="--c:var(--serie-1)"></span>Valor <strong>${esc(M.eur(ultimo.valor))}</strong></li>
         <li><span class="clave-linea" style="--c:var(--tinta-3)"></span>Invertido <strong>${esc(M.eur(ultimo.invertido))}</strong></li>`
      : "";
    Graficos.evolucion($("#evolucion"), historial, M.eur);

    const filas = historial
      .slice()
      .reverse()
      .map(
        (f) => `<tr><td>${esc(fechaCorta(f.fecha))}</td><td>${esc(M.eur(f.valor))}</td><td>${esc(M.eur(f.invertido))}</td>
          <td class="${claseSigno(f.valor - f.invertido)}">${esc(conSigno(f.valor - f.invertido, M.eur))}</td></tr>`
      )
      .join("");
    $("#tabla-evolucion").innerHTML = historial.length
      ? `<table><thead><tr><th scope="col">Fecha</th><th scope="col">Valor</th><th scope="col">Invertido</th><th scope="col">Ganancia</th></tr></thead><tbody>${filas}</tbody></table>`
      : '<p class="nota">Todavía no hay datos.</p>';
  }

  function htmlConsejo(r, completo) {
    const pasos =
      completo && r.pasos && r.pasos.length
        ? `<ul class="pasos">${r.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
        : "";
    return `
      <p class="chip nivel-${r.nivel}">${icono(r.nivel)}${esc(NIVEL[r.nivel])}</p>
      <h3>${esc(r.titulo)}</h3>
      ${completo ? `<p>${esc(r.texto)}</p>` : ""}
      ${pasos}`;
  }

  function pintarDestacados(recs) {
    const primeros = recs.slice(0, 3);
    $("#destacados").innerHTML = primeros.map((r) => `<li>${htmlConsejo(r, false)}</li>`).join("");
    const enlace = $("#ver-consejos");
    enlace.textContent = `Ver los ${recs.length} consejos`;
    enlace.hidden = recs.length <= primeros.length;
  }

  function pintarConsejos(recs, res) {
    const perfil = M.PERFILES[estado.perfil];
    $("#consejos-intro").textContent = `Calculados con reglas sencillas a partir de tus posiciones y de tu perfil ${perfil.nombre.toLowerCase()}. Son orientativos, no asesoramiento financiero.`;
    $("#lista-consejos").innerHTML = recs
      .map((r) => `<li class="consejo">${htmlConsejo(r, true)}</li>`)
      .join("");

    const plan = M.planRebalanceo(res);
    if (!res.valor) {
      $("#tabla-rebalanceo").innerHTML = '<p class="nota">Aparecerá cuando tengas posiciones.</p>';
      return;
    }
    const filas = res.clases
      .map((c, i) => {
        const imp = plan[i].importe;
        const accion = Math.abs(imp) < 1 ? "—" : imp > 0 ? `Comprar ${M.eur(imp)}` : `Vender ${M.eur(-imp)}`;
        return `<tr>
          <th scope="row"><span class="reparto-nombre"><span class="muestra" style="--c:${COLOR_CLASE[c.id]}"></span>${esc(c.nombre)}</span></th>
          <td>${esc(M.eur(c.valor + imp))}</td>
          <td class="celda-accion">${esc(accion)}</td>
        </tr>`;
      })
      .join("");
    $("#tabla-rebalanceo").innerHTML = `<table>
      <thead><tr><th scope="col">Clase</th><th scope="col">Objetivo</th><th scope="col">Qué hacer</th></tr></thead>
      <tbody>${filas}</tbody></table>`;
  }

  function pintarPosiciones(res) {
    const caja = $("#lista-posiciones");
    if (!res.posiciones.length) {
      caja.innerHTML = `<div class="vacio">
        <p>Aún no tienes posiciones. Añade tus fondos, acciones, ETF, cuentas remuneradas o criptomonedas.</p>
        <button type="button" class="boton boton-primario" data-accion="nueva">Añadir la primera</button>
      </div>`;
      return;
    }
    caja.innerHTML = res.clases
      .filter((c) => res.posiciones.some((p) => p.clase === c.id))
      .map((c) => {
        const filas = res.posiciones
          .filter((p) => p.clase === c.id)
          .sort((a, b) => b.valor - a.valor)
          .map((p) => {
            const meta = [M.TIPOS[p.tipo].nombre, p.entidad].filter(Boolean).map(esc);
            if (p.ticker) meta.push(`<code>${esc(p.ticker)}</code>`);
            const precio =
              p.tipo === "cuenta"
                ? `<span>Saldo</span><small class="nota">${esc(haceDias(p.fechaPrecio))}</small>`
                : `<span>${esc(fmtPrecio.format(p.precioActual))}</span><small class="nota">${esc(haceDias(p.fechaPrecio))}</small>`;
            const ganancia =
              p.tipo === "cuenta"
                ? '<small class="nota">Liquidez</small>'
                : `<small class="${claseSigno(p.ganancia)}">${esc(conSigno(p.ganancia, M.eur))} · ${esc(conSigno(p.rentabilidad, M.pct))}</small>`;
            return `<li><button type="button" class="fila" data-editar="${esc(p.id)}" aria-label="${esc(`Editar ${p.nombre}`)}">
              <span class="fila-nombre"><strong>${esc(p.nombre)}</strong><span class="fila-meta">${meta.join(" · ")}</span></span>
              <span class="fila-num fila-peso">${esc(M.pct(p.peso))}</span>
              <span class="fila-num fila-precio">${precio}</span>
              <span class="fila-num fila-valor"><strong>${esc(M.eur(p.valor))}</strong>${ganancia}</span>
            </button></li>`;
          })
          .join("");
        return `<section class="panel grupo" aria-label="${esc(c.nombre)}">
          <div class="grupo-cab">
            <span class="muestra" style="--c:${COLOR_CLASE[c.id]}"></span>
            <h2>${esc(c.nombre)}</h2>
            <span class="grupo-total">${esc(M.eur(c.valor))} · ${esc(M.pct(c.peso))}</span>
          </div>
          <div>
            <div class="filas-cab" aria-hidden="true"><span>Posición</span><span>Peso</span><span>Precio</span><span>Valor</span></div>
            <ul class="filas">${filas}</ul>
          </div>
        </section>`;
      })
      .join("");
  }

  function pintarOperaciones() {
    const ops = [...(estado.operaciones || []), ...(estado.rendimientos || [])]
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .slice(0, 25);
    const titulo = { compra: "Compra", venta: "Venta", dividendo: "Dividendo", interes: "Intereses" };
    $("#lista-operaciones").innerHTML = ops.length
      ? ops
          .map((o) => {
            if (o.tipo === "dividendo" || o.tipo === "interes") {
              const retencion = M.num(o.retencion) > 0 ? ` · retención ${M.eur(o.retencion)}` : "";
              return `<li>
                <strong>${titulo[o.tipo]} · ${esc(o.nombre)}</strong>
                <span class="fila-meta">${esc(fechaCorta(o.fecha))}${esc(retencion)}</span>
                <span class="op-importe positivo">${esc(conSigno(M.num(o.bruto), (n) => fmtPrecio.format(n)))}</span>
              </li>`;
            }
            const importe = M.num(o.participaciones) * M.num(o.precio);
            let extra = "";
            if (o.tipo === "venta") {
              extra = o.incompleta
                ? '<small class="nota">Plusvalía sin calcular: faltan compras en el historial</small>'
                : `<small class="${claseSigno(o.ganancia)}">Plusvalía ${esc(conSigno(M.num(o.ganancia), M.eur))}</small>`;
            }
            return `<li>
              <strong>${titulo[o.tipo] || "Operación"} · ${esc(o.nombre)}</strong>
              <span class="fila-meta">${esc(fechaCorta(o.fecha))} · ${esc(M.num(o.participaciones).toLocaleString("es-ES", { maximumFractionDigits: 6 }))} × ${esc(fmtPrecio.format(M.num(o.precio)))}</span>
              <span class="op-importe"><span>${esc(M.eur(importe))}</span><br>${extra}</span>
            </li>`;
          })
          .join("")
      : '<li class="nota">Aún no has registrado operaciones.</li>';
  }

  // ---------- noticias ----------

  let noticias = leerNoticiasGuardadas();
  let noticiasCargando = false;
  let noticiasError = "";

  function leerNoticiasGuardadas() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_NOTICIAS)) || null;
    } catch (e) {
      return null;
    }
  }

  function firmaConsultas() {
    return JSON.stringify([estado.noticias.fuente, Noticias.consultas(estado)]);
  }

  async function cargarNoticias(forzar) {
    const fuente = estado.noticias.fuente;
    if (!fuente || noticiasCargando) return;
    const firma = firmaConsultas();
    const reciente =
      noticias && noticias.firma === firma && Date.now() - noticias.cargado < MINUTOS_NOTICIAS * 60000;
    if (reciente && !forzar) return;
    noticiasCargando = true;
    noticiasError = "";
    pintarNoticias();
    try {
      const cabeceras = { "Content-Type": "application/json" };
      if (estado.noticias.clave) {
        cabeceras.Authorization = `Bearer ${estado.noticias.clave}`;
        cabeceras.apikey = estado.noticias.clave;
      }
      const resp = await fetch(fuente, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({ consultas: Noticias.consultas(estado) }),
      });
      const datos = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(datos.error || `la fuente respondió ${resp.status}`);
      noticias = {
        firma,
        cargado: Date.now(),
        items: (datos.items || []).filter((n) => /^https?:\/\//.test(n.enlace || "")),
        medios: datos.medios || [],
      };
      try {
        localStorage.setItem(CLAVE_NOTICIAS, JSON.stringify(noticias));
      } catch (e) {
        /* sin almacenamiento: se pedirán otra vez la próxima vez */
      }
    } catch (err) {
      noticiasError = `No se ha podido conectar con la fuente de noticias (${err.message}). Revisa la dirección en Ajustes.`;
    } finally {
      noticiasCargando = false;
      pintarNoticias();
    }
  }

  function htmlNoticia(n, conMotivo) {
    const meta = [n.fuente, haceTiempo(n.fecha)].filter(Boolean).join(" · ");
    return `<li class="noticia">
      <a href="${esc(n.enlace)}" target="_blank" rel="noopener noreferrer">${esc(n.titulo)}</a>
      <span class="noticia-meta">${esc(meta)}</span>
      ${conMotivo && n.motivo ? `<span class="noticia-motivo">${esc(n.motivo)}</span>` : ""}
    </li>`;
  }

  function pintarNoticias() {
    const fuente = estado.noticias.fuente;
    // Si cambian las posiciones o los temas se reutilizan los titulares guardados
    // hasta la próxima carga: organizar() ya descarta lo que no corresponde.
    const items = fuente && noticias ? noticias.items : [];
    const { cartera, mercado } = Noticias.organizar(items, estado);

    let textoEstado;
    if (!fuente) textoEstado = "Fuente de noticias sin conectar.";
    else if (noticiasCargando) textoEstado = "Buscando titulares…";
    else if (noticiasError) textoEstado = noticiasError;
    else if (noticias) textoEstado = `Actualizado ${haceTiempo(new Date(noticias.cargado).toISOString())} · ${noticias.items.length} titulares de prensa económica.`;
    else textoEstado = "Pulsa Actualizar para buscar titulares.";
    $("#noticias-estado").textContent = textoEstado;

    const buscadas = Noticias.consultas(estado)
      .filter((c) => c.tipo === "posicion")
      .map((c) => c.q);
    $("#noticias-cartera").innerHTML = cartera.length
      ? cartera.map((n) => htmlNoticia(n, true)).join("")
      : `<li class="sin-noticias">${
          fuente
            ? "No hay titulares recientes sobre tus posiciones."
            : `Cuando conectes la fuente en <a href="#ajustes">Ajustes</a>, aquí verás titulares de la última semana sobre ${esc(buscadas.slice(0, 4).join(", ") || "tus posiciones")}.`
        }</li>`;

    $("#noticias-mercado").innerHTML = mercado
      .map(({ tema, exposicion, items: delTema }) => {
        const sin = exposicion.aplicable && exposicion.peso < 0.05;
        const lista = delTema.length
          ? delTema.map((n) => htmlNoticia(n, false)).join("")
          : `<li class="sin-noticias">${fuente ? "Sin titulares esta semana." : "Aquí aparecerán los titulares de la prensa especializada."}</li>`;
        return `<article class="tema">
          <div class="tema-cab">
            <h3>${esc(tema.nombre)}</h3>
            <span class="exposicion${sin ? " exposicion-cero" : ""}">${esc(Noticias.textoExposicion(exposicion))}</span>
          </div>
          <p class="tema-desc">${esc(tema.descripcion)}</p>
          <ul class="noticias noticias-compactas">${lista}</ul>
        </article>`;
      })
      .join("") || '<p class="nota">No sigues ningún tema. Elige alguno en Ajustes.</p>';
  }

  function pintarAjustes() {
    // Los controles se crean una vez y luego solo se actualizan, para no perder el foco.
    const perfiles = $("#perfiles");
    if (!perfiles.children.length) {
      perfiles.innerHTML = Object.entries(M.PERFILES)
        .map(([id, p]) => {
          const reparto = M.CLASES.map((c) => `${p.objetivo[c.id]}`).join(" / ");
          return `<label class="perfil">
            <input type="radio" name="perfil" value="${id}" id="perfil-${id}">
            <span class="perfil-nombre">${esc(p.nombre)}</span>
            <span class="perfil-desc">${esc(p.descripcion)}</span>
            <span class="perfil-reparto">RV / RF / Liquidez / Alt.: ${esc(reparto)}</span>
          </label>`;
        })
        .join("");
    }
    $$('input[name="perfil"]', perfiles).forEach((r) => {
      r.checked = r.value === estado.perfil;
    });

    const objetivos = $("#objetivos");
    if (!objetivos.children.length) {
      objetivos.innerHTML = M.CLASES.map(
        (c) => `<div class="campo">
          <label for="obj-${c.id}"><span class="reparto-nombre"><span class="muestra" style="--c:${COLOR_CLASE[c.id]}"></span>${esc(c.nombre)}</span></label>
          <div class="con-unidad"><input id="obj-${c.id}" data-objetivo="${c.id}" type="number" min="0" max="100" step="1" inputmode="numeric"><span>%</span></div>
        </div>`
      ).join("");
    }
    M.CLASES.forEach((c) => {
      const input = $(`#obj-${c.id}`);
      if (document.activeElement !== input) input.value = estado.objetivo[c.id];
    });
    const suma = M.CLASES.reduce((s, c) => s + M.num(estado.objetivo[c.id]), 0);
    $("#suma-objetivo").innerHTML =
      Math.abs(suma - 100) < 0.5
        ? `Suma ${esc(M.pct(suma))}.`
        : `<span class="negativo">Suma ${esc(M.pct(suma))}: ajústalo para que llegue al 100 %.</span>`;

    const temas = $("#temas-elegir");
    if (!temas.children.length) {
      temas.innerHTML = Noticias.TEMAS.map(
        (t) => `<label class="tema-chip"><input type="checkbox" data-tema="${t.id}" id="tema-${t.id}">${esc(t.nombre)}</label>`
      ).join("");
    }
    $$("[data-tema]", temas).forEach((c) => {
      c.checked = estado.noticias.temas.includes(c.dataset.tema);
    });

    [
      ["#a-aportacion", estado.aportacionMensual],
      ["#a-umbral", estado.umbral],
      ["#a-gastos", estado.gastosMensuales || ""],
      ["#n-fuente", estado.noticias.fuente],
      ["#n-clave", estado.noticias.clave],
    ].forEach(([id, v]) => {
      if (document.activeElement !== $(id)) $(id).value = v;
    });
  }

  // ---------- vistas ----------

  function vistaActual() {
    const v = location.hash.slice(1);
    return VISTAS.includes(v) ? v : "resumen";
  }

  function mostrarVista() {
    const v = vistaActual();
    VISTAS.forEach((x) => {
      $(`#vista-${x}`).hidden = x !== v;
    });
    $$(".pestanas a").forEach((a) => {
      if (a.dataset.vista === v) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (v === "resumen") pintarEvolucion();
    if (v === "noticias") cargarNoticias(false);
  }

  window.addEventListener("hashchange", () => {
    mostrarVista();
    window.scrollTo(0, 0);
  });

  // ---------- diálogo de posición ----------

  const dlgPosicion = $("#dlg-posicion");
  let editando = null;
  let claseElegida = false;

  $("#p-tipo").innerHTML = Object.entries(M.TIPOS)
    .map(([id, t]) => `<option value="${id}">${esc(t.nombre)}</option>`)
    .join("");
  $("#p-clase").innerHTML = M.CLASES.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");

  function ajustarCamposTipo() {
    const tipo = $("#p-tipo").value;
    $$("[data-solo]", dlgPosicion).forEach((n) => {
      const solo = n.dataset.solo;
      n.hidden =
        (solo === "cuenta" && tipo !== "cuenta") ||
        (solo === "valor" && tipo === "cuenta") ||
        (solo === "fondo" && !["fondo", "etf"].includes(tipo));
    });
    if (!claseElegida) $("#p-clase").value = M.TIPOS[tipo].clase;
  }

  function mostrarError(texto) {
    const error = $("#p-error");
    error.textContent = texto || "";
    error.hidden = !texto;
  }

  function abrirPosicion(id) {
    const p = id ? estado.posiciones.find((x) => x.id === id) : null;
    editando = p ? p.id : null;
    claseElegida = Boolean(p);
    mostrarError("");
    desarmar($("#p-eliminar"));
    $("#dlg-posicion-titulo").textContent = p ? "Editar posición" : "Añadir posición";
    const hoy = M.fechaISO(new Date());
    $("#p-nombre").value = p ? p.nombre : "";
    $("#p-tipo").value = p ? p.tipo : "fondo";
    $("#p-clase").value = p ? p.clase : "rv";
    $("#p-ticker").value = p ? p.ticker : "";
    $("#p-entidad").value = p ? p.entidad : "";
    $("#p-saldo").value = p && p.tipo === "cuenta" ? p.participaciones : "";
    $("#p-participaciones").value = p && p.tipo !== "cuenta" ? p.participaciones : "";
    $("#p-precio-medio").value = p && p.tipo !== "cuenta" ? p.precioMedio : "";
    $("#p-precio-actual").value = p && p.tipo !== "cuenta" ? p.precioActual : "";
    $("#p-fecha").value = p && p.fechaPrecio ? p.fechaPrecio : hoy;
    $("#p-ter").value = p && p.ter ? p.ter : "";
    $("#p-operacion").hidden = !p || p.tipo === "cuenta";
    $("#op-tipo").value = "compra";
    $("#op-participaciones").value = "";
    $("#op-precio").value = p ? p.precioActual : "";
    $("#op-fecha").value = hoy;
    $("#p-eliminar").hidden = !p;
    ajustarCamposTipo();
    dlgPosicion.showModal();
    $("#p-nombre").focus();
  }

  $("#p-tipo").addEventListener("change", ajustarCamposTipo);
  $("#p-clase").addEventListener("change", () => {
    claseElegida = true;
  });

  function leerPosicion() {
    const nombre = $("#p-nombre").value.trim();
    if (!nombre) throw new Error("Escribe un nombre para la posición.");
    const tipo = $("#p-tipo").value;
    const base = {
      nombre,
      tipo,
      clase: $("#p-clase").value,
      ticker: $("#p-ticker").value.trim(),
      entidad: $("#p-entidad").value.trim(),
      ter: ["fondo", "etf"].includes(tipo) ? Math.max(0, numero("#p-ter") || 0) : 0,
    };
    if (tipo === "cuenta") {
      const saldo = numero("#p-saldo");
      if (!(saldo >= 0)) throw new Error("Indica el saldo de la cuenta.");
      return { ...base, participaciones: saldo, precioMedio: 1, precioActual: 1, fechaPrecio: M.fechaISO(new Date()) };
    }
    const participaciones = numero("#p-participaciones");
    const precioActual = numero("#p-precio-actual");
    let precioMedio = numero("#p-precio-medio");
    if (!(participaciones >= 0)) throw new Error("Indica cuántas participaciones tienes.");
    if (!(precioActual > 0)) throw new Error("Indica el precio actual (mayor que cero).");
    if (!(precioMedio >= 0)) precioMedio = precioActual;
    return {
      ...base,
      participaciones,
      precioMedio,
      precioActual,
      fechaPrecio: $("#p-fecha").value || M.fechaISO(new Date()),
    };
  }

  $("#form-posicion").addEventListener("submit", (e) => {
    e.preventDefault();
    let datos;
    try {
      datos = leerPosicion();
    } catch (err) {
      mostrarError(err.message);
      return;
    }
    // Los lotes (para el FIFO) solo se rehacen si cambian participaciones o precio medio.
    const conLotes = (previa) => {
      if (datos.tipo === "cuenta") return { ...datos, lotes: undefined };
      const iguales =
        previa &&
        Math.abs(M.num(previa.participaciones) - datos.participaciones) < 1e-9 &&
        Math.abs(M.num(previa.precioMedio) - datos.precioMedio) < 1e-9;
      return {
        ...datos,
        lotes: iguales ? M.lotesDe(previa) : M.lotesDesde(datos.participaciones, datos.precioMedio, datos.fechaPrecio),
      };
    };
    if (editando) {
      estado.posiciones = estado.posiciones.map((p) => (p.id === editando ? { ...p, ...conLotes(p) } : p));
    } else {
      estado.posiciones.push({ id: M.nuevoId(), origen: "manual", ...conLotes(null) });
    }
    guardar();
    pintar();
    dlgPosicion.close();
    avisar(editando ? "Posición actualizada" : "Posición añadida");
  });

  function registrarOperacion() {
    const p = estado.posiciones.find((x) => x.id === editando);
    if (!p) return;
    const op = {
      tipo: $("#op-tipo").value,
      participaciones: numero("#op-participaciones"),
      precio: numero("#op-precio"),
      fecha: $("#op-fecha").value || M.fechaISO(new Date()),
    };
    let resultado;
    try {
      resultado = M.aplicarOperacion(p, op);
    } catch (err) {
      mostrarError(err.message);
      return;
    }
    estado.posiciones = estado.posiciones.map((x) => (x.id === p.id ? resultado.posicion : x));
    estado.operaciones.push({
      id: M.nuevoId(),
      posicionId: p.id,
      nombre: p.nombre,
      ...op,
      ganancia: Math.round(resultado.ganancia * 100) / 100,
    });
    guardar();
    pintar();
    dlgPosicion.close();
    avisar(
      op.tipo === "venta"
        ? `Venta registrada. Plusvalía: ${conSigno(resultado.ganancia, M.eur)}`
        : "Compra registrada. Precio medio recalculado."
    );
  }

  function eliminarPosicion() {
    const p = estado.posiciones.find((x) => x.id === editando);
    estado.posiciones = estado.posiciones.filter((x) => x.id !== editando);
    guardar();
    pintar();
    dlgPosicion.close();
    avisar(`${p ? p.nombre : "Posición"} eliminada`);
  }

  // ---------- diálogo de precios ----------

  const dlgPrecios = $("#dlg-precios");

  function abrirPrecios() {
    const conPrecio = estado.posiciones.filter((p) => p.tipo !== "cuenta");
    if (!conPrecio.length) {
      avisar("Añade primero alguna posición con precio.");
      return;
    }
    $("#lista-precios").innerHTML = conPrecio
      .map(
        (p) => `<div class="precio-fila">
          <label for="precio-${esc(p.id)}">${esc(p.nombre)}<span>Último: ${esc(fmtPrecio.format(p.precioActual))}, ${esc(haceDias(p.fechaPrecio))}</span></label>
          <div class="con-unidad"><input id="precio-${esc(p.id)}" data-precio="${esc(p.id)}" type="number" min="0" step="any" inputmode="decimal" value="${esc(p.precioActual)}"><span>€</span></div>
        </div>`
      )
      .join("");
    dlgPrecios.showModal();
    const primero = $("[data-precio]", dlgPrecios);
    if (primero) {
      primero.focus();
      primero.select();
    }
  }

  $("#form-precios").addEventListener("submit", (e) => {
    e.preventDefault();
    const hoy = M.fechaISO(new Date());
    const nuevos = {};
    $$("[data-precio]", dlgPrecios).forEach((input) => {
      if (input.valueAsNumber > 0) nuevos[input.dataset.precio] = input.valueAsNumber;
    });
    estado.posiciones = estado.posiciones.map((p) =>
      nuevos[p.id] ? { ...p, precioActual: nuevos[p.id], fechaPrecio: hoy } : p
    );
    guardar();
    pintar();
    dlgPrecios.close();
    const n = Object.keys(nuevos).length;
    avisar(n === 1 ? "1 precio actualizado" : `${n} precios actualizados`);
  });

  // ---------- importación CSV ----------

  const dlgImportar = $("#dlg-importar");
  let preparado = null;

  function abrirImportar() {
    preparado = null;
    $("#i-archivo").value = "";
    $("#i-resumen").hidden = true;
    $("#i-error").hidden = true;
    $("#i-confirmar").disabled = true;
    dlgImportar.showModal();
  }

  function mostrarResumenImportacion(p) {
    const libro = p.libro;
    const anio = String(new Date().getFullYear());
    const plusvalias = libro.operaciones
      .filter((o) => o.tipo === "venta" && !o.incompleta && o.fecha.startsWith(anio))
      .reduce((s, o) => s + o.ganancia, 0);
    const cuenta = (t) => p.recuento[t] || 0;
    const efectivo = cuenta("ingreso") + cuenta("retirada") + cuenta("gasto") + cuenta("impuesto");
    const filas = [
      ["Posiciones abiertas", String(libro.posiciones.length)],
      ["Compras", String(cuenta("compra"))],
      ["Ventas", `${cuenta("venta")}${cuenta("venta") ? ` · plusvalías ${anio}: ${conSigno(plusvalias, M.eur)}` : ""}`],
      ["Dividendos e intereses", String(cuenta("dividendo") + cuenta("interes"))],
      ["Movimientos de efectivo", `${efectivo} (solo cuentan para el saldo)`],
      ["Efectivo calculado", M.eur(libro.efectivo)],
    ];
    const ignoradas = Object.entries(p.ignoradas);
    const coincidentes = estado.ejemplo
      ? []
      : estado.posiciones.filter(
          (x) => x.origen !== p.formato && libro.posiciones.some((a) => (a.isin && a.isin === x.isin) || a.nombre === x.nombre)
        );
    const notas = [
      estado.ejemplo
        ? "La cartera de ejemplo se borrará."
        : `Se sustituye lo importado antes desde ${p.nombreFormato}. Lo que añadiste a mano se queda.`,
      ...(coincidentes.length
        ? [`Ya tienes a mano ${coincidentes.map((x) => x.nombre).join(", ")}: revisa que no quede duplicado.`]
        : []),
      "Compara el efectivo calculado con el saldo de la app: si el archivo no trae todo el historial, no coincidirá.",
      ...libro.avisos.slice(0, 5),
    ];
    $("#i-resumen").innerHTML = `
      <p><strong>Formato: ${esc(p.nombreFormato)}</strong> · ${esc(String(p.movimientos.length))} movimientos leídos</p>
      <dl class="importacion-datos">${filas.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join("")}</dl>
      ${ignoradas.length ? `<p class="nota">Sin importar: ${esc(ignoradas.map(([k, v]) => `${k} (${v})`).join(", "))}</p>` : ""}
      <ul class="pasos">${notas.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
    $("#i-resumen").hidden = false;
  }

  $("#i-archivo").addEventListener("change", (e) => {
    const archivo = e.target.files && e.target.files[0];
    preparado = null;
    $("#i-confirmar").disabled = true;
    $("#i-resumen").hidden = true;
    $("#i-error").hidden = true;
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        preparado = Libro.prepararImportacion(String(lector.result));
        if (!preparado.movimientos.length) throw new Error("El archivo no contiene movimientos.");
        mostrarResumenImportacion(preparado);
        $("#i-confirmar").disabled = false;
      } catch (err) {
        preparado = null;
        $("#i-error").textContent = err.message;
        $("#i-error").hidden = false;
      }
    };
    lector.onerror = () => {
      $("#i-error").textContent = "No se ha podido leer el archivo.";
      $("#i-error").hidden = false;
    };
    lector.readAsText(archivo);
  });

  $("#form-importar").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!preparado) return;
    const base = estado.ejemplo ? M.estadoVacio() : estado;
    estado = Libro.fusionar(base, preparado.libro, preparado.formato, { entidad: preparado.entidad });
    guardar();
    pintar();
    dlgImportar.close();
    avisar(`${preparado.libro.posiciones.length} posiciones importadas de ${preparado.nombreFormato}`);
    if (location.hash !== "#posiciones") location.hash = "posiciones";
  });

  // ---------- ajustes ----------

  $("#form-ajustes").addEventListener("submit", (e) => e.preventDefault());

  $("#form-ajustes").addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "perfil") {
      estado.perfil = t.value;
      estado.objetivo = { ...M.PERFILES[t.value].objetivo };
      avisar(`Perfil ${M.PERFILES[t.value].nombre.toLowerCase()} guardado`);
    } else if (t.dataset.objetivo) {
      estado.objetivo[t.dataset.objetivo] = Math.max(0, Math.min(100, M.num(t.valueAsNumber)));
    } else if (t.id === "a-aportacion") {
      estado.aportacionMensual = Math.max(0, M.num(t.valueAsNumber));
    } else if (t.id === "a-umbral") {
      estado.umbral = Math.max(1, Math.min(25, M.num(t.valueAsNumber) || 5));
    } else if (t.id === "a-gastos") {
      estado.gastosMensuales = Math.max(0, M.num(t.valueAsNumber));
    } else if (t.dataset.tema) {
      const resto = estado.noticias.temas.filter((id) => id !== t.dataset.tema);
      estado.noticias.temas = t.checked ? [...resto, t.dataset.tema] : resto;
    } else if (t.id === "n-fuente") {
      const url = t.value.trim();
      if (url && !/^https:\/\//.test(url)) {
        avisar("La dirección de la fuente debe empezar por https://");
        return;
      }
      estado.noticias.fuente = url;
      avisar(url ? "Fuente de noticias guardada" : "Fuente de noticias desconectada");
    } else if (t.id === "n-clave") {
      estado.noticias.clave = t.value.trim();
    } else {
      return;
    }
    guardar();
    pintar();
  });

  // ---------- datos ----------

  function exportar() {
    const texto = JSON.stringify({ ...estado, ejemplo: undefined }, null, 2);
    const area = $("#d-texto");
    area.value = texto;
    const seleccionar = () => {
      area.focus();
      area.select();
      avisar("Copia lista: selecciónala y cópiala a un archivo o una nota.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(texto)
        .then(() => avisar("Copia de seguridad copiada. Pégala en un archivo o una nota."))
        .catch(seleccionar);
    } else {
      seleccionar();
    }
  }

  function importar(texto) {
    let nuevo;
    try {
      nuevo = M.normalizarEstado(JSON.parse(texto));
    } catch (err) {
      avisar(
        err instanceof SyntaxError
          ? "No se puede leer: el texto pegado no es una copia de seguridad completa."
          : err.message
      );
      return;
    }
    estado = { ...nuevo, ejemplo: false };
    guardar();
    pintar();
    $("#d-texto").value = "";
    avisar(`Cartera importada: ${estado.posiciones.length} posiciones`);
  }

  $("#d-archivo").addEventListener("change", (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => importar(String(lector.result));
    lector.onerror = () => avisar("No se ha podido leer el archivo.");
    lector.readAsText(archivo);
    e.target.value = "";
  });

  // Botones peligrosos: piden una segunda pulsación en lugar de un confirm().
  function armar(boton) {
    boton.dataset.textoOriginal = boton.dataset.textoOriginal || boton.textContent;
    boton.dataset.armado = "1";
    boton.textContent = boton.dataset.confirmar;
    clearTimeout(boton._desarmar);
    boton._desarmar = setTimeout(() => desarmar(boton), 4000);
  }

  function desarmar(boton) {
    if (!boton.dataset.armado) return;
    delete boton.dataset.armado;
    boton.textContent = boton.dataset.textoOriginal;
  }

  function confirmado(boton) {
    if (boton.dataset.armado) {
      desarmar(boton);
      return true;
    }
    armar(boton);
    return false;
  }

  // ---------- acciones ----------

  const ACCIONES = {
    nueva: () => abrirPosicion(null),
    precios: abrirPrecios,
    "importar-csv": abrirImportar,
    "actualizar-noticias": () => {
      if (!estado.noticias.fuente) {
        avisar("Conecta primero la fuente de noticias en Ajustes.");
        return;
      }
      cargarNoticias(true);
    },
    "registrar-operacion": registrarOperacion,
    eliminar: (b) => confirmado(b) && eliminarPosicion(),
    empezar: () => {
      estado = M.estadoVacio();
      guardar();
      pintar();
      if (location.hash !== "#posiciones") location.hash = "posiciones";
      abrirPosicion(null);
    },
    "restablecer-objetivo": () => {
      estado.objetivo = { ...M.PERFILES[estado.perfil].objetivo };
      guardar();
      pintar();
      avisar("Reparto objetivo restablecido");
    },
    exportar,
    importar: () => {
      const texto = $("#d-texto").value.trim();
      if (!texto) {
        avisar("Pega primero una copia de seguridad en el cuadro de texto.");
        return;
      }
      importar(texto);
    },
    "cargar-ejemplo": (b) => {
      if (!confirmado(b)) return;
      estado = Ejemplo.crearEjemplo(new Date());
      guardar();
      pintar();
      avisar("Cartera de ejemplo cargada");
    },
    borrar: (b) => {
      if (!confirmado(b)) return;
      estado = M.estadoVacio();
      guardar();
      pintar();
      avisar("Datos borrados");
    },
  };

  document.addEventListener("click", (e) => {
    const editar = e.target.closest("[data-editar]");
    if (editar) {
      abrirPosicion(editar.dataset.editar);
      return;
    }
    const cerrar = e.target.closest("[data-cerrar]");
    if (cerrar) {
      cerrar.closest("dialog").close();
      return;
    }
    const boton = e.target.closest("[data-accion]");
    if (boton && ACCIONES[boton.dataset.accion]) ACCIONES[boton.dataset.accion](boton);
  });

  // Cerrar un diálogo al pulsar fuera de él.
  $$("dialog").forEach((dlg) =>
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    })
  );

  // El gráfico se redibuja al cambiar el ancho disponible.
  if ("ResizeObserver" in window) {
    let ultimoAncho = 0;
    let pendiente = false;
    new ResizeObserver((entradas) => {
      const ancho = Math.round(entradas[0].contentRect.width);
      if (!ancho || ancho === ultimoAncho || pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        ultimoAncho = ancho;
        pintarEvolucion();
      });
    }).observe($("#evolucion"));
  }

  pintar();
  mostrarVista();
})();
