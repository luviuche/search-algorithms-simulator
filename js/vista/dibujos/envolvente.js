(function () {
  // El plano de las envolventes convexas (CLAUDE.md 5.21): los puntos en sus
  // coordenadas, con la misma escala en x y en y —las distancias y el área se
  // leen del dibujo—, y al lado los conjuntos escritos.
  //
  // Cada punto es un círculo con su nombre, como en las hojas; si dos quedan
  // muy juntos, todos pasan a ser un punto con el nombre al lado.
  function crearEnvolventes({ svg, crearConjuntos }) {
    const ANCHO = 460;
    const ALTO = 360;
    const MARGEN = 36;
    const RADIO = 15;

    function crearPlano(puntos, paso) {
      const xs = puntos.map((p) => p.x);
      const ys = puntos.map((p) => p.y);
      const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
      const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
      const escala = Math.min(ANCHO / (x1 - x0 || 1), ALTO / (y1 - y0 || 1));
      const ancho = (x1 - x0) * escala + 2 * MARGEN;
      const alto = (y1 - y0) * escala + 2 * MARGEN;
      const X = (x) => MARGEN + (x - x0) * escala;
      const Y = (y) => alto - MARGEN - (y - y0) * escala;
      const dibujo = svg('svg', {
        class: 'grafo grafo--plano', width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}`,
        role: 'img', 'aria-label': `Plano con ${puntos.length} puntos`
      });
      // Los ejes, si pasan por entre los puntos.
      if (x0 <= 0 && x1 >= 0) svg('line', { x1: X(0), y1: 0, x2: X(0), y2: alto, class: 'envolvente__eje' }, dibujo);
      if (y0 <= 0 && y1 >= 0) svg('line', { x1: 0, y1: Y(0), x2: ancho, y2: Y(0), class: 'envolvente__eje' }, dibujo);
      if (paso && paso.vertical !== null) {
        svg('line', { x1: X(paso.vertical), y1: 0, x2: X(paso.vertical), y2: alto, class: 'envolvente__division' }, dibujo);
      }
      const lineas = svg('g', { class: 'grafo__aristas' }, dibujo);
      // Lo descartado debajo, lo que se mira encima.
      const altura = { descartada: 0, rango: 1, encontrada: 2, evaluacion: 3 };
      for (const s of ((paso && paso.segmentos) || []).slice().sort((p, q) => altura[p.clase] - altura[q.clase])) {
        svg('path', {
          d: `M${X(s.a.x)},${Y(s.a.y)} L${X(s.b.x)},${Y(s.b.y)}`,
          class: `grafo__arista grafo__arista--${s.clase}`, 'data-lado': `${s.a.nombre}–${s.b.nombre}`
        }, lineas);
      }
      const cerca = puntos.some((p, i) => puntos.slice(i + 1).some((q) => Math.hypot(p.x - q.x, p.y - q.y) * escala < 2 * RADIO + 4));
      const nodos = svg('g', { class: 'grafo__vertices' }, dibujo);
      for (const p of puntos) {
        const estado = paso && paso.estados[p.nombre];
        const grupo = svg('g', {
          class: 'grafo__vertice envolvente__punto' + (cerca ? ' envolvente__punto--chico' : '') + (estado ? ` grafo__vertice--${estado}` : ''),
          'data-vertice': p.nombre
        }, nodos);
        svg('title', {}, grupo).textContent = `${p.nombre} (${p.x}, ${p.y})`;
        svg('circle', { cx: X(p.x), cy: Y(p.y), r: cerca ? 5 : RADIO }, grupo);
        svg('text', {
          x: X(p.x), y: Y(p.y) - (cerca ? 14 : 0), 'text-anchor': 'middle', 'dominant-baseline': 'central'
        }, grupo).textContent = p.nombre;
      }
      return dibujo;
    }

    function crearMedidas(medidas) {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'coloreo-formula envolvente-medidas';
      for (const [nombre, valor] of medidas) {
        const p = document.createElement('p');
        const el = document.createElement('span');
        el.textContent = `${nombre}: `;
        p.append(el, valor);
        tarjeta.appendChild(p);
      }
      return tarjeta;
    }

    function llenar(caja, puntos, paso) {
      const delPaso = paso && paso.envolvente ? paso : null;
      caja.appendChild(crearPlano(puntos, delPaso));
      if (!delPaso) return;
      const columna = document.createElement('div');
      columna.className = 'estructura-grafo__columna';
      columna.appendChild(crearConjuntos(delPaso));
      if (delPaso.medidas) columna.appendChild(crearMedidas(delPaso.medidas));
      caja.appendChild(columna);
    }

    return { llenar };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.envolventes = crearEnvolventes;
})();
