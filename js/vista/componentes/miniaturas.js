(function () {
  // Las miniaturas de los bloques del menú (CLAUDE.md 4): cada una dibuja la
  // estructura que se estudia, con su estado típico —lo descartado apagado, lo
  // que se mira en naranja, lo hallado en verde—. Los colores son los de los
  // estados del algoritmo (CLAUDE.md 8.2): aquí significan lo mismo.
  //
  // `k` es el orden en que se recorren al pasar el mouse (ver `recorrer`).
  const paso = (k) => (k ? ` data-k="${k}"` : '');
  const T = (x, y, t, c = '', k) => `<text x="${x}" y="${y}" class="${c}"${paso(k)}>${t}</text>`;
  const L = (x1, y1, x2, y2, c = '', k) => `<path d="M${x1},${y1}L${x2},${y2}" class="linea ${c}"${paso(k)}/>`;
  const P = (d, c = '', k) => `<path d="${d}" class="linea ${c}"${paso(k)}/>`;
  const C = (x, y, w, h, t = '', c = '', k) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="forma ${c}"${paso(k)}/>` + (t === '' ? '' : T(x + w / 2, y + h / 2 + 1, t, c.includes('apagada') ? 'apagada' : ''));
  const N = (x, y, t = '', c = '', k, r = 16) => `<circle cx="${x}" cy="${y}" r="${r}" class="opaca"/><circle cx="${x}" cy="${y}" r="${r}" class="forma ${c}"${paso(k)}/>` + (t === '' ? '' : T(x, y + 1, t));
  const peso = (x, y, t) => `<circle cx="${x}" cy="${y}" r="10" class="opaca"/>` + T(x, y + 1, t, 'rot');
  // Grafo: vértices {nombre:[x,y]}, aristas [a, b, peso, clase, k].
  function grafo(v, aristas, clases = {}, r = 16) {
    let s = '';
    for (const [a, b, , c, k] of aristas) s += L(...v[a], ...v[b], c || '', k);
    for (const [a, b, p] of aristas) if (p !== undefined && p !== '') s += peso((v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, p);
    for (const n of Object.keys(v)) {
      const [c, k, rotulo] = clases[n] || [];
      s += N(...v[n], rotulo === undefined ? n.replace(/_.*/, '') : rotulo, c || '', k, r);
    }
    return s;
  }
  const flecha = (x1, y, x2, c = '', k) => P(`M${x1},${y}H${x2}M${x2 - 8},${y - 6}L${x2},${y}L${x2 - 8},${y + 6}`, c, k);
  const abajo = (x, y1, y2, c = '', k) => P(`M${x},${y1}V${y2}M${x - 6},${y2 - 8}L${x},${y2}L${x + 6},${y2 - 8}`, c, k);

  // Las casillas van pegadas, como en la pantalla de trabajo (2026-11-25).
  const centro = (i, cuantas, w) => 160 - (cuantas * w) / 2 + i * w + w / 2;
  const arreglo = (claves, y, w, h, clases = {}, x0) => claves.map((t, i) => {
    const x = (x0 === undefined ? 160 - (claves.length * w) / 2 : x0) + i * w;
    const [c, k] = clases[i] || [];
    return C(x, y, w, h, t, c || '', k);
  }).join('');

  const E = {};

  // ---- Módulos ----
  E.busquedas = () => {
    const claves = [12, 25, 31, 47, 58, 63];
    return claves.map((_, i) => T(centro(i, 6, 45), 42, i + 1, 'rot')).join('')
      + arreglo(claves, 56, 45, 48, { 0: ['apagada', 1], 1: ['apagada', 2], 2: ['apagada', 3] })
      + P('M213,112 L250,160', 'hall', 4) + '<path d="M222,124L250,160" stroke="var(--estado-encontrada-borde)" stroke-width="10"/>'
      + '<circle cx="185" cy="80" r="46" class="opaca"/><circle cx="185" cy="80" r="46" class="forma hall" data-k="4"/>' + T(185, 82, '47', 'gra');
  };
  E.grafos = () => grafo(
    { A: [34, 96], B: [106, 34], C: [112, 144], D: [196, 88], E: [246, 32], F: [282, 130] },
    [['A', 'B', 4], ['A', 'C', 2, 'hall', 1], ['B', 'C', 6], ['B', 'D', 7], ['C', 'D', 3, 'hall', 2], ['D', 'E', 5], ['D', 'F', 1, 'hall', 3], ['E', 'F', 8], ['B', 'E', 9]],
    { A: ['hall', 1], C: ['hall', 1], D: ['hall', 2], F: ['hall', 3] }, 18);

  // ---- Búsquedas ----
  E.internas = () => '<rect x="22" y="26" width="276" height="128" rx="10" class="linea"/>'
    + [58, 92, 126, 160, 194, 228, 262].map((x) => L(x, 14, x, 26) + L(x, 154, x, 166)).join('')
    + T(160, 48, 'memoria', 'rot')
    + arreglo([8, 15, 23, 42, 57], 68, 42, 42, { 0: ['apagada', 1], 1: ['apagada', 2], 2: ['hall', 3] })
    + [1, 2, 3, 4, 5].map((t, i) => T(centro(i, 5, 42), 126, t, 'rot')).join('');
  E.externas = () => {
    let s = '<path d="M20,40a46,15 0 0 1 92,0v100a46,15 0 0 1 -92,0z" class="forma"/><path d="M20,40a46,15 0 0 0 92,0M20,74a46,15 0 0 0 92,0M20,107a46,15 0 0 0 92,0" class="linea"/>';
    s += flecha(122, 90, 160, 'eval', 1);
    [[0, 'apagada'], [1, 'eval'], [2, '']].forEach(([i, c]) => {
      for (let j = 0; j < 4; j++) s += C(181 + j * 29, 30 + i * 49, 29, 34, '', j === 2 && i === 1 ? 'hall' : c, i + 1 + (j === 2 && i === 1 ? 1 : 0));
    });
    return s + T(177 + 62, 16, 'bloques', 'rot');
  };
  E.lineal = () => {
    const claves = [58, 12, 31, 47, 25, 63];
    return arreglo(claves, 74, 44, 44, { 0: ['apagada', 1], 1: ['apagada', 2], 2: ['apagada', 3], 3: ['hall', 4] })
      + claves.map((_, i) => T(centro(i, 6, 44), 134, i + 1, 'rot')).join('')
      + P('M50,62 q22,-34 44,0 q22,-34 44,0 q22,-34 44,0 M174,53 L182,62 L187,50') + T(182, 28, '47', 'hall');
  };
  E.binaria = () => {
    const c = ['05', 12, 23, 31, 47, 58, 63];
    const fila = (y, cl) => arreglo(c, y, 36, 34, cl);
    return fila(18, { 3: ['eval', 1] })
      + fila(72, { 0: ['apagada', 2], 1: ['apagada', 2], 2: ['apagada', 2], 3: ['apagada', 2], 5: ['eval', 2] })
      + fila(126, { 0: ['apagada', 3], 1: ['apagada', 3], 2: ['apagada', 3], 3: ['apagada', 3], 4: ['hall', 4], 5: ['apagada', 3], 6: ['apagada', 3] });
  };
  E.transformacion = () => {
    let s = C(14, 70, 56, 40, '31') + flecha(76, 90, 100, 'eval', 1)
      + '<rect x="106" y="62" width="92" height="56" rx="8" class="forma eval" data-k="2"/>' + T(152, 82, '31 mod 7') + T(152, 101, '+ 1 = 4', 'rot')
      + flecha(204, 90, 228, 'eval', 3);
    for (let i = 0; i < 7; i++) s += C(254, 20 + i * 20, 52, 20, i === 3 ? '31' : { 0: '28', 5: '12' }[i] || '', i === 3 ? 'hall' : i === 0 || i === 5 ? '' : 'vacia', i === 3 ? 4 : 0) + T(242, 31 + i * 20, i + 1, 'rot');
    return s;
  };
  const arbol = (v, aristas, clases, r = 15) => {
    let s = '';
    for (const [a, b, t, c, k] of aristas) {
      s += L(...v[a], ...v[b], c || '', k);
      if (t !== undefined) { const doble = String(t).length > 1; const f = doble ? .62 : .5; const dx = (v[b][0] < v[a][0] ? -1 : 1) * (doble ? 16 : 11); s += T(v[a][0] + (v[b][0] - v[a][0]) * f + dx, v[a][1] + (v[b][1] - v[a][1]) * f - 5, t, 'rot'); }
    }
    for (const n of Object.keys(v)) { const [c, k, t, rr] = (clases && clases[n]) || []; s += N(...v[n], t === undefined ? n : t, c || '', k, rr || r); }
    return s;
  };
  const CHICO = ['', 0, '', 6];
  E.residuo = () => arbol({ x: [160, 22], y: [92, 66], z: [228, 66], w: [52, 112], H: [128, 112], S: [194, 112], X: [264, 112], A: [26, 158], E: [82, 158] },
    [['x', 'y', 0, 'eval', 1], ['x', 'z', 1], ['y', 'w', 0, 'eval', 2], ['y', 'H', 1], ['z', 'S', 0], ['z', 'X', 1], ['w', 'A', 0], ['w', 'E', 1, 'eval', 3]],
    { x: CHICO, y: CHICO, z: CHICO, w: CHICO, E: ['hall', 4] });
  E['arbol-digital'] = () => arbol({ A: [160, 28], E: [92, 84], S: [228, 84], H: [128, 144], R: [192, 144] },
    [['A', 'E', 0], ['A', 'S', 1, 'eval', 1], ['E', 'H', 1], ['S', 'R', 0, 'eval', 2]], { R: ['hall', 3] }, 18);
  E.residuos = () => arbol({ x: [176, 22], y: [112, 70], S: [244, 70], w: [66, 118], H: [158, 118], A: [34, 160], E: [98, 160] },
    [['x', 'y', 0, 'eval', 1], ['x', 'S', 1], ['y', 'w', 0, 'eval', 2], ['y', 'H', 1], ['w', 'A', 0], ['w', 'E', 1, 'eval', 3]],
    { x: CHICO, y: CHICO, w: CHICO, E: ['hall', 4] });
  E['residuos-multiples'] = () => arbol({ x: [160, 24], y: [56, 86], H: [128, 86], S: [196, 86], X: [264, 86], A: [26, 150], E: [92, 150] },
    [['x', 'y', '00', 'eval', 1], ['x', 'H', '01'], ['x', 'S', '10', '', 0], ['x', 'X', '11'], ['y', 'A', '00'], ['y', 'E', '10', 'eval', 2]],
    { x: CHICO, y: CHICO, E: ['hall', 3] });
  E.huffman = () => arbol({ r: [160, 26], A: [94, 84], q: [222, 84], B: [176, 146], C: [268, 146] },
    [['r', 'A', 0], ['r', 'q', 1, '', 0], ['q', 'B', 0], ['q', 'C', 1]],
    { r: ['hall', 3, '1', 18], q: ['eval', 2, '2/4', 22], A: ['', 0, 'A', 18], B: ['', 1, 'B', 18], C: ['', 1, 'C', 18] })
    + T(62, 86, '2/4', 'rot') + T(145, 148, '1/4', 'rot') + T(300, 148, '1/4', 'rot');
  const bloque = (x, y, cl, k, marcada) => [0, 1, 2, 3].map((j) => C(x + j * 21, y, 21, 26, '', j === marcada ? 'hall' : cl, j === marcada ? k + 1 : k)).join('');
  E['externa-secuencial'] = () => {
    let s = '';
    [['apagada', 1], ['apagada', 2], ['eval', 3], ['', 0]].forEach(([c, k], i) => { s += T(66, 31 + i * 40, `Bloque ${i + 1}`, 'rot') + bloque(124, 18 + i * 40, c, k, i === 2 ? 1 : -1); });
    return s + abajo(258, 24, 112, 'eval') + T(282, 66, '', 'rot');
  };
  E['externa-binaria'] = () => {
    let s = '';
    [['apagada', 2], ['apagada', 2], ['eval', 1], ['eval', 3], ['', 0]].forEach(([c, k], i) => { s += T(66, 22 + i * 34, `Bloque ${i + 1}`, 'rot') + bloque(124, 9 + i * 34, i === 2 ? 'eval' : c, k, i === 3 ? 2 : -1); });
    return s + P('M224,90 q34,17 0,34 M234,118 L223,124 L228,112', 'eval', 3);
  };
  E.indices = () => {
    let s = T(62, 16, 'índice', 'rot') + T(254, 16, 'datos', 'rot');
    ['01', '12', '23'].forEach((t, i) => {
      s += C(30, 58 + i * 24, 64, 24, t, i === 1 ? 'eval' : '', i === 1 ? 1 : 0);
      s += P(`M94,${70 + i * 24} C150,${70 + i * 24} 150,${47 + i * 52} 204,${47 + i * 52}`, i === 1 ? 'eval' : '', i === 1 ? 2 : 0);
      for (let j = 0; j < 4; j++) s += C(208 + j * 22, 30 + i * 52, 22, 34, '', i === 1 ? (j === 2 ? 'hall' : 'eval') : '', i === 1 ? 3 : 0);
    });
    return s;
  };
  E.cubetas = () => {
    let s = '';
    const cubeta = (x, claves, c, k) => [0, 1, 2].map((i) => { const t = claves[2 - i]; return C(x, 32 + i * 36, 40, 36, t === undefined ? '' : t, c || (t === undefined ? 'vacia' : ''), k); }).join('');
    s += cubeta(26, [14, 22]) + cubeta(66, [27, 31, 35], 'col', 1) + flecha(118, 86, 152, 'eval', 2);
    s += cubeta(170, [27]) + cubeta(210, [22, 31]) + cubeta(250, [14, 35]);
    return s + T(46, 20, 1, 'rot') + T(86, 20, 2, 'rot') + T(190, 20, 1, 'rot') + T(230, 20, 2, 'rot') + T(270, 20, 3, 'rot');
  };

  // ---- Grafos ----
  E.caminos = () => grafo({ P: [40, 52], Q: [40, 132], R: [126, 92], S: [204, 40], T: [204, 146], U: [284, 92] },
    [['P', 'Q', ''], ['P', 'R', '', 'hall', 1], ['Q', 'R', '', 'hall', 1], ['R', 'S', '', 'hall', 2], ['R', 'T', '', 'hall', 2], ['S', 'T', ''], ['S', 'U', '', 'hall', 3], ['T', 'U', '']],
    { P: ['', 0, ''], Q: ['', 0, ''], R: ['hall', 1, ''], S: ['', 0, ''], T: ['', 0, ''], U: ['', 0, ''] });
  E['grafos-floyd'] = () => grafo({ A: [32, 92], B: [116, 34], C: [116, 146], D: [208, 56], E: [288, 110] },
    [['A', 'B', 4], ['A', 'C', 2, 'hall', 1], ['C', 'B', 1, 'hall', 2], ['B', 'D', 5, 'hall', 3], ['C', 'D', 8], ['C', 'E', 10], ['D', 'E', 2, 'hall', 4]],
    { A: ['hall', 1], C: ['hall', 1], B: ['hall', 2], D: ['hall', 3], E: ['hall', 4] });
  E['grafos-expansion'] = () => grafo({ P: [42, 48], Q: [42, 134], R: [130, 92], S: [210, 36], T: [210, 148], U: [286, 92] },
    [['P', 'Q', 3, 'hall', 2], ['P', 'R', 4, 'hall', 4], ['Q', 'R', 6, 'apagada'], ['R', 'S', 2, 'hall', 1], ['R', 'T', 5, 'apagada'], ['S', 'T', 7, 'apagada'], ['S', 'U', 3, 'hall', 3], ['T', 'U', 4, 'hall', 5]]);
  const tri = (x, y) => ({ a: [x, y + 56], b: [x + 32, y], c: [x + 64, y + 56] });
  E.operaciones = () => {
    const v = { a: [66, 120], b: [108, 46], c: [160, 120], d: [212, 46], e: [256, 120] };
    return '<circle cx="116" cy="90" r="84" class="linea eval"/><circle cx="206" cy="90" r="84" class="linea dom2" style="stroke:var(--dominado-borde)"/>'
      + grafo(v, [['a', 'b', ''], ['b', 'c', ''], ['a', 'c', ''], ['c', 'd', ''], ['c', 'e', ''], ['d', 'e', '']], { a: ['eval', 1, ''], b: ['eval', 1, ''], c: ['hall', 3, ''], d: ['dom', 2, ''], e: ['dom', 2, ''] }, 13);
  };
  E['grafos-operaciones'] = () => {
    const g1 = { 1: [20, 118], 2: [48, 62], 3: [76, 118] };
    const g2 = { 2: [128, 62], 3: [156, 118], 4: [184, 62] };
    const g = { 1: [228, 118], 2: [252, 62], 3: [276, 118], 4: [300, 62] };
    const rosa = (a, b, k) => `<path d="M${a}L${b}" class="linea" style="stroke:var(--dominado-borde);stroke-width:3.5"${paso(k)}/>`;
    return rosa(g2[3], g2[4]) + rosa(g2[2], g2[4]) + rosa(g[3], g[4]) + rosa(g[2], g[4])
      + grafo(g1, [['1', '2', '', 'eval'], ['2', '3', '', 'eval']], {}, 12) + T(102, 92, '∪', 'gra') + grafo(g2, [], {}, 12) + T(208, 92, '=', 'gra')
      + grafo(g, [['1', '2', '', 'eval', 1], ['2', '3', '', 'eval', 1]], { 1: ['', 0], 2: ['hall', 2], 3: ['hall', 2] }, 12)
      + T(48, 148, 'G₁', 'rot') + T(156, 148, 'G₂', 'rot') + T(264, 148, 'G₁ ∪ G₂', 'rot');
  };
  E['grafos-transformaciones'] = () => grafo({ 1: [60, 56], 2: [60, 136], 3: [148, 96], 4: [236, 56] },
    [['1', '2', ''], ['1', '3', ''], ['2', '3', '', 'apagada'], ['3', '4', '']])
    + '<path d="M248,70L270,132" class="linea hall" data-k="2" stroke-dasharray="6 5"/>' + N(272, 138, '+', 'hall', 1, 18)
    + P('M96,108l16,16m0,-16l-16,16', 'eval', 3);
  E['grafos-matricial'] = () => {
    const v = { 1: [34, 46], 2: [100, 46], 3: [67, 100], 4: [67, 156] };
    const m = ['0110', '1010', '1101', '0010'];
    let s = grafo(v, [['1', '2', '', 'hall', 1], ['2', '3', ''], ['1', '3', ''], ['3', '4', '']], { 1: ['hall', 1], 2: ['hall', 1] }, 14);
    m.forEach((f, i) => {
      s += T(172, 48 + i * 32, i + 1, 'rot') + T(199 + i * 32, 18, i + 1, 'rot');
      [...f].forEach((t, j) => { const c = (i === 0 && j === 1) || (i === 1 && j === 0); s += `<rect x="${184 + j * 32}" y="${33 + i * 32}" width="30" height="30" rx="2" class="forma ${c ? 'hall' : t === '0' ? 'apagada' : ''}"${paso(c ? 2 : 0)}/>` + T(199 + j * 32, 49 + i * 32, t, t === '0' ? 'apagada' : ''); });
    });
    return s;
  };
  const pintar = (v, aristas, colores) => {
    let s = aristas.map(([a, b]) => L(...v[a], ...v[b])).join('');
    Object.keys(v).forEach((n) => { s += `<circle cx="${v[n][0]}" cy="${v[n][1]}" r="20" class="c${colores[n]}" stroke-width="2"/><text x="${v[n][0]}" y="${v[n][1] + 1}" class="blanco">${colores[n]}</text>`; });
    return s;
  };
  E.coloreados = () => pintar({ a: [160, 30], b: [66, 150], c: [254, 150], d: [160, 106] }, [['a', 'b'], ['b', 'c'], ['a', 'c'], ['a', 'd'], ['b', 'd'], ['c', 'd']], { a: 'R', b: 'N', c: 'A', d: 'V' });
  E['grafos-coloreado'] = () => pintar({ a: [160, 28], b: [248, 82], c: [214, 154], d: [106, 154], e: [72, 82] }, [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'a']], { a: 'R', b: 'N', c: 'R', d: 'N', e: 'A' });
  E['grafos-conjuntos'] = () => grafo({ 1: [62, 90], 2: [116, 34], 3: [204, 34], 4: [258, 90], 5: [204, 146], 6: [116, 146] },
    [['1', '2', ''], ['2', '3', ''], ['3', '4', ''], ['4', '5', ''], ['5', '6', ''], ['6', '1', '']],
    { 1: ['hall', 1], 4: ['hall', 3], 2: ['dom', 2], 6: ['dom', 2], 3: ['dom', 4], 5: ['dom', 4] }, 19);
  E['grafos-pareamientos'] = () => {
    const izq = [34, 90, 146].map((y) => [26, y]);
    const der = [34, 90, 146].map((y) => [106, y]);
    let s = L(...izq[0], ...der[1], 'hall', 1) + L(...izq[0], ...der[0]) + L(...izq[1], ...der[0], 'hall', 2) + L(...izq[1], ...der[2]) + L(...izq[2], ...der[2], 'hall', 3);
    izq.concat(der).forEach((p) => { s += N(...p, '', '', 0, 11); });
    const ext = [[176, 120], [196, 44], [252, 24], [302, 74], [282, 146], [222, 162]];
    s += `<path d="M${ext.map((p) => p.join(',')).join('L')}Z" class="linea hall" data-k="4"/>`;
    ext.forEach((p) => { s += N(...p, '', 'hall', 4, 6); });
    [[226, 86], [250, 112], [262, 66], [218, 128]].forEach((p) => { s += N(...p, '', '', 0, 5); });
    return s;
  };

  function crear(id) {
    const molde = document.createElement('template');
    molde.innerHTML = `<svg viewBox="0 0 320 180" class="miniatura" aria-hidden="true" focusable="false">${E[id] ? E[id]() : ''}</svg>`;
    return molde.content.firstElementChild;
  }

  const existe = (id) => Object.prototype.hasOwnProperty.call(E, id);

  // Recorre el dibujo una vez: lo que no ha llegado, en reposo; lo del paso,
  // en naranja. Solo cambia colores, nada se mueve, así que corre también con
  // el movimiento reducido.
  const MS_POR_PASO = 380;
  function recorrer(svg) {
    if (svg.dataset.recorriendo) return;
    const partes = [...svg.querySelectorAll('[data-k]')];
    if (partes.length === 0) return;
    const orden = (parte) => Number(parte.dataset.k);
    const ultimo = Math.max(...partes.map(orden));
    svg.dataset.recorriendo = 'si';
    svg.classList.add('miniatura--recorriendo');
    let k = 0;
    const avanzar = () => {
      for (const parte of partes) {
        parte.classList.toggle('espera', orden(parte) > k);
        parte.classList.toggle('actual', orden(parte) === k && k < ultimo);
      }
      k++;
      if (k <= ultimo) window.setTimeout(avanzar, MS_POR_PASO);
      else {
        svg.classList.remove('miniatura--recorriendo');
        delete svg.dataset.recorriendo;
      }
    };
    avanzar();
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.miniaturas = { crear, existe, recorrer };
})();
