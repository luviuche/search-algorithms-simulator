# CLAUDE.md — Simulador de Ciencias de la Computación II

Contexto de dominio del proyecto. Léelo completo antes de escribir código.

---

## 1. Qué se está construyendo

Un **simulador didáctico de algoritmos de búsqueda** para la asignatura Ciencias de la Computación II (Ingeniería de Sistemas, Universidad Distrital Francisco José de Caldas).

El estudiante crea una estructura de datos, inserta claves, y busca y elimina **observando la animación** del algoritmo recorriéndola paso a paso, mientras un panel contabiliza comparaciones y accesos. Buscar y eliminar son la misma lección: eliminar es localizar con el algoritmo del tema y sacar (§5.6).

**La animación no es un adorno: es el producto.** Sin ella no se puede observar el comportamiento de un algoritmo, que es lo único que esta aplicación existe para enseñar. Cualquier decisión técnica que degrade la animación está mal, por más limpia que sea.

**Plataforma:** aplicación web que arranca desde un `index.html`. Debe funcionar abierta con `file://`, sin servidor. Puede empaquetarse como ejecutable de escritorio más adelante; el código no debe asumir Node ni APIs de escritorio.

**Idioma:** toda la interfaz, los mensajes y los identificadores de dominio en español. El código en español para términos de dominio (`clave`, `casilla`, `estructura`) y en inglés para lo genérico.

---

## 2. Glosario de dominio

Estos términos son fijos. No usar sinónimos ni en el código ni en la interfaz.

| Término | Significado | En código |
|---|---|---|
| **Tamaño de la estructura (n)** | Cantidad de casillas | `n` |
| **Longitud de clave (l)** | Dígitos o letras por clave | `l` |
| **Rango válido** | Derivado de `l`. Con `l = 4` numérico: `1000–9999` | `rangoValido(l)` |
| **Clave** | Cada dato individual | `clave` |
| **Casilla** | Cada posición de la estructura | `casilla` |
| **Dirección** | Posición calculada por una función hash | `direccion` |
| **Elisión** | Compresión visual de casillas no relevantes | `elision` |
| **Bitácora** | Registro cronológico de la sesión | `bitacora` |
| **Traza** | Secuencia de pasos que produce un algoritmo | `traza` |
| **Tema** | Cada algoritmo del catálogo (búsqueda binaria, función módulo…) | `tema` |
| **Categoría** | Cada nodo navegable del catálogo que agrupa temas o más categorías (Búsquedas, Búsquedas internas, Búsqueda por residuo…) | `hijos` |

Nunca decir *celda* por casilla, ni *dato* por clave, ni *índice* por dirección.

**Los temas no son "módulos" ni se numeran** (decisión del docente, 2026-08-18). Se identifican por su nombre: ni el catálogo ni el encabezado de la pantalla de trabajo llevan `01`, `02`, … ni la palabra *módulo*. **Tampoco las categorías**: ninguna tarjeta del menú lleva número, en ningún nivel.

**El catálogo ya no se organiza por unidad del curso** (pedido del docente, 2026-09-06): la unidad mezclaba búsquedas externas con grafos en la misma división, que es justo la mezcla que el docente no quiere ver al navegar. Se reemplazó por dos grandes temas —**Búsquedas** y **Grafos**— con sus propias categorías por dentro (§4, "El catálogo del menú").

La palabra *módulo* se reserva para dos usos que no tienen que ver con el catálogo y que sí son correctos: los **módulos ES** de JavaScript (sección 4) y la **función hash módulo** (sección 5.3).

---

## 3. Reglas de dominio

### 3.1 Indexación

**Las casillas se numeran desde 1.** Internamente el arreglo puede ser base 0, pero **toda** salida visible —visualización, mensajes, bitácora, PDF— presenta índices desde 1. Centralizar la conversión en un solo punto; no esparcir `+1` por el código.

### 3.2 Invariantes de la estructura

Estas cuatro condiciones se cumplen siempre. Cualquier operación que las rompa está mal:

1. Las claves colocadas nunca exceden `n`.
2. **Sin duplicados.** Ninguna clave aparece dos veces.
3. **Siempre ordenada ascendente.** Aplica a secuencial y a binaria (decisión del docente), **no a la transformación de claves**: ver los dos modos, abajo.
4. Toda clave cumple exactamente la longitud `l`.

**Dos modos de estructura**, porque los temas colocan las claves de forma distinta:

| Modo | Temas | Cómo coloca | Invariante 3 |
|---|---|---|---|
| `ordenada` | secuencial, binaria | Arreglo denso: la clave entra en la posición que conserva el orden, y las ocupadas son siempre el prefijo `1..cantidad`. | Aplica |
| `dispersa` | transformación de claves | La clave aterriza en la dirección que le da la función hash, así que quedan huecos en el medio. | No aplica |

En ambos modos, `estructura.claves` es el arreglo que la vista lee por casilla —la casilla `i` es `claves[i-1]`— para que dibujar la estructura no dependa del modo. Lo que cambia es que en la dispersa el arreglo nace con las `n` posiciones y su longitud no crece: **contar claves es contar posiciones definidas, no leer `claves.length`** (`dominio.estructura.cantidadClaves`). Confundir las dos cosas hace que la estructura dispersa se declare llena desde el primer momento.

La restricción de unicidad no es cosmética: en binaria los duplicados hacen ambiguo el resultado y no comparable el conteo de comparaciones; en hash un duplicado se confunde visualmente con una colisión. Aplica también al llenado automático y a la carga desde archivo.

### 3.3 Claves numéricas

- Exactamente `l` dígitos.
- **Sin ceros a la izquierda.** Con `l = 4`, `0521` es inválido.
- Rango válido: `10^(l−1)` a `10^l − 1`. Con `l = 4`: `1000–9999`.
- Sin negativos ni decimales.

### 3.4 Claves alfabéticas

*Implementación diferida. Mantener el tipo en el modelo y en la interfaz, deshabilitado.*

- Exactamente `l` letras.
- Normalización a mayúsculas.
- Tildes a letra base: Á→A, É→E, Í→I, Ó→O, Ú→U, Ü→U.
- Alfabeto A–Z, 26 letras. **La Ñ se rechaza** con advertencia.
- **Mapeo posicional:** cada letra a su posición en dos dígitos (`A=01` … `Z=26`), concatenados.
  `CASA` → `03 01 19 01` → `3011901`
  Este mapeo permite que **todas las funciones hash operen sobre números** sin lógica especial para texto. El orden numérico resultante coincide con el lexicográfico, y todas las palabras de longitud `l` producen claves transformadas de igual cantidad de dígitos, lo cual es indispensable para truncamiento y plegamiento.
- La interfaz debe poder mostrar la clave transformada junto a la palabra original, con fines didácticos.

### 3.5 Límites de `n`

| Restricción | Valor | Naturaleza |
|---|---|---|
| Límite duro | 10 000 casillas | Guarda de seguridad |
| Umbral de advertencia | 500 casillas | Sobre esto la ejecución paso a paso deja de ser observable; se advierte sin bloquear |
| Límite derivado de `l` | Claves distintas posibles | Consecuencia de la unicidad |
| Longitud máxima de clave | `l ≤ 15` (`limites.L_MAXIMA`) | Una clave de 15 cifras todavía es un entero seguro de JavaScript; con 16 o más, dos claves distintas podían salir como el mismo número (2026-10-04) |

**`n` y `l` se validan en el dominio, no solo en el formulario** (2026-10-04): `validarTamano` exige que `n` sea un entero de al menos 1 y que `l`, si el tema la pide, sea un entero entre 1 y 15. El formulario ya los bloqueaba con `min`/`max`, pero abrir un archivo llega al dominio sin pasar por él, y las invariantes (§3.2) no pueden depender de quién llame. Por lo mismo, las funciones hash que hacen cuentas con la clave entera —cuadrado, plegamiento con producto, conversión de bases— calculan con `BigInt`: en base 36 una clave de 11 cifras ya se sale del entero seguro.

**El límite derivado se valida al crear la estructura, no al insertar.** Como no hay duplicados, `n` no puede exceder la cantidad de claves distintas que existen para esa longitud: `9 × 10^(l−1)` para numéricas. Con `l = 2` solo existen 90 claves (10–99), así que `n = 150` es imposible de llenar por definición y debe rechazarse en el formulario.

No preguntar al usuario por la memoria de su equipo. El costo no está en almacenar el arreglo sino en dibujarlo, y la elisión ya acota el dibujado.

---

## 4. Arquitectura: la decisión que sostiene todo

**Los algoritmos no ejecutan ni animan. Producen una traza.**

Un algoritmo recibe la estructura y la clave buscada, y devuelve la lista completa de pasos que dio. La interfaz después reproduce esa traza a la velocidad que el usuario elija.

```js
function buscarBinaria(claves, objetivo) {
  const pasos = [];
  let inicio = 0, fin = claves.length - 1;
  let comparaciones = 0, accesos = 0;

  while (inicio <= fin) {
    const medio = Math.floor((inicio + fin) / 2);
    accesos++; comparaciones++;
    pasos.push({
      tipo: 'comparacion',
      inicio, medio, fin,
      descartadas: [...],
      comparaciones, accesos,
      mensaje: `Se compara la clave objetivo con la casilla ${medio + 1}.`
    });
    // ...
  }
  return pasos;
}
```

Esto no es preferencia de estilo. Es lo que hace posible, casi gratis:

- **Paso a paso, ejecución continua y control de velocidad** — es solo un índice sobre un arreglo.
- **Retroceder un paso**, que de otra forma exigiría reejecutar.
- **Interrumpibilidad**: si el usuario avanza rápido, se salta al paso destino sin encolar animaciones.
- **Pruebas del algoritmo sin tocar la interfaz.**
- **Exportar la traza al PDF** sin recalcular nada.

Mezclar el algoritmo con el dibujado hace todo esto difícil y produce exactamente el tipo de código que después no se puede animar bien. **No lo hagas.**

### Separación de capas

```
dominio/      claves, validación, mapeo alfabético, invariantes
algoritmos/   secuencial, binaria, funciones hash, colisiones → devuelven trazas
vista/        componentes, animación, reproducción de la traza
persistencia/ serialización .cc2, recientes
```

El dominio y los algoritmos no importan nada de la vista.

### Stack: sin framework

**HTML, CSS y JavaScript puros. Cero dependencias.**

La razón que decide: si el `index.html` debe abrirse con doble clic, el navegador bloquea los módulos ES bajo `file://`, y React o Vue exigirían un paso de compilación o cargarse desde CDN con Babel en el navegador — frágil justo el día de la sustentación.

Además, el proyecto ya está diseñado para no necesitar framework: con la traza, el estado se reduce a un arreglo de pasos y un índice. No hay estado distribuido ni sincronización entre componentes, que es lo que un framework viene a resolver. Y el acceso directo al DOM es lo que hace viable medir posiciones para animar el reordenamiento.

Reglas concretas:

- **CSS con variables nativas** para los tokens. Nada de Tailwind: con diez tokens semánticos, una paleta de framework solo abre la puerta a colores sin significado asignado.
- **Tipografías locales** vía `@font-face`, descargadas al repositorio. Nunca desde Google Fonts: la sala puede no tener internet.
- **PDF** con `window.print()` y hoja de estilos de impresión.
- **Animación** con la Web Animations API (`element.animate()`), que reemplaza animaciones en curso en lugar de encolarlas.
- **Persistencia** con las APIs del navegador. Sin librerías.
- Sin `npm install`, sin paso de compilación, sin servidor obligatorio.

**Confirmado (2026-08-06): el proyecto se abre con doble clic sobre `index.html` (`file://`).** Por lo tanto **no se usan módulos ES** (`import`/`export`): el navegador los bloquea bajo `file://`. En su lugar, cada archivo es un *script clásico* que se envuelve en un IIFE y cuelga sus símbolos de un único namespace global, `window.CC2`, organizado por capa:

```js
// js/dominio/clave.js
(function () {
  function validarClave(valor, l) { … }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.clave = { validarClave };
})();
```

Los scripts se cargan con `<script src="…">` normales, **en orden de dependencia** (dominio antes que algoritmos, algoritmos antes que vista, vista antes que `app.js`). No hay bundler ni resolución automática: si un archivo nuevo depende de otro, va después en la lista.

**La lista vive en un solo sitio: `js/manifiesto.js`** (2026-10-03). Antes estaba copiada en `index.html`, `pruebas/humo.html`, `pruebas/captura.html` y `pruebas/apoyo.js`, y olvidar una al agregar un archivo era el tropiezo de siempre. El manifiesto tiene dos grupos —`PUROS` (dominio, algoritmos, `persistencia/archivo.js`, `vista/elision.js`: nada que toque el DOM al cargarse) y `PANTALLA`— y hace dos cosas según dónde corra: en el navegador escribe un `<script>` por archivo con `document.write`, que los carga en orden y antes de lo que sigue en la página, exactamente como escritos a mano (`appendChild` los volvería asíncronos); en Node exporta las listas, y `pruebas/apoyo.js` requiere `PUROS`. Las páginas cargan `manifiesto.js` y después `app.js`, que queda fuera de la lista por ser el punto de entrada: `captura.html` mete un script suyo justo antes de él. **Un archivo nuevo se agrega en el manifiesto y en ningún otro sitio**, en `PUROS` si no toca el DOM —así lo alcanzan las pruebas de Node—.

### Convención de componentes

Sin framework hace falta disciplina para no repetir. Un componente es **una función que recibe datos y devuelve un elemento del DOM**, sin leer estado global:

```js
// js/vista/componentes/casilla.js
(function () {
  function crearCasilla({ clave, indice, estado }) { … }
  function crearFilaBitacora(entrada) { … }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.casilla = { crearCasilla, crearFilaBitacora };
})();
```

Quien cambia el estado es la capa de vista, que vuelve a pedir el elemento o actualiza el existente. Los componentes no despachan acciones ni conocen el modelo.

### La pantalla de tema es una sola, parametrizada

`vista/pantallas/tema-busqueda.js` contiene **toda** la pantalla de trabajo —configurar, operar sobre una clave (insertar, buscar, eliminar), llenado automático, reproducir la traza, elidir, métricas, bitácora, alertas— y la comparten todos los temas de búsqueda interna. Un tema nuevo no escribe pantalla: escribe una entrada en `TEMAS` (en `app.js`) con lo único que le es propio:

**Los dibujos de la estructura viven aparte, en `vista/dibujos/`** (2026-10-03). La pantalla pasaba de 3700 líneas y casi la mitad era cómo dibujar cada forma —fila o tabla, apilado, árbol, bloques, índices, bosque—, todo dentro del closure de `crearPantallaTema`. Se sacó tal cual, un archivo por forma: cada uno exporta una función que la pantalla llama al armarse con lo que comparten —`estado`, `dom`, `config`, y lo que haga falta de otro dibujo (`comunes`, o el árbol para el bosque)— y devuelve sus funciones (`renderizarArbol`, `esBloques`…). Son objetos y no copias, así que lo que la pantalla cambie en ellos el dibujo lo ve. La pantalla se queda con todo lo demás: configurar, operar, reproducir, el cálculo, guardar y abrir. **Una forma nueva de dibujar va en su propio archivo de `dibujos/`**, registrado en el manifiesto antes de `tema-busqueda.js`.

```js
{
  titulo, descripcion, orientacion, modo,        // orientacion: horizontal | vertical | arbol
  buscar({ estructura, objetivo }) -> pasos,     // el algoritmo
  eliminar({ estructura, clave }) -> pasos,      // buscar y además sacar (§5.6)
  insertar({ estructura, clave }) -> pasos,      // opcional: inserción con traza
  tratamientos: [{ valor, etiqueta }],           // opcional: selector al crear
  calculo: bool,                                 // opcional: panel de cálculo
  apilada: {                                     // opcional: una fila por paso
    rangoDePaso(paso),
    aplicaA(paso)                                // opcional: pasos sin fila
  },
  claveEsLetra: bool,                            // opcional: la clave es una letra (§5.5)
  insertarPalabra({ estructura, letras }),       // opcional: una palabra, en una traza
  sinTamano: bool, tamano() -> { n, l },         // opcional: n y l los da el tema
  sinConfiguracion: bool,                        // opcional: sin panel; se crea al entrar
  nombreEstructura, mensajeReinicio,             // opcional: cómo se nombra al reiniciar
  casillasRelevantes(paso) -> [índices base 1],  // qué no puede elidirse
  describirCasilla({ paso, indice, ocupada })    // -> { estado, modificadores }
    -> cómo se pinta cada casilla en el paso actual,
  metricas: [{ id, etiqueta, valor({ estructura, paso }) }]
}
```

Es decir: **lo único que distingue un tema de otro es cómo se lee su traza.** Los campos opcionales son las tres formas en que un tema puede apartarse de la búsqueda por comparación: acumular una estructura por paso (binaria, §6.3), colocar por dirección en vez de por orden (`modo: 'dispersa'`, §3.2), y convertir la inserción en una operación reproducible con su cálculo a la vista (§6.5). Un tema que no declara ninguno se comporta como secuencial.

**Crear una estructura y reiniciarla son la misma operación** (`establecerEstructura`): la nueva nace vacía y la pantalla vuelve a su estado inicial. El formulario la llama con lo que el estudiante digitó; el botón **Reiniciar** del encabezado, con lo que la estructura ya tenía —mismo `n`, mismo `l`, mismo tratamiento— y además vacía la bitácora y el aviso (pedido del usuario, 2026-08-29: antes había que salir al menú y volver a entrar). Vive en el encabezado y no en un panel porque no es una operación sobre las claves sino sobre la pantalla entera, y ahí no depende de cuánto haya que desplazar el panel lateral. Sin estructura todavía, el botón no aparece: no hay nada que reiniciar.

**Un tema puede no tener nada que configurar.** El árbol digital no elige tamaño, ni longitud de clave, ni tratamiento: su panel de configuración se quedaría en un título y un botón que no decide nada, así que declara `sinConfiguracion` y **la estructura se crea al entrar al tema**. **Esa creación no se apunta en la bitácora** (`alEntrar`, 2026-09-30): la bitácora cuenta lo que hizo el estudiante, y al entrar decía «Árbol creado: código de 5 bits por letra» —y en Huffman, «Escriba una palabra…», que es una instrucción y ya la da el lienzo— sin que nadie hubiera hecho nada. Sí se anota en las recientes. El panel lateral le queda en tres paneles en vez de cuatro.

El estado (`estructura`, `reproductor`, `pasoActual`) vive en el closure de cada pantalla, no en variables del módulo `app.js`: dos temas abiertos en sucesión no comparten nada, y volver al menú no deja temporizadores corriendo.

**Estados y modificadores de casilla son cosas distintas.** El estado pinta (`ocupada`, `en-evaluacion`, `descartada`, `encontrada`…) y es uno solo. Los modificadores marcan pertenencias independientes del color —la dirección de la que salió la clave (`direccion`)— que pueden caer sobre una casilla que ya tiene su propio estado, y por eso no pueden ser un estado más. (El corchete del rango activo de binaria era el ejemplo de siempre; se retiró con el azul el 2026-09-27, §8.2. El rastro de los sondeos, `sondeada`, se retiró el 2026-09-30: lo recorrido y descartado se apaga.)

### El catálogo del menú: un índice, no una navegación (2026-09-06, rehecho 2026-09-11)

**El catálogo (`CATALOGO` en `app.js`) es un árbol y no una lista plana de unidades.** Cada nodo es o bien una **categoría** (trae `hijos`) o bien un **tema final** (trae `tema`, la clave que abre `TEMAS`). Se organiza en dos grandes temas —**Búsquedas** y **Grafos**— y no por unidad del curso (pedido del docente, §2): la unidad anterior mezclaba búsquedas externas con grafos en la misma división, que es justo la mezcla que el docente ya no quiere ver al navegar. Dentro de Búsquedas: **búsquedas internas** (secuencial, binaria, transformación de claves, búsqueda por residuo) y **búsquedas externas**.

**El árbol se dibuja entero, como el índice de un libro** (pedido del usuario sobre maqueta, 2026-09-11). La navegación por niveles —una tarjeta por nodo, migas de pan arriba— **se retiró**: obligaba a bajar tres niveles para llegar a un tema y la primera pantalla enseñaba dos tarjetas y medio lienzo vacío, cuando lo que uno quiere al abrir es ver el programa completo. Ahora la jerarquía la dicen **la sangría y la tipografía**: parte (`indice__parte`), grupo (`indice__grupo`) y subgrupo sangrado (`indice__subgrupo`), los tres el mismo componente rotulado distinto, porque nada garantiza que el árbol tenga siempre tres niveles. **Ningún nodo lleva número**, en ningún nivel (§2).

**Un tema pendiente va sin descripción hasta que se trabaje** (decisión del usuario, 2026-09-11). Se probó a describirlos todos —binaria externa, tablas de índices, índices multinivel y los ocho de grafos— con definiciones de manual, y se retiró: una descripción escrita sin haber visto el enfoque del docente enseña algo que puede no ser lo que él plantea, y en el índice se lee como si lo fuera. Cada uno recibirá la suya cuando se construya, que es cuando se sabe.

**El título de un tema no se parte nunca** (`white-space: nowrap`): es el nombre, y partido deja de leerse de un vistazo. Cuando la fila se queda corta, cede la descripción. Por eso las descripciones de los pendientes se escribieron cortas: con nombre largo, descripción y sello en el mismo renglón, no hay ancho para frases.

**Un renglón de tema es: título · guía de puntos · descripción.** La guía es la línea que en un libro lleva del título al número de página; aquí lleva a lo que hay que saber del tema, y por eso **ningún renglón la deja colgando sin nada al otro lado**: si el tema no está construido, al final va su marca «En desarrollo» en lugar de la descripción. Los temas sin construir **siguen respondiendo al clic** con el aviso de «en construcción», como antes (decisión del usuario, 2026-09-11): la marca dice qué hay y qué no, y el aviso explica por qué no pasa nada.

**Las dos partes van una al lado de la otra** (`indice--columnas`). No es decoración: medido sobre la maqueta, el índice en una sola columna mide 1439 px y a dos columnas 1045, así que en una sola columna Grafos quedaba fuera de la ventana y había que desplazarse para verlo — justo lo que el índice viene a evitar.

**Desde el 2026-09-27, tres columnas y un menú que crece con la pantalla** (repaso de diseño contra las tres pantallas de referencia: portátil 1366×640, la del usuario 1920×950 y 1440p 2560×1310). En el portátil, el índice de dos columnas dejaba Huffman y todas las externas bajo el borde; y en 1440p ocupaba la mitad izquierda de la pantalla.

- **Búsquedas pone sus categorías lado a lado, cada una entera en su columna**: internas | externas (`indice__parte--en-columnas`, para toda parte con más de una categoría). Se probó equilibrar las alturas pasando los árboles a la columna de externas, y el usuario no quiso: Búsquedas se divide en internas y externas, y cada mitad va junta. Bajo externas queda un hueco; es el precio.
- **Una parte sin ningún tema construido va angosta** (`indice__parte--pendiente`, hoy Grafos): solo los nombres, y el «En desarrollo» una vez en su cabecera en vez de en cada renglón. Es lo que le deja a Búsquedas el ancho para que sus descripciones quepan. Cuando Grafos tenga temas volverá a llevar descripciones, y el menú habrá que repensarlo.
- **Los títulos de grupo y subgrupo no llevan el margen del navegador**: `h3` y `h4` traían unos 40 px de aire vacío por subgrupo que nunca se anularon. El renglón, además, va más apretado (1 px de relleno vertical).
- **El menú se dibuja al ancho de un portátil y se escala para llenar la ventana** (`escalarAlaVentana` en `menu.js`; opción A de la maqueta, elegida sobre una variante adaptable que cambiaba de diseño a los 1600 px y aun así dejaba media pantalla vacía). Letra, renglones y espacios crecen juntos, con `zoom` —que sí cambia el espacio ocupado, a diferencia de `transform`—, desde 1× en el portátil hasta un tope de 2×; se recalcula al cambiar la ventana. **Y también se achica, hasta 0,75×** (2026-10-06): con el piso en 1, por debajo de 1366 px el diseño se apretaba —a 1024 las descripciones quedaban una palabra por renglón, y a 1280, la pantalla de referencia con el zoom a 150 %, las de externas ocupaban hasta cinco—. 0,75 es lo que pide un proyector XGA (1024 / 1366). El `min-height` de la pantalla se divide por la escala, o `100vh` con zoom 1,4 mediría 140 vh. **Solo en el menú**: en las pantallas de tema, escalarlo todo le quitaría ancho a las estructuras anchas como índices, y eso se decide aparte (punto pendiente del repaso).

**Las categorías ya no llevan estado propio.** Con todo a la vista, cada tema dice el suyo y una insignia en la categoría solo repetiría —o mentiría, como en búsquedas externas, que hoy tiene dos temas construidos y tres por construir—.

Dos consecuencias para quien toque las pruebas: **se entra a un tema con un solo clic en su renglón** (`entrarATema`, en `humo.html` y `captura.html`, ya no recorre categorías y por eso desapareció el mapa `RUTA_TEMA`), y ese renglón **se busca por título exacto y no por `includes`**: en el índice conviven «Búsqueda secuencial» y «Búsqueda secuencial externa», y un `includes` entraría siempre al primero.

### El nombre de un tema vive en un solo sitio (2026-09-11)

**El título y la descripción de cada tema los pone el catálogo, y `TEMAS` no los repite.** Antes estaban en los dos —doce pares— y en los tres temas de árbol las dos copias ya decían cosas distintas: el menú «Claves solo en las hojas» y la pantalla «Un bit por nivel, y las claves solo en las hojas». `mostrarTema` funde el nodo del catálogo con la configuración del tema, así que el menú y la cabecera no pueden volver a desincronizarse.

