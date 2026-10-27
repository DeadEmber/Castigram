# 🗼 Atalaya — tu cartera, a la vista

App sencilla para **seguir tu cartera de inversión**, recibir **recomendaciones
claras** y estar al día de las **noticias** que te afectan. La app es una página
estática (sin servidor ni instalación); solo las noticias necesitan una pequeña
función en Supabase.

## Cómo usarla

Abre `cartera/index.html` en el navegador (doble clic basta). Si prefieres
servirla:

```bash
npx serve cartera
```

La primera vez verás una **cartera de ejemplo** con cifras inventadas. Pulsa
**«Empezar con la mía»** para borrarla, o importa directamente tu historial de
Trade Republic.

## Qué hace

| Sección | Para qué sirve |
|---|---|
| **Resumen** | Valor total, ganancia sobre lo invertido, dividendos e intereses del año, comisiones, reparto por clase de activo frente a tu objetivo y evolución en el tiempo. |
| **Posiciones** | Tus fondos, ETF, acciones, bonos, cuentas y criptomonedas, agrupados por clase. Importación del CSV de Trade Republic, compras y ventas a mano, y últimas operaciones. |
| **Consejos** | Recomendaciones sobre tu cartera ordenadas por prioridad y la tabla de compraventas para volver justo a tu objetivo. |
| **Noticias** | Dos bloques: titulares sobre **lo que tienes** y titulares de **temas de mercado** que sigues aunque no los tengas (oro, BCE, petróleo…), cada uno con tu exposición. |
| **Ajustes** | Perfil de riesgo, reparto objetivo, aportación mensual, temas de noticias, fuente de noticias y copia de seguridad. |

## Alimentar la cartera

### Trade Republic (CSV)

Trade Republic no tiene API pública. Desde abril de 2026 su app permite
descargar todo el historial en CSV: **Perfil → Extractos → Exportación de
transacciones** (el nombre del menú puede variar).

En Atalaya: **Posiciones → Importar de Trade Republic** y elige el archivo. Se
lee en el navegador y no se envía a ningún sitio. Antes de importar ves un
resumen: posiciones, compras, ventas con su plusvalía, dividendos, efectivo
calculado y lo que no se ha podido reconocer.

- Volver a importar **sustituye** lo que vino antes de Trade Republic y respeta
  lo que corregiste a mano (clase de activo, tipo, comisión anual y precios
  actualizados después).
- Las posiciones añadidas a mano no se tocan.
- Se ignoran las cuentas junior. Los pagos con tarjeta, ingresos y retiradas
  solo cuentan para el saldo de efectivo.
- Trade Republic no publica el formato. El lector (`js/importar.js`) usa las
  columnas que documentan otros importadores de código abierto (`datetime`,
  `type`, `symbol`, `shares`, `price`, `amount`, `fee`, `tax`…). Si tu archivo
  trae un tipo de movimiento nuevo, aparece como «No reconocido» en el resumen
  en lugar de importarse mal.

### Plantilla para otros brókeres

Un CSV con estas columnas (coma o punto y coma; decimales con punto o coma):

```
fecha;tipo;nombre;isin;participaciones;precio;comision;impuestos
15/01/2026;compra;Fondo indexado MSCI World;IE00XXXXXXXX;10;14,20;0;0
```

`tipo` admite compra, venta, dividendo, interes, ingreso y retirada.

### El libro de operaciones (FIFO)

`js/libro.js` reconstruye la cartera a partir de los movimientos:

- Cada compra es un **lote** con su coste (precio más comisiones).
- Cada venta consume primero los lotes más antiguos (**FIFO**, el criterio del
  IRPF para valores homogéneos). La plusvalía es el importe de la venta menos
  comisiones y menos el coste de esos lotes.
- Los splits multiplican las participaciones sin cambiar el coste.
- Si se vende más de lo que consta comprado (historial incompleto), la venta se
  marca y no cuenta para los consejos fiscales.

Las compras y ventas registradas a mano usan el mismo FIFO.

## Noticias

La app pide los titulares a la función `supabase/functions/noticias`, que busca
en el RSS de Google Noticias limitado a prensa económica especializada
(Expansión, Cinco Días, elEconomista, El Confidencial, Bolsamanía, Investing,
Morningstar, Europa Press, Finanzas.com y El Español). Solo guarda titular,
medio, fecha y enlace: para leer la noticia vas a la web del medio.

