---
name: verificar
description: Corre y fotografía el simulador CC2 para comprobar un cambio - pruebas de dominio con node --test, prueba de humo por el DOM real en Edge headless a varios altos de ventana, y capturas de la aplicación en un estado concreto. Usar al terminar cualquier cambio en el simulador, y siempre que haga falta ver la aplicación funcionando, levantarla, fotografiarla o comprobar que algo se dibuja bien.
---

# Verificar el simulador

Cómo se comprueba un cambio en este repositorio. **Al tocar la vista se corren las dos**: las pruebas de dominio no ven el dibujo, y la prueba de humo ha destapado defectos reales que `node --test` no podía ver.

La aplicación se abre por `file://` (ver `docs/CLAUDE.md` §4): no hay servidor que levantar ni nada que apagar después.

## 1. Pruebas de dominio y algoritmos

```
npm test
```

`node --test pruebas/*.test.js`. Cubre dominio, algoritmos, elisión — todo lo que es cálculo puro. Los archivos se cargan con el shim `pruebas/apoyo.js`, que simula `window` para poder requerir los scripts clásicos tal cual.

**Un archivo nuevo en `js/` hay que registrarlo en cuatro sitios**: `index.html`, `pruebas/captura.html`, `pruebas/humo.html` y `pruebas/apoyo.js`. Si una prueba nueva falla con "no es una función", es esto.

## 2. Prueba de humo por el DOM real

```
node .claude/skills/verificar/scripts/humo.js
```

Abre `pruebas/humo.html` en Edge headless **a 700, 800 y 950 px de alto** y reporta el informe. Sale con código 1 si algo falla. Un solo alto: `humo.js 700`. El informe entero, paso a paso: `humo.js --informe`.

Cubre catálogo, traza, métricas, bitácora, **layout** y **apilado**, entrando por el DOM como lo haría el estudiante. Los tres altos no son un capricho: la pantalla se ancla al viewport y lo que cabe a 950 px puede no caber a 700 — así se detectaron las regresiones de layout.

**Al comprobar layout, medir el contenido y no la caja.** `.estructura-vertical` lleva `max-height: 100%`, así que su rectángulo siempre cae dentro del viewport aunque por dentro sobresalgan filas: hay que comparar `scrollHeight` con `clientHeight`, o mirar dónde queda la casilla marcada. Una comprobación que medía la caja escondió durante semanas que la tabla desbordaba.

**Al medir un rótulo, medir el texto y no la caja.** Un relleno sobrante deja el rectángulo del elemento centrado con las letras corridas dentro de él: `getBoundingClientRect()` da por bueno lo que a ojo está torcido. Un `Range` sobre el contenido (`selectNodeContents`) devuelve dónde están de verdad las letras. Así se cazó el rótulo «Paso n» de binaria (CLAUDE.md 6.3).

**Y cuidado con medir posiciones mientras el FLIP está en vuelo.** El reordenamiento aplica un `transform` a las casillas, y `getBoundingClientRect()` devuelve la posición animada, no la final: una auditoría de rótulos dio 121 px de desvío en secuencial y 102 en la tabla hash, y las dos eran mentira —la captura mostraba todo alineado—. Comparar anchos, comparar elementos que se animan por igual, o mirar la captura antes de creerle al número.

Dos ayudas ya escritas en `humo.html` para las regresiones de dibujo: `afirmarCasillasParejas` (todas las casillas miden lo mismo y nada se sale de la suya) y `afirmarColumnasAlineadas` (las filas de la vista vertical alinean sus columnas).

**Si una prueba nueva de humo deja una inserción a medias**, la culpa suele ser de `agotarTraza()`: sus doce clics no bastan cuando la traza es larga —el cálculo de la dirección, más una posición recorrida por paso—. Se le pasa el número de clics: `agotarTraza(30)`.

## 3. Capturas de la aplicación

```
node .claude/skills/verificar/scripts/captura.js "vista=anidados&n=10&l=4&paso=fin"
```

Con `--quieto` la foto se toma con movimiento reducido: sin él, el navegador sin interfaz congela las animaciones en su primer cuadro y un árbol o un bosque a mitad de FLIP sale desarmado (2026-09-30). Imprime la ruta del PNG (por defecto, en el directorio temporal del sistema; las capturas son material de trabajo, no del proyecto). Un segundo argumento suelto fija el destino, y `--alto` / `--ancho` el tamaño de ventana.

Vistas de `pruebas/captura.html`: `menu` (con `&recientes=5` siembra la tira de recientes), `secuencial`, `binaria`, `hash`, `hash-libre`, `anidados`, `encadenamiento`, `arbol-digital`, `residuos`, `residuos-multiples`, `cubetas`, `secuencial-externa`, `binaria-externa`, `eliminar-secuencial`, `eliminar-binaria`, `eliminar-hash`, y `entrar&titulo=<tema tal como sale en el índice>`, que deja la pantalla recién entrada, sin operar: es lo primero que ve el estudiante y lo que más fácil se olvida revisar (así se escapó el cuadro vacío de Reproducción, 2026-09-30).

Parámetros útiles: `paso=fin` recorre la traza entera (`paso=<n>` se detiene en un paso concreto, que es como se fotografía la casilla marcada antes de que se mueva nada), y en los temas de transformación de claves `tema=`, `tratamiento=`, `n=`, `l=`, `clave=`, `base=`, `posiciones=`, `operacion=`.

Si el estado que hace falta no existe, **se agrega una función `preparar…` a `pruebas/captura.html`** en vez de improvisar clics: así queda repetible para la próxima vez.

## Trampas de este entorno

Las tres viven resueltas en `scripts/navegador.js`; están aquí por si hay que llamar a Edge a mano.

- **`--screenshot` necesita ruta absoluta de Windows.** Con una relativa falla con "Access is denied" y no explica por qué.
- **El `#salida` del volcado se extrae con una expresión regular sobre el HTML, no con `sed`.** El `<pre>` lleva atributo `style` y su texto es multilínea; grepear el volcado entero cuenta las palabras del propio script y da falsos positivos.
- **Sin `--virtual-time-budget` suficiente el volcado sale a medias**, con pruebas que ni llegaron a correr. La prueba de humo usa 30 s de tiempo virtual, que no es tiempo de reloj.

Se busca Edge en las rutas habituales de Windows y, si no está, el primer navegador de la familia Chromium que haya en el `PATH` (`microsoft-edge`, `chromium`, `google-chrome`…): **en Linux funciona sin configurar nada**. Para forzar otro, la variable de entorno `CC2_EDGE` (p. ej. `CC2_EDGE=/usr/bin/brave node …`).

## Qué se reporta al terminar

El resultado con evidencia: el conteo de `npm test`, el resultado del humo en los tres altos, y la captura cuando el cambio es visual. Los commits se hacen **solo cuando el usuario lo pide**.