**La descripción sí puede diferir, pero declarándolo**: un tema escribe la suya solo cuando quiere decir algo más, y si no la escribe hereda la del catálogo. Las dos descripciones tienen trabajos distintos —una para escoger entre temas desde el índice, otra para situarse dentro del que ya se escogió— y eso no es un descuido; el descuido era que los otros nueve pudieran divergir sin que nadie se enterara.

**El título se guarda en capitalización normal.** Las mayúsculas las pone la escala tipográfica (§8.3), no el dato: guardarlas dentro era meter estilo en el contenido, y obligaba a editar doce cadenas para cambiar una regla de presentación.

### Organización de archivos

```
/
├── index.html
├── CLAUDE.md
├── css/
│   ├── tokens.css          variables de color, tipografía, espaciado
│   ├── base.css            reset y elementos base
│   ├── componentes.css     casilla, panel, botón, alerta, bitácora
│   ├── pantallas.css       menú, tema, alertas
│   └── impresion.css       hoja de estilos del PDF
├── js/
│   ├── manifiesto.js       la lista de scripts, en orden: la leen las páginas y las pruebas
│   ├── dominio/
│   │   ├── clave.js        validación, normalización, mapeo alfabético
│   │   ├── estructura.js   invariantes, insertar, eliminar, ordenar
│   │   ├── limites.js      rango derivado de l, límites de n
│   │   └── cubetas.js      tamaño de la tabla de cubetas: siguienteN/anteriorN (§5.7)
│   ├── algoritmos/
│   │   ├── traza.js        contrato de paso y utilidades
│   │   ├── secuencial.js
│   │   ├── binaria.js
│   │   ├── eliminacion.js  eliminar en las ordenadas: buscar y sacar
│   │   ├── cubetas.js      otras búsquedas dinámicas: insertar, buscar, eliminar (§5.7)
│   │   ├── hash/
│   │   │   ├── comun.js       cifras necesarias, ajuste al rango
│   │   │   ├── modulo.js · cuadrado.js · truncamiento.js
│   │   │   ├── plegamiento.js · bases.js
│   │   │   └── operaciones.js traza de insertar, buscar y eliminar
│   │   └── colisiones/     reasignacion.js · anidados.js · encadenamiento.js
│   ├── vista/
│   │   ├── componentes/    casilla, panel, alerta, métrica, bitácora, cálculo
│   │   ├── pantallas/
│   │   │   ├── menu.js           catálogo de temas y recientes
│   │   │   └── tema-busqueda.js  pantalla de trabajo, parametrizada
│   │   ├── dibujos/        cómo se dibuja cada forma de estructura (ver §4, «La pantalla de tema»)
│   │   │   ├── comun.js          marcas, tramos, anidados y cadenas, llevar a la vista
│   │   │   ├── fila.js           fila horizontal o tabla vertical (hash)
│   │   │   ├── apilado.js        filas de binaria (§6.3)
│   │   │   ├── arbol.js          árboles por residuo (§6.7)
│   │   │   ├── bloques.js        búsquedas externas
│   │   │   ├── indices.js        columnas de índices y flechas
│   │   │   └── bosque.js         Huffman: bosque y tabla de códigos
│   │   ├── elision.js      cálculo de casillas visibles
│   │   ├── reproductor.js  reproduce la traza: paso, continuo, velocidad
│   │   └── animacion.js    FLIP y utilidades de movimiento
│   ├── persistencia/
│   │   ├── archivo.js      serializar y leer .cc2
│   │   └── recientes.js    almacenamiento del navegador
│   └── app.js              catálogo, configuración de temas y enrutamiento
├── fuentes/
└── pruebas/
    ├── *.test.js           dominio y algoritmos, con `npm test`
    ├── humo.html           integración de la vista, en el navegador
    └── captura.html        deja la app en un estado concreto para fotografiarla
```

### Cómo se prueba

**El ritual entero vive en la skill de proyecto `.claude/skills/verificar/`** (2026-08-29), con los comandos ya escritos y las trampas del entorno resueltas:

```
npm test
node .claude/skills/verificar/scripts/humo.js                       # 700, 800 y 950 px de alto
node .claude/skills/verificar/scripts/captura.js "vista=anidados&paso=fin"
```

Lo que sigue explica qué cubre cada cosa; los detalles de operación están en la skill.

`npm test` (`node --test`, sin dependencias) cubre dominio, algoritmos y elisión: todo lo que es cálculo puro. `pruebas/apoyo.js` simula `window` para poder requerir esos archivos tal como los carga el navegador.

La vista no entra ahí —necesita DOM— y se cubre con `pruebas/humo.html`, que recorre la aplicación real por el DOM: entra al tema desde el menú, crea la estructura, inserta claves, avanza la traza y verifica estados, métricas y bitácora. Se abre con doble clic o sin ventana:

```
msedge --headless --disable-gpu --virtual-time-budget=8000 --dump-dom "file:///…/pruebas/humo.html"
```

Al tocar la pantalla de tema, correr las dos. La prueba de humo también verifica el layout —que la pantalla se ancle al viewport y que la estructura entre completa— porque es una regresión que no se ve en el DOM y sí arruina la proyección en clase.

Para revisar diseño hay `pruebas/captura.html`, que deja la aplicación en un estado concreto (`?vista=menu|secuencial|binaria`) y se fotografía sin abrir ventana:

```
msedge --headless --disable-gpu --hide-scrollbars --window-size=1500,950 \
       --screenshot=salida.png --virtual-time-budget=8000 \
       "file:///…/pruebas/captura.html?vista=binaria"
```

Vistas disponibles: `menu`, `secuencial`, `binaria`, `hash` (inserción que colisiona), `hash-libre` (inserción en casilla libre), `anidados`, `encadenamiento` y las tres de eliminación (`eliminar-secuencial`, `eliminar-binaria`, `eliminar-hash`); con `&paso=fin` se recorre la traza completa, con `&tratamiento=ninguno|reasignacion` se cambia el tratamiento, y con `&tema=`, `&base=` y `&posiciones=` se fotografía cualquiera de las cinco funciones hash con sus parámetros. La captura de `hash` es la que ya destapó un defecto real: la elisión escondía las claves ya colocadas, que en una tabla dispersa son el resultado mismo del algoritmo (§6.2).

`dominio/` y `algoritmos/` no importan nada de `vista/`. Esa regla es la que permite probar los algoritmos sin abrir el navegador.

---

## 5. Algoritmos — Fase 1

### 5.1 Búsqueda secuencial · `O(n)`

Recorrido lineal desde la casilla 1. Casilla relevante: la posición actual `i`.

**Lo ya comparado se apaga** (2026-09-27): cada comparación fallida descarta una casilla, así que se dibuja como lo que descarta binaria —apagado—, y se ve de un vistazo cuánto lleva recorrido la búsqueda, que es lo que el tema enseña. Una búsqueda que se agotó las descartó todas; el paso final deja la estructura como queda, sin rastro (§7). Un tramo elidido cuyas casillas están todas descartadas se apaga con ellas (`tramoDescartado`). Secuencial y binaria hablan así el mismo idioma: apagado es descartado, normal es «todavía puede estar», naranja es la que se compara (§8.2).

### 5.2 Búsqueda binaria · `O(log n)`

Requiere estructura ordenada, que es invariante del sistema. Casillas relevantes: `inicio`, `medio`, `fin`.

Mostrar en métricas el máximo teórico: `⌈log₂ n⌉` pasos (`dominio/limites.js`, `maximoPasosBinaria`).

**Forma de la traza (implementada):** un paso por comparación, no dos. Cada paso lleva el rango vigente `inicio`, `medio`, `fin` —el que estaba activo *al comparar*, antes de descartar— y `descartadas`, el acumulado de casillas eliminadas por los pasos anteriores. Todo en base 1; la conversión ocurre solo al construir el paso.

Separar "comparar" y "descartar" en dos pasos se descartó: duplica la longitud de la traza y desalinea el conteo de comparaciones con el número de paso, que es justo la lectura que el estudiante debe poder hacer de un vistazo. El descarte se ve igual, porque el paso siguiente ya muestra el rango estrechado.

El paso final `no-encontrada` no lleva rango —ya no existe— y sí `descartadas` con la estructura completa.

### 5.3 Funciones hash

Todas devuelven una **dirección en base 1** dentro de `1..n`, y deben exponer los pasos intermedios del cálculo, que son el contenido didáctico central de estos temas.

Cada función devuelve `{ direccion, calculo }`, donde `calculo` es la lista de líneas `{ etiqueta, expresion, resultado }` del desarrollo, en orden. `expresion` es la cuenta tal como se escribe en el tablero; la vista revela una línea por paso del reproductor, así que cada línea tiene que poder mostrarse sola.

| Función | Cálculo | Parámetro del estudiante |
|---|---|---|
| **Módulo** | `(clave mod n) + 1` | — |
| **Cuadrado** | Elevar al cuadrado, tomar las cifras centrales que numeran el rango desde cero y sumar 1 | — |
| **Truncamiento** | Seleccionar posiciones fijas de los dígitos de la clave y sumar 1 | Las posiciones |
| **Plegamiento** | Partir la clave en grupos, sumarlos o multiplicarlos, tomar las últimas cifras del total y sumar 1 | La operación |
| **Conversión de bases** | Leer las cifras de la clave como cifras en base b, evaluar el polinomio y tomar las últimas cifras del total | La base |

Tres reglas comunes, en `algoritmos/hash/comun.js`:

1. **Cuántas cifras se toman.** Hay dos cuentas y no son la misma:
   - **Cuadrado, truncamiento y plegamiento toman las cifras de `n − 1`** (`cifrasDeRango`): dos con `n = 100`, porque el número extraído numera el rango de `00` a `99` y la cuenta cierra con el `+ 1`. Tomar tres metería en el número una cifra que ninguna dirección usa. En el plegamiento esa cuenta es además el tamaño del grupo: con `n = 100`, pares.
   - **La conversión de bases también toma las cifras de `n − 1`** (2026-08-29), y son cifras **decimales** del total del polinomio: dos con `n = 100`. Antes contaba cifras "en la base elegida", que era parte de la fórmula equivocada.
2. **Hay dos formas de cerrar el cálculo**, y cada función declara la suya en su última línea:
   - **Valores que ya cuentan desde 1** (`lineaDireccion`): se usan tal cual si caen en `1..n`.
   - **Valores que cuentan desde 0** (`lineaDireccionDesdeCero`): la dirección es `valor + 1`. Es el caso del cuadrado, el truncamiento y el plegamiento, y el mismo cierre que ya tenía la función módulo.

   En ambos casos, si el resultado se sale del rango se ajusta preservando las direcciones válidas: `((valor − 1) mod n) + 1`, de modo que 1 sigue siendo 1, `n` sigue siendo `n` y `n + 1` vuelve a 1. El doble módulo es por los valores menores que 1: en JavaScript el resto de un negativo es negativo, y sin corregirlo la casilla 0 sería posible.
3. **La última línea del desarrollo se rotula siempre `Dirección`** y su resultado es la dirección. No es cosmético: el reproductor lee el resultado de la última línea para saber a qué casilla apuntar.

**Corrección del docente (2026-08-23), función cuadrado.** Antes se tomaban las cifras de `n` y no había `+ 1`; con `n = 100` y la clave 3748 (`14047504`) eso daba `047` en vez de `47`. Como lo plantea el docente: se toman las **dos** cifras centrales, `47`, y la dirección es `48`. Cuando el cuadrado tiene una cantidad impar de cifras y hay que tomar una cantidad par, la selección **se corre hacia la izquierda**: en `3025² = 9150625` la cifra central es el `0` y la acompaña el `5` de su izquierda (`50` → dirección 51), no el `6` de su derecha, porque `150` se saldría del rango. **Corrección del docente (2026-08-23), función truncamiento.** La selección de posiciones ya era correcta; lo que faltaba era el `+ 1` final. Arrastra dos ajustes: las posiciones por defecto pasan a ser las de `n − 1` (dos con `n = 100`, que con el `+ 1` cubren exactamente `1..100`), y la advertencia de casillas inalcanzables se mide contra esa misma cuenta.

**Corrección del docente (2026-08-23), función plegamiento.** Tres cambios:

- **El grupo es del tamaño del rango**, no de `n`: con `n = 100` la clave 3025 se pliega en `30` y `25`, no en `302` y `5`.
- **Los grupos se suman o se multiplican**, y eso lo elige el estudiante al crear la estructura (`operacion`), igual que las posiciones del truncamiento y por la misma razón: cambiarlo con claves puestas dejaría direcciones que no corresponden a ninguna cuenta. Sin indicar nada, se suman. Es el único parámetro que se digita eligiendo de una lista, no escribiendo: `parametro.opciones` hace que el formulario dibuje un `<select>`.
- **Del total se toman las últimas cifras** —el acarreo que se sale por la izquierda se descarta, que es el plegado clásico— y después el `+ 1`. Con 3025 y `n = 100`: sumando, `55 → 56`; multiplicando, `750 → 50 → 51`.

**Corrección del docente (2026-08-29), conversión de bases.** La fórmula era otra. No se convierte la clave a la base: **se leen sus cifras decimales como si fueran cifras en base `b` y se evalúa el polinomio que forman**, y del total se toman las últimas cifras.

```
clave 1836, b = 6, n = 100

  1×6³ + 8×6² + 3×6¹ + 6×6⁰  =  216 + 288 + 18 + 6  =  528
  528 no cabe en 1..100  →  dos cifras (las del rango)  →  28  →  + 1  →  29
```

No es una conversión de base en sentido estricto, y ahí está lo que se venía haciendo mal: **las cifras de la clave pueden valer más que la base** —el `8` y el `6` del ejemplo no existen en base 6— porque la operación *mezcla* la clave, no la representa. Antes se convertía de verdad (`1836` en base 6 es `12300`), se truncaba esa representación y se leían las cifras en esa base, lo que daba la casilla 8 en vez de la 29.

Con eso queda resuelto lo que estaba pendiente sobre las cifras: **se truncan cifras decimales del total, y son las del rango** (`cifrasDeRango`), igual que en las otras tres. Ya no se cuentan cifras "en la base elegida", y `cifrasEnBase` desaparece.

**El `+ 1` también aplica aquí** (decisión del usuario, 2026-08-29). El enunciado del docente se detiene en el `28` —está explicando qué cifras se toman, no cerrando la dirección—, y la razón para sumar no es solo la consistencia con las otras cuatro: **el número truncado cuenta desde cero**. Con `n = 100` las dos últimas cifras van de `00` a `99`, que son exactamente cien valores, y sumar uno es la única forma de llevarlos a `1..100` sin caso especial. Sin el `+ 1`, el total terminado en `00` no tendría dirección propia y caía en la casilla `n` por el ajuste del módulo: una excepción que aparece en una clave de cada cien y es incómoda de explicar en el tablero. Cierra entonces con `lineaDireccionDesdeCero`, como cuadrado, truncamiento y plegamiento.

**Consecuencia a tener presente:** con el `+ 1`, el ejercicio del docente da la casilla **29** y no la 28. Es la única diferencia entre lo que él escribió en el tablero y lo que muestra la aplicación.

Detalles que no se deducen del enunciado y conviene no cambiar sin motivo: el cuadrado se calcula con `BigInt`, porque con claves largas supera el entero seguro y las cifras centrales saldrían falseadas; las posiciones del truncamiento se numeran desde 1 y de izquierda a derecha, como las casillas, y se toman **en el orden indicado**; el plegamiento parte de izquierda a derecha, así que el grupo corto queda al final; y "truncar" en conversión de bases es quedarse con las **últimas** cifras decimales del total.

**Los parámetros se eligen al crear la estructura**, junto a `n`, `l` y el tratamiento de colisiones, y por la misma razón (§5.4): cambiarlos con claves ya colocadas dejaría direcciones que no corresponden a ninguna cuenta. Se validan contra `n` y `l` en ese momento, no al insertar.

El documento original pedía soportarlas «en decimal y en binario». **Descartado (2026-08-29):** el usuario confirmó que lo binario no se vio en clase y no se va a implementar. Se daba por cubierto porque conversión de bases con base 2 mostraba la clave en binario y truncaba bits; con la fórmula del docente eso dejó de ocurrir —base 2 solo hace que las cifras de la clave pesen como bits— y al preguntarlo quedó claro que no hacía falta. **Las claves se digitan y se muestran siempre en decimal** (§3.3). No reabrir esto por "completar el enunciado": está decidido.

### 5.4 Tratamiento de colisiones internas

- **Reasignación** — la clave busca otra casilla en la misma tabla. Tres pruebas, que solo se distinguen en el salto (abajo): **lineal**, **cuadrática** y **doble función hash**.
- **Arreglos anidados** — estructura secundaria por dirección.
- **Encadenamiento secuencial** — lista enlazada por dirección.

La traza debe registrar **cada casilla recorrida** por el tratamiento, no solo el destino final.

**El tratamiento no es un tema aparte: es parte de cada función hash (pedido del docente, 2026-08-22).** No aparece en el catálogo como tema propio. Se elige **al crear la estructura**, junto a `n` y `l`, y vale para toda su vida.

Se elige al crear y no después porque el tratamiento cambia la **forma** de la estructura y no solo su comportamiento: arreglos anidados y encadenamiento necesitan estructuras secundarias por dirección, así que cambiarlo con claves ya colocadas obligaría a redispersar la tabla entera. Como efecto secundario, comparar dos tratamientos es crear dos estructuras con las mismas claves y ponerlas lado a lado, que es como se explica en clase.

`ninguno` es un tratamiento más, y el que deja ver la función hash pura: al chocar, la clave **no entra** y la casilla se marca como colisión. Es el estado inicial del selector.

#### Prueba cuadrática y doble función hash (2026-09-23)

Confirmadas por el docente a través del usuario. Son **reasignación**, como la lineal: comparten con ella parar, buscar, contar y dibujar, y lo único que cambia es a qué casilla se salta (`SONDEOS` en `hash/operaciones.js`, sondeos en `colisiones/reasignacion.js`). Con `D` la dirección que dio la función hash:

- **Cuadrática:** el intento `i` va a `D + i²`. **Lo que se pasa de `n` da la vuelta con módulo y sigue contando** —`((D − 1 + i²) mod n) + 1`—, no se reinicia en la casilla 1 como en otras versiones del libro.
- **Doble función hash:** la segunda función **se aplica a la dirección anterior, no a la clave**: `D' = H'(D)`, `D'' = H'(D')`…, con `H'(D) = ((D + 1) mod n) + 1`. En direcciones `1..n` eso avanza **de a dos casillas**, así que con `n` par solo recorre las de la paridad de `D`. No es el doble hashing clásico (`D + i·H₂(k)`), que se descartó al preguntarlo.

**Las dos pueden agotarse con casillas libres**, y entonces la clave **no entra** (decisión del usuario, sin confirmar con el docente). La doble función hash se corta al volver a una casilla ya visitada: como la siguiente depende solo de la actual, eso es el ciclo sin fin. La cuadrática se corta tras `n − 1` intentos, porque ahí los cuadrados se repiten enteros; en el camino no vuelve a mirar casillas que ya miró. El paso es `rechazada` y dice cuántas casillas libres quedaron sin alcanzar; si la tabla sí está llena, es `saturada` como en la lineal.

**Eliminación:** *todas las claves que llegaron por colisión vuelven a pasar por la función hash* (así lo explica el docente). Con saltos no hay un grupo contiguo «detrás del hueco» como en la lineal —que sigue igual—, así que se levantan **todas** las claves que no están en su dirección y después se recolocan **en su orden de llegada**. Primero todas y luego la recolocación, no de a una: una clave recolocada podría quedar con su recorrido pasando por la casilla de otra que aún no se levantó, y al levantarla se le abriría un hueco en el camino. Por eso `eliminar` recibe `ordenLlegada`.

**Los saltos se ven en el panel del cálculo** (maqueta elegida por el usuario, 2026-09-23, opción «sección aparte»), en las **tres** pruebas, lineal incluida. Debajo del cálculo de la función hash, que queda intacto, una línea punteada abre una sección con el nombre de la prueba —«Prueba cuadrática · la 9 está ocupada»; al buscar, «· 55 no está en la 6»— y un renglón por salto: `i = 1  9 + 1²  10` en la lineal y la cuadrática, `D' = H'(9)  (9 + 1) mod 12 + 1  11` en la doble. El salto que no sirvió se tacha y dice debajo qué había (`ocupada por 1016`, `contiene 35`, `vacía`); el último revelado es el activo. **En la tabla, la casilla que el salto pasó de largo se apaga** (estado `descartada`, maqueta del usuario, 2026-09-28): apagado es descartado (§8.2), y el rojo queda solo para la dirección que chocó. Antes llevaba el borde rojo punteado del modificador `sondeada`, que se confundía con la colisión. Lo mismo las posiciones ya recorridas del arreglo anidado y de la cadena. En las externas y en cubetas se hizo lo mismo en su repaso (2026-09-30): los registros ya mirados dentro del bloque y los renglones de la cubeta que se pasaron de largo se apagan, y el modificador `sondeada` dejó de existir. **Lo que se pasa de `n` se escribe sumando y restando las vueltas**: `9 + 2² = 13 − 12`. Con más de cinco saltos la sección elide: el primero, los tres últimos y `⋯ N saltos más ⋯`. Viaja en cada paso como `paso.saltos = { titulo, lineas }`, con lo revelado hasta él, igual que `calculo`.

#### Arreglos anidados (2026-08-29)

**La estructura es una matriz de `n × n`.** La primera columna es la tabla y las otras `n − 1` son el arreglo anidado de cada dirección, así que en una dirección caben `n` claves contando la suya. **El tamaño no se pide: sale de `n`.** Pedirlo como parámetro fue el primer intento y estaba mal — es forma de la estructura, no una elección del estudiante.

**La clave nunca se aleja de su dirección**, y eso es lo que lo separa de la reasignación: el límite es la capacidad del arreglo de esa dirección, no la de la tabla.

- **La clave que obtuvo la dirección se queda en la casilla de la tabla**; el anidado es para las siguientes. Una dirección sin colisiones no usa su arreglo.
- **Cuando el arreglo se llena, la clave no entra** y se dice por qué. Deja ver el límite del método, que es la razón de que después se enseñe encadenamiento. Dejarlo crecer sin tope lo convertiría en encadenamiento y los dos temas se verían igual.
- **Búsqueda:** primero la casilla de la dirección, después el arreglo posición por posición. Hasta `n` comparaciones, y eso es lo que la métrica debe dejar ver. Una posición vacía prueba la ausencia: el arreglo se llena en orden.
- **Eliminación:** la clave sale de donde esté y el arreglo cierra el hueco. Si la que salió era la de la tabla, **sube la primera del anidado a ocuparla** — sin eso quedaría una dirección vacía con claves colgando, que contradice lo que el dibujo dice y dejaría la primera comparación de la búsqueda contra una casilla que nadie ocupa.
- **El factor de carga se mide contra la capacidad, `n × n`.** Dividir por `n` daría más de 1 con la tabla a medio llenar.

**Cómo se dibuja** (maqueta acordada con el usuario, que la había trabajado igual): la fila de cada dirección se lee como una matriz, con un canal entre la tabla y su arreglo.

```
         tabla        arreglo anidado (n - 1 = 9)
  dir      ·        1      2      3     ...     9
    3   [ 7412 ]  [5312] [9912] [    ]  ...  [    ]
    4   [ 1023 ]  [    ] [    ] [    ]  ...  [    ]
```

**El arreglo elide con la misma regla que la tabla** (§6.2): la primera posición, la última, las ocupadas, y un tramo diciendo cuánto se resumió. Con `n = 10` sus nueve columnas caben y no se elide nada, que es el caso del salón; con `n = 100` serían 99 columnas por fila y sin elidir habría que desplazarse a lo ancho, encima del desplazamiento vertical que el lienzo ya tiene.

Las posiciones vacías que sí se dibujan son la única excepción a la regla de no dibujar casillas vacías: ahí no son direcciones intermedias sino la capacidad del arreglo, y ver cuánto queda antes de que el método se agote es lo que el tema enseña.

**Los segmentos del anidado se calculan una sola vez para todas las filas**, sobre las posiciones ocupadas de la estructura entera. Si cada fila elidiera por su cuenta tendrían distinta cantidad de columnas y la matriz dejaría de estar alineada, que es justo lo que la hace legible — el mismo cuidado que las columnas del apilado de binaria (§6.3).

El tema lo declara con `anidados: { tamano(estructura), columnas(estructura) }`, y `describirCasilla` recibe `posicion` para distinguir la casilla de la tabla —donde es `undefined`— de cada casilla del arreglo.

#### Encadenamiento secuencial (2026-08-29)

**Es el hermano de los arreglos anidados, y lo único que los separa es que la cadena no tiene tope.** Por eso se leen igual salvo en eso, y por eso comparten la estructura secundaria del dominio (`estructura.anidados`), sus aplicadores (`colocar-anidado`, `retirar-anidado`, `compactar-anidado`) y la rama de eliminación.

```
  anidados     3  [ 7412 ]  [ 5312 ][ 9912 ][      ]   ← tope de n − 1, hueco a la vista
  encadenado   3  [ 7412 ] → [ 5312 ] → [ 9912 ]       ← sin tope, crece
```

