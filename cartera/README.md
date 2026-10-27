# 🗼 Atalaya — tu cartera, a la vista

App sencilla para **seguir tu cartera de inversión** y recibir **recomendaciones
claras** sobre qué ajustar. Es independiente de Castigram: no necesita servidor,
base de datos ni instalación.

## Cómo usarla

Abre `cartera/index.html` en el navegador (doble clic basta). Si prefieres
servirla:

```bash
npx serve cartera
```

La primera vez verás una **cartera de ejemplo** con cifras inventadas. Pulsa
**«Empezar con la mía»** para borrarla y añadir tus posiciones.

## Qué hace

| Sección | Para qué sirve |
|---|---|
| **Resumen** | Valor total, ganancia sobre lo invertido, comisiones al año, reparto por clase de activo frente a tu objetivo y evolución en el tiempo. |
| **Posiciones** | Tus fondos, ETF, acciones, bonos, cuentas y criptomonedas, agrupados por clase. Al abrir una posición puedes registrar compras (recalcula el precio medio) y ventas (guarda la plusvalía). |
| **Consejos** | Recomendaciones ordenadas por prioridad y la tabla de compraventas para volver justo a tu objetivo. |
| **Ajustes** | Perfil de riesgo, reparto objetivo, aportación mensual, margen de aviso, gastos mensuales y copia de seguridad. |

### Reglas de las recomendaciones

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
  index.html        Estructura de la página
  estilos.css       Diseño (tema claro y oscuro)
  js/motor.js       Cálculos y recomendaciones (funciones puras)
  js/ejemplo.js     Cartera de ejemplo
  js/graficos.js    Gráfico de evolución en SVG
  js/app.js         Interfaz y almacenamiento
  tests/            Tests del motor
```

## Tests

```bash
node --test cartera/tests/*.test.js
```

## Ideas para la siguiente versión

- **Precios automáticos** desde una API de cotizaciones (necesita clave y un
  pequeño servidor o función para evitar CORS).
- **Sincronizar entre dispositivos** con Supabase, reutilizando el login de
  Castigram.
- **Varias monedas** (USD, GBP) con tipo de cambio.
- **Rentabilidad ponderada por dinero (TIR)** a partir de las operaciones.
- **Explicaciones con IA** sobre los consejos, manteniendo las reglas como base.
