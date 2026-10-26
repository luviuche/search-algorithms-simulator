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
        // Sin tipo —el coloreado no lo pide— es no dirigido, como en app.js.
        const lectura = dominio.grafo.leerGrafo(p.aristas, p.tipo || dominio.grafo.TIPOS.NO_DIRIGIDO);
        leido = { texto: p.aristas, tipo: p.tipo, grafo: lectura.valido ? lectura.grafo : null };
      }
      return leido.grafo;
    }

    // **Con 4 y 5 vértices, el cuadrado del docente**: 1 y 2 arriba, 3 y 4
    // abajo, y el 5 a la derecha, a media altura. Así dibuja la hoja de Floyd,
    // el grafo verde de la representación y la hoja 1 del coloreado; en
    // círculo, el 3 caía abajo a la derecha y sus diagonales se cruzaban
    // (2026-10-24). **Con los demás, en círculo**, el 1 arriba a la izquierda
    // y los demás en el sentido del reloj. Calcar cada dibujo exacto queda
    // para cuando se puedan arrastrar los vértices.
    const CUADRADO = { 0: [0, 0], 1: [1, 0], 2: [0, 1], 3: [1, 1], 4: [1.6, 0.5] };
    function posiciones(vertices) {
      const n = vertices.length;
      if (n === 4 || n === 5) {
        const lado = 190;
        const ancho = (n === 5 ? 1.6 : 1) * lado + 2 * MARGEN;
        const alto = lado + 2 * MARGEN;
        const mapa = new Map(vertices.map((v, i) => [v, { x: MARGEN + CUADRADO[i][0] * lado, y: MARGEN + CUADRADO[i][1] * lado }]));
        return { mapa, ancho, alto, centro: { x: ancho / 2, y: alto / 2 } };
      }
      const radio = n <= 2 ? 80 : 50 + n * 12;
      const inicio = -Math.PI / 2 - Math.PI / n;
      const centro = radio + MARGEN;
      const mapa = new Map();
      vertices.forEach((v, i) => {
        const angulo = inicio + (2 * Math.PI * i) / n;
        mapa.set(v, { x: centro + radio * Math.cos(angulo), y: centro + radio * Math.sin(angulo) });
      });
      return { mapa, ancho: 2 * centro, alto: 2 * centro, centro: { x: centro, y: centro } };
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
      // Representación matricial: la fila que se llena en azul —un vértice o
      // una arista— y lo que lleva 1 o −1 en ella en naranja, igual que en la
      // matriz. En la adyacencia de vértices se resaltan también las aristas
      // que los unen, que son las que ponen esos unos.
      if (paso.representacion && paso.filaActual !== undefined) {
        const r = paso.representacion;
        const fila = r.filas[paso.filaActual];
        const valores = r.valores[paso.filaActual];
        const relacionados = new Set(r.columnas.filter((_, k) => valores[k] !== 0).map((c) => c.clave));
        if (fila.clase === 'vertice') {
          vertices.set(fila.clave, 'rango');
          if (r.columnas[0] && r.columnas[0].clase === 'vertice') {
            for (const otro of relacionados) vertices.set(otro, 'evaluacion');
            aristas = (a) => ((a.origen === fila.clave && relacionados.has(a.destino))
              || (a.destino === fila.clave && relacionados.has(a.origen)) ? 'evaluacion' : undefined);
          } else {
            aristas = (a) => (relacionados.has(a.nombre) ? 'evaluacion' : undefined);
          }
        } else {
          aristas = (a) => (a.nombre === fila.clave ? 'rango' : relacionados.has(a.nombre) ? 'evaluacion' : undefined);
        }
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
      const { mapa, ancho, alto, centro: medio } = posiciones(grafo.vertices);
      const dibujo = svg('svg', {
        class: 'grafo',
        width: ancho,
        height: alto,
        viewBox: `0 0 ${ancho} ${alto}`,
        role: 'img',
        'aria-label': `Grafo ${grafo.tipo === dominio.grafo.TIPOS.DIRIGIDO ? 'dirigido' : 'no dirigido'} de ${grafo.vertices.length} vértices`
      });
      const dirigido = grafo.tipo === dominio.grafo.TIPOS.DIRIGIDO;
      const resaltado = resaltadoDelGrafo(paso, grafo);

      // Una punta por estado: el color de la punta no se hereda de la línea.
      const defs = svg('defs', {}, dibujo);
      for (const estadoPunta of ['normal', 'evaluacion', 'encontrada', 'descartada', 'rango']) {
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
        const trazo = curva ? `M${p1.x},${p1.y} Q${control.x},${control.y} ${p2.x},${p2.y}` : `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
        // En el coloreado de aristas, la del paso lleva un halo naranja
        // debajo: el naranja de «en evaluación» encima taparía su color.
        const colorArista = colorDe(paso, arista.nombre, MODOS_COLOREADO.ARISTAS);
        if (paso && paso.modo === MODOS_COLOREADO.ARISTAS && paso.actual === arista.nombre) {
          svg('path', { d: trazo, class: 'grafo__arista-halo' }, aristas);
        }
        svg('path', {
          d: trazo,
          class: 'grafo__arista' + (estadoArista ? ` grafo__arista--${estadoArista}` : '')
            + (colorArista ? ` grafo__arista--color grafo__color--${colorArista}` : ''),
          'marker-end': dirigido ? `url(#grafo-punta-${estadoArista || 'normal'})` : ''
        }, aristas);
        // Al lado de la mitad y hacia afuera de la curva: el peso, o en la
        // representación matricial el nombre de la arista, que es el rótulo
        // de su columna.
        const conNombre = config.nombresDeAristas;
        if (conNombre || grafo.conPesos) {
          const px = mx - uy * 13;
          const py = my + ux * 13;
          const texto = svg('text', {
            x: px, y: py,
            class: (conNombre ? 'grafo__nombre' : 'grafo__peso') + (estadoArista ? ` grafo__peso--${estadoArista}` : ''),
            'text-anchor': 'middle', 'dominant-baseline': 'central'
          }, pesos);
          texto.textContent = conNombre ? arista.nombre + (colorArista ? ` ${colorArista}` : '') : arista.peso;
          if (colorArista) texto.classList.add('grafo__nombre--color', `grafo__color--${colorArista}`);
        }
      }

      const nodos = svg('g', { class: 'grafo__vertices' }, dibujo);
      for (const vertice of grafo.vertices) {
        const { x, y } = mapa.get(vertice);
        const estadoVertice = resaltado.vertices.get(vertice) || (resaltado.apagarResto ? 'descartada' : null);
        // **Coloreado: el vértice pintado de su color, con su letra al lado**
        // (opción B de las maquetas, elegida por el usuario el 2026-10-24); el
        // del paso, con un anillo naranja, y sus vecinos con uno azul.
        const colorVertice = paso && paso.modo !== MODOS_COLOREADO.ARISTAS ? colorDe(paso, vertice) : null;
        const enColoreo = paso && paso.modo && paso.modo !== MODOS_COLOREADO.ARISTAS;
        const papelEnColoreo = enColoreo && paso.actual === vertice ? ' grafo__vertice--actual'
          : enColoreo && (paso.vecinos || []).includes(vertice) && paso.actual !== undefined ? ' grafo__vertice--vecino' : '';
        const grupo = svg('g', {
          class: 'grafo__vertice' + (estadoVertice ? ` grafo__vertice--${estadoVertice}` : '')
            + (colorVertice ? ` grafo__vertice--color grafo__color--${colorVertice}` : '') + papelEnColoreo,
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
          const dx = x - medio.x;
          const dy = y - medio.y;
          const largo = Math.hypot(dx, dy) || 1;
          const rotulo = svg('text', {
            x: x + (dx / largo) * (RADIO + 13), y: y + (dy / largo) * (RADIO + 13),
            class: `grafo__papel grafo__papel--${papel}`, 'text-anchor': 'middle', 'dominant-baseline': 'central'
          }, grupo);
          rotulo.textContent = papel;
        }
        if (colorVertice) {
          const dx = x - medio.x;
          const dy = y - medio.y;
          const largo = Math.hypot(dx, dy) || 1;
          const letraEl = svg('text', {
            x: x + (dx / largo) * (RADIO + 15), y: y + (dy / largo) * (RADIO + 15),
            class: `grafo__letra grafo__color--${colorVertice}`, 'text-anchor': 'middle', 'dominant-baseline': 'central'
          }, grupo);
          letraEl.textContent = colorVertice;
        }
      }
      return dibujo;
    }

    // La letra del color de un vértice o una arista en el paso, o nada.
    const MODOS_COLOREADO = dominio.coloreado.MODOS;
    function colorDe(paso, clave, modo) {
      if (!paso || !paso.colores || (modo && paso.modo !== modo)) return null;
      const indice = paso.colores[clave];
      return indice === undefined ? null : dominio.coloreado.COLORES[indice].letra;
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

    // ── Representación matricial (CLAUDE.md 5.13) ──────────────────────────
    // La matriz y, debajo, su estructura de adyacencia, llenándose una fila
    // por paso (maqueta A, elegida por el usuario el 2026-10-23): son la
    // misma información escrita de dos formas, y se ve al llenarse juntas.
    const valorConSigno = (v) => (v < 0 ? `−${-v}` : String(v));

    function crearMatrizRepresentacion(r, paso) {
      const llenas = paso ? paso.filasLlenas : 0;
      const actual = paso && paso.filaActual !== undefined ? paso.filaActual : null;
      const tabla = document.createElement('table');
      tabla.className = 'matriz-grafo matriz-grafo--representacion';
      const titulo = document.createElement('caption');
      titulo.className = 'matriz-grafo__titulo';
      titulo.textContent = config.tituloRepresentacion ? config.tituloRepresentacion(r) : '';
      tabla.appendChild(titulo);
      const cabecera = document.createElement('tr');
      cabecera.appendChild(document.createElement('th'));
      r.columnas.forEach((columna, k) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = columna.etiqueta;
        if (actual !== null && r.valores[actual][k] !== 0) th.className = 'matriz-grafo__cabecera--evaluacion';
        cabecera.appendChild(th);
      });
      tabla.appendChild(cabecera);
      r.filas.forEach((fila, i) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = fila.etiqueta;
        if (i === actual) th.className = 'matriz-grafo__cabecera--rango';
        tr.appendChild(th);
        r.valores[i].forEach((v) => {
          const td = document.createElement('td');
          const clases = ['matriz-grafo__celda'];
          if (i >= llenas) {
            clases.push('matriz-grafo__celda--pendiente');
          } else {
            if (i === actual) clases.push(v !== 0 ? 'matriz-grafo__celda--operando' : 'matriz-grafo__celda--fila');
            td.textContent = valorConSigno(v);
          }
          td.className = clases.join(' ');
          tr.appendChild(td);
        });
        tabla.appendChild(tr);
      });
      return tabla;
    }

    // La estructura de adyacencia: un arreglo principal —las filas— y de cada
    // una, enlazados, los que llevan 1 o −1 en su fila (el −1 con su signo).
    function crearEstructuraDeAdyacencia(r, paso) {
      const llenas = paso ? paso.filasLlenas : 0;
      const actual = paso && paso.filaActual !== undefined ? paso.filaActual : null;
      const tabla = document.createElement('table');
      tabla.className = 'adyacencia-grafo';
      const titulo = document.createElement('caption');
      titulo.className = 'matriz-grafo__titulo';
      titulo.textContent = 'Estructura de adyacencia';
      tabla.appendChild(titulo);
      r.filas.forEach((fila, i) => {
        const tr = document.createElement('tr');
        if (i === actual) tr.className = 'adyacencia-grafo__fila--actual';
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = fila.etiqueta;
        tr.appendChild(th);
        const td = document.createElement('td');
        if (i < llenas) {
          r.valores[i].forEach((v, k) => {
            if (v === 0) return;
            const nodo = document.createElement('span');
            nodo.className = 'adyacencia-grafo__nodo' + (v < 0 ? ' adyacencia-grafo__nodo--negativo' : '');
            const caja = document.createElement('span');
            caja.className = 'adyacencia-grafo__caja';
            caja.textContent = (v < 0 ? '−' : '') + r.columnas[k].etiqueta;
            nodo.appendChild(caja);
            td.appendChild(nodo);
          });
        }
        tr.appendChild(td);
        tabla.appendChild(tr);
      });
      return tabla;
    }

    // ── Coloreado (CLAUDE.md 5.14) ─────────────────────────────────────────
    // La tabla en orden, como la lista del docente: «V3 → color Azul → es
    // adyacente con V1 y V2». Las filas que faltan se ven vacías.
    function pastilla(indice) {
      const color = dominio.coloreado.COLORES[indice];
      const el = document.createElement('span');
      el.className = 'coloreo-tabla__color';
      el.innerHTML = `<span class="coloreo-pastilla grafo__color--${color.letra}">${color.letra}</span> ${color.nombre}`;
      return el;
    }

    function crearTablaDeColoreo(paso) {
      const deAristas = paso.modo === MODOS_COLOREADO.ARISTAS;
      const tabla = document.createElement('table');
      tabla.className = 'coloreo-tabla';
      tabla.innerHTML = `<caption class="matriz-grafo__titulo">Coloreado en orden (R, N, A, V)</caption>
        <tr><th scope="col">${deAristas ? 'Arista' : 'Vértice'}</th><th scope="col">${deAristas ? 'Vecinas ya coloreadas' : 'Vecinos ya coloreados'}</th><th scope="col">Color</th></tr>`;
      paso.tabla.forEach((fila, i) => {
        const tr = document.createElement('tr');
        if (paso.actual === fila.clave) tr.className = 'coloreo-tabla__fila--actual';
        const llena = i < paso.filasLlenas;
        tr.innerHTML = `<td>${fila.clave}</td><td>${llena ? fila.vecinos : ''}</td><td></td>`;
        // Con el coloreado de χ colores, la columna dice el de ese coloreado.
        if (llena) tr.lastElementChild.appendChild(pastilla(paso.optimo ? paso.colores[fila.clave] : fila.color));
        tabla.appendChild(tr);
      });
      return tabla;
    }

    // El polinomio: la tabla de cᵢ y, al sumar, la fórmula.
    function crearTablaDelPolinomio(paso) {
      const tabla = document.createElement('table');
      tabla.className = 'coloreo-tabla';
      tabla.innerHTML = `<caption class="matriz-grafo__titulo">Formas de colorear con exactamente i colores</caption>
        <tr><th scope="col">i</th><th scope="col">cᵢ</th><th scope="col">C(λ, i)</th><th scope="col">cᵢ · C(λ, i)</th></tr>`;
      const caida = (i) => Array.from({ length: i }, (_, k) => (k === 0 ? 'λ' : `(λ−${k})`)).join('');
      paso.tabla.forEach((fila, k) => {
        const tr = document.createElement('tr');
        if (k === paso.filasLlenas - 1 && !paso.polinomio) tr.className = 'coloreo-tabla__fila--actual';
        const llena = k < paso.filasLlenas;
        const termino = fila.ci === 0 ? '0' : `${fila.mi === 1 ? '' : `${fila.mi} · `}${caida(fila.i)}`;
        tr.innerHTML = `<td>${fila.i}</td><td>${llena ? fila.ci : ''}</td><td>${caida(fila.i)}${fila.i > 1 ? `/${fila.i}!` : ''}</td><td>${llena ? termino : ''}</td>`;
        tabla.appendChild(tr);
      });
      return tabla;
    }

    function crearFormula(polinomio) {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'coloreo-formula';
      for (const linea of [polinomio.suma, polinomio.factorizado, polinomio.expandido, polinomio.evaluado].filter(Boolean)) {
        const p = document.createElement('p');
        p.textContent = linea;
        if (linea === polinomio.evaluado) p.className = 'coloreo-formula__resultado';
        tarjeta.appendChild(p);
      }
      return tarjeta;
    }

    // ── Operaciones entre grafos (CLAUDE.md 5.15) ─────────────────────────
    // Los dos operandos chicos a la izquierda, con el símbolo entre ellos, y
    // el resultado en una cuadrícula: una fila por vértice de G₁ y una
    // columna por vértice de G₂ (maquetas aprobadas el 2026-10-26). G₁ va en
    // vertical y G₂ en horizontal, como las filas y las columnas.
    const operaciones = dominio.operaciones;
    function operandosDeLaEstructura() {
      const p = (estado.estructura && estado.estructura.parametros) || {};
      const g1 = operaciones.leerOperando(p.aristas1, 'G₁');
      const g2 = operaciones.leerOperando(p.aristas2, 'G₂');
      return g1.valido && g2.valido ? { g1: g1.grafo, g2: g2.grafo, operacion: p.operacion } : null;
    }

    // Una arista recta, salvo que pase por encima de otro vértice: entonces
    // se curva hacia afuera de la figura, más cuanto más larga —en la misma
    // columna, la de 1 a 3 y la de 1 a 4 no quedan encimadas—, y nunca hasta
    // meterse en la columna de al lado. Devuelve el trazo y el punto más
    // salido de la curva, que el dibujo tiene que abarcar.
    const CURVA_MAXIMA = 44;
    function trazoEntre(a, b, otros, medio) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const largo = Math.hypot(dx, dy);
      const tapa = otros.some((o) => {
        if (o === a || o === b) return false;
        const t = ((o.x - a.x) * dx + (o.y - a.y) * dy) / (largo * largo);
        if (t <= 0 || t >= 1) return false;
        return Math.hypot(a.x + t * dx - o.x, a.y + t * dy - o.y) < 22;
      });
      if (!tapa) return { d: `M${a.x},${a.y} L${b.x},${b.y}`, pico: null };
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      let nx = -dy / largo;
      let ny = dx / largo;
      if ((mx - medio.x) * nx + (my - medio.y) * ny < 0) { nx = -nx; ny = -ny; }
      const curva = Math.min(CURVA_MAXIMA, 10 + largo * 0.12);
      return {
        d: `M${a.x},${a.y} Q${mx + nx * curva * 2},${my + ny * curva * 2} ${b.x},${b.y}`,
        pico: { x: mx + nx * curva, y: my + ny * curva }
      };
    }

    // El dibujo crece lo que salgan las curvas: dibujadas fuera de su caja,
    // `ajustarGrafo` no las medía y quedaban recortadas.
    function abarcarCurvas(dibujo, ancho, alto, picos) {
      const holgura = 6;
      const x0 = Math.min(0, ...picos.map((p) => p.x - holgura));
      const y0 = Math.min(0, ...picos.map((p) => p.y - holgura));
      const x1 = Math.max(ancho, ...picos.map((p) => p.x + holgura));
      const y1 = Math.max(alto, ...picos.map((p) => p.y + holgura));
      dibujo.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
      dibujo.setAttribute('width', x1 - x0);
      dibujo.setAttribute('height', y1 - y0);
    }

    const juntas = (lista, a, b) => lista.some(([p, q]) => (p === a && q === b) || (p === b && q === a));

    // Un operando: G₁ hacia abajo, G₂ hacia la derecha. Lo que el paso usa
    // de él, resaltado: el vértice que se fija en azul, las aristas en naranja.
    function crearOperando(grafo, titulo, horizontal, usa) {
      const PASO_OPERANDO = 78;
      const n = grafo.vertices.length;
      const ancho = horizontal ? 2 * MARGEN + (n - 1) * PASO_OPERANDO : 2 * MARGEN + 20;
      const alto = horizontal ? 2 * MARGEN + 20 : 2 * MARGEN + 20 + (n - 1) * PASO_OPERANDO;
      const posicion = (i) => (horizontal
        ? { x: MARGEN + i * PASO_OPERANDO, y: MARGEN + 20 }
        : { x: MARGEN + 10, y: MARGEN + 20 + i * PASO_OPERANDO });
      const mapa = new Map(grafo.vertices.map((v, i) => [v, posicion(i)]));
      const medio = { x: ancho / 2, y: alto / 2 + (horizontal ? -40 : 0) };
      const dibujo = svg('svg', {
        class: 'grafo grafo--operando', width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}`,
        role: 'img', 'aria-label': `${titulo}: ${n} vértices, ${grafo.aristas.length} aristas`
      });
      svg('text', { x: 4, y: 16, class: 'grafo__titulo' }, dibujo).textContent = titulo;
      const lineas = svg('g', { class: 'grafo__aristas' }, dibujo);
      const picos = [];
      for (const [p, q] of grafo.aristas) {
        const usada = usa && juntas(usa.aristas, p, q);
        const { d, pico } = trazoEntre(mapa.get(p), mapa.get(q), [...mapa.values()], medio);
        if (pico) picos.push(pico);
        svg('path', { d, class: 'grafo__arista' + (usada ? ' grafo__arista--evaluacion' : '') }, lineas);
      }
      abarcarCurvas(dibujo, ancho, alto, picos);
      const nodos = svg('g', { class: 'grafo__vertices' }, dibujo);
      for (const v of grafo.vertices) {
        const { x, y } = mapa.get(v);
        const fijo = usa && usa.vertices.includes(v);
        const grupo = svg('g', { class: 'grafo__vertice' + (fijo ? ' grafo__vertice--rango' : ''), 'data-vertice': v }, nodos);
        svg('circle', { cx: x, cy: y, r: 20 }, grupo);
        svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, grupo).textContent = v;
      }
      return dibujo;
    }

    function crearOperandos({ g1, g2, operacion }, usa) {
      const caja = document.createElement('div');
      caja.className = 'operacion-grafos__operandos';
      const simbolo = document.createElement('span');
      simbolo.className = 'operacion-grafos__simbolo'
        + (operacion === operaciones.OPERACIONES.COMPOSICION ? ' operacion-grafos__simbolo--largo' : '');
      simbolo.textContent = { cartesiano: '⊕', tensorial: '⊗', composicion: 'G₁[G₂]' }[operacion] || '';
      if (g1) caja.appendChild(crearOperando(g1, 'G₁', false, usa && usa.g1));
      caja.appendChild(simbolo);
      if (g2) caja.appendChild(crearOperando(g2, 'G₂', true, usa && usa.g2));
      return caja;
    }

    // El resultado: los pares en pastillas, las aristas hechas, en naranja
    // las de este paso y punteadas las que faltan. Las filas y las columnas
    // llevan su vértice escrito al borde, que es como las nombra el aviso.
    function crearResultado(paso) {
      const { g1, g2 } = paso;
      const etiqueta = ([u, v]) => operaciones.par(u, v);
      const anchoPastilla = Math.max(...paso.resultado.vertices.map((p) => 18 + 9.5 * etiqueta(p).length));
      const columna = anchoPastilla + 64;
      const fila = 96;
      const izquierda = MARGEN + 24 + anchoPastilla / 2;
      const arriba = MARGEN + 44;
      const ancho = izquierda + (g2.vertices.length - 1) * columna + anchoPastilla / 2 + MARGEN;
      const alto = arriba + (g1.vertices.length - 1) * fila + 18 + MARGEN;
      const posicion = ([u, v]) => ({ x: izquierda + g2.vertices.indexOf(v) * columna, y: arriba + g1.vertices.indexOf(u) * fila });
      const mapa = new Map(paso.resultado.vertices.map((p) => [etiqueta(p), posicion(p)]));
      const medio = { x: (izquierda + ancho - MARGEN) / 2, y: (arriba + alto - MARGEN) / 2 };
      const simbolo = window.CC2.algoritmos.operaciones.SIMBOLOS[paso.operacion];
      const dibujo = svg('svg', {
        class: 'grafo grafo--resultado', width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}`,
        role: 'img', 'aria-label': `${simbolo}: ${mapa.size} vértices, ${paso.hechas} aristas`
      });
      svg('text', { x: 4, y: 16, class: 'grafo__titulo' }, dibujo).textContent = simbolo;
      g2.vertices.forEach((v, k) => {
        svg('text', { x: izquierda + k * columna, y: arriba - 34, class: 'grafo__rotulo', 'text-anchor': 'middle' }, dibujo).textContent = v;
      });
      g1.vertices.forEach((u, k) => {
        svg('text', { x: 12, y: arriba + k * fila, class: 'grafo__rotulo', 'dominant-baseline': 'central' }, dibujo).textContent = u;
      });
      const otros = [...mapa.values()];
      const lineas = svg('g', { class: 'grafo__aristas' }, dibujo);
      // Primero las que faltan, debajo de todo; las nuevas, encima.
      const orden = paso.resultado.aristas.map((a, i) => ({ a, i }))
        .sort((x, y) => rango(x.i) - rango(y.i));
      function rango(i) {
        return i >= paso.hechas ? 0 : i >= paso.nuevasDesde ? 2 : 1;
      }
      const picos = [];
      for (const { a: [p, q], i } of orden) {
        const estadoArista = i >= paso.hechas ? 'pendiente' : i >= paso.nuevasDesde ? 'evaluacion' : null;
        const { d, pico } = trazoEntre(mapa.get(etiqueta(p)), mapa.get(etiqueta(q)), otros, medio);
        if (pico) picos.push(pico);
        svg('path', { d, class: 'grafo__arista' + (estadoArista ? ` grafo__arista--${estadoArista}` : '') }, lineas);
      }
      abarcarCurvas(dibujo, ancho, alto, picos);
      const resaltados = new Set((paso.paresResaltados || []).map(etiqueta));
      const nodos = svg('g', { class: 'grafo__vertices' }, dibujo);
      for (const [texto, { x, y }] of mapa) {
        const grupo = svg('g', {
          class: 'operacion-grafos__par' + (resaltados.has(texto) ? ' operacion-grafos__par--evaluacion' : ''),
          'data-par': texto
        }, nodos);
        svg('rect', { x: x - anchoPastilla / 2, y: y - 18, width: anchoPastilla, height: 36, rx: 18 }, grupo);
        svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, grupo).textContent = texto;
      }
      return dibujo;
    }

    // Al terminar, la cuenta: |V| y |A| con su fórmula y sus números.
    function crearCuenta(paso) {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'coloreo-formula';
      const n1 = paso.g1.vertices.length;
      const n2 = paso.g2.vertices.length;
      const c = paso.cuenta;
      for (const [texto, clase] of [
        [`|V| = |V₁| · |V₂| = ${n1} · ${n2} = ${n1 * n2}`, ''],
        [`|A| = ${c.formula} = ${c.numeros} = ${c.valor}`, 'coloreo-formula__resultado']
      ]) {
        const p = document.createElement('p');
        p.textContent = texto;
        if (clase) p.className = clase;
        tarjeta.appendChild(p);
      }
      return tarjeta;
    }

    function renderizarOperacion(paso) {
      dom.estructuraEl.className = 'estructura-grafo';
      dom.estructuraEl.removeAttribute('style');
      dom.estructuraEl.innerHTML = '';
      const operandos = paso && paso.resultado ? paso : operandosDeLaEstructura();
      if (!operandos) return;
      dom.estructuraEl.appendChild(crearOperandos(operandos, paso && paso.usa));
      if (paso && paso.resultado) {
        const columna = document.createElement('div');
        columna.className = 'estructura-grafo__columna';
        columna.appendChild(crearResultado(paso));
        if (paso.cuenta) columna.appendChild(crearCuenta(paso));
        dom.estructuraEl.appendChild(columna);
      }
      ajustarGrafo();
    }

    function renderizarGrafo(paso) {
      if (config.operaciones) {
        renderizarOperacion(paso);
        return;
      }
      const grafo = grafoDeLaEstructura();
      dom.estructuraEl.className = 'estructura-grafo';
      dom.estructuraEl.removeAttribute('style');
      dom.estructuraEl.innerHTML = '';
      if (!grafo) return;
      if (config.coloreado) {
        dom.estructuraEl.appendChild(crearGrafo(grafo, paso));
        if (paso && paso.tabla) {
          const columna = document.createElement('div');
          columna.className = 'estructura-grafo__columna';
          if (paso.modo === MODOS_COLOREADO.POLINOMIO) {
            columna.appendChild(crearTablaDelPolinomio(paso));
            if (paso.polinomio) columna.appendChild(crearFormula(paso.polinomio));
          } else {
            columna.appendChild(crearTablaDeColoreo(paso));
          }
          dom.estructuraEl.appendChild(columna);
        }
        ajustarGrafo();
        return;
      }
      if (config.representacionDe) {
        const r = paso && paso.representacion ? paso.representacion : config.representacionDe(estado.estructura, grafo);
        dom.estructuraEl.appendChild(crearGrafo(grafo, paso));
        const columna = document.createElement('div');
        columna.className = 'estructura-grafo__columna';
        columna.append(crearMatrizRepresentacion(r, paso), crearEstructuraDeAdyacencia(r, paso));
        dom.estructuraEl.appendChild(columna);
        ajustarGrafo();
        return;
      }
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
    // **El panel del cálculo se puede soltar donde el tema lo declara**
    // (`calculoPrescindible`, la representación matricial): ahí repite lo
    // que ya dice el aviso, y en una ventana chica —un proyector XGA— se
    // llevaba la mitad del ancho y la matriz no cabía ni a la mitad. Si con
    // él la estructura quedaría por debajo de `ENCOGIMIENTO_SIN_CALCULO`, se
    // oculta. En Floyd no: su panel tiene las comparaciones.
    const ENCOGIMIENTO_SIN_CALCULO = 0.8;
    function ajustarGrafo() {
      const caja = dom.estructuraEl;
      if (!caja.isConnected || !caja.firstChild) return;
      if (dom.escenario) dom.escenario.classList.remove('lienzo__escenario--sin-calculo');
      const factor = encajar(caja);
      if (config.calculoPrescindible && dom.escenario && factor < ENCOGIMIENTO_SIN_CALCULO) {
        dom.escenario.classList.add('lienzo__escenario--sin-calculo');
        encajar(caja);
      }
    }

    function encajar(caja) {
      caja.style.zoom = '';
      const cabe = () => Math.min(1, caja.clientWidth / caja.scrollWidth, caja.clientHeight / caja.scrollHeight);
      // Las disposiciones que se prueban. La representación suma una: la
      // matriz y su estructura una al lado de la otra, en vez de una encima
      // de la otra —con la adyacencia de aristas son doce filas de alto, y en
      // un proyector XGA no cabían ni a la mitad—.
      const disposiciones = ['', 'estructura-grafo--apilada']
        .concat(config.representacionDe || config.coloreado || config.operaciones ? ['estructura-grafo--extendida'] : []);
      const quitarTodas = () => disposiciones.forEach((clase) => clase && caja.classList.remove(clase));
      let mejor = { clase: '', cabe: -1 };
      for (const clase of disposiciones) {
        quitarTodas();
        if (clase) caja.classList.add(clase);
        const medida = cabe();
        if (medida > mejor.cabe + 0.001) mejor = { clase, cabe: medida };
      }
      quitarTodas();
      if (mejor.clase) caja.classList.add(mejor.clase);
      let factor = Math.max(ENCOGIMIENTO_MINIMO, mejor.cabe);
      if (factor < 1) caja.style.zoom = String(factor);
      // Encogida, deja sitio que el panel del cálculo —flexible como ella—
      // toma, y lo que le queda vuelve a ser menos: se mide otra vez y se
      // achica lo que falte, como el árbol (`ajustarArbol`). Con un margen,
      // porque el zoom redondea y dejaba 2 o 3 px de sobra.
      for (let intento = 0; intento < 5 && factor > ENCOGIMIENTO_MINIMO; intento++) {
        if (caja.scrollWidth <= caja.clientWidth + 1 && caja.scrollHeight <= caja.clientHeight + 1) break;
        const sobra = Math.min(caja.clientWidth / caja.scrollWidth, caja.clientHeight / caja.scrollHeight);
        factor = Math.max(ENCOGIMIENTO_MINIMO, factor * sobra * 0.98);
        caja.style.zoom = String(factor);
      }
      return factor;
    }

    // **El grafo se ve mientras se escribe** (maqueta D, 2026-10-22): antes de
    // crearlo, el lienzo dibuja lo que hay en el formulario, si se lee.
    function renderizarVistaPrevia(grafo) {
      dom.estructuraEl.className = 'estructura-grafo estructura-grafo--previa';
      dom.estructuraEl.removeAttribute('style');
      dom.estructuraEl.innerHTML = '';
      // En las operaciones, la vista previa son los dos operandos.
      dom.estructuraEl.appendChild(config.operaciones ? crearOperandos(grafo, null) : crearGrafo(grafo, null));
      ajustarGrafo();
    }

    return { ajustarGrafo, esGrafo, renderizarGrafo, renderizarVistaPrevia };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.grafo = crearDibujoGrafo;
})();