- **La casilla de la tabla guarda la primera clave**, igual que en anidados; la cadena es para las que chocaron. Una dirección sin colisiones no dibuja cadena. Se descartó el modelo clásico —la tabla como arreglo de punteros— porque dejaría la tabla sin claves y se leería distinto de los otros tres tratamientos.
- **El enlace se dibuja con flecha** entre casillas, y la primera sale de la casilla de la tabla. **Dibujada, raya y punta en tinta** (opción B de la maqueta, elegida por el usuario el 2026-09-28): era el glifo `→` pequeño y en tinta suave, y entre casillas apagadas casi no se veía. Es lo que distingue a simple vista la cadena del arreglo anidado; sin flecha los dos tratamientos se verían casi igual y lo que los separa dejaría de verse en el dibujo. Se descartó dibujar la cadena hacia abajo: cada colisión sumaría filas al alto, que es el recurso escaso.
- **Nunca se satura.** No hay paso de saturación en la traza, y `capacidad()` deja de ser un número: `tamanoAnidado` vale `Infinity` y la capacidad con él. Es lo que define al tratamiento.
- **El factor de carga cambia de significado.** Con anidados se mide contra `n × n`; aquí contra `n` —lo que devuelve `dominio.estructura.baseDeCarga`— y **puede pasar de 1**, que es lo que el factor de carga significa en una tabla encadenada: claves por dirección en promedio. Dividir por una capacidad infinita daría siempre 0.
- **Búsqueda:** primero la casilla de la dirección, después la cadena posición por posición. No hay posición vacía que pruebe la ausencia —una cadena no tiene huecos, la clave nueva se engancha al final— así que **lo que la prueba es llegar al final de la cadena**. Es la única diferencia de fondo con el recorrido del arreglo anidado.
- **Eliminación:** igual que en anidados. La clave sale, la cadena cierra el hueco, y si la que salió era la de la tabla sube la primera de la cadena a ocuparla.

**Elisión:** la cadena elide como todo lo demás —cabeza, cola, la posición del paso y `⋯ N ⋯` en medio—, con dos diferencias respecto de la matriz:

1. **Aquí sí se pueden comprimir casillas ocupadas**, al revés que en la tabla dispersa (§6.2): en una cadena la posición es orden de llegada y no el resultado del algoritmo, así que comprimir el medio no esconde lo que el tema enseña.
2. **Cada fila elide por su cuenta**, al revés que en anidados (donde los segmentos se calculan una sola vez para todas las filas). Una lista no es una matriz: no hay columnas que alinear entre direcciones, y cada dirección crece lo que crezcan sus colisiones.

Por eso la cadena ocupa **una sola columna del grid de la fila** y se ordena por dentro (`.cadena`, un flex), en vez de una pista por posición.

### 5.5 Árboles de búsqueda por residuo

Por residuos, árboles de búsqueda digital, residuos múltiples. Mismo contrato: producen traza. En el catálogo del menú viven agrupados bajo "Búsqueda por residuo" (§4). **Método de la rejilla, árboles 2D y tablas de índices salieron del temario**: los dos primeros el 2026-09-06 y las tablas de índices el 2026-09-17 (§12). No se van a cubrir.

**Los tres primeros trabajan con letras, no con números** (pedido del usuario, 2026-08-29): el ejercicio de clase es la palabra `prueba`, cuyas letras se insertan en orden.

#### La letra y su código (2026-08-29)

**La letra viaja como su byte, pero se ramifica con las cinco últimas cifras de ese byte**, que son su posición en el alfabeto:

```
  p = 112 = 011 10000 → 10000 (16)      a =  97 = 011 00001 → 00001 (1)
  r = 114 = 011 10010 → 10010 (18)      b =  98 = 011 00010 → 00010 (2)
  u = 117 = 011 10101 → 10101 (21)      e = 101 = 011 00101 → 00101 (5)
```

Con el byte entero las tres primeras cifras (`011`) son iguales en todas las letras y nada se bifurca hasta el bit 4: las seis letras de `prueba` quedarían en una sola rama. Con cinco, el árbol se abre a lado y lado, que es como lo dibuja el docente. Mayúscula y minúscula dan las mismas cinco cifras, así que da igual cómo se digite; se guarda en minúscula.

Vive en `dominio/clave.js` (`BITS_LETRA`, `codigoDeLetra`, `validarLetra`, `validarPalabra`) y lo comparten los tres temas.

#### Búsqueda por residuos (2026-08-30)

**Un bit por nivel, igual que el árbol digital, y una sola diferencia de la que cuelga todo lo demás: las claves viven solo en las hojas.** Los nodos de en medio no guardan nada y nunca podrán: son bifurcaciones. El árbol de `prueba` —el mismo ejercicio de clase— queda más hondo y más simétrico que el digital:

```
                   ·                  p = 10000   e = 00101
        0 /                 \ 1        r = 10010   b = 00010
        ·                    ·         u = 10101   a = 00001
      0 /                  0 /
      ·                    ·
   0 /  \ 1             0 /  \ 1
   ·     [e]            ·     [u]
 0/ \1                0/ \1
[a] [b]              [p] [r]
```

De la regla salen las cuatro consecuencias que hay que respetar:

- **Buscar hace una sola comparación de clave**, la de la hoja a la que se llega. Bajar cuesta accesos, no comparaciones, y esa es la lección del tema: por eso las dos métricas van juntas, y por eso bajar por una bifurcación es un paso de tipo propio (`ramificacion`) y no una comparación. Llamarlo comparación sería mentirle a la métrica.
- **Insertar sobre una hoja ocupada es el caso normal, no un error.** Ninguna de las dos claves puede quedarse ahí: la posición pasa a bifurcar y las dos bajan juntas mientras sus códigos coincidan bit a bit, separándose en el primero en que difieren. Por eso una inserción puede mover dos claves —la que entra y la que ya estaba— y la traza lo declara con dos efectos.
- **Hay dos formas de probar que una clave no está**, y las dos son concluyentes: el camino se corta en una posición que no existe, o se llega a una hoja que guarda otra clave. En el segundo caso sí hubo una comparación; en el primero, ninguna.
- **Al eliminar, la rama se recoge** (decisión del usuario sobre maqueta, 2026-08-30): mientras un ancestro quede colgando de una sola clave, esa clave sube. Los bits que hacían falta para distinguirla de la que se fue ya no distinguen nada. Así el dibujo depende solo de **qué** claves hay y no del orden en que se borraron: el árbol queda idéntico al que saldría de insertar las que quedan desde cero, y eso es lo que fija la prueba `eliminar deja el mismo árbol que insertar las claves que quedan`. Sin recoger, la misma palabra daría árboles distintos y la altura mentiría.

**Un nivel más que el árbol digital.** Dos códigos que solo se separan en el último bit dejan sus hojas por debajo del último nivel que se mira, así que `n = 2^(bits + 1) − 1 = 63` y no 31. La posición se nombra por su **camino de bits** —el binario del índice sin el bit de la raíz— y no por su parentesco: el padre casi siempre es una bifurcación sin clave, y «hijo izquierdo de b» no tendría de qué colgar.

Todo lo demás lo comparte con el árbol digital y no hubo que tocarlo: la letra y su código, el modo `arbol`, el dibujo por niveles, la palabra entera como una sola operación reproducible, y que el tema no pida `n` ni `l` ni panel de configuración. Vive en `algoritmos/residuos.js`, con `dominio/arbol.js` aportando `clavesDelSubarbol` —el recorrido que **atraviesa** las posiciones vacías, que `subarbol` no hace—.

#### Árboles de búsqueda digital (2026-08-29)

**Un bit por nivel**: en el nivel `d` se mira el bit `d` del código, `0` baja a la izquierda y `1` a la derecha. La primera clave queda en la raíz. El árbol de `prueba`:

```
            p                p en la raíz
         0/   \1             e y r por el bit 1
        e       r            b y u por el bit 2
      0/      0/             a por el bit 3
      b       u
    0/
    a
```

- **Las claves viven en todos los nodos, no solo en las hojas.** Es lo que lo separa de los temas de residuos: en cada nodo se compara la clave entera antes de mirar el bit siguiente, así que una búsqueda puede terminar en cualquier nivel.
- **El árbol se guarda en el mismo `claves` de la estructura, indexado como árbol binario implícito** (`modo: 'arbol'`, raíz en la posición 1, hijos de `i` en `2i` y `2i + 1`). No es un atajo: en un árbol digital **la posición es el camino de bits que llevó hasta ella**, así que el índice ya dice lo que el tema enseña, y dibujar o contar sigue leyendo `claves` como en los demás temas. Las operaciones viven en `dominio/arbol.js`.
- **El tema no pide `n` ni `l`.** Cuántas posiciones caben sale de los bits del código —con cinco, 31—, y la clave es siempre una letra. `n` deja de ser una capacidad elegida y por eso el tema no lleva factor de carga: su métrica propia es la **altura**, que es lo que cuesta la peor búsqueda y tiene por tope el número de bits.
- **Una posición vacía prueba la ausencia**: si la clave existiera, sus bits la habrían puesto justo ahí.
- **Se puede insertar una palabra entera**, y sus letras viajan en **una sola traza**: se avanza y se retrocede letra por letra como en cualquier otra operación. No es un llenado —que prepara el escenario sin reproducir nada—: aquí el recorrido de cada letra *es* la lección.
- **Eliminación** (§5.6): si el nodo es una hoja, se va y ya. Si tiene descendientes, dejar el hueco partiría el árbol —lo que cuelga de él dejaría de ser alcanzable—, así que **sube una hoja de su propio subárbol** a ocupar el sitio. Sirve cualquiera: esa hoja llegó hasta ahí bajando por la posición que queda libre, de modo que sus primeros bits son justo los que esa posición exige y ninguna búsqueda cambia de camino. Se elige la más profunda porque es la que más baja la altura.

#### Residuos múltiples (2026-08-30)

**Residuos leyendo un bloque de bits por nivel en vez de un bit**, y una diferencia de fondo que no es solo de escala: **toda clave gasta el código entero y queda en el último nivel**, se hubiera podido distinguir antes o no. El camino de una clave *es* su código leído por bloques (así lo dibuja el docente; confirmado sobre su tablero, 2026-08-30).

**Los bloques son 2, 2 y 1.** Cinco bits no se parten entre dos, así que **el último va corto**: los dos primeros niveles ramifican en cuatro —`00 01 10 11`— y el tercero solo en dos —`0 1`—. El código de la letra no cambia: sigue siendo el mismo de cinco bits que muestran el árbol digital y residuos.

```
  p = 10000 → 10 | 00 | 0                         ·
  r = 10010 → 10 | 01 | 0            00 /                  \ 10
  u = 10101 → 10 | 10 | 1              ·                     ·
  e = 00101 → 00 | 10 | 1       00/  01|  \10          00/  01|  \10
  b = 00010 → 00 | 01 | 0        ·     ·     ·          ·     ·     ·
  a = 00001 → 00 | 00 | 1       1|    0|    1|         0|    0|    1|
                               [a]   [b]   [e]        [p]   [r]   [u]
```

De la profundidad fija salen dos cosas que **residuos sí necesita y aquí no existen**, y no es un atajo: es lo que significa gastar el código entero.

- **No puede haber choques.** Dos letras distintas tienen códigos distintos, así que sus caminos completos no coinciden nunca y ninguna clave le disputa el sitio a otra. Insertar es bajar el código y dejar la clave al final; si la posición está ocupada solo puede ser la misma clave, y se rechaza por duplicada. La prueba `no puede haber choques` inserta el alfabeto entero y comprueba que no aparece un solo paso de colisión ni de movimiento.
- **Al eliminar no sube nada.** Una clave que subiera dejaría de estar donde su código dice, y la búsqueda —que baja el código entero sin mirar— no la encontraría. El hueco se queda a la vista, que es lo que hay que ver al eliminar.

Y una tercera, más sutil: **nunca se llega a una hoja que guarde otra clave.** Cada letra tiene su propia posición final, así que una búsqueda fallida no compara nada — o el camino se corta antes, o la posición del final está vacía. En residuos sí existe el caso de tropezar con una hoja ajena.

**Lo que sigue igual:** una sola comparación por búsqueda, la de la posición a la que se llega. Y el precio del método se lee en las dos métricas juntas — buscar `a` cuesta **4 accesos contra los 5 de residuos**, con la misma única comparación: menos niveles a cambio de más ramas por nodo.

**El esqueleto se dibuja completo hasta el penúltimo nivel**, como en el tablero (decisión del usuario sobre maqueta, 2026-08-30): cada nodo abre todas sus ramas, lleven a una clave o no. Se ve de un golpe cuánto espacio de direcciones queda sin usar, que es la otra mitad de lo que el método cuesta. **Del último nivel se dibujan solo las posiciones con clave** —los enlaces `0 | 1` van donde hay algo al final, como los pone el docente—: completo serían 32 puntos más para no decir nada, y no cabrían. Con `prueba` son 1 + 4 + 16 + 6 = 27 posiciones.

**Sin claves no se dibuja nada**, como en los otros dos temas de árbol. Se probó abrir el tema con la raíz y sus cuatro ramas ya pintadas y al usuario le pareció un dibujo suelto sin relación con nada (2026-08-30): el esqueleto solo se entiende cuando hay claves que lo justifiquen.

**La forma del árbol dejó de estar cableada en la pantalla.** `config.arbol` trae qué ramas abre un nodo (`hijos`), con qué se rotulan (`rotuloDeArista`), en qué nivel está una posición y qué se dibuja (`posicionesDibujadas`); por omisión es `dominio/arbol.js`, el binario. Vive en `dominio/arbol-multiple.js`, que **reutiliza de `arbol.js` todo lo que no depende de la forma** —guardar, sacar, mover y listar claves sobre el mismo arreglo— y redefine lo que sí.

La indexación es **de grado fijo, el mayor de los bloques**, aunque el último nivel use solo dos de sus cuatro huecos: con un grado distinto por nivel el índice dejaría de ser una cuenta y haría falta una tabla de desplazamientos para ir de padre a hijo. Sobran unos huecos que nadie dibuja a cambio de que la posición se siga calculando; por eso `n = (4^4 − 1) / 3 = 85`. La posición se nombra por su **camino de bloques** (`10·00·0`).

### 5.6 Eliminación

**La aplicación elimina claves, y cada tema elimina con su propio método** (pedido del usuario, 2026-08-29). No existe un algoritmo de borrado: eliminar es **localizar la clave con el algoritmo del tema y solo entonces sacarla**. Borrar en secuencial recorre desde la casilla 1; borrar en binaria divide; borrar en una tabla hash calcula la dirección. Por eso una traza de eliminación empieza siendo, literalmente, una traza de búsqueda: los pasos de borrado se le agregan detrás.

Consecuencia directa: **que la clave no esté no se comprueba por adelantado.** Descubrirlo es el trabajo de la búsqueda, y el estudiante tiene que verla recorrer hasta concluirlo. Es la diferencia con la inserción, donde el duplicado y la saturación sí son estados de la estructura y se avisan de una vez, sin reproducir nada (§3.2).

**En las estructuras ordenadas —secuencial y binaria— son dos pasos y no uno.** Primero se marca la casilla que sale, con su clave todavía dentro; después se cierra el hueco y las siguientes se desplazan. Con un solo paso la clave desaparece y las demás se corren a la vez, y no se alcanza a ver de cuál casilla salió, que es justo lo que la animación de eliminación existe para mostrar (§7).

**En una tabla dispersa con reasignación hay que redispersar el grupo.** Borrar en medio de un sondeo deja un hueco que corta la cadena: una clave que se corrió más allá deja de ser alcanzable, porque la búsqueda se detiene en la primera casilla vacía que encuentra. Así lo explica el docente y así se implementa: **las claves que siguen al hueco vuelven a pasar por la función hash**, se levantan una a una y se vuelven a dispersar, con su cálculo y su sondeo a la vista. Eso vale para la prueba lineal; la cuadrática y la doble función hash reorganizan todas las claves desplazadas (§5.4).

```
7412 → dirección 3          3 [7412]        3 [7412]        3 [7412]
5312 → dirección 3,         4 [5312]   →    4 [    ]   →    4 [9912]
       sondea la 4          5 [9912]        5 [9912]        5 [    ]
9912 → dirección 3,
       sondea 4 y 5        se borra 5312   9912 vuelve a pasar por el hash:
                                           dirección 3 ocupada, sondea la 4
```

El grupo se recorre **hasta la primera casilla vacía y no más allá**. Si hay una vacía, ninguna clave posterior pudo haberse corrido cruzándola, así que su cadena nunca pasó por aquí: "reorganizar las que colisionaron" y "reorganizar el grupo detrás del hueco" terminan siendo lo mismo. Una clave del grupo que sí estaba en su propia dirección se levanta igual —es parte del grupo— y el cálculo la devuelve a su sitio.

Sin tratamiento no hay nada que redispersar: la casilla se vacía y ya, porque ninguna clave llegó a estar fuera de su dirección.

**El paso declara su efecto, la vista lo aplica.** La traza sigue sin tocar la estructura (§4). Un paso puede llevar `efecto: { tipo: 'colocar' | 'retirar' | 'eliminar', casilla, clave }`, y la pantalla lo aplica al llegar y lo deshace al retroceder. Reconstruye desde el estado previo a la operación en vez de deshacer paso a paso: una eliminación con redispersión mueve varias claves, y las inversas encadenadas son justo donde se cuelan los errores. Antes de esto la pantalla adivinaba el efecto por el tipo del paso, lo que solo alcanzaba para una única colocación por operación.

**En binaria, los pasos que sacan la clave no van apilados.** Sacar no es descartar, así que no les corresponde una fila más; y las filas ya dibujadas se leen del mismo arreglo, de modo que el desplazamiento las cambiaría todas hacia atrás. El tema lo declara con `apilada.aplicaA(paso)` y esos pasos se dibujan sobre la estructura completa, que es donde el desplazamiento se ve moverse.

### 5.7 Otras búsquedas dinámicas — cubetas (2026-09-06)

Primer tema construido de **Búsquedas externas** en el catálogo del menú (§4), aunque el algoritmo en sí no distingue disco de memoria: lo que lo hace distinto de todo lo demás en el proyecto es que **`n` cambia con el tiempo**. En ningún otro tema el estudiante deja de controlar `n` una vez creada la estructura; aquí crece al expandir y decrece al reducir, y eso rompe la invariante "el estudiante fija `n` para toda la vida de la estructura" (§3.2) — es la única excepción, y es deliberada.

**Estructura**: `n` cubetas, cada una con `r` renglones fijos (`r` sí se fija al crear y no cambia). `H(k) = k mod n` da la cubeta; la clave entra en el primer renglón libre. Parámetros que se piden al crear, todos con su propio validador (`dominio/cubetas.js`): `n` inicial, `r`, el **modo de expansión y reducción** (`total` | `parcial`) y los **umbrales** de expandir y reducir (porcentajes, no fijos en la app).

**Una cubeta con `r` renglones es la misma forma que ya usa el tratamiento de arreglos anidados** (§5.4): el primer renglón vive en `estructura.claves[dirección − 1]` y los `r − 1` restantes en `estructura.anidados[dirección − 1]`. Por eso el tema declara `modo: 'dispersa'` y `config.anidados = { tamano: r − 1, columnas: r − 1 }`, y reutiliza sin tocarlas `colocarEn`, `colocarEnAnidado`, `retirarDeAnidado` y sobre todo `compactarAnidado` (eliminar cierra el hueco de la cubeta exactamente como ya cerraba el de un arreglo anidado).

**Se dibuja horizontal y no vertical como los temas hash** (corrección del usuario, 2026-09-06): el docente dibuja las cubetas en columnas —`n` cubetas lado a lado— con los renglones bajando dentro de cada una, y no una tabla de direcciones apiladas con su arreglo a la derecha. La matriz de "casilla principal + arreglo anidado" (`segmentosAnidados`, `casillasAnidadas`, CLAUDE.md 5.4) no dependía de la orientación más que por accidente —solo se invocaba dentro de la rama `vertical` de `renderizarFilaUnica`—, así que **se generalizó para dibujar también en horizontal**: `.columna-casilla` ya era un flex en columna, así que apilar ahí la casilla principal, los renglones del arreglo y la marca de escala alcanza sin CSS nuevo. Para los temas verticales existentes (todos los hash) el comportamiento no cambia: la condición pasó de "es vertical" a "hay columnas de arreglo que dibujar", que da el mismo resultado.

**Los `r` renglones de una cubeta se dibujan todos iguales** (defecto visto por el usuario, 2026-09-11). Reutilizar la matriz de arreglos anidados traía de regalo el modificador `anidada`, que dibuja la casilla **punteada** para decir «esto es la estructura secundaria de la casilla de al lado» (§5.4). En una cubeta eso es falso: el renglón 1 no es más tabla que el 2, son renglones de lo mismo, y con el trazo distinto la primera fila se veía con otro borde —muy visible en una estructura recién creada, con todo vacío—. El modificador se aplica ahora **solo en vertical**, que es donde de verdad hay una tabla y su arreglo.

**Las cubetas se numeran desde 0 — la única excepción del proyecto a "toda salida numera desde 1" (CLAUDE.md 3.1)** (pedido del usuario, 2026-09-06): así las dibuja el docente y así calcula `H(k) = k mod n`, sin un "+ 1" final. Los renglones dentro de cada cubeta sí numeran desde 1, como todo lo demás — la excepción es solo para el índice de cubeta. Alcanza a la escala (`crearMarca`, con `config.numerarDesdeCero`, que resta 1 solo al texto que se muestra), y también al aviso, la bitácora y el panel de cálculo, para que todo hable el mismo número: decir "cubeta 7" junto a una columna rotulada "6" habría sido peor que no tener el rótulo.

Por dentro **nada cambia de base**: `estructura.claves[dirección − 1]` sigue siendo base 1 como en cualquier otro tema — es la única forma de reutilizar `dominio.estructura` y el resto de la pantalla sin tocarlos. La conversión vive en un solo punto, `mostrar = (indiceInterno) => indiceInterno - 1`, en `algoritmos/cubetas.js`.

**Por eso no se reutiliza `hash/modulo.js`.** Esa función cierra con `residuo + 1` (CLAUDE.md 5.3), que es exactamente lo que aquí sobra: el residuo *es* la dirección que se muestra. `algoritmos/cubetas.js` trae su propio `calculoCubeta(clave, n)` —dos líneas, "Clave" y "Dirección" `= clave mod n`, sin la línea de "Residuo" intermedia que sí tienen los temas hash— y su propio `pasosDelCalculoCubeta`, que revela esas líneas igual que `pasosDelCalculo` pero **sin** derivar el índice interno del texto de la última línea: ese texto es la cubeta en base 0, y el índice que de verdad hace falta para indexar la estructura (base 1) se calcula aparte y viaja pegado al paso.

**La clave que choca no desaparece: espera en la fila «Col»** (defecto visto por el usuario contra su propio taller, 2026-09-11). Cuando una cubeta está llena, el docente escribe la clave rechazada en una fila rotulada `Col` debajo de la cubeta que no la admitió, y ahí se queda hasta que la expansión la recoloca. Antes la aplicación la hacía desaparecer entre que chocaba y que reaparecía recolocada, y con ella desaparecía la explicación del número siguiente.

La clave rechazada **viaja en el paso y no en la estructura** (`paso.rechazada`): no está colocada en ningún sitio, está esperando. Por eso la dibuja la vista desde el paso, y por eso retroceder la hace desaparecer sin deshacer nada.

**Y la densidad la cuenta mientras espera.** Es la otra cara del mismo agujero: en ese instante el taller escribe `D.O. = 8/9 = 88,89 %` —siete claves colocadas más la que chocó— y la pantalla mostraba `7/9 = 77,8 %`. La regla siempre fue "claves intentadas" (abajo); lo que fallaba era que la métrica solo sabía contar las colocadas. `densidadExpandir` acepta ahora cuántas hay esperando.

**Densidad para expandir** = `claves_intentadas / (n × r)`, revisada después de cada inserción — cuenta la clave recién procesada aunque haya chocado, porque chocar es justo el caso en que no llegó a entrar. Si la densidad llega al umbral, o si la cubeta de la clave está llena (eso solo, aparte de la densidad), se expande.

**Densidad para reducir** = `claves_restantes / n` — **una fórmula distinta, sin multiplicar por `r`** (confirmado contra un taller resuelto del curso, comparando sus tablas casilla por casilla). Se revisa después de cada eliminación.

**Expansión total**: `n` se duplica. **Reducción total**: `n` se divide entre dos.

**Expansión parcial**: dos series intercaladas que se doblan cada una por su cuenta. La 1ª estructura es `n₀` (el `n` con que se creó), la 2ª es `n₀ + 1`, y de ahí en adelante cada estructura dobla a la que quedó dos posiciones atrás (3ª = 2×1ª, 4ª = 2×2ª, 5ª = 2×3ª…). Con `n₀ = 2` da 2 → 3 → 4 → 6 → 8, verificado contra el taller. **Reducción parcial**: retrocede exactamente un paso en esa misma serie, sin necesidad de guardar un historial — alcanza con saber `n₀` (guardado una sola vez en `estructura.parametros.n0`) y el `n` actual para derivar tanto el siguiente como el anterior (`dominio/cubetas.js`, `siguienteN`/`anteriorN`). Para el modo total, retroceder así equivale a dividir entre dos: es el mismo caso general.

**Al expandir o reducir, todas las claves vivas se rehashean en su orden original de llegada** —no en el orden que tenían en las cubetas viejas—, confirmado casilla por casilla contra el taller. Por eso la estructura lleva un `estructura.ordenLlegada` aparte de `claves`/`anidados`, que mantienen los efectos `colocar-cubeta`/`retirar-cubeta` (`tema-busqueda.js`). El efecto `redimensionar` solo vacía la tabla al tamaño nuevo; son los pasos de `calculo` + `insercion` que le siguen —uno por clave viva, reutilizando `pasosDelCalculo`— los que la vuelven a llenar.

