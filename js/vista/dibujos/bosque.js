(function () {
  const vista = window.CC2.vista;

  // El árbol de Huffman (CLAUDE.md 5.9): el bosque que se va uniendo paso a
  // paso y, al terminar, la tabla de codificación.
  //
  // Vivía dentro de `crearPantallaTema` (pantallas/tema-busqueda.js) y se
  // sacó tal cual (2026-10-03): la pantalla lo crea al armarse y le pasa lo
  // que comparte con él —el `estado` de la pantalla, sus nodos en `dom`, la
  // `config` del tema—, que son objetos y no copias: lo que la pantalla
  // cambie en ellos, el dibujo lo ve.
  function crearDibujoBosque({ dom, config, arbol }) {
    const { DIAMETRO_NODO, DURACION_APARICION_MS, SEPARACION_HERMANOS, SEPARACION_NIVEL, seguirAristas } = arbol;

    // Árbol de Huffman (CLAUDE.md 5.x): quinta orientación de la pantalla. No
    // es un árbol —todavía—, sino **un bosque que se va uniendo**: la lista de
    // nodos tal como está en cada paso, las letras sueltas y los arbolitos ya
    // formados, cada uno con su peso debajo y en el orden en que se van a
    // reducir. La última unión deja un solo árbol, que es el árbol final: no
    // hay que redibujar nada al terminar, y eso es justo lo que el tema enseña
    // (decisión del usuario sobre maqueta, 2026-09-11).
    //
    // A diferencia de los otros árboles, aquí los nodos **no** salen de
    // `estructura.claves`: el bosque de cada paso viaja en el propio paso
    // (`paso.bosque`), porque se deduce entero de la construcción. Retroceder
    // es volver a dibujar, sin efectos que deshacer.

    const DIAMETRO_PESO = 36;

    function esBosque() {
      return config.orientacion === 'bosque';
    }

    const esHojaDeHuffman = (nodo) => nodo.letra !== undefined;

    // Reparto de un árbol de Huffman: cada hoja ocupa una columna y cada nodo
    // interno se centra entre sus dos hijos. No vale el reparto de los otros
    // árboles, que deriva la columna de la posición en el arreglo implícito:
    // aquí la forma la decidió la frecuencia y no hay arreglo del que leerla.
    function disponerHuffman(raiz, anchoNodo) {
      const puestos = [];
      let x = 0;
      let profundidad = 0;

      (function bajar(nodo, nivel) {
        profundidad = Math.max(profundidad, nivel);
        if (esHojaDeHuffman(nodo)) {
          const centro = x + anchoNodo / 2;
          x += anchoNodo;
          puestos.push({ nodo, centro, nivel });
          return centro;
        }
        const izquierda = bajar(nodo.izquierda, nivel + 1);
        const derecha = bajar(nodo.derecha, nivel + 1);
        const centro = (izquierda + derecha) / 2;
        puestos.push({ nodo, centro, nivel });
        return centro;
      })(raiz, 0);

      return {
        puestos,
        ancho: Math.max(x, anchoNodo),
        alto: profundidad * SEPARACION_NIVEL + DIAMETRO_NODO
      };
    }

    // El peso de un nodo interno va **dentro** del nodo, y por eso aquí no
    // vale el punto de bifurcación de residuos (CLAUDE.md 6.7): allí el nodo
    // interno no puede guardar nada y dibujarlo como caja sería mentir; aquí
    // el nodo interno *es* una suma, y el peso es lo que el método va
    // calculando. Un círculo con la fracción dentro dice las dos cosas: que no
    // es una clave, y cuánto pesa.
    function crearNodoDePeso(nodo, total, marcado) {
      const el = document.createElement('div');
      el.className = 'nodo-peso' + (marcado ? ' nodo-peso--en-curso' : '');
      el.textContent = `${nodo.peso}/${total}`;
      return el;
    }

    function crearHojaDeHuffman(nodo, marcado) {
      return vista.componentes.casilla.crearCasilla({
        clave: nodo.letra,
        indice: nodo.letra,
        estado: marcado ? 'en-evaluacion' : 'ocupada',
        modificadores: []
      });
    }

    // Como `crearAristas` en los otros árboles: las crea sin colocarlas y
    // devuelve `trazar`, que las coloca a partir de dónde está cada nodo, para
    // que puedan seguirlos mientras viajan (ver `seguirAristas`).
    function crearAristasHuffman(puestos, ancho, alto) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'arbol__aristas');
      svg.setAttribute('width', ancho);
      svg.setAttribute('height', alto);
      svg.setAttribute('aria-hidden', 'true');

      const aristas = [];
      for (const { nodo } of puestos) {
        if (esHojaDeHuffman(nodo)) continue;
        for (const [hijo, bit] of [[nodo.izquierda, '0'], [nodo.derecha, '1']]) {
          const linea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          linea.setAttribute('class', 'arbol__arista');
          svg.appendChild(linea);

          const rotulo = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          rotulo.setAttribute('class', 'arbol__bit');
          rotulo.textContent = bit;
          svg.appendChild(rotulo);
          aristas.push({ padre: nodo, hijo, linea, rotulo });
        }
      }

      function trazar(centroDe) {
        for (const { padre, hijo, linea, rotulo } of aristas) {
          const desde = centroDe(padre);
          const hasta = centroDe(hijo);
          linea.setAttribute('x1', desde.x);
          linea.setAttribute('y1', desde.pie);
          linea.setAttribute('x2', hasta.x);
          linea.setAttribute('y2', hasta.arriba);
          rotulo.setAttribute('x', desde.x + (hasta.x - desde.x) * 0.45 + (hasta.x < desde.x ? -8 : 8));
          rotulo.setAttribute('y', desde.pie + (hasta.arriba - desde.pie) * 0.45);
        }
      }
      return { svg, aristas, trazar };
    }

    // La identidad de un nodo para el FLIP: la letra en una hoja, y en un nodo
    // interno las letras que cuelgan de él —cada letra está en un solo
    // subárbol, así que no se repite—. Sin ella solo viajaban las letras: los
    // círculos de peso y las aristas saltaban a su sitio mientras las letras
    // iban de camino, y la unión se veía como un salto (visto por el usuario,
    // 2026-09-30).
    const letrasDe = (nodo) => (esHojaDeHuffman(nodo)
      ? nodo.letra
      : letrasDe(nodo.izquierda) + letrasDe(nodo.derecha));

    // Un árbol del bosque, con su peso debajo: el peso del nodo raíz es lo que
    // ordena la lista, así que se lee al pie de cada uno sin tener que buscarlo
    // dentro del dibujo.
    function crearArbolDelBosque(raiz, total, marcados) {
      // Mismo ancho de nodo que en los demás árboles: el nodo es redondo y
      // mide de ancho lo que de alto.
      const anchoNodo = DIAMETRO_NODO + SEPARACION_HERMANOS;
      const { puestos, ancho, alto } = disponerHuffman(raiz, anchoNodo);

      const caja = document.createElement('div');
      caja.className = 'bosque__arbol' + (marcados.includes(raiz) ? ' bosque__arbol--en-curso' : '');

      const lienzoArbol = document.createElement('div');
      lienzoArbol.className = 'arbol';
      lienzoArbol.style.width = `${ancho}px`;
      lienzoArbol.style.height = `${alto}px`;
      const aristas = crearAristasHuffman(puestos, ancho, alto);
      const sitioDe = new Map(puestos.map((p) => [p.nodo, p]));
      const centroFinal = (nodo) => {
        const { centro, nivel } = sitioDe.get(nodo);
        const arriba = nivel * SEPARACION_NIVEL;
        return { x: centro, arriba, pie: arriba + (esHojaDeHuffman(nodo) ? DIAMETRO_NODO : DIAMETRO_PESO) };
      };
      aristas.trazar(centroFinal);
      lienzoArbol.appendChild(aristas.svg);

      const nodos = new Map();
      for (const { nodo, centro, nivel } of puestos) {
        const marcado = marcados.includes(nodo);
        const el = esHojaDeHuffman(nodo)
          ? crearHojaDeHuffman(nodo, marcado)
          : crearNodoDePeso(nodo, total, marcado);
        el.dataset.clave = esHojaDeHuffman(nodo) ? nodo.letra : `peso-${letrasDe(nodo)}`;
        const anchoEl = esHojaDeHuffman(nodo) ? DIAMETRO_NODO : DIAMETRO_PESO;
        el.style.position = 'absolute';
        el.style.left = `${centro - anchoEl / 2}px`;
        el.style.top = `${nivel * SEPARACION_NIVEL}px`;
        lienzoArbol.appendChild(el);
        nodos.set(nodo, el);
      }

      // El peso solo se escribe al pie cuando el árbol es **una letra suelta**:
      // en cuanto tiene raíz, la raíz ya lo lleva dentro de su círculo y
      // repetirlo debajo era decir dos veces lo mismo —en el árbol final se
      // leía `8/8` arriba y `8/8` abajo— (revisión de diseño, 2026-09-11).
      caja.appendChild(lienzoArbol);
      if (esHojaDeHuffman(raiz)) {
        const peso = document.createElement('span');
        peso.className = 'bosque__peso';
        peso.textContent = `${raiz.peso}/${total}`;
        caja.appendChild(peso);
      }
      return { caja, lienzo: lienzoArbol, aristas, nodos, centroFinal };
    }

    // La tabla de codificación, que aparece solo al terminar (pedido del
    // usuario, 2026-09-11): antes ninguna letra tendría código que poner en
    // ella. Ocupa el sitio del panel de reducciones, así que el lienzo no
    // cambia de forma al acabar la construcción.
    function crearTablaDeCodigos(tabla) {
      const el = document.createElement('table');
      el.className = 'tabla-codigos';
      const filas = tabla.filas.map((fila) => `
        <tr>
          <td class="tabla-codigos__clave">${fila.letra}</td>
          <td>${fila.codigo}</td>
          <td>${fila.longitud}</td>
          <td>${fila.veces}/${tabla.total}</td>
          <td>${fila.producto}/${tabla.total}</td>
        </tr>`).join('');
      const media = (tabla.suma / tabla.total).toString().replace('.', ',');
      el.innerHTML = `
        <thead>
          <tr>
            <th class="tabla-codigos__clave">k</th><th>Código</th><th>Li</th><th>Pi</th><th>Pi × Li</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td class="tabla-codigos__clave" colspan="4">Σ Pi × Li</td>
            <td>${tabla.suma}/${tabla.total} = ${media}</td>
          </tr>
        </tfoot>`;
      return el;
    }

    function renderizarBosque(paso, opciones) {
      const bosque = (paso && paso.bosque) || [];
      const total = (paso && paso.total) || 0;
      const marcados = (paso && paso.uniendo) || [];
      // Lo que ya estaba dibujado antes de este paso: lo que no, aparece.
      const previos = new Set([...dom.estructuraEl.querySelectorAll('[data-clave]')]
        .map((el) => el.dataset.clave));

      const arboles = [];
      vista.animacion.animarFlip(dom.estructuraEl, () => {
        dom.estructuraEl.className = 'estructura-bosque';
        dom.estructuraEl.removeAttribute('style');
        dom.estructuraEl.innerHTML = '';

        if (bosque.length === 0) {
          const vacio = document.createElement('p');
          vacio.className = 'texto-nivel-5';
          vacio.textContent = 'Escriba una palabra para construir su árbol.';
          dom.estructuraEl.appendChild(vacio);
          return;
        }
        for (const raiz of bosque) {
          const arbol = crearArbolDelBosque(raiz, total, marcados);
          dom.estructuraEl.appendChild(arbol.caja);
          arboles.push(arbol);
        }
      }, opciones);

      // La tabla sustituye al panel del desarrollo en el último paso, y no se
      // suma a él: los dos dicen lo mismo desde dos sitios, y el lienzo no da
      // para ambos.
      if (dom.tabla) dom.tabla.remove();
      dom.tabla = null;
      if (paso && paso.tabla) {
        dom.tabla = crearTablaDeCodigos(paso.tabla);
        dom.escenario.appendChild(dom.tabla);
        if (dom.calculo) dom.calculo.el.hidden = true;
      } else if (dom.calculo) {
        // Sin palabra no hay nada que reducir: el panel no se dibuja, como en
        // los otros árboles (CLAUDE.md 6.7). Antes del primer árbol se leía
        // «Reducción · Sin operación en curso» junto a la invitación a
        // escribir una palabra (visto por el usuario, 2026-09-30).
        dom.calculo.el.hidden = !(paso && paso.calculo && paso.calculo.length);
      }

      // Como en los otros árboles: **lo nuevo aparece, no salta**. En cada
      // unión lo nuevo es el círculo de la suma y sus dos aristas, que se
      // desvanecen hacia dentro mientras los dos hijos bajan a su sitio; y
      // las aristas siguen a los nodos mientras viajan.
      if (vista.animacion.prefiereMovimientoReducido()) return;
      const aparecer = (el) => el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: DURACION_APARICION_MS, delay: DURACION_APARICION_MS / 2, fill: 'backwards'
      });
      for (const { lienzo, aristas, nodos, centroFinal } of arboles) {
        if (previos.size > 0) {
          for (const [nodo, el] of nodos) {
            if (previos.has(el.dataset.clave)) continue;
            aparecer(el);
            for (const arista of aristas.aristas) {
              if (arista.padre !== nodo) continue;
              aparecer(arista.linea);
              aparecer(arista.rotulo);
            }
          }
        }
        seguirAristas(lienzo, aristas.trazar, nodos, centroFinal, () => true);
      }
    }

    return { esBosque, renderizarBosque };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.bosque = crearDibujoBosque;
})();
