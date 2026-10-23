(function () {
  const dominio = window.CC2.dominio;

  // Grafos (CLAUDE.md 5.12 y 6.10): séptima orientación de la pantalla. El
  // lienzo pone lado a lado **el grafo y la matriz de distancias**, que es lo
  // que el docente tiene en la hoja, y al final la matriz suma las columnas
  // de los conceptos por vértice (maquetas B, C y D, elegidas por el usuario
  // el 2026-10-22).
  //
  // Todo sale del paso: la matriz viaja copiada en cada uno (ver
  // `algoritmos/floyd.js`), así que dibujar es leer, y retroceder no tiene
  // nada que deshacer. Fuera de la traza se dibuja la matriz inicial.
  //
  // Los colores son los estados de siempre (CLAUDE.md 8.2) y nada más:
  // naranja lo que se está usando —el intermedio j y D_ij—, azul la fila i,
  // verde lo que cambió o lo que el concepto elige, gris lo que queda fuera.
  function crearDibujoGrafo({ estado, dom, config, comunes }) {
    const NS_SVG = 'http://www.w3.org/2000/svg';
    // Radio del vértice: el del nodo de los árboles (`--diametro-nodo`), para
    // que hablen el mismo idioma visual (CLAUDE.md 6.7).
    const RADIO = 22;
    const MARGEN = 40;

    function esGrafo() {
      return config.orientacion === 'grafo';
    }

    // El grafo de la estructura, leído de su parámetro. Se guarda leído y se
    // vuelve a leer solo si el texto cambió.
    let leido = { texto: null, tipo: null, grafo: null };
    function grafoDeLaEstructura() {
      const p = (estado.estructura && estado.estructura.parametros) || {};
      if (!p.aristas) return null;
      if (leido.texto !== p.aristas || leido.tipo !== p.tipo) {
        const lectura = dominio.grafo.leerGrafo(p.aristas, p.tipo);
        leido = { texto: p.aristas, tipo: p.tipo, grafo: lectura.valido ? lectura.grafo : null };
      }
      return leido.grafo;
    }

    // **Los vértices van en círculo, el 1 arriba a la izquierda** y los demás
    // en el sentido del reloj. Con 4 queda el cuadrado de la hoja de Floyd.
    // El docente acomoda cada grafo a mano; calcar su dibujo exacto queda
    // para cuando se puedan arrastrar los vértices.
    function posiciones(vertices) {
      const n = vertices.length;
      const radio = n <= 2 ? 80 : 50 + n * 12;
      const inicio = -Math.PI / 2 - Math.PI / n;
      const centro = radio + MARGEN;
      const mapa = new Map();
      vertices.forEach((v, i) => {
        const angulo = inicio + (2 * Math.PI * i) / n;
        mapa.set(v, { x: centro + radio * Math.cos(angulo), y: centro + radio * Math.sin(angulo) });
      });
      return { mapa, lado: 2 * centro, centro };
    }

    function svg(etiqueta, atributos, padre) {
      const el = document.createElementNS(NS_SVG, etiqueta);
      for (const [nombre, valor] of Object.entries(atributos)) el.setAttribute(nombre, valor);
      if (padre) padre.appendChild(el);
      return el;
    }

    // Qué resalta el paso en el grafo: { vertices: Map(v → estado),
    // aristas: (arista) → estado | undefined, apagarResto }.
    function resaltadoDelGrafo(paso, grafo) {
      const vertices = new Map();
      let aristas = () => undefined;
      let apagarResto = false;
      if (!paso) return { vertices, aristas, apagarResto };
      const v = grafo.vertices;
      if (paso.j !== undefined) {
        const vj = v[paso.j];
        const vi = v[paso.i];
        for (const c of paso.cambiadas || []) vertices.set(v[c.columna], 'encontrada');
        vertices.set(vi, 'rango');
        vertices.set(vj, 'evaluacion');
        // La arista de i a j, si la hay: es D_ij cuando todavía vale lo que
        // vale la arista, y el primer tramo del camino que se prueba.
        aristas = (a) => (unen(a, vi, vj, grafo) ? 'evaluacion' : undefined);
      }
      if (paso.resaltar) {
        const { tipo, vertices: elegidos } = paso.resaltar;
        const estadoElegido = tipo === 'diametro' ? 'evaluacion' : 'encontrada';
        for (const e of elegidos) vertices.set(e, estadoElegido);
        // Centro y mediana son subgrafos inducidos (hoja del docente): se ven
        // los vértices y sus aristas, y lo demás se apaga.
        if (tipo === 'centro' || tipo === 'mediana') {
          apagarResto = true;
          const dentro = new Set(elegidos);
          aristas = (a) => (dentro.has(a.origen) && dentro.has(a.destino) ? 'encontrada' : 'descartada');
        }
      }
      return { vertices, aristas, apagarResto };
    }

    // Una arista une i con j en el sentido de i a j; en un no dirigido, en
    // cualquiera.
    function unen(arista, desde, hasta, grafo) {
      if (arista.origen === desde && arista.destino === hasta) return true;
      return grafo.tipo !== dominio.grafo.TIPOS.DIRIGIDO && arista.origen === hasta && arista.destino === desde;
    }

    function crearGrafo(grafo, paso) {
      const { mapa, lado, centro: medio } = posiciones(grafo.vertices);
      const dibujo = svg('svg', {
        class: 'grafo',
        width: lado,
        height: lado,
        viewBox: `0 0 ${lado} ${lado}`,
        role: 'img',
        'aria-label': `Grafo ${grafo.tipo === dominio.grafo.TIPOS.DIRIGIDO ? 'dirigido' : 'no dirigido'} de ${grafo.vertices.length} vértices`
      });
      const dirigido = grafo.tipo === dominio.grafo.TIPOS.DIRIGIDO;
      const resaltado = resaltadoDelGrafo(paso, grafo);

      // Una punta por estado: el color de la punta no se hereda de la línea.
      const defs = svg('defs', {}, dibujo);
      for (const estadoPunta of ['normal', 'evaluacion', 'encontrada', 'descartada']) {
        const marcador = svg('marker', {
          id: `grafo-punta-${estadoPunta}`,
          viewBox: '0 0 10 10', refX: 10, refY: 5,
          markerWidth: 12, markerHeight: 12, markerUnits: 'userSpaceOnUse',
          orient: 'auto-start-reverse'
        }, defs);
        svg('path', { d: 'M0,0 L10,5 L0,10 z', class: `grafo__punta grafo__punta--${estadoPunta}` }, marcador);
      }

      const aristas = svg('g', { class: 'grafo__aristas' }, dibujo);
      const pesos = svg('g', { class: 'grafo__pesos' }, dibujo);
      for (const arista of grafo.aristas) {
        const a = mapa.get(arista.origen);
        const b = mapa.get(arista.destino);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const largo = Math.hypot(dx, dy);
        const ux = dx / largo;
        const uy = dy / largo;
        // **La ida y la vuelta se curvan**, cada una a su lado: rectas, las
        // dos flechas de 1→2 y 2→1 serían la misma raya.
        const deVuelta = dirigido && grafo.aristas.some((otra) => otra.origen === arista.destino && otra.destino === arista.origen);
        const curva = deVuelta ? 22 : 0;
        const mx = (a.x + b.x) / 2 - uy * curva;
        const my = (a.y + b.y) / 2 + ux * curva;
        // Los extremos, en el borde del círculo y apuntando hacia el control.
        const hacia = (desde, punto, separacion) => {
          const ex = punto.x - desde.x;
          const ey = punto.y - desde.y;
          const l = Math.hypot(ex, ey);
          return { x: desde.x + (ex / l) * separacion, y: desde.y + (ey / l) * separacion };
        };
        const control = { x: mx * 2 - (a.x + b.x) / 2, y: my * 2 - (a.y + b.y) / 2 };
        const p1 = hacia(a, curva ? control : b, RADIO);
        const p2 = hacia(b, curva ? control : a, RADIO + (dirigido ? 1 : 0));
        const estadoArista = resaltado.aristas(arista) || (resaltado.apagarResto ? 'descartada' : null);
        svg('path', {
          d: curva ? `M${p1.x},${p1.y} Q${control.x},${control.y} ${p2.x},${p2.y}` : `M${p1.x},${p1.y} L${p2.x},${p2.y}`,
          class: 'grafo__arista' + (estadoArista ? ` grafo__arista--${estadoArista}` : ''),
          'marker-end': dirigido ? `url(#grafo-punta-${estadoArista || 'normal'})` : ''
        }, aristas);
        if (grafo.conPesos) {
          // El peso, al lado de la mitad y hacia afuera de la curva.
          const px = mx - uy * 13;
          const py = my + ux * 13;
          const texto = svg('text', {
            x: px, y: py,
            class: 'grafo__peso' + (estadoArista ? ` grafo__peso--${estadoArista}` : ''),
            'text-anchor': 'middle', 'dominant-baseline': 'central'
          }, pesos);
          texto.textContent = arista.peso;
        }
      }

      const nodos = svg('g', { class: 'grafo__vertices' }, dibujo);
      for (const vertice of grafo.vertices) {
        const { x, y } = mapa.get(vertice);
        const estadoVertice = resaltado.vertices.get(vertice) || (resaltado.apagarResto ? 'descartada' : null);
        const grupo = svg('g', {
          class: 'grafo__vertice' + (estadoVertice ? ` grafo__vertice--${estadoVertice}` : ''),
          'data-vertice': vertice
        }, nodos);
        svg('circle', { cx: x, cy: y, r: RADIO }, grupo);
        const texto = svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, grupo);
        texto.textContent = vertice;
        // El papel del vértice en el paso, escrito a su lado: j e i son las
        // variables de la hoja, y el color solo no se lee proyectado.
        const papel = paso && paso.j !== undefined
          ? (vertice === grafo.vertices[paso.j] ? 'j' : vertice === grafo.vertices[paso.i] ? 'i' : null)
          : null;
        // Hacia afuera del grafo, en la dirección del vértice: por dentro es
        // donde llegan las aristas.
        if (papel) {
          const dx = x - medio;
          const dy = y - medio;
          const largo = Math.hypot(dx, dy) || 1;
          const rotulo = svg('text', {
            x: x + (dx / largo) * (RADIO + 13), y: y + (dy / largo) * (RADIO + 13),
            class: `grafo__papel grafo__papel--${papel}`, 'text-anchor': 'middle', 'dominant-baseline': 'central'
          }, grupo);
          rotulo.textContent = papel;
        }
      }
      return dibujo;
    }

    const valor = (numero) => (Number.isFinite(numero) ? String(numero) : '∞');

    // La matriz de distancias, con lo que el paso está usando: la fila i en
    // azul, D_ij en naranja y lo que cambió en verde con su valor anterior
    // tachado encima, como lo corrige el docente sobre la hoja.
    function crearMatriz(grafo, paso, matriz) {
      const v = grafo.vertices;
      const tabla = document.createElement('table');
      tabla.className = 'matriz-grafo';
      const titulo = document.createElement('caption');
      titulo.className = 'matriz-grafo__titulo';
      titulo.textContent = paso && paso.fase === 'conceptos'
        ? 'Distancias mínimas'
        : (paso && paso.j !== undefined ? `Matriz de distancias D (j = ${v[paso.j]})` : 'Matriz de distancias D');
      tabla.appendChild(titulo);

      const enFloyd = paso && paso.j !== undefined;
      const cambiadas = new Map((enFloyd ? paso.cambiadas : []).map((c) => [`${c.fila},${c.columna}`, c.antes]));
      const filasDestacadas = filasDeConceptos(paso, grafo);

      // **Los conceptos por vértice, como columnas al final de su fila**: la
      // distancia es la suma de la fila y la excentricidad su mayor valor, y
      // escritas al lado se lee de dónde salen. Iban en una tabla aparte
      // (maqueta C), que en una ventana chica no cabía junto a todo lo demás.
      const columnas = columnasDeConceptos(paso);
      const cabecera = document.createElement('tr');
      cabecera.appendChild(document.createElement('th'));
      v.forEach((vertice, k) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = vertice;
        if (enFloyd && k === paso.j) th.className = 'matriz-grafo__cabecera--evaluacion';
        cabecera.appendChild(th);
      });
      for (const columna of columnas) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'matriz-grafo__cabecera--concepto';
        th.innerHTML = `${columna.titulo}<span>${columna.ayuda}</span>`;
        cabecera.appendChild(th);
      }
      tabla.appendChild(cabecera);

      matriz.forEach((fila, i) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = v[i];
        if (enFloyd && i === paso.i) th.className = 'matriz-grafo__cabecera--rango';
        tr.appendChild(th);
        fila.forEach((distancia, k) => {
          const td = document.createElement('td');
          const clases = ['matriz-grafo__celda'];
          if (i === k) clases.push('matriz-grafo__celda--diagonal');
          if (!Number.isFinite(distancia)) clases.push('matriz-grafo__celda--infinita');
          const clave = `${i},${k}`;
          if (enFloyd) {
            if (cambiadas.has(clave)) clases.push('matriz-grafo__celda--cambio');
            else if (i === paso.i && k === paso.j) clases.push('matriz-grafo__celda--operando');
            else if (i === paso.i) clases.push('matriz-grafo__celda--fila');
          } else if (filasDestacadas.has(i)) {
            clases.push(`matriz-grafo__celda--${filasDestacadas.get(i)}`);
          }
          td.className = clases.join(' ');
          if (cambiadas.has(clave)) {
            const antes = document.createElement('span');
            antes.className = 'matriz-grafo__antes';
            antes.textContent = valor(cambiadas.get(clave));
            td.appendChild(antes);
          }
          td.appendChild(document.createTextNode(valor(distancia)));
          tr.appendChild(td);
        });
        for (const columna of columnas) {
          const td = document.createElement('td');
          td.className = 'matriz-grafo__concepto'
            + (filasDestacadas.has(i) ? ` matriz-grafo__concepto--${filasDestacadas.get(i)}` : '');
          td.textContent = columna.valores[i];
          tr.appendChild(td);
        }
        tabla.appendChild(tr);
      });
      return tabla;
    }

    function columnasDeConceptos(paso) {
      if (!paso || !paso.conceptos) return [];
      const c = paso.conceptos;
      const columnas = [];
      if (c.mostrar.includes('distancia')) columnas.push({ titulo: 'Distancia', ayuda: 'suma', valores: c.distancias });
      if (c.mostrar.includes('excentricidad')) columnas.push({ titulo: 'Excentr.', ayuda: 'mayor', valores: c.excentricidades });
      return columnas;
    }

    // Las filas que un concepto elige, con su color.
    function filasDeConceptos(paso, grafo) {
      const filas = new Map();
      if (!paso || !paso.resaltar) return filas;
      const estadoFila = paso.resaltar.tipo === 'diametro' ? 'evaluacion' : 'encontrada';
      for (const vertice of paso.resaltar.vertices) filas.set(grafo.vertices.indexOf(vertice), estadoFila);
      return filas;
    }

    function renderizarGrafo(paso) {
      const grafo = grafoDeLaEstructura();
      dom.estructuraEl.className = 'estructura-grafo';
      dom.estructuraEl.removeAttribute('style');
      dom.estructuraEl.innerHTML = '';
      if (!grafo) return;
      const matriz = paso && paso.matriz ? paso.matriz : dominio.grafo.matrizInicial(grafo);
      dom.estructuraEl.appendChild(crearGrafo(grafo, paso));
      dom.estructuraEl.appendChild(crearMatriz(grafo, paso, matriz));
      ajustarGrafo();
    }

    // **Cabe en el lienzo sin desplazarse**: en una ventana chica —1280 × 633
    // con el zoom al 150 %, un proyector XGA— el grafo, la matriz y el panel
    // del cálculo no caben en una fila. Se prueba el grafo al lado de la
    // matriz y el grafo encima, se queda la disposición que deja la letra más
    // grande, y se encoge lo justo, nunca por debajo de `ENCOGIMIENTO_MINIMO`.
    const ENCOGIMIENTO_MINIMO = 0.5;
    function ajustarGrafo() {
      const caja = dom.estructuraEl;
      if (!caja.isConnected || !caja.firstChild) return;
      caja.style.zoom = '';
      const cabe = () => Math.min(1, caja.clientWidth / caja.scrollWidth, caja.clientHeight / caja.scrollHeight);
      caja.classList.remove('estructura-grafo--apilada');
      const enFila = cabe();
      caja.classList.add('estructura-grafo--apilada');
      const apilada = cabe();
      if (enFila >= apilada) caja.classList.remove('estructura-grafo--apilada');
      let factor = Math.max(ENCOGIMIENTO_MINIMO, Math.max(enFila, apilada));
      if (factor < 1) caja.style.zoom = String(factor);
      // Encogida, deja sitio que el panel del cálculo —flexible como ella—
      // toma, y lo que le queda vuelve a ser menos: se mide otra vez y se
      // achica lo que falte, como el árbol (`ajustarArbol`).
      for (let intento = 0; intento < 3 && factor > ENCOGIMIENTO_MINIMO; intento++) {
        const sobra = Math.min(caja.clientWidth / caja.scrollWidth, caja.clientHeight / caja.scrollHeight);
        if (sobra >= 0.999) break;
        factor = Math.max(ENCOGIMIENTO_MINIMO, factor * sobra * 0.995);
        caja.style.zoom = String(factor);
      }
    }

    // **El grafo se ve mientras se escribe** (maqueta D, 2026-10-22): antes de
    // crearlo, el lienzo dibuja lo que hay en el formulario, si se lee.
    function renderizarVistaPrevia(grafo) {
      dom.estructuraEl.className = 'estructura-grafo estructura-grafo--previa';
      dom.estructuraEl.removeAttribute('style');
      dom.estructuraEl.innerHTML = '';
      dom.estructuraEl.appendChild(crearGrafo(grafo, null));
      ajustarGrafo();
    }

    return { ajustarGrafo, esGrafo, renderizarGrafo, renderizarVistaPrevia };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.grafo = crearDibujoGrafo;
})();