**`sincronizarEfectos` y `reproducirOperacion` (`tema-busqueda.js`) ahora también preservan `n` y `ordenLlegada`** en el snapshot "antes de la operación", además de `claves`/`anidados` de siempre: sin eso, retroceder a un paso anterior a una expansión a medio reproducir dejaría el `n` ya crecido. Es un campo que solo cubetas usa; para los demás temas queda `undefined` y no cambia nada.

**Reiniciar vuelve al `n` con que se creó la estructura, no al que alcanzó por expansión.** `establecerEstructura` guarda `parametros.n0 = n` en cada creación (de cualquier tema, no solo este), y `reiniciarEstructura` lo usa en vez de `anterior.n`. Para los demás temas es el mismo número siempre, así que el cambio no altera nada; para cubetas es lo que hace que reiniciar de verdad vuelva al principio.

### 5.8 Búsqueda secuencial externa (2026-09-11)

**Repaso de diseño (2026-09-30), para las dos externas y para cubetas:** el panel del cálculo solo está durante la operación, como en hash y en los árboles (`calculoSoloEnOperacion`), y lo ya mirado dentro del bloque —o de la cubeta— se apaga en vez de llevar el borde rojo punteado (§8.2). En cubetas, la densidad va en su renglón y con coma decimal: «70,8 %».

Primer tema de **Búsquedas externas** con recorrido propio (cubetas, §5.7, no distingue disco de memoria). El archivo son `N` registros repartidos en `B` bloques de `r`, y **el estudiante no elige la forma**: fija `N` y la regla del docente deriva lo demás (traída por el usuario tras preguntarle en clase, 2026-09-11).

**La forma del archivo** (`dominio/externa.js`):

- `B = √N`, **truncado** a entero.
- `r = N / √N`, **redondeado al más cercano**. Es el punto que más fácil se entiende mal, y por eso las dos pruebas son los dos ejemplos del docente: con `N = 23` el 4,79 sube a 5, pero con `N = 10` el 3,16 se queda en 3. Al techo, el segundo daría 4 y la forma entera saldría distinta.
- Si `B · r < N`, se agrega **un** bloque más. De ahí sale la consecuencia limpia que fija una prueba de barrido: **el bloque extra aparece si y solo si `N` no es cuadrado perfecto**. El redondeo nunca empata, porque `√N` no puede terminar en `,5` para ningún `N` entero.
- **El último bloque se queda con el sobrante y no acepta más**: la capacidad del archivo es exactamente `N`. Con `N = 23` son 5 bloques: 4 de 5 y uno de 3.

**Por dentro no hay estructura nueva: es el mismo arreglo ordenado y denso de secuencial interna** (`modo` ordenada, §3.2), y los bloques son una **agrupación de posiciones consecutivas encima de él**. Esa decisión es la que paga:

- **Insertar sigue siendo instantáneo**, como en secuencial y binaria — no hace falta traza propia. Y el desbordamiento al bloque de al lado, que es la animación que este tema tiene para enseñar, sale gratis: las claves se corren dentro del arreglo y el FLIP las anima cruzando el canal. Lo fija la prueba `insertar en medio empuja la última clave del bloque al bloque siguiente`.
- **Eliminar reutiliza `eliminacion.eliminarPorBusqueda`** (§5.6) con el recorrido de este tema. Lo único que hubo que agregarle es `nombrar`, porque aquí el estudiante ubica **el bloque** y no el número de registro; sin ese parámetro los demás temas siguen diciendo "la casilla 7", igual que antes.

**El recorrido**: se compara la clave contra el **último registro de cada bloque** —lo único que hay que leer para descartarlo entero— y solo se recorre por dentro el que sí puede contenerla. Si no está ahí, **no se siguen leyendo bloques**: el archivo está ordenado y no puede estar en otro, y decirlo es parte de lo que el tema enseña. Dentro del bloque se recorre entero, sin cortar al pasarse, igual que la secuencial interna (§5.1), que tampoco aprovecha el orden.

**Los accesos se cuentan por bloque leído, no por registro** (supuesto del usuario, 2026-09-11, **pendiente de confirmar con el docente**): comparar contra el último registro *es* la lectura del bloque, así que recorrerlo por dentro no suma otro acceso. Es el número que el tema existe para enseñar —cercano a `√N` y no a `N`—, y por eso la métrica se llama **«Accesos a bloque»** y no «Accesos» a secas. Si en clase resulta ser al revés, es una línea.

**Cómo se dibuja** (maqueta acordada con el usuario, 2026-09-11): **bloques verticales separados**, cada uno rotulado `B1…Bn` arriba —numerados **desde 1**, sin la excepción de cubetas— y una **sola escala de renglones a la izquierda**, porque todos los bloques tienen los mismos `r`. Es la **cuarta orientación** de la pantalla (§6.1), `orientacion: 'bloques'`.

- **El último bloque se dibuja corto.** Sus posiciones de más no existen, y una casilla vacía ahí diría «aquí cabe una clave», que es mentira. Mismo criterio que el punto de bifurcación de residuos (§6.7).
- **El bloque en curso se marca en su rótulo, no pintando la columna** (§8.1). El trazo grueso va por `box-shadow` y no engordando el borde: un borde de 2 px donde los demás llevan 1 hace la etiqueta un píxel más alta y **baja la columna entera ese píxel**. Lo destapó la prueba de humo, no la vista a ojo.
- **El bloque descartado se apaga entero**, que es la unidad con la que este algoritmo descarta — igual que binaria apaga el tramo que tiró.
- **La elisión es por bloque**, un nivel más arriba que la de siempre (§6.2). Cuando los renglones no caben, los bloques que no se están mirando **se comprimen a su último registro** —el único que el algoritmo llega a mirar— y los ya comparados que quedan lejos se juntan en un tramo `⋯ k bloques ⋯`; sobreviven el primero, el último, el del paso y los **dos** últimos comparados (`BLOQUES_RECIENTES`).
- **El tramo mide exactamente lo que oculta** (`altoDeRenglones`), y no se reparte el sobrante con `flex`. Es lo que hace que cada casilla caiga en su renglón, que el último registro de un bloque comprimido quede a la altura del último de los completos, y que la escala de la izquierda siga rotulando lo que rotula. Para eso el alto de casilla dejó de estar suelto como `40px` en tres archivos y pasó a ser el token `--alto-casilla`.
- **El panel del cálculo desarrolla la comparación en curso** —contra qué registro, de qué bloque, y qué se concluye— y no una dirección: es la cuenta que este algoritmo hace (§6.5).
- **El aviso ubica la clave por bloque**: «Clave encontrada en el bloque 2», sin el número de registro (pedido del usuario, 2026-09-11).

**Solo se leen los bloques que tienen claves** (regla escrita el 2026-09-27, al construir binaria externa; el código ya la seguía desde el principio). Con 12 claves en un archivo de `N = 23` hay tres bloques con datos, y B4 y B5 no se leen nunca: una clave mayor que todo el archivo se da por ausente tras leer B3. Y si el último bloque con datos está a medio llenar, **su "último registro" es el último ocupado**, no el último que cabría. Binaria externa sigue las dos reglas (§5.11).

**Lo que no está confirmado y por eso no se construyó**: hashing externo. La forma del archivo de arriba probablemente le sirva igual, pero su recorrido no se le ha preguntado al docente. No implementarlo por iniciativa propia.

---

### 5.9 Árbol de Huffman (2026-09-11)

Cuarto tema de **Árboles de búsqueda por residuo** (§5.5), y el único de la familia que **no busca nada**: se construye desde una palabra y se lee su tabla de codificación. Comparte con los otros tres la bajada —un bit por nivel, 0 a la izquierda y 1 a la derecha, claves solo en las hojas—, pero se aparta en lo esencial: **la forma del árbol no la dicta la clave sino la frecuencia**. En el árbol digital el camino de la `a` está fijado de antemano por su código de cinco bits; aquí se descubre construyendo, y por eso lo que el tema enseña es la construcción.

**La regla** (confirmada con el usuario contra el ejemplo del docente, CIENCIAS):

1. Las letras se ordenan por **frecuencia ascendente**, y a igual frecuencia **por orden de lectura** —la que aparece antes en la palabra entra antes—. Con CIENCIAS: `e, n, a, s, c, i`.
2. Se reducen de dos en dos, tomando siempre los dos primeros.
3. **El nodo nuevo vuelve a la lista en su sitio por peso**, y a igual peso detrás de los que ya estaban. De ahí sale el paso que revela la regla fina: con cuatro nodos de 2/8 —`c`, `i`, `e+n`, `a+s`— se unen las dos **letras**, porque llevaban más tiempo en la lista que los nodos recién creados.
4. Al quedar un solo nodo, su peso es 1: esa es la comprobación que el docente hace en el tablero, y ese nodo es el árbol.

El primero de cada pareja va a la izquierda. Con CIENCIAS da `c=00, i=01, e=100, n=101, a=110, s=111`.

**Lo que el ejemplo del docente no alcanza a decidir, y por eso está fijado por una prueba aparte**: en CIENCIAS todos los empates caen a favor de las letras, así que no distingue si el nodo nuevo se ordena por peso o se empuja al final de la lista. Con pesos `1,1,1,5` las dos formas dan árboles distintos y solo la primera es Huffman — lo fija `bcdaaaaa` en `huffman.test.js`.

**El espacio es un carácter más** (pedido del docente, 2026-10-06, con su taller de JULIO CESAR): cuenta su frecuencia y lleva su código como cualquier letra. Se escribe `_`, como lo escribe el docente —JULIO_CESAR—, porque un espacio en blanco no se ve en una hoja ni en la tabla; al teclear valen las dos formas. Los espacios de los extremos se descartan y los de en medio cuentan todos. Solo en este tema (`dominio.huffman.validarPalabra`, que ya no pasa por `clave.validarPalabra`): en los otros árboles cada letra se convierte en sus bits del alfabeto (§3.4) y el espacio no tiene.

**La media se escribe con a lo sumo dos decimales**, y con `≈` cuando se redondea (`dominio.huffman.mediaComoTexto`): JULIO_CESAR da 39/11, periódica, y salía «3,5454545454545454» en la métrica, la tabla y la bitácora. Exacta sigue con `=`: CIENCIAS da 20/8 = 2,5.

**La tabla de codificación** cierra el tema: por letra, su código, la longitud `Li`, la frecuencia `Pi` y el producto, con la suma de `Pi × Li` al pie, que es la longitud media del código —cuánto costó de verdad cada letra—. Con CIENCIAS, `20/8 = 2,5` bits por letra frente a los 3 de un código de longitud fija para seis símbolos. **Las filas van en el orden inverso al de entrada** (`i, c, s, a, n, e`), que es como el docente escribe la lista de frecuencias en el tablero. **Las fracciones se guardan como numerador sobre el total**, no como decimal: así la tabla se lee igual que en el tablero y la comprobación de que todo suma 1 sigue siendo exacta.

**Cómo se dibuja** (maqueta acordada con el usuario, 2026-09-11): **quinta orientación de la pantalla**, `orientacion: 'bosque'`. El lienzo no muestra un árbol sino **la lista de nodos tal como está** —las letras sueltas y los arbolitos ya formados, cada uno con su peso al pie, en el orden en que se van a reducir—. Cada unión marca los dos nodos que se van a juntar **antes** de juntarlos, para que se vea por qué se eligen esos dos; la última deja un solo árbol, que es el final, sin redibujar nada. Se descartó mostrar solo la lista y revelar el árbol al terminar: más simple, pero se pierde el momento en que dos nodos se vuelven uno, que es lo único que este tema tiene de propio.

- **Cada unión va en tres tiempos, y cada uno hace una sola cosa** (opción C de la maqueta, elegida por el usuario el 2026-09-30): se marcan los dos nodos; se juntan **donde están**, con el nodo nuevo resaltado al principio de la lista («Nace el nodo de 2/8: e a la izquierda (0) y n a la derecha (1)»); y en un paso propio el nodo nuevo **vuelve a la lista en su sitio por peso**, con su porqué en la bitácora («…detrás de c y i, que pesan lo mismo y estaban antes»). Si le toca el primer lugar no se mueve y ese paso no aparece. Con CIENCIAS son 16 pasos en vez de 7. Hasta entonces juntarse e ir a su sitio eran un solo paso: las letras cruzaban el lienzo hasta un círculo que aparecía ya en su sitio, y la regla de dónde vuelve el nodo —la que decide el empate de CIENCIAS— no se veía por separado. Se descartó un punto intermedio (juntar en su sitio e ir a su sitio a la vez que se marca la pareja siguiente) porque volvía a juntar dos cosas en un paso.
- **Todo el árbol viaja, no solo las letras** (2026-09-30). Los círculos de peso tienen identidad para el FLIP —las letras que cuelgan de ellos, `peso-en`—, las aristas siguen a los nodos mientras se mueven (`seguirAristas`, como en los otros árboles, §6.7) y el círculo nuevo y sus dos aristas aparecen desvaneciéndose. Antes solo viajaban las letras, y los círculos y las aristas saltaban a su sitio final mientras ellas iban de camino.
- **El nodo interno lleva su peso dentro, en un círculo.** Es lo contrario del punto de bifurcación de residuos (§6.7): allí el nodo interno no puede guardar nada y dibujarlo como caja sería mentir; aquí el nodo interno *es* una suma. Redondo para que no se confunda con la casilla de una clave.
- **El peso al pie solo se escribe cuando el árbol es una letra suelta** (revisión de diseño, 2026-09-11). En cuanto tiene raíz, la raíz ya lleva su fracción dentro del círculo, y repetirla debajo decía dos veces lo mismo: en el árbol final se leía `8/8` arriba y `8/8` abajo. La letra suelta sí lo necesita, porque no tiene círculo donde ponerlo.
- **La tabla aparece solo al final** y ocupa el sitio del panel de reducciones, así que el lienzo no cambia de forma al terminar. Antes no habría nada que poner en la columna del código.
- **El panel no tiene operaciones de clave** (`soloPalabra`): ni insertar, ni buscar, ni eliminar. Solo la palabra.
- **Sin palabra no se dibuja el panel de las reducciones** (2026-09-30), como en los otros árboles: antes del primer árbol se leía «Reducción · Sin operación en curso» junto a la invitación a escribir una palabra.

**Nada de esto toca `estructura.claves`.** El bosque de cada paso viaja en el propio paso, porque se deduce entero de la construcción: retroceder es volver a dibujar y no hay efectos que deshacer. La estructura existe solo para que la pantalla tenga de qué colgar la operación.

**El archivo guarda la palabra** (2026-10-01). Como el bosque viaja en los pasos y no toca `estructura.claves`, hasta entonces «Guardar» escribía `huffman-n1-l1.cc2` con `"claves": []`, y abrirlo no reconstruía nada. Ahora guarda la palabra entera con sus letras repetidas —las frecuencias son el dato— como orden de llegada, con su largo como `n` (que es contra lo que el archivo valida las claves), en `huffman-ciencias.cc2`. **Al abrirlo, el árbol se reconstruye y queda ya construido**, con su tabla; la construcción sigue ahí para recorrerla hacia atrás. Huffman se declara de claves de letras (`claveEsLetra`), como los otros tres árboles, así que su archivo abre en el árbol digital —donde las letras repetidas no caben dos veces y se avisa— y el de un árbol de letras abre aquí como palabra.

**Una palabra de una sola letra distinta se rechaza.** No hay reducción posible y su código sería la cadena vacía; no se inventa la convención de que «vale 0», que el docente no ha dado.

---

---

### 5.10 Índices primarios, secundarios y multinivel (2026-09-17)

**El tema que más se sale del molde: aquí no hay claves.** No se inserta, no se busca y no se elimina. De cuatro parámetros —`r` registros del archivo, `R` bytes por registro de datos, `Ri` bytes por registro índice y `B` bytes por bloque— sale una estructura, y **construirla bien es el ejercicio** (pedido del usuario, 2026-09-17). Por eso el tema no tiene panel de operaciones (`sinOperaciones`) y **crear la estructura arranca su traza** (`alCrear`): no queda nada que pedir después.

**La fuente fue la hoja manuscrita del docente** (tres fotos, retiradas del repositorio el 2026-09-23 porque ya no hacen falta). Quedó verificada número a número en `pruebas/indices.test.js`, que es ahora donde vive. Una solución de dos estudiantes coincidía en todo salvo en que **omitía los accesos del índice primario**, que él sí calcula (7).

**El redondeo va en dos direcciones y es la trampa del tema** —él escribe el mismo corchete para las dos—:

- El **factor de bloqueo trunca**: un registro no se parte entre dos bloques, así que `bfr = ⌊4096/120⌋ = 34` y no 34,13.
- El **número de bloques va al techo**: el último bloque va a medias pero existe, `b = ⌈500000/34⌉ = 14.706`.

**Y de ahí sale lo que este tema tiene y búsqueda secuencial externa no (§5.8): la capacidad excede a la ocupación, y el docente escribe las dos.** 14.706 × 34 = **500.004** posiciones para 500.000 registros, con 4 libres en el último bloque; 54 × 273 = **14.742** entradas de índice para 14.706. Allá la capacidad del archivo era exactamente `N`. **La escala que se dibuja a la izquierda de cada columna cierra en la capacidad**, no en la ocupación: esas posiciones existen aunque estén vacías.

**Primario contra secundario es una sola cosa: de qué se hace una entrada.**

| | El archivo está… | Una entrada por… | Entradas | Bloques |
|---|---|---|---|---|
| **Primario** — disperso | ordenado por ese campo, que es clave única | **bloque** (el ancla: su primer registro) | `b` = 14.706 | 54 |
| **Secundario** — denso | ordenado por otro campo, así que no hay anclas | **registro** | `r` = 500.000 | 1.832 |

**Accesos.** Con un nivel, búsqueda binaria sobre los bloques del índice más el bloque de datos: `⌈log₂ bi⌉ + 1` — 7 con primarios, 12 con secundarios. Con multinivel no se busca, se **baja**: un bloque por nivel más el de datos, `niveles + 1` — 3 y 4.

**Los niveles: él los escribe como `log_bfri(entradas)`, pero lo que se cuenta es la cascada.** Cada nivel indexa los *bloques* del anterior y se para cuando uno cabe en un solo bloque. Dan lo mismo en sus dos ejercicios (14.706 → 54 → 1 son 2 niveles; 500.000 → 1.832 → 7 → 1 son 3), pero **con una sola entrada el logaritmo daría 0 niveles y la estructura igual necesita un bloque**. La fórmula se muestra en el panel porque es como él la escribe; `nivelesDelIndice` itera.

**Cómo se dibuja** (§6.1, sexta orientación; decidido sobre maqueta con el usuario, 2026-09-17, calcando su hoja):

- **Cada estructura es una columna de bloques apilados, y las estructuras van una al lado de otra**, de la raíz del índice al archivo de datos, que queda siempre a la derecha. El multinivel con secundarios son cuatro columnas.
- A la izquierda de cada columna, **la numeración acumulada** que abre y cierra cada bloque (1/273, 274/546, …, 14.470/14.742); el **rótulo** `B1…B54` **dentro de cada bloque** (hasta el 2026-09-27 iba a su derecha, justo donde salían las flechas); arriba, el primer bloque **partido en sus registros** con su tamaño en bytes.
- **Flechas de la entrada del índice al bloque que señala**, tres por unión: la primera entrada al primer bloque, la última entrada del primer bloque al **bloque frontera** —el B273 de su hoja, que es el que enseña cuánto abarca un solo bloque de índice— y la última entrada **que se usa** del último bloque al último. Por eso la frontera se marca como bloque relevante y siempre se dibuja.
- **El último bloque de cada columna se parte donde terminan las entradas que se usan** (opción A de la maqueta, elegida por el usuario el 2026-09-30, calcando sus tres hojas): una línea en la última entrada ocupada, con su número en negrita en la escala —14.706 en B54, 54 o 7 en la raíz, 1.832 en B7, 500.000 en B1832 y en los datos—, y debajo una franja punteada con las libres hasta la capacidad, que sigue cerrando la escala. **La tercera flecha sale de esa línea**, así que el número escrito y el bloque al que llega coinciden: hasta entonces salía del borde del bloque y en los últimos bloques había que deducir qué conectaba con qué. También sale de la raíz, que es un solo bloque —el 7 a B7, el 54 a b54—, flecha que el docente dibuja y la aplicación no tenía. Hacia los datos con un índice secundario llega al registro mismo (la línea de los 500.000) y no al centro del bloque. Se descartó además un recuadro con el número dentro del bloque: repetía el de la escala y se amontonaba con el rótulo.
- **Ni los bloques ni la escala se encogen de alto** (`flex-shrink: 0`, 2026-09-30). Cuando una columna no cabía —el Nivel 2 en el portátil—, los bloques bajaban a 36 px y la escala se quedaba en 48: los números dejaban de rotular su bloque y las flechas, trazadas sobre lo encogido, llegaban un bloque más arriba. Lo que no cabe se desplaza. Las flechas se vuelven a trazar si la pista cambia de tamaño.
- **Se ve dónde conecta cada flecha** (opción B de la maqueta, elegida por el usuario el 2026-09-27). Antes salían del borde de la columna, en curva, y llegaban por detrás de los números: no se leía de qué entrada salían ni en qué bloque terminaban. Ahora **salen de la entrada** —una raya dentro del bloque índice, arriba si es su primera entrada y abajo si es la última, con un punto en el borde—, **van en codo** por su propio carril entre las columnas, uno por flecha para que no se monten, y **llegan con la punta tocando el borde del bloque, a media altura**, que es el hueco entre sus dos números. Se descartaron las curvas con los mismos extremos: por encima de las columnas tachaban números en diagonal, y por debajo volvían a esconder la punta.
- **Las columnas se dibujan todas desde el primer paso**, apagadas las que la derivación aún no definió. Ir añadiéndolas cambiaría el ancho a cada paso y, con el lienzo desplazándose, sería imposible de seguir.
- **El SVG de las flechas vive dentro de la pista**, no del contenedor que scrollea: fuera, las flechas se quedarían quietas mientras las columnas se mueven por debajo. Va **por encima** de las columnas desde el 2026-09-27: en codo y llegando por el medio del bloque no tacha ningún número, y por debajo la punta se perdía justo antes de llegar. El humo comprueba que cada punta toca el borde de un bloque por su medio y que cada flecha sale de un punto.

**El ancho no alcanza, y está resuelto a propósito y no por descuido (decisión del usuario, 2026-09-17: «estrechar y desplazar»).** La columna se estrecha todo lo que aguanta —los cinco tokens `--…-indice`— y aun así las cuatro columnas miden 768 px contra los 612 del lienzo, medido por la prueba de humo. La otra mitad es que **el lienzo se desplaza en horizontal y la vista centra la columna del paso**, igual que lleva a la vista la casilla evaluada cuando una tabla dispersa no cabe (§6.2). Lo que dice «hay más a la derecha» es **el borde desvanecido** (§6.2). **Y la derivación no se encoge por debajo de sus fórmulas** (opción B de la maqueta de externas, 2026-09-30): cuando ella y la estructura no caben juntas, pasa a 300 px con la fórmula en su renglón y el resultado debajo (`apretarDerivacion`, `.lienzo__escenario--apretado`). Antes se quedaba con lo que sobrara y en el portátil partía las fórmulas a media expresión y tapaba la columna de datos. Solo cuando no cabe: angosta en una ventana ancha, se alargaba y había que desplazarla. Se descartó encoger además la estructura para ver las cuatro columnas a la vez: quedaba al 60 % y los números de la escala apenas se leían. **Sin estructura, el panel de la derivación no se dibuja** (`calculoSoloEnOperacion`); creada, se queda, porque el paso final la conserva. Hasta el 2026-09-27 era la barra, reservada y a la vista (`scrollbar-gutter: stable`), porque sin ninguna señal una columna cortada por el borde se lee como un defecto de dibujo.

**Cuatro defectos que solo se vieron con la aplicación delante** (el usuario mandó una captura, 2026-09-17), y que ahora vigila la prueba de humo:

- **Los títulos colgaban del pie de su propia columna**, así que el de «Nivel 3» —un bloque— quedaba doscientos píxeles por encima del de «Nivel 2» —siete—, y las flechas que bajaban hacia una columna corta **atravesaban el título de la siguiente**. Se arregla estirando las columnas (`align-items: stretch` en la pista) y dándole a la pila la fila `1fr`, que empuja el pie hasta abajo del todo. El humo compara los altos y los `offsetTop` de los títulos, con `offsetTop` y no con la posición en pantalla porque el FLIP deja un `transform` en vuelo que falsearía la medida (§verificar).
- **Y el pie tiene que caber en un renglón**: cada columna es su propia rejilla, así que un pie que se parte en dos —«14.706 bloq. · 34 registros»— sube el título de esa columna y rompe la línea de base recién conseguida. De ahí que las unidades vayan abreviadas (`entr.`, `reg.`) y `white-space: nowrap`.
- **El tramo elidido se salía de su columna.** «⋯ 14.432 ⋯» es más ancho que los 64 px del bloque y se montaba sobre la escala y lo que había a su derecha: va acotado al ancho del bloque, con `overflow: hidden`.
- **Los bloques eran demasiado bajos.** Con 38 px el hueco de la elisión y los bloques de al lado pesaban lo mismo y la pila dejaba de leerse como pila. El bloque sube a 48 px —más que una casilla normal— y el tramo a 30.
- **Y la pila se desalineaba un píxel por bloque.** Los bloques se pegaban con `margin-top: -1px` para compartir el borde, así que **cada uno avanzaba 47 px mientras su renglón de escala avanzaba 48**. En el primero no se nota; en el séptimo son 8 px y la columna parece irse cayendo (defecto visto por el usuario, 2026-09-17). El borde compartido se hace **quitándole el borde de arriba al bloque que sigue a otro**, no subiéndolo: con `box-sizing: border-box` la caja sigue midiendo lo que dice y las tres columnas avanzan al mismo paso. El humo compara, celda a celda, el `offsetTop` de cada bloque con el de su escala.

