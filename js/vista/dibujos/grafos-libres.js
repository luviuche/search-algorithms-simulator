(function () {
  const dominio = window.CC2.dominio;
  const algoritmos = window.CC2.algoritmos;

  // Los dibujos de las operaciones que no son productos (CLAUDE.md 5.15 y
  // 5.19): dos grafos que comparten vértices, y un grafo con su transformado.
  //
  // **Cada vértice va en el mismo sitio en todos los dibujos**: el 2 de G₁,
  // el de G₂ y el del resultado están en el mismo punto de su figura, y así
  // se ve sin leer qué entró, qué se quitó y qué era común.
  //
  // Las piezas de SVG son las de `grafo.js`, que las pasa al crear este.
  function crearGrafosLibres({ svg, trazoEntre, abarcarCurvas, posiciones }) {
    const { COMBINACIONES } = dominio.combinaciones;
    const mismos = dominio.transformaciones.mismos;
    const clave = (arista) => arista.slice().sort().join('|');
    const SOBRE = 18;

    // Un grafo en posiciones dadas. `aristas`: [{ extremos, clase }], en el
    // orden en que se pintan; `claseVertice(v)`: su estado o ''.
    function crear({ titulo, lugares, vertices, aristas, claseVertice = () => '', radio = 20, clase = '' }) {
      const { mapa, centro } = lugares;
      const ancho = lugares.ancho;
      const alto = lugares.alto + SOBRE;
      const en = (v) => ({ x: mapa.get(v).x, y: mapa.get(v).y + SOBRE });
      const dibujo = svg('svg', {
        class: `grafo ${clase}`, width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}`,
        role: 'img', 'aria-label': `${titulo}: ${vertices.length} vértices, ${aristas.length} aristas`
      });
      svg('text', { x: 4, y: 16, class: 'grafo__titulo' }, dibujo).textContent = titulo;
      const puntos = vertices.map(en);
      const lineas = svg('g', { class: 'grafo__aristas' }, dibujo);
      const picos = [];
      for (const { extremos: [u, v], clase: deArista } of aristas) {
        const a = puntos[vertices.indexOf(u)];
        const b = puntos[vertices.indexOf(v)];
        const { d, pico } = trazoEntre(a, b, puntos, { x: centro.x, y: centro.y + SOBRE }, radio + 1);
        if (pico) picos.push(pico);
        svg('path', { d, class: 'grafo__arista' + (deArista ? ` grafo__arista--${deArista}` : ''), 'data-arista': `${u}–${v}` }, lineas);
      }
      abarcarCurvas(dibujo, ancho, alto, picos);
      const nodos = svg('g', { class: 'grafo__vertices' }, dibujo);
      vertices.forEach((v, i) => {
        const { x, y } = puntos[i];
        const estado = claseVertice(v);
        const grupo = svg('g', { class: 'grafo__vertice' + (estado ? ` grafo__vertice--${estado}` : ''), 'data-vertice': v }, nodos);
        // El vértice fundido, «10,12», no cabe en el círculo: va en pastilla.
        if (v.length > 2) {
          const medio = Math.max(radio + 4, 10 + 5.5 * v.length);
          svg('rect', { x: x - medio, y: y - radio, width: 2 * medio, height: 2 * radio, rx: radio }, grupo);
        } else {
          svg('circle', { cx: x, cy: y, r: radio }, grupo);
        }
        svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, grupo).textContent = v;
      });
      return dibujo;
    }

    // Las mismas posiciones, más juntas: los operandos van chicos.
    function encoger(lugares, escala, margen = 28) {
      const puntos = [...lugares.mapa.values()];
      const x0 = Math.min(...puntos.map((p) => p.x));
      const y0 = Math.min(...puntos.map((p) => p.y));
      const pasar = (p) => ({ x: margen + (p.x - x0) * escala, y: margen + (p.y - y0) * escala });
      const mapa = new Map([...lugares.mapa].map(([v, p]) => [v, pasar(p)]));
      const nuevos = [...mapa.values()];
      return {
        mapa,
        centro: pasar(lugares.centro),
        ancho: Math.max(...nuevos.map((p) => p.x)) + margen,
        alto: Math.max(...nuevos.map((p) => p.y)) + margen
      };
    }

    // ── Dos grafos ───────────────────────────────────────────────────────

    // En la suma, V₁ a la izquierda y V₂ a la derecha: así se ve que cada uno
    // de un lado se une con todos los del otro. En las demás, donde el dibujo
    // de grafos pone V₁ ∪ V₂.
    function lugaresDe(g1, g2, operacion) {
      if (operacion !== COMBINACIONES.SUMA || !g1 || !g2) {
        const vacio = { vertices: [] };
        return posiciones(dominio.combinaciones.reunir(g1 || vacio, g2 || vacio));
      }
      const radio = 70 + Math.max(g1.vertices.length, g2.vertices.length) * 16;
      const margen = 40;
      const c = margen + radio;
      const mapa = new Map();
      const arco = (vertices, medio, sentido) => vertices.forEach((v, i) => {
        const n = vertices.length;
        // Abierto lo bastante para que una arista entre dos no pase sobre el
        // de en medio.
        const abre = Math.min(150, 45 * (n - 1)) * (Math.PI / 180);
        const angulo = medio + (n === 1 ? 0 : sentido * (i / (n - 1) - 0.5) * abre);
        mapa.set(v, { x: c + radio * Math.cos(angulo), y: c + radio * Math.sin(angulo) });
      });
      arco(g1.vertices, Math.PI, -1);
      arco(g2.vertices, 0, 1);
      // Cerrado a lo alto que de verdad ocupan los arcos.
      return encoger({ mapa, centro: { x: c, y: c } }, 1, margen);
    }

    const SIGNOS = {
      [COMBINACIONES.UNION]: '∪', [COMBINACIONES.INTERSECCION]: '∩', [COMBINACIONES.DIFERENCIA]: '−',
      [COMBINACIONES.SUMA_ANILLO]: '⊕', [COMBINACIONES.SUMA]: '+'
    };

    function crearOperandos({ g1, g2, operacion }, paso) {
      const todos = lugaresDe(g1, g2, operacion);
      // En la suma no hay vértices que emparejar: cada operando, a su tamaño.
      const lugaresDel = (grafo) => encoger(operacion === COMBINACIONES.SUMA
        ? { ...todos, mapa: new Map(grafo.vertices.map((v) => [v, todos.mapa.get(v)])) }
        // Con muchos vértices el círculo ya va cerrado: se encoge menos.
        : todos, todos.mapa.size > 7 ? 0.75 : 0.6);
      const caja = document.createElement('div');
      caja.className = 'operacion-grafos__operandos';
      const enComun = g1 && g2
        ? new Set(dominio.combinaciones.combinar(g1, g2, COMBINACIONES.INTERSECCION).aristas.map((x) => clave(x.arista)))
        : new Set();
      const operando = (grafo, nombre, cual) => {
        const usa = paso && paso.usa && paso.usa[cual];
        const usadas = new Set(usa ? usa.aristas.map(clave) : []);
        return crear({
          titulo: nombre,
          lugares: lugaresDel(grafo),
          vertices: grafo.vertices,
          radio: 17,
          clase: 'grafo--operando',
          claseVertice: (v) => (usa && usa.vertices.includes(v) ? 'rango' : ''),
          aristas: grafo.aristas.map((extremos) => ({
            extremos,
            clase: usadas.has(clave(extremos)) ? 'evaluacion'
              : paso && paso.cuenta ? `de-${enComun.has(clave(extremos)) ? 'ambos' : cual}` : ''
          }))
        });
      };
      const signo = document.createElement('span');
      signo.className = 'operacion-grafos__simbolo';
      signo.textContent = SIGNOS[operacion] || '';
      if (g1) caja.appendChild(operando(g1, 'G₁', 'g1'));
      caja.appendChild(signo);
      if (g2) caja.appendChild(operando(g2, 'G₂', 'g2'));
      return caja;
    }

    function crearCombinacion(paso) {
      const { vertices, aristas } = paso.resultado;
      const puestas = aristas.slice(0, paso.hechas).map(({ arista, origen }, i) => ({
        extremos: arista,
        clase: paso.cuenta ? `de-${origen}` : i >= paso.nuevasDesde ? 'evaluacion' : ''
      }));
      if (paso.noEntra && paso.noEntra.every((v) => vertices.includes(v))) puestas.unshift({ extremos: paso.noEntra, clase: 'descartada' });
      return crear({
        titulo: algoritmos.combinaciones.SIMBOLOS[paso.operacion],
        lugares: lugaresDe(paso.g1, paso.g2, paso.operacion),
        vertices,
        aristas: puestas,
        clase: 'grafo--resultado',
        claseVertice: (v) => (paso.verticesNuevos.includes(v) ? 'evaluacion' : '')
      });
    }

    const ORIGENES = [
      ['g1', 'Solo de G₁'], ['g2', 'Solo de G₂'], ['ambos', 'De los dos'], ['nueva', 'Nuevas: V₁ con V₂']
    ];
    function crearLeyenda(paso) {
      const leyenda = document.createElement('p');
      leyenda.className = 'operacion-grafos__leyenda';
      for (const [origen, texto] of ORIGENES) {
        if (!paso.resultado.aristas.some((x) => x.origen === origen)) continue;
        const item = document.createElement('span');
        const muestra = svg('svg', { width: 34, height: 10, 'aria-hidden': 'true' });
        svg('path', { d: 'M2,5 L32,5', class: `grafo__arista grafo__arista--de-${origen}` }, muestra);
        item.append(muestra, texto);
        leyenda.appendChild(item);
      }
      return leyenda;
    }

    // Los conjuntos escritos, con lo que el paso mira resaltado.
    function crearConjuntos(paso) {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'operacion-conjuntos';
      for (const { etiqueta, elementos, actuales } of paso.conjuntos) {
        const nombre = document.createElement('span');
        nombre.className = 'operacion-conjuntos__nombre';
        nombre.textContent = `${etiqueta} =`;
        const lista = document.createElement('span');
        lista.className = 'operacion-conjuntos__lista';
        lista.append(elementos.length ? '{' : '∅');
        elementos.forEach((elemento, i) => {
          const el = document.createElement('span');
          el.className = 'operacion-conjuntos__elemento' + (actuales.includes(elemento) ? ' operacion-conjuntos__elemento--actual' : '');
          el.textContent = elemento;
          lista.append(el, i < elementos.length - 1 ? ', ' : '');
        });
        if (elementos.length) lista.append('}');
        tarjeta.append(nombre, lista);
      }
      return tarjeta;
    }

    // |V| y |A| con su fórmula y sus números.
    function crearCuenta(cuenta, v = '|V|', a = '|A|') {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'coloreo-formula';
      for (const [nombre, c, clase] of [[v, cuenta.vertices, ''], [a, cuenta.aristas, 'coloreo-formula__resultado']]) {
        const p = document.createElement('p');
        p.className = clase;
        p.textContent = `${nombre} = ${c.formula}${c.numeros && c.numeros !== String(c.valor) ? ` = ${c.numeros}` : ''} = ${c.valor}`;
        tarjeta.appendChild(p);
      }
      return tarjeta;
    }

    function llenarCombinacion(caja, operandos, paso) {
      caja.appendChild(crearOperandos(operandos, paso));
      if (!paso || !paso.combinacion) return;
      const columna = document.createElement('div');
      columna.className = 'estructura-grafo__columna';
      const resultado = document.createElement('div');
      resultado.className = 'operacion-resultado';
      resultado.appendChild(crearCombinacion(paso));
      if (paso.cuenta) resultado.appendChild(crearLeyenda(paso));
      const texto = document.createElement('div');
      texto.className = 'operacion-resultado';
      texto.appendChild(crearConjuntos(paso));
      if (paso.cuenta) texto.appendChild(crearCuenta(paso.cuenta));
      columna.append(resultado, texto);
      caja.appendChild(columna);
    }

    // ── Un solo grafo ────────────────────────────────────────────────────

    function lugaresDeUno(paso) {
      const lugares = posiciones(paso.universo);
      if (paso.fundido) {
        const [a, b] = paso.fundido.de.map((v) => lugares.mapa.get(v));
        lugares.mapa.set(paso.fundido.nombre, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
      return lugares;
    }

    function crearUno(titulo, grafo, marcas, lugares) {
      const estadoDe = (extremos) => {
        const marca = marcas.aristas.find((m) => mismos(m, extremos));
        return marca ? marca[2] : '';
      };
      const aristas = grafo.aristas.map((extremos) => ({ extremos, clase: estadoDe(extremos) }));
      // Las que ya no están pero el paso nombra: la que se acaba de borrar.
      const idas = marcas.aristas.filter((m) => m[2] === 'descartada'
        && !grafo.aristas.some((a) => mismos(a, m)) && grafo.vertices.includes(m[0]) && grafo.vertices.includes(m[1]))
        .map(([u, v, clase]) => ({ extremos: [u, v], clase }));
      return crear({ titulo, lugares, vertices: grafo.vertices, aristas: idas.concat(aristas), claseVertice: (v) => marcas.vertices[v] || '' });
    }

    function llenarTransformacion(caja, grafo, paso) {
      const sinMarcas = { vertices: {}, aristas: [] };
      if (!paso || !paso.transformacion) {
        caja.appendChild(crearUno('G', grafo, sinMarcas, posiciones(grafo.vertices)));
        return;
      }
      const lugares = lugaresDeUno(paso);
      caja.appendChild(crearUno('G', paso.g, paso.marcas.g, lugares));
      const flecha = document.createElement('span');
      flecha.className = 'operacion-grafos__simbolo operacion-grafos__flecha';
      flecha.textContent = '→';
      caja.appendChild(flecha);
      const columna = document.createElement('div');
      columna.className = 'estructura-grafo__columna';
      const resultado = crearUno(`G′ = ${paso.nombreResultado}`, paso.parcial, paso.marcas.r, lugares);
      resultado.classList.add('grafo--resultado');
      columna.appendChild(resultado);
      if (paso.cuenta) columna.appendChild(crearCuenta(paso.cuenta, '|V′|', '|A′|'));
      caja.appendChild(columna);
    }

    return { llenarCombinacion, llenarTransformacion };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.grafosLibres = crearGrafosLibres;
})();