- **Sobre tu cartera**: una búsqueda por cada posición importante (hasta 8),
  con el nombre limpio de palabras genéricas («Fondo indexado MSCI World» →
  «MSCI World»).
- **Mercado en general**: una búsqueda por cada tema que sigues. Cada tarjeta
  dice cuánto te afecta («No tienes exposición», «Te afecta: 26 % de tu
  cartera»). Los temas están en `js/noticias.js`.

### Ponerla en marcha

1. Crea un proyecto en [supabase.com](https://supabase.com) (o usa el de
   Castigram).
2. Despliega la función:

   ```bash
   supabase functions deploy noticias --no-verify-jwt
   ```

   Sin `--no-verify-jwt` también funciona, pero entonces hay que poner la clave
   pública (*anon key*) en Ajustes.
3. En **Ajustes → Noticias**, pega la dirección
   `https://TU-PROYECTO.supabase.co/functions/v1/noticias`.

Los titulares se guardan 30 minutos en el navegador y la función los guarda 15
minutos, para no repetir búsquedas.

## Reglas de las recomendaciones

Todas están en `js/motor.js` (`recomendaciones()`), son deterministas y se
explican en el propio consejo:

- **Desviación del objetivo**: una clase se aleja más del margen (±5 puntos por
  defecto). Si el exceso está en fondos, propone un **traspaso** (sin
  impuestos); si está en ETF o acciones con plusvalía, avisa de que vender
  tributa en el IRPF y calcula en cuántos meses lo corriges solo con
  aportaciones.
- **Reparto de la aportación mensual** hacia las clases que más faltan, sin
  vender nada.
- **Concentración**: una sola acción o criptomoneda por encima del 10 %.
- **Criptomonedas** por encima del límite del perfil (2 / 5 / 10 %).
- **Comisiones altas**: fondos o ETF con TER mayor del 1 %, con el ahorro anual
  frente a un indexado.
- **Colchón de emergencia** menor de 3 meses de gastos.
- **Diversificación**: renta variable concentrada en pocas acciones sueltas.
- **Fondo de Garantía de Depósitos**: más de 100.000 € en cuentas de una misma
  entidad.
- **Pérdidas fuertes** (más del 20 %) para revisar la tesis.
- **Compensación fiscal** de octubre a diciembre si has vendido con beneficio y
  tienes acciones o ETF en pérdidas (con el aviso de la regla de los dos
  meses).
- **Precios sin actualizar** desde hace más de una semana.

Son orientativas y **no sustituyen el asesoramiento financiero**.

## Tus datos

Se guardan en el `localStorage` del navegador: no salen de tu equipo. Desde
**Ajustes → Tus datos** puedes copiar una copia de seguridad (JSON) e
importarla en otro navegador.

## Estructura

```
cartera/
  index.html          Estructura de la página
  estilos.css         Diseño (tema claro y oscuro)
  js/motor.js         Cálculos, lotes FIFO y recomendaciones (funciones puras)
  js/importar.js      Lectura de CSV: Trade Republic y plantilla propia
  js/libro.js         Libro de operaciones: CSV → posiciones, ventas, dividendos
  js/noticias.js      Temas, exposición y reparto de titulares en dos bloques
  js/ejemplo.js       Cartera de ejemplo
  js/graficos.js      Gráfico de evolución en SVG
  js/app.js           Interfaz y almacenamiento
  tests/              Tests
supabase/functions/noticias/
  index.ts            Función que busca titulares en prensa especializada
  rss.ts              Lector de RSS y Atom
```

## Tests

```bash
node --test cartera/tests/*.test.js cartera/tests/*.test.mjs
```

`rss.test.mjs` importa el TypeScript de la función directamente (Node 22.18 o
posterior elimina los tipos al cargarlo).

## Siguientes pasos

- **Precios en tiempo real**: una segunda función en Supabase que traiga
  cotizaciones por ISIN y actualice las posiciones al abrir la app.
- **Sincronizar entre dispositivos** con Supabase, reutilizando el login de
  Castigram.
- **Varias monedas** (USD, GBP) con tipo de cambio.
- **Rentabilidad ponderada por dinero (TIR)** a partir de las operaciones.
- **Explicaciones con IA** sobre los consejos y las noticias, manteniendo las
  reglas como base.