**Y el lienzo hay que repartirlo diciendo quién cede.** El cálculo de este tema es una fórmula entera por línea —el texto más ancho de la aplicación— y por proporciones naturales se llevaba el lienzo, dejando la estructura en dos columnas cortadas a media palabra. `.lienzo__escenario--indices` le pone al cálculo un tope **en píxeles y no en porcentaje** —con el 48 % de una ventana ancha crecía sin necesitarlo—, y además **apila el rótulo sobre la fórmula**: en tres columnas, «Factor de bloqueo del archivo» dejaba a `⌊4.096 / 120⌋` un canal tan estrecho que se partía en cuatro renglones. Es el mismo criterio que con el árbol de residuos (§6.7), al revés de como lo repartían las proporciones.

**Se guarda y se abre como cualquier otra estructura, pero lo que el archivo lleva son los parámetros** (pedido del usuario, 2026-09-17: no se cruza con otros temas, pero sí se quiere recuperar la misma estructura). El `.cc2` marca `sinClaves: true` y de ahí salen tres diferencias con §10:

- **No cruza de tema, en ninguna de las dos direcciones.** Los parámetros de índices no significan nada fuera de él, y un archivo de claves abierto aquí no traería nada que colocar. El cruce existe para ver las mismas claves con otras reglas, y aquí no hay claves que ver.
- **Abrir vuelve a correr la derivación**, en vez de reinsertar claves: la estructura ya queda definida al establecer sus parámetros, y lo que falta es volver a contar de dónde sale.
- **El nombre del archivo lo da `config.nombreArchivo`**, porque `indices-n1-l1.cc2` no diría nada — `n` y `l` son de mentira en este tema.

**El orden de los parámetros importa**: `B` va declarado antes que `R` y `Ri` porque esos dos se validan **contra él** —un registro que no cabe en un bloque daría factor de bloqueo cero y no habría estructura— y `leerParametros` los lee en el orden en que el tema los declara. Para eso `parametro.validar` recibe ahora, además de `n` y `l`, **los parámetros ya leídos**; los temas que no lo necesitan ignoran ese dato.

### 5.11 Búsqueda binaria externa (2026-09-27)

**El mismo archivo que secuencial externa** (§5.8): la forma que da `N`, ordenado y denso, insertar instantáneo y el borrado por `eliminarPorBusqueda` nombrando el bloque. Lo único que cambia es **el orden en que se leen los bloques**, y por eso los dos temas salen de una sola configuración, `temaExterno(recorrido)` en `app.js`. Las reglas las dio el usuario sobre mi hipótesis:

- **Del bloque del medio se compara solo su último registro**, como en secuencial externa. Mayor → se descartan él y los anteriores (`inicio = m + 1`). **Menor → la clave está en ese bloque o antes, así que el bloque se queda en el rango** (`fin = m`). Igual → encontrada, sin entrar al bloque.
- **El medio se trunca**, `m = ⌊(inicio + fin) / 2⌋`, igual que en binaria interna.
- **El rango son solo los bloques con claves** (recomendación mía, aceptada; §5.8). Con 12 claves en `N = 23` el rango es `B1 … B3` y el primer medio es B2, no B3.
- **Cuando queda un solo bloque, se busca dentro también en binaria**, sobre sus renglones.

**Los accesos se cuentan por bloque leído**, como en secuencial externa (pendiente de confirmar con el docente). La regla nueva la trajo este tema: **el bloque que queda no siempre es el último que se leyó.** Buscando 22 en el archivo lleno se leen B3, B2 y B1, y el rango se cierra en B2; buscando 67 se cierra en B5, que nunca se leyó. **En memoria solo está el último bloque leído, así que el que queda cuesta otro acceso salvo que sea ése** (recomendación mía, aceptada el 2026-09-27; también pendiente de confirmar). El panel lo dice en la línea `Bloque` —`ya leído`, `se lee · acceso 3`, `se relee · acceso 4`— para que ese acceso no se cuente a escondidas. Con esa regla, en el archivo lleno 53 cuesta 2 accesos, 22 cuesta 4 y 67 cuesta 3.

**Cómo se dibuja** (opción A de la maqueta, elegida por el usuario el 2026-09-27): **todo sobre los mismos bloques** de §5.8, sin estructura aparte.

- **Fase de bloques.** El bloque del medio se marca en su rótulo y su último registro en naranja; los bloques fuera del rango se apagan enteros, **por los dos lados**. El rango de cada paso es el que estaba vigente al comparar, antes de estrecharlo, como en binaria interna (§5.2).
- **Fase dentro del bloque.** La binaria se hace **en la misma columna**: el medio en naranja, los renglones descartados apagados dentro del bloque y los que siguen en juego, normales. (Hasta el 2026-09-27 los que seguían en juego iban en azul; §8.2.)
- **El panel del cálculo cambia de título con la fase** —«Búsqueda por bloques» y «Dentro del bloque B4»—: el paso lo trae en `tituloCalculo`, y sin él vuelve el del tema. Desarrolla el rango, la cuenta del medio con su acceso y la comparación con su conclusión (`50 < 58 → fin = 4`).
- **La elisión conserva los dos extremos del rango de bloques** (`paso.rangoBloques`), además del bloque del paso y los dos últimos leídos (`paso.bloquesLeidos`). Sin eso, con `N = 150` un tramo «⋯ 7 bloques ⋯» se tragaba B8 justo cuando el rango era `B8 … B10`; lo encontró la captura en ventana ancha y lo cierra la prueba de humo. Dentro del bloque, lo mismo con los extremos del rango de renglones.

La opción B —apilar al lado los pasos de dentro, como en binaria interna— se descartó: dentro de un bloque la binaria da dos o tres pasos, y a 1440 px de ancho ya cortaba el panel del cálculo. **El usuario quiere llevar este diseño a binaria interna** (2026-09-27); está por conversar.

## 6. Visualización

### 6.1 Orientación

- Secuencial y binaria: estructura **horizontal**.
- Funciones hash: estructura **vertical**.
- Árboles de búsqueda por bits: por **niveles** (§6.7).
- Búsquedas externas: en **bloques** —columnas separadas, con su rótulo arriba— (§5.8 y §5.11).
- Árbol de Huffman: en **bosque** —los árboles que aún no se han unido, en fila— (§5.9).
- Índices: **columnas una al lado de otra**, unidas por flechas, de la raíz del índice al archivo de datos (§5.10).

### 6.2 Regla de elisión

Solo se dibuja lo relevante del paso actual. Es lo que permite que `n` no tenga límite impuesto por la pantalla.

- **Las ordenadas en fila —secuencial y binaria, también su apilado— se eliden solo cuando no caben** (revisión de diseño, 2026-10-04). Quien dibuja mide cuántas casillas caben a lo ancho del escenario (`casillasQueCaben` en `dibujos/comun.js`) y se lo pasa a `calcularSegmentos` como `capacidad`: si `n` cabe, se dibuja entera; si no, se destapan casillas alrededor de las relevantes hasta llenar lo que cabe, y solo lo demás va a tramos. El umbral fijo escondía el recorrido casilla por casilla en una pantalla de 1920 px, que es justo lo que esos temas enseñan; y en el aula se proyecta a una resolución que no se conoce, así que se mide en vez de suponer. Al cambiar la ventana se vuelve a dibujar solo si cambió cuántas caben. El apilado elide sobre lo que dibuja —de la 1 a la última clave—, no sobre `n`.
- Las demás formas —dispersas (hash, cubetas), anidados, vertical— siguen con el umbral: `n ≤ 12` (horizontal) o `n ≤ 10` (vertical) se muestra completa. Una matriz de anidados que llenara el ancho saldría enorme y casi vacía.
- Por encima, permanecen **siempre visibles**: la casilla 1, la casilla n, y las casillas relevantes del paso. **Con una vecina a cada lado solo en las estructuras ordenadas** (secuencial, binaria), donde acompaña a una comparación: se ve contra qué se comparó y qué había al lado.
- Casillas relevantes: `i` en secuencial · `inicio, medio, fin` en binaria · `d` en hash · `d` más el recorrido del tratamiento cuando hay colisión.
- **En una estructura dispersa, toda casilla ocupada es relevante**, aunque el paso actual no la toque. Dónde quedó cada clave *es* el resultado de la función hash: comprimirla dentro de un tramo borra justamente lo que el tema enseña. En las ordenadas no hace falta, porque las claves ocupan siempre el mismo prefijo y su posición no dice nada por sí sola.
- **En una estructura dispersa no se dibujan vecinas** (pedido del docente, 2026-08-23). Una tabla grande se dibuja con sus extremos y las claves colocadas, y nada entre medias: `1 ⋯ 15 ⋯ 21 ⋯ 56 ⋯ 100`. Es como se dibuja en el tablero y es lo que el tema enseña — las direcciones vacías intermedias no dicen nada y son las que llenaban la pantalla. Con seis claves en `n = 100` la diferencia son 8 casillas dibujadas contra 20, y 15 filas contra 27. **No se pierde el sondeo de la reasignación**: `casillasRelevantes` ya trae las casillas sondeadas, así que el recorrido de la clave se dibuja entero sin necesidad de vecinas. Lo decide quien dibuja, con `vecinas: false` en `calcularSegmentos`.
- **Cada tramo comprimido muestra cuántas casillas oculta, y nada más.** Sin el conteo se pierde la noción del tamaño real. **Lo que sí se quitó es el rótulo del rango elidido** (`6–8` en la escala, pedido del usuario, 2026-08-29): se multiplicaba con la estructura, porque cada clave insertada parte un tramo en dos y la tabla acababa con más números de escala que claves. Lo que el tema enseña es dónde cayó cada clave, y el rango elidido no aporta a eso. Vale en los tres dibujos —secuencial, binaria apilada y hash—, para que la elisión se lea igual en toda la aplicación.
- **Un tramo de una sola casilla no se comprime: se dibuja.** El rótulo `⋯ 1 ⋯` ocupa más que la casilla que esconde. Aparece de forma natural en binaria, cuando `inicio`, `medio` y `fin` con sus vecinas dejan una casilla suelta entre dos visibles.
- La expansión y compresión de tramos se anima; no es un salto brusco.
- Control "Ver estructura completa" que desactiva la elisión. **Solo se muestra cuando hay algo comprimido que mirar** (2026-09-11): con `n` chico no hacía nada y ocupaba la esquina del lienzo. Se decide **después de dibujar y mirando el dibujo** —¿quedó algún tramo?— y no recalculando la elisión, que es lo que permite que valga igual para las cuatro orientaciones sin repetir su lógica en cada una. La excepción es la casilla ya marcada: con ella no queda ni un tramo, así que el control tiene que seguir a la vista o no habría forma de desmarcarla. Lo vigila `controlDeElision` en la prueba de humo.

La estructura se dibuja **centrada** en el lienzo, horizontal y verticalmente. Es el foco de atención durante toda la clase.

**Y mientras no hay estructura, el lienzo dice qué falta** (2026-09-11). Al entrar a un tema con configuración —secuencial, binaria, las cinco hash, cubetas, búsquedas externas— el lienzo era un rectángulo gris y mudo: lo primero que ve el estudiante, y no decía nada. Ahora muestra, centrado en el sitio donde irá la estructura, **lo que hay que hacer en grande y dónde, debajo y con una flecha hacia el panel**: «Cree una estructura para empezar» a 22 px en tinta, y «Elija su tamaño en el panel de la derecha →» a 15 px (revisión de diseño, punto 5, 2026-10-06: hasta entonces era una sola frase de 12 px en gris, que proyectada no se leía). El mensaje es `{ titulo, indicacion }`; `config.mensajeLienzoVacio` lo cambia, y los árboles, índices y Huffman usan la misma forma con sus palabras. Los temas sin configuración no lo necesitan porque entran con su estructura ya creada; el árbol de Huffman tiene el suyo, que pide una palabra (§5.9).

**Y el centrado hay que anclarlo por fila, no dejarlo al orden de los hijos** (defecto visto por el usuario, 2026-09-11). El lienzo es una rejilla de dos filas —el control de elisión arriba, el escenario abajo, `auto minmax(0, 1fr)`— y el escenario solo ocupa el alto entero si cae en la segunda. Cuando el control no está, se caía a la primera, que mide lo que su contenido, y la estructura se pegaba al borde de arriba con medio lienzo vacío debajo. Le pasaba a los cuatro árboles —que nunca han llevado control, porque no eliden— y empezó a pasarle a cualquier tema cuya estructura cupiera entera, desde que el control se esconde cuando no hay nada que comprimir. Se arregla diciendo la fila de cada uno (`grid-row`), no contando hijos. Lo vigila `afirmarEstructuraCentrada` en la prueba de humo, que compara el centro de la estructura con el del escenario.

**Cuando aun así no cabe, la casilla del paso se lleva a la vista.** La elisión acota lo dibujado, pero no lo elimina: cada clave colocada suma unos 78 px, y el lienzo mide unos 640 px en una ventana de 950 y unos 390 en una de 700 — o sea unas seis claves y unas tres. Pasado ese punto el lienzo se desplaza, y el desplazamiento lo hace la vista sola, centrando la casilla que el paso está evaluando. Sin eso el desarrollo dice "dirección 56" y la tabla se queda mostrando las primeras casillas, que es exactamente el defecto que esto corrige. El salto es instantáneo y no suave: ocurre dentro del cambio que anima el FLIP, y un desplazamiento en curso dejaría las casillas animándose hacia coordenadas que ya se movieron.

Comprobarlo tiene truco y conviene no repetir el error: **medir la caja no sirve**. `.estructura-vertical` lleva `max-height: 100%`, así que su rectángulo siempre cae dentro del viewport aunque por dentro sobresalgan filas. Lo que hay que comparar es `scrollHeight` contra `clientHeight`, o dónde queda la casilla marcada respecto de la caja. La comprobación vieja medía la caja y por eso el defecto vivió sin que ninguna prueba lo viera.

**La pantalla de tema se ancla al alto del viewport y la página nunca scrollea.** El desplazamiento vive dentro del panel lateral. Si scrollea la página, el panel lateral —que acumula configuración, operaciones, reproducción, métricas y bitácora— estira el lienzo y empuja la estructura fuera de la pantalla: al proyectar en el salón se pierde justo lo que la aplicación existe para mostrar.

**Insertar, buscar y eliminar comparten un solo panel** (pedido del docente, 2026-08-29). Las tres operan sobre lo mismo —una clave—, así que el panel tiene un campo y tres botones, más el llenado automático. Antes eran tres paneles con un campo idéntico cada uno: repetían el mismo formulario tres veces y empujaban reproducción, métricas y bitácora hacia abajo, que es la misma presión que el ancla al viewport existe para contener. El panel lateral queda en cinco paneles y no siete (cuatro desde el 2026-09-30, cuando la reproducción pasó a ser la última fila de Operaciones). No es que ahora todo quepa sin desplazar —en una ventana de 700 px el lateral sigue midiendo bastante más de lo visible, y para eso scrollea—, pero en la ventana de proyección la reproducción vuelve a quedar a la vista sin buscarla.

Solo la inserción limpia el campo al terminar: es la que se repite clave tras clave al preparar el escenario. Buscar y eliminar dejan el valor, que suele ser el mismo con el que se quiere seguir operando. `Enter` inserta.

**La configuración se pliega en cuanto hay estructura** (opción B de la maqueta, elegida por el usuario el 2026-09-27, revisada en las tres pantallas de referencia: portátil 1366×640, la suya 1920×950 y 1440p 2560×1310). Abierta todo el tiempo ocupaba unos 250 px para algo que casi no se vuelve a tocar, y en el portátil dejaba la reproducción y las métricas fuera de la vista. Plegada, lo que queda de ella es **un resumen en la cabecera de Operaciones** —`n = 24 · l = 2  Editar`, o el `detalleReciente` del tema cuando lo declara—; «Editar» la abre en su sitio con los valores de siempre y un «Cancelar» que la vuelve a plegar sin tocar la estructura, y «Crear estructura» la pliega al terminar (`sincronizarConfiguracion`). **No se pliega donde la configuración es la operación** (índices, sin panel de Operaciones), ni existe en los temas sin configuración. Se descartaron plegarla en un panel propio —en el portátil seguían faltando 70 px para las métricas— y llevar las métricas al lienzo, que taparían el dibujo en las estructuras altas.

- **`hidden` tiene que ganarle al `display` del componente**: `form.panel { display: flex }` dejaba a la vista la configuración «plegada». `.panel[hidden]` lo arregla, y la prueba de humo mira lo que se ve (`getClientRects`) y no el atributo, porque con el atributo pasaba sin verlo.
- **El llenado automático es un enlace** junto al rótulo «Clave» y no un botón en su propia fila: se usa una vez para preparar el ejemplo, y esa fila era la que le faltaba al portátil.
- **La reproducción cabe en una fila**: `◀  Reproducir  ▶`, con la velocidad en un renglón debajo.
- **La reproducción es la última fila de Operaciones, separada por una línea, y está siempre** (opción C de la maqueta, elegida por el usuario el 2026-09-30): los pasos y «Reproducir» quedan apagados hasta que hay una operación (`habilitarReproduccion`); la velocidad no, porque elegirla antes también vale. Lo que se hace y cómo se lo ve avanzar quedan juntos, y se ahorra el marco de una tarjeta. Antes era una tarjeta propia cuyos botones nacían ocultos; al quitarle el título esa mañana para ganar alto, sin operación se veía como un cuadro blanco vacío. Se descartaron llevarla al lienzo como barra flotante —en el portátil taparía el final de las estructuras altas— y dejarla en su tarjeta siempre a la vista, que no ahorraba nada. **Donde no hay Operaciones (índices) va sola en su tarjeta**, igual de siempre presente. **Reproducir y Detener son un solo botón que alterna** con «Pausar»: nunca se usaban a la vez. El reproductor avisa cuándo arranca y cuándo se detiene (`alCambiarReproduccion`), y así el botón dice la verdad también cuando la operación arranca sola (§6.8), cuando un paso a mano la pausa y cuando llega al final.
- **El resumen baja a su renglón si no cabe junto al título** (`flex-wrap` en `.panel__cabecera`): el de las búsquedas externas —«N = 23 · 5 bloques de 5 Editar»— se salía del panel en el portátil y cortaba el «Editar».
- **Las métricas van en un renglón cada una, con el valor delante del rótulo** (2026-09-27): el panel mide la mitad, y en el portátil la tercera métrica de binaria dejó de quedar cortada. Dos por renglón con aire entre ellas, para que no se lean como una frase, y la que lleva fórmula ocupa el renglón entero. **El símbolo va aparte del rótulo** (`formula` en la métrica, `.metrica__formula`): los rótulos van en versalitas, y «⌈log₂ n⌉» se leía «⌈LOG₂ N⌉» y «Cubetas (n)», «CUBETAS (N)» — y aquí `N` y `n` no son lo mismo.
- **Cada paso se apunta en la bitácora una sola vez, la primera que se llega a él** (2026-09-30). La bitácora es lo que pasó y no por dónde anda la reproducción: al retroceder se volvía a apuntar el mensaje del paso al que se volvía, y al avanzar otra vez, de nuevo.
- **La bitácora lleva la hora como separador de su grupo, y los mensajes a todo el ancho** (2026-09-27). Era una columna de ocho cifras a la izquierda de cada mensaje, casi siempre vacía —la hora solo se escribe cuando cambia—, y cada entrada ocupaba dos o tres renglones. Los mensajes van en la letra de texto, que en frases se lee mejor que la monoespaciada. La hora repetida se oculta a la vista pero no al lector de pantalla, que la sigue oyendo por su `aria-label`. **La bitácora está posicionada** (`position: relative`) para que esa hora oculta —fuera del flujo— se ubique dentro de ella: hasta el 2026-10-01 se ubicaba contra la página, cada renglón nuevo la empujaba más abajo, y la página crecía hasta sacar una barra que desplazaba el lienzo y el panel lateral, en todos los temas. La prueba de humo vigila en cada traza que nada de la pantalla se posicione contra la página.
- **El renglón que se sale por arriba de la bitácora se desvanece** (revisión de diseño, punto 4, 2026-10-06). La bitácora baja sola hasta lo último y el renglón de arriba quedaba cortado a media altura, que se leía como un defecto de dibujo. Usa el mismo desvanecido que el lienzo (`.desborda`, `vigilarDesborde`), en 32 px y no 80: la bitácora mide unos 260 px. Un `MutationObserver` lo recalcula cuando entra una entrada o se vacía, en un solo sitio en vez de en cada llamada.
- **La bitácora ocupa el alto que sobra en el panel lateral** (2026-10-06). Con su tope fijo de 260 px, en la pantalla de referencia quedaban unos 110 px vacíos debajo de ella mientras la historia se cortaba arriba. Ahora su tarjeta crece hasta el pie del panel (`.panel--bitacora`, `flex: 1 0 auto`); cuando no sobra alto no encoge por debajo de lo que mide su historia, hasta 260 px, y el panel se desplaza como antes. Ese mínimo lo fija `ajustarAltoMinimoBitacora` cada vez que cambia su contenido, porque «lo que mida, hasta 260» no se puede decir en CSS sin quitarle el crecimiento: con un `min-height` fijo, la bitácora vacía de la pantalla recién entrada medía 260 px y su tarjeta quedaba cortada en el borde.
- **Los números se escriben con coma decimal en todas partes** (2026-10-06): el factor de carga salía `0.50` junto a `3,55` y `1,6 s`, y la densidad de cubetas en la bitácora, `82.5 %`.
- **El panel lateral lleva un ritmo más apretado que el resto** (opción A + C de la maqueta, 2026-09-30): 12 px entre tarjetas, 12 de relleno y el título a 8 de su contenido, en vez de 16, 16 y 12. Solo ahí; el menú no tiene esa presión.
- **Lo que queda justo**: en el portátil (1366×640) se ven operaciones, reproducción y todas las métricas —desde que el aviso salió del panel lateral, también al terminar—. Lo último en entrar fueron «Altura» en los árboles de bits, cuyo campo «Palabra» alarga Operaciones, y la segunda fila de métricas de las búsquedas externas: les faltaban 43 y 48 px, y los dieron el título de Reproducción y el ritmo apretado.

**El aviso flota sobre el lienzo, arriba a la izquierda, en la fila del control «Ver estructura completa»** (opción B de la maqueta, elegida por el usuario el 2026-09-27). De agosto a septiembre fue anclado arriba del panel lateral (pedido del usuario, 2026-08-29: abajo en la columna quedaba fuera de la vista), pero ahí empujaba todos los paneles, y en un portátil dejaba las métricas bajo el borde justo al terminar cada operación. Entonces se había descartado el lienzo porque su alto es el recurso escaso y una banda que aparece y desaparece haría saltar la estructura: **flotando no ocupa alto y no mueve nada**. Se descartó también el encabezado, que en índices partía el título en dos renglones y crecía.

- **La fila de arriba del lienzo mide siempre al menos lo que el control** (`minmax(20px, auto)`), esté visible o no. Colapsaba a cero cuando la estructura cabe entera, y una tabla que llena el lienzo subía hasta quedar debajo del aviso: lo destapó la prueba de humo a 700 px de alto, que ahora comprueba que el aviso no se monta sobre la primera casilla de la tabla.
- Deja libre el ancho del control a la derecha, y la sombra lo despega de lo que haya debajo. El aviso más largo de la aplicación —clave ausente en binaria externa— cabe en un renglón en el portátil.

**Lo que pasa durante la traza se dice, no solo se ve.** La bitácora registra todos los pasos; el aviso destaca los que deciden el resultado, para no tener que leerla entera para saber qué pasó:

| Paso | Aviso |
|---|---|
| `colision` | advertencia |
| `rechazada` · `saturada` | error |
| `no-encontrada` | advertencia |
| `encontrada` | éxito (verde, como la casilla hallada; desde el 2026-10-07) |
| `insercion` · `eliminacion` | información |

Los pasos de recorrido —comparación, sondeo, cálculo, desplazamiento, extracción— **no avisan**: son el trámite, no la noticia, y avisar en cada uno haría parpadear el panel y dejaría de leerse. El aviso **se deduce del punto de la traza y no se acumula**: al retroceder vuelve a decir lo que correspondía ahí, buscando hacia atrás la última noticia, igual que la estructura se rehace desde su estado base (§5.6).

**Desde el 2026-10-07 el aviso narra todos los pasos, no solo las noticias** (opción B de las maquetas, elegida por el usuario, también en la pantalla de referencia). Con el zoom del navegador a 150 % —como se proyecta— la bitácora queda bajo el borde, y el mensaje de un paso de trámite («se compara 84 con la casilla 11…») no se veía en ninguna parte. El párrafo anterior describe la regla de antes; lo que sigue valiendo de él es que el aviso se deduce del punto de la traza y no se acumula.

- **Un paso de trámite va con borde neutro** (`tramite`), y las noticias con el color de la tabla: así la narración no se lee entera como una alarma. Cada uno lleva **«Paso n de N»** y el mensaje a 16 px. **Todos los avisos del lienzo van a ese tamaño**, narren un paso o no: los sueltos —un carácter no admitido, una clave de otra longitud— se habían quedado en 13 px y se veían más chicos que la narración (visto por el usuario). En binaria, ese número coincide con el rótulo de la fila del apilado.
- **Cada tipo de paso tiene su ícono, además del color** (pedido del usuario): proyectado, los colores se lavan hasta parecerse, y hay estudiantes que no distinguen el rojo del verde. Los íconos están dibujados en SVG (`vista/componentes/iconos.js`), no son caracteres: el computador del aula tiene fuentes que no se conocen. Los avisos sueltos también los usan, en lugar de `i`, `!` y `✕`.
- **El paso final muestra el resultado de la operación**, como antes, con el rótulo «Resultado» y al mismo tamaño que la narración.
- **La fila de arriba del lienzo le guarda su alto al aviso** (`--alto-aviso`, `reservarAltoDelAviso`). Narrando, el aviso mide un rótulo y hasta dos renglones, y en una ventana de 700 px se montaba sobre la primera fila de la tabla hash (lo destapó la prueba de humo). La reserva solo crece mientras haya aviso, para que la estructura no suba y baje cada vez que un mensaje pasa de uno a dos renglones; vuelve a cero al limpiar el aviso o cambiar el ancho del lienzo.

Detalle que hace falta y es fácil de omitir: las filas del grid van con `minmax(0, 1fr)`, no `1fr`. Sin el `minmax(0, …)` una fila de grid no puede encogerse por debajo de su contenido, y el panel lateral vuelve a estirar el lienzo aunque la pantalla tenga el alto fijado.

**El lienzo no muestra barras de desplazamiento** (pedido del usuario, 2026-09-27). Lo que no cabe se sigue desplazando —rueda en vertical, Shift + rueda en horizontal, touchpad—, y la vista sigue llevando sola a la casilla, nodo o bloque en curso. Las barras aparecían en dos casos: al activar «Ver estructura completa», con una barra clásica de 15 px que además le quitaba alto al lienzo y movía el dibujo; y a destellos al desactivarla o al crecer un árbol, porque la animación FLIP arranca las casillas desde donde estaban y mientras viajan el contenido desborda. **El panel lateral conserva la suya**: no es del lienzo, y el usuario la quiso así.

- **Sin barra, lo que avisa que hay más es el borde desvanecido**, y solo el del lado por donde sigue la estructura: al principio el derecho, a mitad de camino los dos, al final el izquierdo; y lo mismo arriba y abajo en lo que crece hacia abajo. Es una máscara de 80 px (`.desborda` y `.desborda-izq|der|arr|aba` en `pantallas.css`) que `marcarDesborde` pone midiendo el desplazamiento —`scrollLeft` contra `scrollWidth`—, así que vale igual para todas las vistas, incluido el panel del cálculo.
- **Se mide con la estructura asentada** (`marcarDesbordeAlAsentarse`): si hay animaciones en curso, espera a que terminen. Medir a media animación encendía el desvanecido a destellos, que es el mismo defecto por el que se quitó la barra. Cada dibujo reescribe la clase de la estructura y con ella borra el desvanecido, que vuelve cuando la estructura se asienta.
- La prueba de humo lo comprueba con n = 24 y la vista completa (`lienzoSinBarras`), y sin barra en las columnas de índices. Como la prueba es síncrona, termina las animaciones a mano y avisa con un `scroll`, que es lo que la pantalla escucha para volver a medir.

### 6.3 Estructuras apiladas (binaria)

**Pedido del docente (2026-08-18): binaria no muestra una estructura que cambia, sino una estructura por paso, apiladas.** Al terminar la búsqueda, el apilado completo es el paso a paso del algoritmo, legible de un vistazo — que es como se explica en el tablero.

**Cada fila es la estructura entera, con lo descartado apagado en su sitio** (opción A de la maqueta, elegida por el usuario el 2026-09-27). Hasta entonces cada fila se recortaba al tramo que sobrevivía y lo descartado desaparecía; lo que el usuario quería ver es **cómo se van apagando los tramos que ya no se usan**, y que al final quede toda la estructura con ellos apagados. Se descartaron la fila única que se va apagando —más limpia, pero al terminar ya no se lee cómo se llegó— y el panel del cálculo, que el usuario no quiso aquí.

- Todas las filas miden lo mismo; lo que se achica de fila en fila es lo encendido: el rango que sigue en juego, normal, y el medio en naranja. Los tramos elididos que caen enteros en lo descartado se apagan igual (`tramo-elidido--descartado`).
- Las filas se alinean por columna: la casilla 7 cae bajo la casilla 7 de la fila de arriba. Sin esa alineación se pierde la noción de *dónde* está lo que sobrevivió.
- Las filas aparecen **una por paso** al avanzar, y retroceder las quita. El apilado sigue al reproductor, no lo reemplaza.
- **Al cerrar, el apilado se va** (§7): el último paso del algoritmo muestra todas las filas con lo apagado, y el paso final deja la estructura en una sola fila, como queda, con la clave hallada en verde — «como si todo se hubiera reiniciado» (pedido del usuario, 2026-09-27). Se probó conservar el apilado al cerrar, y también agregarle debajo una fila «Resultado»; el usuario no quiso ninguna de las dos.
- La fila de una búsqueda fallida no tiene rango: se dibuja **entera y toda apagada**. Antes, recortada, quedaba vacía y anunciaba *Rango vacío*; ese aviso solo queda para una estructura sin claves.
- **Sin azul ni corchete para el rango** (2026-09-27, §8.2): lo de fuera está apagado, y eso basta para ver lo que sigue en juego.

**Pendiente de consultar con el docente (2026-08-22): la primera fila muestra el rango de la búsqueda, no las `n` casillas.** Como `buscarBinaria` recorre solo el arreglo de claves, el rango del paso 1 va de 1 a la cantidad de claves; las casillas vacías del final (siempre al final, porque `dominio/estructura.js` inserta empaquetado) no aparecen en ninguna fila. Solo se nota cuando la estructura no está llena. La alternativa evaluada —dibujar la fila 1 completa, con las vacías, y recortar de la fila 2 en adelante— convence al usuario, pero **no se implementa hasta que el docente opine**: las vacías nunca fueron candidatas y mostrarlas puede leerse como que se descartaron en el paso 1. No "corregir" esto por iniciativa propia.

**El rótulo «Paso n» va en la fila de las casillas, no a caballo entre ella y la escala** (defecto visto por el usuario, 2026-09-11). Cada paso ocupa dos filas del grid —las casillas y su escala—, y el rótulo las abarcaba las dos: al centrarse entre ambas quedaba 16 px por debajo del centro de lo que nombra, más cerca de la numeración que de la estructura. Lo mismo valía para el aviso de rango vacío.

**Y centrar la caja no bastó: había que mirar el texto.** Corregida la fila, el rótulo seguía leyéndose alto porque conservaba un `padding-bottom` de cuando abarcaba las dos filas: la caja quedaba centrada y el texto vivía en su mitad superior, 6 px por encima de las claves. Es la misma trampa que en el desplazamiento del lienzo (`docs` de la skill `verificar`: medir el contenido y no la caja), y aquí se resuelve igual — **la prueba de humo mide el texto con un `Range` sobre el contenido**, no el rectángulo del elemento. Comprobado devolviendo el relleno a propósito: con él, la comprobación falla en tres rótulos.

Dos decisiones de implementación que hay que respetar al tocar esto:

1. **Un solo grid para todo el apilado**, no un grid por fila. Con grids independientes las columnas de cada fila se dimensionan por separado y dejan de corresponderse, que es justo lo que la vista necesita.
2. **Las columnas se calculan una vez por búsqueda**, con las casillas relevantes de la traza completa. Si se recalcularan paso a paso, las columnas se moverían bajo las filas ya dibujadas.

El modo lo activa la configuración del tema (`apilada.rangoDePaso`); los temas que no lo declaran siguen con una estructura única, como secuencial.

### 6.4 Regla de índices

Bajo la estructura horizontal —y al costado de la vertical— corre una escala continua que numera las posiciones, con marcas mayores cada 5. Cuando hay elisión, la escala se comprime pero **mantiene visible la numeración real de lo dibujado**: cada casilla que sobrevive conserva su índice, así que la numeración nunca miente sobre dónde está una clave. Es el elemento distintivo del producto. **El tramo comprimido no se rotula** (ver 6.2): declara cuánto oculta desde su propia casilla (`⋯ 18 ⋯`) y deja el hueco de la escala vacío.

**Cada casilla y su marca se dibujan en la misma columna** (`.columna-casilla`), no en dos filas independientes. Con elisión los tramos tienen ancho propio, y dos contenedores paralelos desalinean la numeración de lo que rotula — que es precisamente el error que la escala existe para no cometer. En vertical el par es `.fila-casilla` y la marca va a la izquierda, pero la regla es la misma: van juntos.

**Cuando la escala vive en una columna aparte, su alineación no la garantiza nada: hay que medirla** (2026-09-11). Es el caso de las dos vistas en columnas —cubetas (§5.7) y búsquedas externas (§5.8)—, donde una sola columna de números rotula los renglones de todas las columnas. Ahí la regla de arriba no puede aplicarse —la marca no puede viajar dentro de cada casilla, porque entonces se repetiría una vez por columna— y en su lugar vale esta otra: **la columna de la escala se construye como una columna más**, con el mismo rótulo arriba (oculto) y los mismos huecos, de modo que la alineación salga de compartir la disposición y no de escribir alturas a mano.

Dos defectos reales salieron justo de ahí, y los dos eran invisibles para `node --test`:

- **Un espaciador vacío no mide nada.** El hueco que dejaba pasar la fila de rótulos en cubetas era un `<span>` sin texto: sin línea que medir, su alto es cero, y la columna entera de números subía 16 px —un renglón completo— respecto de las cubetas que rotulaba. Lleva un espacio duro dentro.
- **Un alto escrito a mano acaba desalineado.** En búsquedas externas el hueco medía `26px` puestos a ojo, y la escala quedaba 2 px arriba; al construir la escala como un bloque más —mismo rótulo, mismos huecos— el error desaparece por construcción.

Lo vigila `afirmarEscalaAlineada` en la prueba de humo, que compara el centro de cada marca con el de lo que rotula, en los dos temas.

Dos consecuencias de que el tramo ya no lleve marca, ambas de alineación: la estructura horizontal alinea sus grupos **por arriba** (`align-items: flex-start`) —al pie, el grupo del tramo, más bajo por no tener marca, se hundiría a la altura de la numeración— y en vertical el tramo se manda a mano a la segunda columna del grid, que si no el navegador lo metería en la de la escala.

### 6.5 El cálculo de la dirección (transformación de claves)

El desarrollo del hash se dibuja **junto a la estructura**, en el lienzo, y no en el panel lateral: lo que se enseña es la correspondencia entre la cuenta y la casilla que resulta de ella, y esa correspondencia se pierde si las dos cosas viven en extremos opuestos de la pantalla.

**Insertar deja de ser instantáneo y pasa a ser una operación reproducible** (decisión del usuario, 2026-08-22), porque en estos temas insertar *es* lo que hay que enseñar: buscar solo repite el mismo cálculo. Una línea del desarrollo por paso del reproductor, y la clave se coloca en el último paso, no antes.

Tres consecuencias que hay que respetar al tocar esto:

1. **El reproductor es de la operación en curso, sea buscar o insertar.** Por eso vive en su propio panel y no dentro del formulario de búsqueda.
2. **La traza no toca la estructura.** Igual que en las búsquedas, es la pantalla la que aplica el efecto al alcanzar el paso que coloca la clave, y lo **deshace** al retroceder. Sin eso, retroceder mostraría una estructura que no corresponde al paso en pantalla.
3. **Abandonar una inserción a medio reproducir la consuma.** Al empezar otra operación, o al volver al menú, la clave pendiente se coloca antes de olvidar la traza; de lo contrario quedaría en el limbo.

Cada paso carga las líneas reveladas hasta ese momento —no solo la última—, del mismo modo que los pasos de binaria cargan sus `descartadas`. Es lo que permite que el panel se dibuje sin recordar nada del paso anterior.

El **llenado automático** no reproduce nada: llena aplicando directamente el paso que coloca de cada traza. Llenar es preparar el escenario, no la lección; la lección es la clave que se inserta a mano.

**El panel señala su casilla** (maqueta elegida por el usuario en el repaso de diseño, 2026-09-28). El tema lo declara con `calculoSenalaCasilla`; hoy solo lo declara la transformación de claves, porque los árboles y las externas tienen su propia parada en el repaso:

- **La línea activa va a la altura de la fila que el paso sigue.** El panel se corre en vertical (`alinearCalculo`, con `transform` y una transición de 200 ms) y **un pico ámbar** —el color de la línea activa— la señala desde el borde. Centrado en el lienzo, el «Dirección 56 + 1 = 57» de la función cuadrado caía a 40 px de la casilla 57, y la correspondencia que el tema enseña había que buscarla. Mientras avanza el sondeo el panel baja con él: «Dirección 9» a la 9, «i = 1» a la 10, «i = 2» a la 11.
- **Si el panel no llega sin salirse del lienzo, se queda en el borde y el pico se esconde.** Pasa en ventanas bajas, con la línea activa al pie de un panel alto y la fila arriba. El pico nunca señala la fila desde un renglón que no es el que la produjo.
- **Se mide la fila y no la casilla**, y el panel por `offsetTop`: el FLIP mueve las casillas con `transform` y el propio panel transiciona el suyo, así que las posiciones en pantalla mienten a media animación. Se vuelve a alinear al desplazar la tabla y al cambiar el tamaño del lienzo.
- **Sin operación en curso no se dibuja.** El «Sin operación en curso» ocupaba el ancho que la matriz de anidados necesita y no enseñaba nada; ahora la estructura se centra sola en el lienzo, como en binaria al cerrar (§6.3). Esta parte la declara aparte `calculoSoloEnOperacion`, y la usan también los tres árboles de bits (usuario, 2026-09-28), con la misma entrada y salida del panel; alinear y el pico (`calculoSenalaCasilla`) quedan para las tablas, porque en un árbol la cuenta no lleva a una fila.
- **Al aparecer o irse el panel, la estructura se recentra deslizándose entera, como un bloque** (`aplicarVisibilidadCalculo`, pedido del usuario, 2026-09-28). La primera versión dejaba el corrimiento al FLIP de las casillas, y la numeración, los tramos elididos y el borde de la tabla —que no son casillas— saltaban de golpe mientras las casillas viajaban: la tabla se veía descuadrada. Ahora se anima el contenedor, antes de dibujar el paso, y el FLIP de las casillas solo anima lo que les pasa a ellas.
- **Panel y estructura nunca se ven encima uno del otro.** La tabla queda a un canal (16 px) del panel, así que cualquier corrimiento la mete en su sitio. Al entrar, la estructura se corre (400 ms) y el panel se funde ya alineado —sin bajar desde el centro— cuando a ella le faltan unos 6 px; al irse, en espejo, el panel sale del flujo donde está, se funde (150 ms) y solo entonces arranca la estructura. La primera versión fundía el panel mientras la estructura ya se movía, y al irse «se intersectaban» (usuario).

### 6.6 Ancho de casilla (2026-08-29)

**Todas las casillas de una estructura miden lo mismo, tengan clave dentro o no.** El ancho sale de `l` —lo que ocupa una clave de `l` cifras con su marca— y se fija al crear la estructura, en la variable `--ancho-casilla` de la raíz de la pantalla; lo heredan por igual la tabla, sus arreglos anidados y el apilado.

Antes cada casilla se dimensionaba por su contenido y la estructura se deformaba a medida que se insertaban claves: con `n = 10` y `l = 4`, la casilla vacía medía 42 px, la que tenía clave 50 y la recién insertada 60, así que la fila con clave empezaba 11 px a la izquierda de la vacía y las columnas del arreglo anidado dejaban de corresponderse. En una matriz eso es fatal: lo que se enseña es cuánto espacio queda en cada dirección, y no se lee si las columnas no están alineadas.

Dos detalles que sostienen la regla:

- **El ancho se mide, no se calcula con `ch`.** El mismo valor lo usan las pistas del grid de las filas, y allí `ch` resolvería contra la fuente de la fila —proporcional— y no contra la monoespaciada de la casilla. Se mide una casilla de prueba en el DOM (`vista.componentes.casilla.anchoParaCifras`), con el sitio de una marca reservado a la derecha del número, y así el ancho ya contiene el relleno, el borde y la fuente que de verdad esté cargada.
- **Las marcas de estado (`◂` insertada, `✓` encontrada, `✕` eliminada) van en la esquina superior derecha y fuera del flujo** (pedido del usuario, 2026-09-24). Al lado del número lo empujaban a la izquierda y la clave dejaba de verse centrada justo en la casilla que más se mira. Se descartó sacarlas de la casilla: en las horizontales y en la matriz de anidados el hueco entre casillas es de 4 px y se montarían sobre la vecina. El ancho reservado de arriba es lo que deja libre la esquina. El `◂` va a 18 px y los otros dos a 12: el triángulo ocupa menos de la mitad de su caja y al mismo tamaño no se entendía. En el nodo redondo del árbol la marca baja y entra hasta caer dentro del círculo.
- **Las pistas del grid son fijas, salvo el tramo elidido.** Con `auto`, cada fila era un grid independiente que repartía el sobrante a su manera. El tramo sí se dimensiona por su contenido: lleva un conteo dentro, no una clave. La primera columna del arreglo anidado suma además el canal que la separa de la tabla (§5.4).

La prueba de humo lo vigila con `afirmarCasillasParejas` y `afirmarColumnasAlineadas`: es un defecto de layout, invisible para `node --test`.

### 6.7 El árbol (2026-08-29)

Tercera orientación de la pantalla, además de horizontal y vertical: ni fila ni tabla, sino **niveles**. Cada nodo se posiciona a mano dentro de un lienzo propio —columna por recorrido en orden, fila por nivel— porque el nivel *es* el número de bit que se miró para llegar hasta él, y eso no lo puede decidir el flujo del documento.

**Las aristas se rotulan con el bit** que lleva a cada hijo (`0` izquierda, `1` derecha), dibujadas en un SVG detrás de las casillas. Sin ese rótulo el dibujo no dice por qué la clave tomó ese camino, que es justo lo que el tema enseña. El desarrollo completo —código de la letra y bajada bit a bit— se lee en el panel del cálculo, al lado, igual que la dirección en las funciones hash (§6.5); el nodo solo muestra la letra (decisión del usuario sobre maqueta, 2026-08-29).

Dos consecuencias:

- **El árbol no elide** y su control desaparece del lienzo: su tamaño lo acota el alfabeto, no un `n` que el estudiante elige.
- **Se dibujan también las posiciones vacías que son ancestro de una ocupada.** Es lo que hace visible el hueco a medio eliminar —el paso que saca la clave antes de que suba la hoja— en vez de dejar descendientes flotando sin padre.

**El nodo de un árbol es redondo** (pedido del usuario, 2026-09-11). Los árboles se parecen a los grafos —que vienen después en el temario— y conviene que hablen el mismo idioma visual desde ya. Es **un ajuste de la casilla de siempre y no un componente nuevo**: `.arbol .casilla` redondea y ajusta el ancho, así que hereda sin tocar nada sus estados —ocupada, vacía, en evaluación, encontrada, insertada, eliminada— y sus marcas.

- **Solo dentro del árbol.** En una tabla o en una fila, la cuadrícula es lo que deja comparar columna con columna, y redondear las casillas la rompería (decisión del usuario).
- **El nodo mide 44 px y no los 40 de la casilla**, porque una caja redonda pierde las esquinas: con 40, una clave con su marca —«a ◂»— quedaba pegada al borde. El número vive en dos sitios que tienen que seguirse: `--diametro-nodo` en `tokens.css` y `DIAMETRO_NODO` en `vista/dibujos/arbol.js`, que es el que reparte las columnas.
- **El árbol se estrechó de paso**, porque el nodo redondo es más angosto que la casilla que reservaba sitio para `l` cifras: 68 px por nodo en vez de 72. En residuos múltiples, donde el esqueleto entraba justo (más abajo), es aire ganado.

**En residuos el nodo interno se dibuja como un punto y no como una casilla** (decisión del usuario sobre maqueta, 2026-08-30). En todos los demás temas una casilla vacía significa «aquí cabe una clave», y en residuos eso sería mentira: ese nodo bifurca y nunca podrá guardar nada. Dibujado como punto, lo único con caja en el árbol son las claves, que es lo que hay que leer. Lo enciende `config.clavesSoloEnHojas`.

**Y el punto se queda como punto aunque las hojas sean redondas** (decisión del usuario sobre maqueta, 2026-09-11). Se evaluó agrandarlo a un círculo hueco, más parecido al vértice de un grafo, y se descartó por lo mismo de arriba: un círculo vacío del tamaño de un nodo promete un sitio donde cabría una clave, y ahí nunca cabrá. El parecido con los grafos ya lo dan las hojas; el punto de bifurcación no es un vértice, es una decisión de camino.

Dos cosas que ese punto arrastró:

- **El nodo por el que se está bajando sigue siendo un punto, solo que resaltado.** Hincharlo a casilla en cada paso recolocaría el árbol entero debajo del reproductor. La excepción es la posición vacía en la que **termina** un paso —donde se corta el camino de una búsqueda—: esa sí se dibuja como casilla, porque es donde la clave tendría que estar.
- **Cada posición ocupa lo que ocupa su dibujo**, no una columna fija: un punto pide menos aire que una casilla. Con columnas de ancho único el árbol de `prueba` no cabía a lo ancho del lienzo y se ponía a scrollear. Y cuando aun así el árbol y el cálculo no caben juntos, **el árbol se encoge lo justo** (`ajustarArbol`, maqueta elegida por el usuario, 2026-09-28): el panel conserva el ancho que su contenido pide y el árbol toma el resto con `zoom`, nunca por debajo de 0,6. Pasa en el portátil con residuos múltiples, que queda en torno al 75 %. Hasta entonces cedía el cálculo, y cedía cortándose: con el escenario centrado a secas, lo que no cabía se salía por los dos lados, y se perdían a la vez la primera hoja del árbol y los valores del panel. El escenario centra ahora con `safe center`: si algo no cabe, se sale solo por la derecha.

**Y cuando sobra lienzo, el árbol crece** (revisión de diseño, 2026-10-04), hasta 1,5×, y solo si cabe también a lo alto: con medidas fijas, en la pantalla de referencia (§6.9) el árbol ocupaba una fracción del lienzo y sus bits —la lección del tema— quedaban chicos. El alto se comprueba sobre el resultado: si al crecer se sale de su caja, se recorta el crecimiento. Hasta el 2026-10-08 el sitio del cálculo se reservaba siempre; ver el párrafo siguiente. Los bits de las aristas van en tinta y a 13 px (antes gris a 11). **FLIP divide el delta por el zoom del elemento** (`animacion.js`): mide en la pantalla y aplica dentro del árbol ampliado, y sin esa conversión, avanzar pasos seguidos acumulaba el error hasta mandar las casillas a decenas de miles de píxeles.

**El sitio del cálculo se reserva solo durante una operación** (opción B de las maquetas, elegida por el usuario el 2026-10-08). Reservado siempre, el árbol no cambiaba de tamaño al aparecer o irse el panel, pero con el zoom del navegador a 150 % los árboles de residuos quedaban en reposo a 0,64×, corridos a la izquierda junto a un tercio de lienzo vacío; ahora en reposo llegan a ~1,1×. A 1920 × 950 no cambia nada: el árbol ya tocaba su tope de 1,5×. Lo que cuidar:

- **Dentro de una operación el tamaño no cambia**: se reserva el ancho del panel más ancho de toda la traza, medido por adelantado (`anchoDelCalculo`). Una palabra es una sola operación —todos sus pasos llevan cálculo—, así que el árbol se achica al empezar la palabra y crece al terminarla, no con cada letra.
- **El cambio se anima como un bloque** (`recentrarArbol`, en la pantalla): la caja del árbol viaja y se escala desde donde se veía, aristas y bits incluidos, y el FLIP de los nodos solo anima lo que les pasa a ellos. Se recentra dos veces: ya, para que el árbol siga viéndose donde estaba aunque el panel entre al flujo o salga de él, y al dibujar el paso (`dom.recentrarArbol`), sobre el árbol nuevo, porque el paso final no dibuja la rama del camino y medir el viejo daba un salto. Mientras dura, la caja no recorta ni lleva la máscara del desborde (`.lienzo__escenario--recentrando`).
- **`zoomEfectivo` cuenta también la escala de los `transform` de los ancestros**: sin eso, el FLIP de los nodos y las aristas que los siguen se corrían en la proporción del escalado.
- **Al irse, el panel conserva su último contenido** (`sincronizarCalculo`): se desvanecía diciendo «Sin operación en curso», y al cambiar de ancho corría la estructura justo antes de medirla.
- **A lo alto el árbol también encoge**, hasta el mismo 0,6×: antes el ancho reservado ya lo achicaba más que el alto, y sin la reserva el árbol de residuos se salía por abajo a 1280 × 633.

La prueba de humo lo vigila en residuos múltiples: en el primer cuadro de la entrada y de la salida cada nodo se ve donde estaba, y con el panel a la vista el árbol no queda debajo.

**Y si ni en su mínimo caben juntos, se estrecha y se desplaza** (opción D de las maquetas, elegida por el usuario el 2026-10-09). En un proyector de 1024 × 650 el lienzo mide unos 562 × 250 px y el panel 343 × 241: el panel se salía por la derecha y se perdían sus resultados. Se descartaron una franja al pie, ocultar el panel y ponerlo encima del árbol porque ninguna otra estructura hace algo así; esta es la regla que ya siguen índices (§5.10), Huffman y las tablas dispersas:

- **El panel se aprieta** con la misma clase que la derivación de índices, `.lienzo__escenario--apretado`, que aquí pone `apretarCalculo` (`dibujos/arbol.js`) cuando el árbol a 0,6× y el panel a su ancho natural no caben. Junto a un árbol cambia la forma: las fórmulas son cortas, así que solo el rótulo sube a su renglón y la fórmula sigue en el suyo con el resultado; tres renglones por línea no cabían en 250 px. Si aun así no cabe a lo alto, el panel se desplaza por dentro hasta la línea activa (`llevarLineaALaVista`, que vale para cualquier panel que desborde).
- **La caja del árbol se estrecha y se desplaza** hasta el nodo del paso (`llevarALaVista`), con el borde desvanecido del lado por donde sigue. El árbol se queda en 0,6×.
- **Se decide con el ancho de toda la traza** y no cambia a mitad de la operación; al irse, el panel conserva su forma mientras se desvanece (`soltarApretado` al terminar).
- **La clase solo se toca si cambia, y cada ajuste vuelve a centrar el nodo del paso.** Quitarla y ponerla en cada `ajustarArbol` devolvía la caja un instante a su ancho entero, y reiniciar el zoom acortaba lo desplazable: el navegador recortaba el desplazamiento y el nodo activo quedaba fuera o bajo el desvanecido.
- **Mientras el árbol se achica al empezar, la caja sí recorta**: sin recortar no se puede desplazar. Durante esos 400 ms el lado derecho del árbol queda bajo el desvanecido.

La prueba de humo comprueba, en residuos múltiples, que con el cálculo a la vista el panel cabe entero en el lienzo y que el nodo del paso queda dentro de lo que se ve de la caja; a 1024 × 650 (`humo.js 1024x650`) es donde se ejercita.

**El bosque de Huffman crece igual** (opción B de las maquetas, elegida por el usuario el 2026-10-06; `ajustarBosque` en `dibujos/bosque.js`): hasta 1,5× si sobra lienzo, hasta 0,6× si falta, con el panel de reducciones y la tabla a su tamaño. Dos diferencias con el árbol. **Un solo tamaño para toda la palabra**, el que deja caber su momento más ancho —casi siempre el primero, con todas las letras sueltas en fila—, medido sobre los bosques de la traza entera sin dibujarlos: medido paso a paso crecía a cada unión (de 1,18× a 1,5× con MURCIELAGO) y ese cambio de escala se sumaba al viaje de los nodos. Y **la tabla del final se mide por adelantado** para reservarle el sitio desde el primer paso, o el último encogería el árbol. El zoom va en la caja de cada árbol, que escala también su peso al pie, y por eso `seguirAristas` divide por el zoom efectivo y no por el del lienzo. Cuando ni a 0,6× cabe —un proyector de 1024 × 650 con una palabra larga— el lienzo se desplaza hasta lo que se está uniendo, y el bosque se centra con `safe center`: centrado a secas se desbordaba también por la izquierda, y las dos hojas de la primera unión quedaban donde ni desplazando se veían.

**Solo llevan bit las ramas que conducen a una clave** (opción 1a de la maqueta, elegida por el usuario el 2026-09-28). Las que no llevan a ninguna se dibujan punteadas y sin rótulo: siguen ahí porque el espacio sin usar es la mitad de lo que el método cuesta, pero su bit no decía nada, y en residuos múltiples los de las ramas vacías de dos subárboles vecinos se montaban («11 01 01») y el del extremo derecho se cortaba («1:»). Es también como rotula el docente en su tablero (§5.5). La rama del camino del paso lleva su bit aunque no llegue a una clave: es donde la clave tendría que estar. Se descartó la opción de rotularlas todas dándoles más aire a las vacías: el árbol se ensanchaba y en los extremos los rótulos seguían casi pegados.

**Lo que la búsqueda descarta se apaga** (opción 2b de la maqueta, elegida por el usuario el 2026-09-28): todo lo que no está en el camino hasta el nodo del paso ni cuelga de él —nodos como `descartada`, y puntos, aristas y bits a la misma opacidad—. Es la regla de toda la aplicación, apagado es descartado (§8.2), y el camino queda encendido por contraste; a mitad de la búsqueda, el subárbol del nodo actual sigue normal porque la clave todavía puede estar ahí. El camino no viaja en la traza: en un árbol son los ancestros del nodo del paso. Se descartó remarcar el camino en tinta gruesa: resaltaba más, pero era un estilo que no existe en ningún otro sitio.

**Sin claves, el lienzo dice qué hacer** (pedido del usuario, 2026-09-30): «Inserte una letra o una palabra para empezar.», como Huffman con su «Escriba una palabra para construir su árbol.». El árbol vacío no dibuja nada —ni el esqueleto de residuos múltiples, que suelto no se entendía (2026-08-30)—, y hasta entonces el lienzo quedaba gris y mudo justo al entrar al tema, que en los árboles de bits es cuando la estructura ya existe y solo falta insertar. Es corto a propósito: el mensaje del lienzo vacío se parte a 44ch, y la versión larga dejaba «árbol.» solo en un segundo renglón. **Solo sin operación en curso** (visto por el usuario, 2026-10-08): el primer paso de la primera clave es el cálculo de su código, con el árbol todavía vacío, y el lienzo seguía pidiendo «Inserte una letra…» junto al cálculo de esa misma letra. Mientras se opera queda en blanco; el paso final —al eliminar la última clave— vuelve a decir qué hacer.

**Al recolocarse, el árbol se mueve entero** (pedido del usuario, 2026-09-28: se conectaba «raro» y no fluía). El FLIP solo animaba los nodos con clave: los puntos de bifurcación saltaban a su sitio, y las aristas —que viven en un SVG aparte— aparecían ya en la posición final, uniendo huecos, mientras los nodos iban de camino. Ahora los puntos tienen identidad (`bifurcacion-<posición>`) y viajan como los nodos; las aristas y sus bits **siguen a los nodos cuadro a cuadro** mientras algo del árbol se anima (`seguirAristas`), midiendo dónde se ve cada nodo, y al terminar se trazan con la retícula; y **lo nuevo aparece desvaneciéndose** —el nodo y la arista que llega a él—. La prueba de humo lo vigila con `afirmarAristasPegadas`, que mide a media animación a propósito, y se comprobó que sin el seguimiento falla.

**Cuando un nodo abre más de dos ramas, los rótulos se bajan hasta cerca del hijo y se escalonan a dos alturas.** A mitad de la arista los cuatro caen casi en el mismo punto —de ahí es de donde salen— y se montan unos sobre otros; bajando, se abren tanto como se abran los hijos. El escalonado hace falta además porque **no hay ancho que repartir**: el esqueleto de `prueba` y el panel del cálculo ocupan el escenario exacto, sin un píxel de sobra. Lo vigila la comprobación `ningún rótulo se monta sobre otro` de la prueba de humo.

**El aire de alrededor se le quita al cálculo, así que se recortó** (2026-09-11). En residuos múltiples —el dibujo más ancho de la aplicación— el panel se quedaba en 272 px cuando necesita unos 340, y **cinco de sus siete líneas se partían en dos**: la peor dejaba «bloque 1 =» arriba y un «00» huérfano debajo, que se lee como un valor aparte. No hizo falta cambiar quién cede: bastó devolverle al cálculo el espacio que se iba en huecos —el canal entre estructura y panel de 32 a 16 px, y el relleno del árbol de 16 a 8— y acortar el texto más largo del desarrollo («posición 1 en el alfabeto» → «del alfabeto»). El panel pasó de 272 a 304 px y de cinco líneas partidas a una, que además parte por un espacio y no por una igualdad.

**Que el árbol quepa no basta: hay que mirar también el cálculo.** Como el árbol no se encoge, al crecer empuja al panel y el escenario lo recorta por la derecha sin avisar —el panel sigue midiendo lo suyo, solo que la mitad queda fuera—. Pasó al bajar el esqueleto de residuos múltiples a su cuarto nivel, y lo destapó una captura, no las pruebas. Ahora lo vigilan dos comprobaciones de humo: que el borde derecho del cálculo caiga dentro del escenario, y que su contenido no quede recortado. El margen es tan estrecho que el tamaño del punto de bifurcación es lo que decide si cabe: por eso mide 10 px y lleva 4 de hueco, y no los 12 y 8 con que empezó.



### 6.8 La reproducción arranca sola (2026-08-30)

**Toda operación con traza —buscar, insertar, eliminar, en cualquier tema— empieza a reproducirse sola.** Antes se quedaba en el primer paso esperando que alguien pidiera el siguiente, y eso estorba: lo normal es querer ver la operación entera, y pedir cada paso a mano convierte en trabajo lo que debería mirarse (pedido del usuario, 2026-08-30).

Los controles no se van: paso anterior, paso siguiente y el botón que alterna entre reproducir y pausar (eran cuatro botones hasta el 2026-09-27, §6.2) siguen ahí y siguen valiendo. **Cualquiera de ellos corta la reproducción en curso**, sin que haya que detenerla primero, porque los pasos pasan por `irAPaso` y `irAPaso` cancela el temporizador antes de moverse (§4, interrumpibilidad). De ahí que la prueba de humo y las capturas, que hacen clic en «paso siguiente» de forma síncrona, sigan controlando la traza igual que antes: el primer clic apaga el automático.

**El paso dura 1,6 s por omisión y el deslizador va de 4 s a 0,2 s** (eran 800 ms y un tope de 2 s). Ahora que la traza corre sola en vez de esperar un clic, el ritmo por omisión es el que se ve casi siempre, y a 800 ms los pasos se atropellaban; el extremo lento tampoco daba para seguir una comparación en voz alta. El ritmo no toca las animaciones, que siguen fijas en 400 ms (§7): lo que se alarga es la pausa para leer el paso, no el movimiento.

**El deslizador crece hacia la derecha y lleva su lectura en segundos al lado** (pedido del usuario, 2026-08-30). Se llama «Velocidad», así que a la derecha tiene que ir más rápido; pero lo que el reproductor consume es el tiempo *entre* pasos, que crece al revés. La conversión es un espejo —`min + max − valor`, en `espejarVelocidad`— y por eso sirve para los dos sentidos con una sola función. Al tocar esto hay que acordarse de que **el valor del `<input type="range">` ya no es milisegundos**: quien lo lea directo pondrá la traza al revés sin que nada más falle. Lo vigila la comprobación `controlDeVelocidad` de la prueba de humo, que mide los dos extremos y el centro.

---

### 6.9 Pantallas y escala (2026-10-04)

**La pantalla de referencia es la del usuario: 1920 × 1080, ventana del navegador ≈ 1920 × 950.** El usuario trabaja en escritorio y no tiene portátil; en clase se proyecta desde el computador del aula, de resolución desconocida. Las menciones a «el portátil 1366 × 640» en secciones anteriores son de repasos hechos con esa suposición: un ajuste pensado solo para ese portátil no tiene que sacrificar nada en la pantalla de referencia.

**No se escala la pantalla de tema automáticamente.** Se evaluó con maquetas (diseñar a 1280 × 600 y ampliar o reducir para llenar la ventana, como el menú) y se descartó:

- Una sola escala para todos los temas favorece a los que dejan lienzo vacío —hash, binaria, árboles— y perjudica a índices: a 1,5× el multinivel secundario muestra dos de sus cuatro columnas y la derivación tapa el resto, cuando en la pantalla de referencia entra entero.
- **El zoom del navegador ya hace ese escalado**, uniforme y sin desalinear nada, porque para la página es simplemente una ventana más chica. Y es mejor que una regla fija porque se elige por tema: `Ctrl` + `+` para que hash o binaria se lean desde el fondo del salón, `Ctrl` + `0` para índices, `Ctrl` + `−` si el proyector resulta pequeño. Las maquetas «con escalado» se fotografiaron justamente así (`--force-device-scale-factor`).
- Escalar dentro de la aplicación habría exigido que las 43 medidas que el código toma del DOM (flechas de índices, pico del cálculo, árbol) supieran de la escala.

Lo que sí protege al aula desconocida es que **las fuentes viajen con la aplicación** (§8.3). Lo que queda por cuidar es que nada se rompa con el zoom del navegador entre el 80 % y el 150 % de la pantalla de referencia: ese es el rango en que se va a usar.

**Revisado el 2026-10-07: nada se rompe entre el 80 % y el 150 %.** Para la página, el zoom es una ventana de otro tamaño —2400 × 1188, 1920 × 950, 1536 × 760 y 1280 × 633—, y así se revisó: las dieciséis vistas fotografiadas a los cuatro tamaños, y la prueba de humo a los cuatro (`humo.js --zoom`, que desde entonces existe para repetirlo). Las tres fallas que dio la prueba eran de la prueba: una fila de n = 24 que ya no desborda a 1920 desde que la fila se elide solo si no cabe (§6.2), dos comparaciones de posiciones del árbol que no dividían por su `zoom` y a 1920 pasaban sin mirar nada, y una de rótulos encimados que medía con el FLIP en vuelo y contaba dos ramas de nodos distintos que se cruzan un instante. Lo que a 150 % queda justo, y es diseño y no defecto:

- ~~**Los árboles de residuos se encogen mucho**~~ (hacia 0,6×): resuelto el 2026-10-08, el sitio del cálculo ya solo se reserva durante la operación (§6.7). Durante ella siguen a ~0,64×.
- **La derivación de índices no cabe a lo alto** y se desplaza por dentro: es el «estrechar y desplazar» de §5.10.
- **La bitácora queda bajo el borde del panel lateral**: lo cubre la narración del paso en el aviso (§6.2), que está siempre a la vista.

## 7. Animación

El profesor evalúa explícitamente que los bloques se muevan. Estas son las animaciones obligatorias:

1. **Inserción** — la clave entra y las claves mayores se desplazan para abrirle lugar. Es la más visible y la que hay que resolver primero.
2. **Eliminación** — la casilla se vacía y las siguientes se desplazan. Va en dos pasos, y por qué está en §5.6.
3. **Paso del algoritmo** — cambio de estado de las casillas involucradas.
4. **Elisión** — expansión y compresión de tramos.
5. **Llenado automático** — inserciones sucesivas, no un salto al estado final.

### Dos capas que no se mezclan

| Capa | Qué anima | Duración | Curva |
|---|---|---|---|
| Interfaz | Paneles, alertas, hover, cambios de pantalla | 140–220 ms fijos | `ease-out` |
| Algoritmo | Paso, elisión, reordenamiento | La que fije el usuario | Lineal o `ease-in-out` suave |

**La capa de algoritmo no lleva rebote, spring ni personalidad.** Si el paso dura exactamente lo configurado, el tiempo se vuelve comparable entre algoritmos — que es justamente lo que la asignatura pide evaluar. Un easing con carácter arruina la comparación.

### Reglas técnicas

- Animar **solo `transform` y `opacity`**, nunca propiedades de layout.
- Para el reordenamiento al insertar, usar la técnica **FLIP**: medir posición antes, aplicar el cambio, medir después, animar el delta con `transform`.
- **Las animaciones son interrumpibles.** Si el usuario avanza pasos en rápida sucesión, se reemplazan; no se encolan. Con la traza esto es trivial: se salta al paso destino.
- Respetar `prefers-reduced-motion`: sustituir la animación por cambio de estado directo.
- Cada casilla necesita una **identidad estable** —clave como llave, no índice— para que el reordenamiento anime el movimiento y no un redibujado.

**En el llenado automático, entre clave y clave tiene que caber la animación entera.** Es la misma regla de arriba —las animaciones se reemplazan, no se encolan— vista desde el otro lado: con un intervalo más corto que la animación, cada clave cancelaba el movimiento de la anterior a media carrera y las claves parecían amontonarse en vez de acomodarse. Era el caso: **150 ms de intervalo contra 400 de animación** (pedido del usuario, 2026-08-30). Ahora el reordenamiento del llenado dura **500 ms** y las claves entran cada **700**; la diferencia es la pausa para leer dónde cayó cada una. Si se toca uno de los dos números, el otro tiene que seguirlo: son `MS_ANIMACION_LLENADO` y `MS_ENTRE_CLAVES` en `tema-busqueda.js`, juntos y comentados por eso. El costo es que llenar es lento a propósito: doce casillas tardan unos 8 s.

Es el único sitio donde el reordenamiento no dura los 400 ms de siempre, y por eso `renderizarEstructura` acepta la duración como dato de quien dibuja en vez de tenerla fija.

### El paso final: así queda la estructura (2026-09-24)

**Toda operación de todo tema termina con un paso más**, siempre, también cuando la clave no está o no entra (pedido del usuario). En ese paso la estructura se ve como queda para la siguiente operación: sin casilla marcada, sin sondeo, sin rango, sin apilado —binaria vuelve a la fila única, «como si todo se hubiera reiniciado» (usuario, 2026-09-27, §6.3)—, y con el panel del cálculo en «Sin operación en curso» —o sin panel, en los temas donde el cálculo señala una casilla (§6.5)—. No lo produce ningún algoritmo: lo agrega la pantalla en `reproducirOperacion` (`pasoFinal`, tipo `final` en `traza.js`), porque no es un paso del algoritmo sino el momento de mirar el resultado.

- **La excepción: una búsqueda que halló la clave la deja marcada**, en verde y con su ✓ (pedido del usuario, 2026-09-24). Al buscar, lo que se quería saber es dónde está, y apagarla la hacía desaparecer justo al terminar. El paso final es entonces un `encontrada` que solo conserva la ubicación —`casilla`, `posicion` en anidados y cubetas, `medio` en binaria— sin rango, descartes ni recorrido, y lleva `final: true` para que ni el aviso, ni la bitácora, ni el apilado de binaria lo tomen por un paso del algoritmo. Insertar y eliminar terminan sin resaltados.
- **Hereda los contadores** del último paso, que son el resultado de la operación, y lo que el tema declare en `config.conservarAlFinal` porque su dibujo sale del paso y no de la estructura: Huffman conserva su árbol, su tabla y su reducción; índices, su derivación entera.
- **Dibuja las mismas casillas que el último paso** (`paso.vistas`): la elisión no cambia, solo se apagan los resaltados. Sin eso una ordenada volvía a sus extremos —«10 ⋯ 22 ⋯ 24»— y la clave recién hallada desaparecía dentro de un tramo. Tampoco desplaza el lienzo: no hay casilla que seguir, así que la vista se queda donde estaba.
- **No escribe en la bitácora ni cambia el aviso**: el aviso sigue con la noticia de la operación, que es lo que explica lo que se ve.
- Quien pruebe «lo que el algoritmo marcó» lo mira **un paso antes**: `hastaElUltimoPasoDelAlgoritmo()` en la prueba de humo, `?paso=ultimo` en `captura.html`.

---

## 8. Sistema visual

### 8.1 Principio

**El color es información, no decoración.** Cada tono está asignado a un estado del algoritmo y no se reutiliza con fines estéticos en ninguna otra parte. En particular, **las alertas no usan los colores de estado del algoritmo**: se diferencian por icono, barra lateral y texto sobre fondo blanco.

**El color nunca es el único canal.** Cada estado lleva refuerzo de forma para funcionar proyectado en videobeam y para usuarios con daltonismo.

### 8.2 Tokens de color

```css
--papel:              #EDF0F3;  /* fondo de la aplicación */
--superficie:         #FFFFFF;  /* paneles, tarjetas, casillas ocupadas */
--superficie-hundida: #E4E8EC;  /* lienzo de la estructura, campos */
--tinta:              #24303B;  /* texto principal, bordes de casilla */
--tinta-suave:        #5C6A77;  /* texto secundario, índices — 4,5:1 sobre el lienzo */
--borde:              #C6D0D8;  /* separadores */
--borde-fuerte:       #748798;  /* contorno de paneles, aristas, tramos — 3:1 sobre el lienzo */
```

**Estados del algoritmo** — cada uno con su refuerzo no cromático:

| Estado | Borde | Relleno | Refuerzo |
|---|---|---|---|
| Vacía | `#728799` | `--superficie-hundida` | Contorno punteado |
| Ocupada | `#24303B` | `#FFFFFF` | — |
| En evaluación | `#B8731C` | `#F7E2BD` | Borde de 2 px |
| Descartada | `#97A3AC` | `#E5E9EC` | Opacidad 0.5 |
| Encontrada | `#1B7A63` | `#CFE9E1` | Glifo de verificación |
| Colisión | `#A8324A` | `#F3D6DC` | Trama diagonal |

**Contraste pensado para proyectar** (revisión de diseño, 2026-10-04). Un proyector aclara los negros y lava los colores, así que lo que hay que *ver* —bordes de casilla, líneas, el naranja de «en evaluación»— llega al menos a **3:1** contra el lienzo, y el texto gris a **4,5:1**. Antes el borde de la vacía estaba en 1,47:1, el naranja en 2,69:1 y el gris de líneas en 1,98:1: en una simulación de proyector las casillas vacías —las que muestran el tamaño de la tabla— desaparecían. Cada valor nuevo es el más claro que conserva el matiz y llega a la meta, así que los colores siguen significando lo mismo. **La descartada queda como estaba** a propósito: apagado es descartado, y que ceda es su función. Si se toca un token, medirlo de nuevo.

**Ya no hay estado «rango activo»** (decisión del usuario sobre maqueta, 2026-09-27). Era el azul del tramo en juego en binaria —con un corchete encima como refuerzo— y el de los renglones en juego dentro del bloque en binaria externa. Al apagar lo descartado en el apilado de binaria y llevar el rastro a secuencial, la pregunta fue si el azul tenía que ir también a secuencial, a las externas y al hashing. El análisis: el azul significa «donde la clave todavía puede estar», y esa región solo existe en la familia de búsquedas por comparación —en hashing la clave está en su dirección o en su secuencia de sondeos, que no es un tramo; en los árboles, en el camino—. Se eligió **quitarlo en vez de extenderlo**: con lo descartado apagado, lo que sigue en juego ya se lee por contraste, y queda una sola regla para toda la aplicación, **apagado es descartado; normal, todavía puede estar**. Los tokens `--estado-rango-*` siguen existiendo porque otros usos no de estado los toman —el foco del teclado y los bloques del índice en índices—.

### 8.3 Escala tipográfica

**Regla: una etiqueta nunca es más pequeña que el contenido que etiqueta.** Se diferencian por peso y color, no por tamaño. Este error ya apareció en las maquetas y no debe repetirse.

| Nivel | Uso | Tamaño | Familia y peso |
|---|---|---|---|
| 1 | Título de pantalla o tema | 20 px | Plex Sans Condensed 600, **mayúsculas**, `tracking .08em` |
| 2 | Rótulo de panel | 13 px | Plex Sans Condensed 600, **mayúsculas**, `tracking .08em`, `--tinta-suave` |
| 3 | Etiqueta de campo o grupo | 13 px | Plex Sans 500, `--tinta` |
| 4 | Contenido, opciones, botones | 13 px | Plex Sans 400, `--tinta` |
| 5 | Texto auxiliar y ayuda | 12 px | Plex Sans 400, `--tinta-suave` |
| — | Claves, índices, métricas | según contexto | JetBrains Mono, **cifras tabulares obligatorias** |

**Las tipografías viajan con la aplicación, en `fuentes/`** (2026-10-04). Hasta entonces la carpeta no existía: `tokens.css` declaraba los `.woff2` pero nadie los había copiado, y cada computador dibujaba con lo que tuviera instalado —Liberation Sans en uno, Arial o Segoe UI y las claves en Courier New en un Windows—. Cada letra tiene otro ancho, así que lo que cabía en una pantalla podía no caber en otra del mismo tamaño, y el computador del aula, desde el que se proyecta, es justo el que no se puede probar de antemano. Son IBM Plex Sans (400, 500), Plex Sans Condensed (400, 600) y JetBrains Mono (400, la versión completa y no el subconjunto «latin», que no trae `⌈ ⌉ ⌊ ⌋ → ⋯ ◂`), todas con licencia SIL OFL 1.1 (los `OFL-*.txt` van al lado). Cargan desde `file://` en Chromium.

**La aplicación arranca con las fuentes cargadas** (`cargarFuentes` en `app.js`): el ancho de casilla se mide una sola vez y se guarda (`casilla.anchoParaCifras`), y medido con la fuente de respaldo quedaría mal toda la sesión. Si una fuente falla, al segundo arranca igual. Las páginas de prueba esperan `CC2.listo` en vez de `DOMContentLoaded`.

Las cifras tabulares no son opcionales: los dígitos deben alinearse en columna al comparar claves.

**Mayúsculas de verdad y no versalitas en los niveles 1 y 2** (pedido del usuario, 2026-09-11). Las versalitas solo se ven bien cuando la fuente las trae dibujadas, y mientras falten los `.woff2` de Plex Sans Condensed el navegador las falsea encogiendo las mayúsculas: el rótulo salía con la inicial grande y el resto en otra proporción —«Cᴏɴғɪɢᴜʀᴀᴄɪóɴ ᴅᴇ ʟᴀ ᴇsᴛʀᴜᴄᴛᴜʀᴀ»— y las tildes de MÉTRICAS y BITÁCORA quedaban despegadas. Se leía como otra tipografía dentro de la misma pantalla, que es justo lo que esta escala existe para evitar.

**Las métricas van en cuadrícula de dos columnas**, no en fila: son entre dos y cuatro según el tema, y en fila la cuarta se salía del panel y quedaba cortada contra el borde.

### 8.4 Elevación, radios y espaciado

```css
--elev-0: solo borde 1px;                        /* embebido en un panel */
--elev-1: 0 1px 2px rgba(36,48,59,.08) + borde;  /* paneles y tarjetas */
--elev-2: 0 3px 10px rgba(36,48,59,.12) + borde; /* diálogos */
```

Radios: 3 px casillas · 6 px controles · 10 px paneles.
Espaciado: escala 4 · 8 · 12 · 16 · 24 · 32 · 40. No usar valores fuera de ella.

Sombras cortas y definidas, nunca difusas. Sin gradientes ni glassmorphism. Tema claro obligatorio: se proyecta en salón iluminado y debe coincidir con el PDF exportado.

---

## 9. Voz de la interfaz

- Los mensajes describen el estado del sistema; no se disculpan ni interpelan al usuario.

**«Vaciar» y no «reiniciar»** (2026-09-11). El botón deja la misma estructura sin claves —mismo `n`, misma `l`, mismos parámetros— y eso es vaciarla. Se llamaba «Reiniciar estructura», que sonaba a empezar de cero: tanto, que el usuario llegó a pedir un segundo botón para lo que este ya hacía. **El nombre era el problema, no el comportamiento**, y añadir el botón habría dejado dos que hacen lo mismo. Para crear una estructura distinta no hace falta ningún botón: se cambian los parámetros y se pulsa «Crear estructura», que reemplaza la que haya.

En cubetas, vaciar además devuelve `n` al valor con que se creó y no al que alcanzó expandiéndose (§5.7). Es el único tema donde pasa, y lo dice su mensaje de bitácora en vez de cambiarle el nombre al botón: una palabra distinta por tema confunde más de lo que aclara.

**Vaciar pide un segundo clic** (pedido del usuario, 2026-09-11). Con quince claves puestas a mano, un clic por error duele. No hay diálogo —el proyecto no usa ninguno— sino que **el propio botón pregunta**: cambia su texto a «¿Vaciar estructura?» y espera cuatro segundos; si no se confirma, vuelve solo a lo que decía. El realce es el borde de evaluación, sin color nuevo (§8.1).
- Los botones nombran la acción: *Insertar*, no *Aceptar*. Nunca un verbo genérico.
- **El botón nombra el verbo; el objeto lo pone el campo si ya está a la vista.** En el panel de operaciones los tres botones dicen *Insertar*, *Buscar* y *Eliminar* a secas, porque el campo que tienen encima ya dice *Clave*: repetir la palabra tres veces en una fila no cabe y no agrega nada. Un botón suelto, sin campo que lo acompañe, sí nombra el objeto completo.
- Una acción conserva el mismo nombre en todo el flujo: si el botón dice *Insertar*, la bitácora registra *Clave insertada*.
- Vocabulario técnico riguroso, nunca coloquial.
- Sentencia capital, nunca Mayúscula En Cada Palabra.

### Catálogo de mensajes

| Situación | Mensaje |
|---|---|
| Estructura llena | *Estructura saturada: capacidad máxima de n casillas alcanzada.* |
| Clave repetida | *Clave duplicada: la clave ya reside en la posición i.* |
| Longitud incorrecta | *Longitud de clave inválida: se esperan l dígitos.* |
| Carácter no permitido | *Carácter no admitido en el alfabeto definido (A–Z).* |
| Búsqueda sin resultado | *Clave no localizada en la estructura tras k comparaciones.* |
| Clave eliminada (ordenada) | *Casilla i liberada: las k claves siguientes se desplazan una posición.* |
| Clave levantada para redispersar | *Se retira la clave c de la casilla i: colisionó en su momento y hay que volver a dispersarla.* |
| Colisión | *Colisión en la dirección d: se aplica tratamiento por [método].* |
| Colisión sin tratamiento | *Colisión en la dirección d: la casilla ya contiene la clave c.* — sin tratamiento no hay nada que aplicar, y decirlo dejaba la frase «se aplica tratamiento por ninguno» |
| Estructura vacía | *Estructura no inicializada: no existen claves para procesar.* |
| `n` imposible | *Tamaño inviable: para l = 2 solo existen 90 claves distintas.* |
| Archivo incompatible | *Archivo no compatible con el tema activo.* |

---

## 10. Persistencia

### Modelo del archivo `.cc2` (JSON)

```json
{
  "version": 1,
  "nombre": "Práctica de hash",
  "tema": "hash-modulo",
  "tipoClave": "numerica",
  "n": 30,
  "l": 4,
  "claves": [1024, 2048, 4096],
  "funcionHash": "modulo",
  "metodoColisiones": "reasignacion",
  "creadaEn": "2026-08-06T13:24:48Z"
}
```

### Qué devuelve el archivo al cargarse (2026-09-11)

**El archivo devuelve la estructura con sus claves, lista para operar: `n`, `l` y las claves, esté completa o no** (confirmado con el docente, traído por el usuario). No devuelve una sesión ni un estado de reproducción: ni bitácora, ni paso en curso, ni operación a medias.

**Lo que se guarda son las claves en su orden de llegada, no la tabla.** En los temas de transformación de claves ese orden *es* lo que decide dónde cae cada una —dos órdenes distintos del mismo conjunto dan tablas distintas en cuanto hay colisiones—, así que la tabla se rehace al cargar reinsertando en ese orden. Es exactamente lo que ya hace cubetas al expandir (§5.7) y lo que hace Huffman con su palabra (§5.9): **el dato es la entrada; la colocación es su consecuencia.** Guardar la colocación sería guardar dos veces lo mismo, y mal, porque solo significa algo dentro de las reglas del tema que la produjo.

### Guardar — dos niveles con degradación

1. **Siempre disponible:** generar el archivo y dispararlo como descarga (`<a download>` sobre un Blob), con un nombre propuesto por la aplicación.
2. **Donde el navegador lo soporte:** File System Access API para un diálogo real de "Guardar como", con elección de carpeta y regrabado sobre el mismo archivo.

**Medido en el navegador, no supuesto** (2026-09-11), abriendo la aplicación como se abre de verdad —`file://`—:

| | desde `file://` |
|---|---|
| `isSecureContext` | **sí** (no es un problema de seguridad) |
| `showSaveFilePicker` / `showOpenFilePicker` | **no existen** |
| `<a download>` + `URL.createObjectURL` | sí |
| `<input type="file">` + `FileReader` | sí |

O sea: **el nivel 2 no está disponible desde `file://`** —Chromium no expone esos selectores a una página abierta como archivo— y en la práctica el nivel 1 es el que se usa siempre. El nivel 2 entra solo si alguien abre la aplicación servida por `http://localhost`, y se detecta con `'showSaveFilePicker' in window`; no hay que elegir de antemano.

**Elegir carpeta y nombre sin servidor no es problema del programa, es un ajuste del navegador.** Con «Preguntar dónde guardar cada archivo» activado (Chrome/Edge → Descargas), cada descarga abre el explorador de Windows y deja elegir las dos cosas. Conviene decirlo en la interfaz al guardar, en vez de perseguirlo con código.

**Abrir sí funciona nativo desde `file://`**: `<input type="file">` abre el explorador de Windows y `FileReader` lee el JSON. No hace falta nada más.

**Servir por `http://localhost` no es montar un servicio**, es publicar la carpeta, y hay varias formas según lo que haya instalado en la máquina: el servidor integrado de WebStorm (`http://localhost:63342/…`), `python3 -m http.server`, `npx serve`, o la extensión Live Server de VS Code. Lo que se gana es el diálogo real y el regrabado sobre el mismo archivo; lo que se pierde es abrir la aplicación con doble clic, que es la decisión de §4. **La aplicación tiene que seguir funcionando entera sin ninguna de esas cosas.**

### Cómo quedó construido (2026-09-11)

`persistencia/archivo.js` guarda, valida y lee; la pantalla pone los dos botones y el camino de vuelta.

**Las tres acciones sobre la estructura van juntas y a la derecha del encabezado**: `Cargar`, `Guardar` y `Vaciar` (decisión del usuario sobre maqueta, 2026-09-11). Sueltas junto al título parecían parte de él y quedaban flotando donde no hay nada más; agrupadas se leen como lo que son —lo que se puede hacer con la estructura entera— y no le quitan un píxel al panel lateral ni al lienzo, que son los que van justos (§6.2). **Guardar aparece con la estructura**, porque sin ella no hay nada que guardar; Cargar está desde que se entra. **Vaciar, igual.** Hasta el 2026-09-30 los dos se veían desde que se entraba a cualquier tema con configuración: el atributo `hidden` lo ganaba el `display` de `.boton` (ver `.boton[hidden]`). **En los temas que crean su estructura solos al entrar** (los árboles), Guardar y Vaciar aparecen con la primera clave o la primera operación —en Huffman, la palabra— y no antes: la estructura existe, pero para el estudiante ahí todavía no hay árbol (`sincronizarAccionesDeEstructura`, pedido del usuario, 2026-09-30).

**Se llama «Cargar» y no «Abrir»** (pedido del usuario): lo que se trae es una estructura, no un documento.

**El `<input type="file">` está oculto** y lo dispara el botón: abrir el explorador del sistema es lo único que sabe hacer, y su aspecto por omisión no se parece a nada de esta pantalla. Se limpia su valor en cada `change`, o elegir dos veces seguidas el mismo archivo no haría nada la segunda.

**Abrir rehace la estructura y reinserta las claves sin traza**, por la misma razón que el llenado automático (§6.5): abrir un archivo es preparar el escenario, no la lección. Reutiliza `colocarSinTraza`, que es la misma pieza que usa el llenado — y que aplica **todos** los efectos de la traza, no solo el de colocar, porque en cubetas una sola inserción puede traer una expansión entera.

**El panel de configuración refleja lo que se abre.** Si siguiera mostrando los valores anteriores diría una cosa mientras el lienzo dibuja otra, y bastaría pulsar «Crear estructura» para tirar sin querer lo recién abierto.

**El orden de llegada lo lleva ahora el dominio**, no la pantalla: `anotarLlegada`/`olvidarLlegada` en `estructura.js`, invocadas desde insertar, eliminar, colocar y retirar —y desde `arbol.js` para los árboles—. Lo estrenó cubetas para rehacer su tabla al expandir (§5.7) y hacía falta para esto; tenerlo en un solo sitio evita que cada tema lleve su propia cuenta.

**Lo que se prueba y dónde**: serializar, validar y el nombre sugerido son cálculo puro y viven en `archivo.test.js` —incluida la prueba que justifica todo el diseño: en una tabla con colisiones, dos órdenes distintos del mismo conjunto dan tablas distintas—. El cableado de los botones va en la prueba de humo. **Abrir un archivo de verdad es asíncrono y no cabe en el humo, que es síncrono**: se comprueba con la captura `vista=abrir-archivo`, que arma un `.cc2` en memoria, se lo entrega al selector con un `DataTransfer` y fotografía la estructura ya cargada.

### Nombre de la estructura — retirado hasta que exista el guardado (2026-08-29)

El diseño original le daba a la estructura un **nombre propio dentro de la aplicación**, editable en el panel de configuración, que servía como nombre por defecto del archivo `.cc2`.

**El campo se retiró de la interfaz** (decisión del usuario): su única razón de ser es el guardado, que quedó para el final del proyecto, y mientras tanto obligaba a escribir un dato en cada estructura que se crea sin que ese dato sirviera para nada. **Vuelve cuando vuelva el guardado**, no antes.

Consecuencia: **una estructura reciente se identifica por su tema y por los datos con que se creó** —«Función módulo · n = 12 · l = 4»— que es lo que el estudiante recuerda de ella. Las entradas viejas que sí traían nombre se siguen leyendo: `persistencia/recientes.js` las normaliza al formato nuevo.

### Estructuras recientes

**Van en una tira bajo la barra del menú** (2026-09-27): cada una es una pastilla con su tema y los datos con que se creó —la fecha, en el `title`—, y si no caben todas se desvanece el borde derecho, como en el lienzo. Hasta entonces eran un panel de 320 px a la derecha que se quedaba con el ancho del catálogo; en un portátil las descripciones del índice acababan en columnas de una palabra. Sin recientes no hay tira.

**No se pueden abrir**: guardan el nombre del tema y un resumen, no la estructura. Son un recordatorio. Hacerlas útiles —abrir el tema con la misma estructura— exigiría guardar también las claves, un autoguardado local del `.cc2`; queda como idea, no decidida.

`captura.html` las siembra con `?recientes=5` (y las borra con `?recientes=0`): el navegador sin interfaz no tiene ninguna guardada, y sin eso las capturas del menú salían siempre sin la tira, que es como casi nunca se ve de verdad.

Hasta 5, en almacenamiento del navegador. **No son la copia real**: si el estudiante borra datos de navegación, desaparecen. La interfaz debe dejar claro que el archivo `.cc2` es la copia real.

### Al cargar

Validar integridad antes de tocar nada: si el archivo no cuadra, la estructura que está en pantalla se queda como está.

**Qué es «no cuadra»** (2026-10-02). `validar` exige que cada clave sea un número o una letra —no un objeto ni una lista— y que `l`, si viene, sea un entero positivo. **No compara la cantidad de claves contra `n`**: `n` es cuántas casillas tiene la tabla, no cuántas claves caben —con cubetas caben `n × r`, con arreglos anidados `n × n`, con encadenamiento no hay tope—, y esa comparación dejaba sin poder abrir, ni en su propio tema, una tabla de cubetas expandida o una encadenada. Si caben lo decide el tema que abre, al colocarlas, y lo avisa.

**Cada clave del archivo pasa por el mismo validador que una digitada** (`validarClaveDigitada`, con la `l` de la estructura que se va a crear), antes de crearla: una clave guardada no vale más que una escrita a mano, y sin esto un archivo editado —o uno de cubetas, que no tiene `l`— colaba claves de otra longitud que rompían el orden de la binaria (§3.2). Si ninguna vale, no se abre; si valen algunas, se abre con ellas y el aviso separa las que no valían de las que no cupieron o estaban repetidas. Un archivo sin `l` abierto en un tema que la pide la toma de la configuración en pantalla, como los parámetros de un archivo ajeno.

**Los parámetros del propio tema también se validan** (2026-10-03). Un archivo abierto en su tema trae sus parámetros, y se respetan —pero pasando por los mismos validadores del formulario—: con `r: 0`, una base fuera de rango o un tipo de índice inventado, no se abre. Los validadores leen texto, así que `archivo.parametrosComoTexto` reescribe cada parámetro declarado como se digita; el que no se guarda igual que se digita declara su inversa en `comoTexto` (los umbrales de cubetas: fracción guardada, porcentaje digitado, `dominio.cubetas.umbralComoTexto`). La misma conversión llena el formulario al abrir, que antes mostraba `0.82` en un campo de porcentaje. El tratamiento de colisiones tiene que ser uno de los que ofrece el tema.

**En su propio tema, cubetas conserva su `n` de partida** (`archivo.nInicial`, que lee `parametros.n0`): la tabla se rehace con el `n` que alcanzó —reinsertar en orden de llegada sobre ese `n` da la misma tabla—, pero reducir y vaciar vuelven al de partida, no al expandido.

**Un archivo se abre también en otro tema** (pedido del usuario, 2026-09-11). Era el objetivo desde el principio —«poder usar una estructura creada en secuencial en binaria»— y la primera versión lo impedía, porque exigía que el archivo fuera del tema activo. Lo que decide si se puede no es el nombre del tema sino **qué clase de claves guarda**:

| | Qué pasa | Aviso |
|---|---|---|
| **Sale igual** | El archivo viene de una estructura ordenada y el destino también: secuencial, binaria y secuencial externa colocan las claves exactamente igual | «listas para operar» |
| **Se recoloca** | Mismo tipo de clave, otra regla de colocación: de secuencial a una función hash, entre dos funciones hash, a cubetas | «recolocadas con las reglas de este tema» |
| **No se abre** | Distinto tipo de clave: números a un tema de letras, o al revés | «El archivo guarda claves de números y este tema trabaja con letras» |

Avisar de la recolocación no es un detalle: las claves son las mismas pero su sitio no, y sin decirlo parecería que el archivo se abrió mal. Es además lo interesante del asunto —las mismas doce claves por módulo y por plegamiento—, y conviene que se lea como una posibilidad y no como un fallo.

**Del archivo salen las claves; los parámetros propios dependen de quién lo abra.** Si es su propio tema, el archivo los trae y se respetan. Si viene de otro, no significan nada aquí —un archivo de secuencial no sabe de `r` ni de umbrales— y se toman de lo que haya configurado en pantalla, validado igual que al crear; si falta algo, se dice cuál y no se abre. Y en los temas que no piden tamaño —los árboles— se ignoran el `n` y el `l` del archivo y se usan los suyos.

**El archivo guarda también el `modo`**, que es lo que permite distinguir «sale igual» de «se recoloca». Uno guardado antes de que esto existiera no lo trae: entonces se avisa de recolocación, que es lo honesto cuando no se puede saber, y se arregla solo en cuanto se vuelve a guardar.

### Bitácora

**No se persiste.** Al recuperar una estructura, la bitácora inicia vacía y registra solo la sesión en curso.

**La hora se escribe solo cuando cambia, y en 24 horas** (2026-09-11). Una traza entera cae dentro del mismo segundo, así que la hora se repetía quince renglones seguidos en la columna más estrecha de la pantalla, y `12:54:31 p. m.` es además el formato más largo posible. Con el cambio, la hora marca *cuándo empezó lo que viene debajo*, que es lo que de verdad aporta.

**El hueco de la hora se conserva aunque el texto no esté**, para que los mensajes sigan alineados: su columna mide `8ch` de la monoespaciada —lo que mide `HH:MM:SS`— y no `max-content`. Cada fila es su propia cuadrícula, así que con `max-content` el renglón cuya hora se omite daba una columna de ancho cero y su mensaje se corría a la izquierda, desalineado de los demás. La hora omitida sí viaja en `aria-label`: la repetición estorba a la vista, que abarca varios renglones de un golpe, no al oído.

---

## 11. Exportación a PDF

`window.print()` con hoja de estilos de impresión. Sin librerías.

El documento incluye: encabezado con datos de la asignatura, configuración de la estructura, estado final, bitácora cronológica y resumen de métricas.

**En el PDF la estructura se dibuja completa, sin elisión**, repartida en varias filas si hace falta. La elisión es un recurso de pantalla, no de documento.

---

## 12. Alcance

### Fase 1 — implementar

Búsqueda secuencial · binaria · funciones hash (módulo, cuadrado, truncamiento, plegamiento, conversión de bases) **solo en decimal**, ya que lo binario quedó descartado (§5.3) · tratamiento de colisiones (reasignación lineal, cuadrática y por doble función hash, arreglos anidados, encadenamiento secuencial) · otras búsquedas internas (residuos, árboles de búsqueda digital, residuos múltiples).

**Orden de construcción confirmado: primero búsqueda secuencial, luego binaria.** Secuencial es el tema anterior a binaria en el orden de la asignatura, y sirve como la primera plantilla end-to-end (dominio → traza → elisión → animación → bitácora); binaria reutiliza ese mismo patrón, no al revés.

**Estado de construcción:** secuencial, binaria y **las cinco funciones hash** implementadas y disponibles en el menú. Todas entran por la misma pantalla parametrizada, `vista/pantallas/tema-busqueda.js`, y todas **insertan, buscan y eliminan** (§5.6), cada una con su algoritmo.

La función módulo dejó lista la maquinaria de transformación de claves —modo disperso (§3.2), cálculo reproducible (§6.5), tratamiento de colisiones al crear (§5.4)— y las otras cuatro entraron **declarando su `direccionDe` y una entrada en `TEMAS`**, sin tocar la pantalla. La única pieza que hubo que agregar fue `config.parametros`, para los dos temas que necesitan un dato del estudiante (las posiciones del truncamiento, la base de la conversión). Si en adelante una función obliga a cambiar la pantalla, es señal de que el contrato de `{ direccion, calculo }` se quedó corto.

**«Árboles de búsqueda por residuo» está completa, con sus cuatro temas: árbol de búsqueda digital, árbol de búsqueda por residuos (trie), árbol de búsqueda por residuos múltiples y árbol de Huffman** (§5.5 y §5.9). El digital estrenó las claves alfabéticas, el modo `arbol` y el dibujo por niveles; residuos entró encima aportando una sola regla —las claves solo en las hojas—; y residuos múltiples entró sobre residuos cambiando solo la forma del árbol, que dejó de estar cableada en la pantalla y ahora viaja en `config.arbol`. Los tres comparten la letra y su código de cinco bits. **Rejilla y árboles 2D salieron del temario** (decisión del usuario, 2026-09-06), y **tablas de índices** también, más abajo.

**Los seis tratamientos de colisión están construidos: `ninguno`, `reasignación` (prueba lineal, cuadrática y doble función hash — las dos últimas desde el 2026-09-23), `arreglos anidados` y `encadenamiento secuencial` (§5.4).** Los anidados trajeron el modelo de estructuras secundarias por dirección —`estructura.anidados`, con sus tres operaciones en el dominio— y el encadenamiento entró sobre él: comparte almacenamiento, aplicadores y rama de eliminación, y lo único propio suyo es que su estructura secundaria no tiene tope.

Pendientes conocidos, no bloqueantes: faltan los `.woff2` en `fuentes/` (cae al stack de respaldo), y ni `css/impresion.css` ni `persistencia/archivo.js` (.cc2) están construidos.

**Otras búsquedas dinámicas (cubetas) está construido** (§5.7), el primer tema de Búsquedas externas. Es la única estructura del catálogo donde `n` cambia con el tiempo, y la única razón por la que `tema-busqueda.js` tuvo que tocarse fuera de un tema nuevo declarando su config: `sincronizarEfectos`/`reproducirOperacion` ahora también preservan `n` y el orden de llegada de las claves, y `reiniciarEstructura` vuelve al `n` con que se creó y no al que alcanzó por expansión.

### Diferido dentro de Fase 1

- **El guardado en archivo `.cc2` va al final del proyecto** (decisión del usuario, 2026-08-29), y con él el **nombre de la estructura**, que solo existía para nombrar ese archivo (§10.3). Primero los temas, que son lo que se evalúa.
- Claves alfabéticas: **habilitadas en los temas de búsqueda por bits**, donde la clave *es* una letra (§5.5). En los demás temas siguen diferidas: se mantienen en el modelo y en la interfaz, deshabilitadas.
- Llenado automático con palabras: requiere diccionario en español. El llenado numérico sí se implementa.

### Fase 2 — solo visible en el menú, sin implementar

La categoría de grafos completa (las búsquedas externas ya están todas construidas: §5.7, §5.8, §5.10 y §5.11). Se muestran en el catálogo del menú, marcadas "En desarrollo", y responden al clic con un aviso de "en construcción" en vez de quedar mudas. Su presencia comunica el alcance del curso.

**Búsqueda secuencial externa está construida** (§5.8, 2026-09-11): el docente confirmó la forma del archivo —`B = √N` truncado, `r = N/√N` redondeado al más cercano, un bloque más si no alcanza, y el último con el sobrante— y que el llenado es ordenado. Queda una sola duda abierta, que solo afecta al contador: si recorrer el bloque que contiene la clave suma **otro** acceso o si ya estaba contado por la comparación contra su último registro.

**Tablas de índices salió del temario y del menú** (decisión del usuario, 2026-09-17). Se deja escrito aquí porque el catálogo ya no lo dice y conviene no volver a proponerlo:

- Entró al catálogo el **2026-09-06**, apuntado como «el docente la está viendo en clase». Se lo situó primero entre los árboles de búsqueda por residuo y después, al ver que no era de esa familia, junto a las búsquedas externas.
- **Nunca llegó a verse en clase, y el usuario no espera que se vea.** En once días no apareció ni un enunciado, ni un ejercicio, ni una regla que implementar, mientras el tema vecino —índices primarios, secundarios y multinivel (§5.10)— sí llegó con la hoja del docente y quedó construido.
- **Nunca tuvo código**: era una entrada del catálogo con `tema: null` y `disponible: false`, así que quitarla no deja nada huérfano. Si el docente lo retoma, vuelve con una línea en `CATALOGO` y lo que se aprenda de él.

**Binaria externa está construida** (§5.11, 2026-09-27). **Hashing externo sigue sin algoritmo confirmado**: la forma del archivo probablemente le sirva igual, pero su recorrido no se le ha preguntado al docente. No construirlo por iniciativa propia mientras esa duda siga abierta.

---

## 13. Accesibilidad

- Contraste AA en todo texto, incluido el atenuado.
- Foco de teclado visible en cada elemento navegable.
- El color nunca es el único canal.
- Respetar `prefers-reduced-motion`.

---

## 14. Errores a no cometer

- Ejecutar el algoritmo mientras se dibuja, en vez de producir una traza.
- Usar el índice del arreglo como identidad de la casilla: rompe la animación de reordenamiento.
- Animar propiedades de layout en vez de `transform` y `opacity`.
- Encolar animaciones en vez de reemplazarlas.
- Esparcir conversiones `+1` por el código en vez de centralizar la indexación base 1.
- Reutilizar colores de estado del algoritmo para alertas, botones o acentos decorativos.
- Poner una etiqueta más pequeña que el contenido que etiqueta.
- Dibujar las `n` casillas sin aplicar elisión.
- Permitir claves duplicadas en cualquier ruta de entrada, incluido el llenado automático y la carga de archivo.
- Contar las claves de una estructura dispersa con `claves.length`: siempre vale `n`, así que la estructura se declara llena desde el primer momento. Es `dominio.estructura.cantidadClaves` (§3.2).
- Mutar la estructura desde el algoritmo de inserción. La traza no toca nada; el efecto lo aplica la pantalla, y retroceder tiene que deshacerlo (§6.5).
- Elidir casillas ocupadas en una estructura dispersa: esconden el resultado de la función hash (§6.2).
- Contar en decimal las cifras a truncar en conversión de bases: con base 2 y `n = 12` se tomarían 2 bits, y ocho casillas quedarían inalcanzables (§5.3).
- Elevar la clave al cuadrado con aritmética normal: por encima del entero seguro las cifras centrales dejan de ser las del cuadrado (§5.3).
- Dejar que la casilla se dimensione por lo que lleva dentro —`min-width` con relleno, o pistas `auto` en el grid de la fila—: la estructura se deforma clave a clave y la matriz de arreglos anidados pierde la alineación de sus columnas (§6.6).
