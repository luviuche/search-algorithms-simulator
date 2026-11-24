(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const caminos = window.CC2.dominio.caminos;
  const { ALGORITMOS } = caminos;

  // Dijkstra y Bellman (CLAUDE.md 5.20): la traza, como en las notas del
  // docente. Cada paso lleva lo que el dibujo pone y nada que deshacer:
  //
  //   etiquetas  por vértice, lo escrito a su lado: { texto, clase }
  //   estados    por vértice, su color
  //   marcadas   por arista, su color
  //   tabla      { cabecera, filas: [{ vertice, celdas, actual }] }; una
  //              celda es texto o una lista de etiquetas, las cambiadas
  //              tachadas, como en la hoja
  //
  // Temporal en naranja y permanente en azul, como los escribe el docente; la
  // ruta mínima, en verde.

  const DIGITOS = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).replace(/\d/g, (d) => DIGITOS[d]);
  const valor = (d) => (Number.isFinite(d) ? String(d) : '∞');
  const flechas = (camino) => camino.join(' → ');
  const enLista = (lista) => (lista.length < 2 ? lista.join('') : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`);
  const conjunto = (lista) => (lista.length ? `{${lista.join(', ')}}` : '∅');

  const recorrer = (grafo, { algoritmo, inicio, fin }) => (algoritmo === ALGORITMOS.BELLMAN
    ? bellman(grafo, { inicio, fin })
    : dijkstra(grafo, { inicio, fin }));

  // El cierre de los dos: la ruta en verde y su distancia.
  function cierre({ grafo, comun, inicio, fin, predecesores, distancias, estados, mensajeInicial }) {
    const camino = caminos.ruta(predecesores, inicio, fin);
    const marcadas = {};
    const verdes = { ...estados };
    if (camino) {
      caminos.aristasDe(grafo, camino).forEach((a) => { marcadas[a.nombre] = 'encontrada'; });
      camino.forEach((v) => { verdes[v] = 'encontrada'; });
    }
    const pesos = camino ? caminos.aristasDe(grafo, camino).map((a) => a.peso) : [];
    const suma = pesos.length > 1 ? `${pesos.join(' + ')} = ` : '';
    return crearPaso(TIPOS_PASO.CONSTRUIDO, {
      ...comun,
      estados: verdes,
      marcadas,
      ruta: camino,
      inicio,
      fin,
      suma,
      distancia: distancias[fin],
      calculo: [camino
        ? { etiqueta: 'Ruta', expresion: flechas(camino), resultado: valor(distancias[fin]), activa: true }
        : { etiqueta: 'Ruta', expresion: `${inicio} → ${fin}`, resultado: 'no hay', activa: true }],
      mensaje: camino
        ? `${mensajeInicial} De ${inicio} a ${fin} el camino mínimo es ${flechas(camino)}, con distancia ${valor(distancias[fin])}.`
        : `${mensajeInicial} De ${inicio} no se llega a ${fin}: no hay camino.`
    });
  }

  // ── Dijkstra ─────────────────────────────────────────────────────────────

  function dijkstra(grafo, { inicio, fin }) {
    const { vertices } = grafo;
    const distancias = Object.fromEntries(vertices.map((v) => [v, Infinity]));
    const predecesores = {};
    // Todas las etiquetas que tuvo cada vértice, en orden: la última que no
    // está tachada es la que vale.
    const historia = Object.fromEntries(vertices.map((v) => [v, []]));
    const permanentes = [];
    const pasos = [];
    const texto = (v) => `[${valor(distancias[v])}, ${predecesores[v] === undefined || predecesores[v] === null ? '–' : predecesores[v]}]`;
    const temporales = () => vertices.filter((v) => !permanentes.includes(v) && Number.isFinite(distancias[v]));

    const comun = (actual, extra = {}) => ({
      caminos: true,
      algoritmo: ALGORITMOS.DIJKSTRA,
      fase: 'dijkstra',
      permanentes: permanentes.slice(),
      etiquetas: Object.fromEntries(vertices.filter((v) => Number.isFinite(distancias[v])).map((v) => [v, {
        texto: texto(v) + (permanentes.includes(v) ? '*' : ''),
        clase: permanentes.includes(v) ? 'permanente' : 'temporal'
      }])),
      estados: Object.fromEntries(permanentes.map((v) => [v, 'rango'])),
      marcadas: {},
      tabla: {
        cabecera: ['Vértice', 'Etiquetas [d, n]', 'Permanente'],
        filas: vertices.map((v) => ({
          vertice: v,
          actual: v === actual,
          celdas: [v, historia[v].length
            ? historia[v].map((e) => ({ ...e, clase: permanentes.includes(v) && !e.tachada ? 'permanente' : 'temporal' }))
            : '∞', permanentes.includes(v) ? `${permanentes.indexOf(v) + 1}.º` : '']
        }))
      },
      tituloCalculo: `Dijkstra desde ${inicio}`,
      ...extra
    });

    distancias[inicio] = 0;
    predecesores[inicio] = null;
    historia[inicio].push({ texto: '[0, –]' });
    permanentes.push(inicio);
    let base = comun(inicio);
    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...base,
      estados: { ...base.estados, [inicio]: 'evaluacion' },
      calculo: [{ etiqueta: inicio, expresion: 'inicio', resultado: '[0, –]*', activa: true }],
      mensaje: `${inicio} es el inicio: su etiqueta [0, –] es permanente, distancia 0 y sin predecesor.`
    }));

    let actual = inicio;
    for (;;) {
      // Desde el que se acaba de hacer permanente se miran sus vecinos.
      const lineas = [];
      const marcadas = {};
      const dichos = [];
      for (const { arista, hasta } of caminos.salidas(grafo, actual)) {
        const suma = distancias[actual] + arista.peso;
        const cuenta = `${valor(distancias[actual])} + ${arista.peso} = ${suma}`;
        if (permanentes.includes(hasta)) {
          lineas.push({ etiqueta: hasta, expresion: 'ya es permanente', resultado: '—', activa: false });
          continue;
        }
        marcadas[arista.nombre] = 'evaluacion';
        const antes = distancias[hasta];
        if (suma < antes) {
          distancias[hasta] = suma;
          predecesores[hasta] = actual;
          historia[hasta] = historia[hasta].map((e) => ({ ...e, tachada: true })).concat({ texto: `[${suma}, ${actual}]` });
          lineas.push({ etiqueta: hasta, expresion: `${cuenta} < ${valor(antes)}`, resultado: `[${suma}, ${actual}]`, activa: true });
          dichos.push(`${hasta} queda [${suma}, ${actual}]${Number.isFinite(antes) ? `, mejor que ${antes}` : ''}`);
        } else {
          historia[hasta] = historia[hasta].concat({ texto: `[${suma}, ${actual}]`, tachada: true });
          lineas.push({ etiqueta: hasta, expresion: `${cuenta} ${suma === antes ? '=' : '>'} ${valor(antes)}`, resultado: 'no cambia', activa: false });
          dichos.push(`${hasta} no cambia, ${suma} no es menor que ${antes}`);
        }
      }
      // La última que no está tachada es la que vale: las que no mejoraron se
      // escriben después, pero tachadas.
      base = comun(actual);
      if (lineas.length) {
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, {
          ...base,
          estados: { ...base.estados, [actual]: 'evaluacion' },
          marcadas,
          calculo: lineas,
          mensaje: dichos.length
            ? `Desde ${actual} (d = ${valor(distancias[actual])}): ${dichos.join('; ')}.`
            : `Desde ${actual}: ${lineas.length === 1 ? 'su único vecino ya es permanente' : 'sus vecinos ya son permanentes'}.`
        }));
      }

      const pendientes = temporales();
      if (pendientes.length === 0) break;
      const menor = pendientes.reduce((m, v) => (distancias[v] < distancias[m] ? v : m));
      const empatan = pendientes.filter((v) => distancias[v] === distancias[menor]);
      permanentes.push(menor);
      base = comun(menor);
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...base,
        estados: { ...base.estados, [menor]: 'evaluacion' },
        marcadas: Object.fromEntries(caminos.aristasDe(grafo, [predecesores[menor], menor]).map((a) => [a.nombre, 'evaluacion'])),
        calculo: pendientes.map((v) => ({
          etiqueta: v, expresion: `temporal [${distancias[v]}, ${predecesores[v]}]`, resultado: v === menor ? 'permanente' : '', activa: v === menor
        })),
        mensaje: pendientes.length === 1
          ? `Queda una sola etiqueta temporal: ${menor} se hace permanente, ${texto(menor)}*.`
          : `La menor de las temporales es ${valor(distancias[menor])}${empatan.length > 1
            ? `, empatan ${enLista(empatan)}, y va el primero` : ''}: ${menor} se hace permanente, ${texto(menor)}*.`
      }));
      actual = menor;
    }

    const sinLlegar = vertices.filter((v) => !permanentes.includes(v));
    base = comun(null);
    // Al terminar, la tabla dice el camino de cada uno.
    base.tabla = {
      cabecera: ['Vértice', 'Etiquetas [d, n]', 'd', `Camino desde ${inicio}`],
      filas: base.tabla.filas.map((f) => {
        const camino = caminos.ruta(predecesores, inicio, f.vertice);
        return { ...f, celdas: [f.celdas[0], f.celdas[1], valor(distancias[f.vertice]), camino ? flechas(camino) : 'no hay'] };
      })
    };
    pasos.push(cierre({
      grafo, comun: base, inicio, fin, predecesores, distancias, estados: base.estados,
      mensajeInicial: sinLlegar.length
        ? `Dijkstra terminado: a ${sinLlegar.join(', ')} no se llega desde ${inicio}.`
        : 'Dijkstra terminado: todas las etiquetas son permanentes.'
    }));
    return pasos;
  }

  // ── Función ordinal y Bellman ────────────────────────────────────────────

  function bellman(grafo, { inicio, fin }) {
    const { vertices } = grafo;
    const { orden, candidatos } = caminos.funcionOrdinal(grafo);
    const numero = new Map(orden.map((v, i) => [v, i]));
    const pasos = [];
    const n = vertices.length;

    // Primero la función ordinal: un vértice por paso.
    orden.forEach((v, i) => {
      const numerados = orden.slice(0, i + 1);
      const posibles = candidatos[i];
      const llegan = caminos.llegadas(grafo, v);
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        caminos: true,
        algoritmo: ALGORITMOS.BELLMAN,
        fase: 'ordinal',
        numerados: numerados.length,
        etiquetas: Object.fromEntries(numerados.map((x, k) => [x, { texto: String(k), clase: k === i ? 'temporal' : 'permanente' }])),
        estados: { ...Object.fromEntries(numerados.map((x) => [x, 'rango'])), [v]: 'evaluacion' },
        marcadas: Object.fromEntries(llegan.map((a) => [a.nombre, 'evaluacion'])),
        tabla: {
          cabecera: ['i', 'Vértice', 'Predecesores'],
          filas: numerados.map((x, k) => ({
            vertice: x, actual: k === i, celdas: [String(k), x, conjunto(caminos.llegadas(grafo, x).map((a) => a.origen))]
          }))
        },
        tituloCalculo: 'Función ordinal',
        calculo: [
          { etiqueta: 'Pueden ir', expresion: conjunto(posibles), resultado: '', activa: false },
          { etiqueta: `i = ${i}`, expresion: `predecesores ${conjunto(llegan.map((a) => a.origen))}`, resultado: v, activa: true }
        ],
        mensaje: `i = ${i}: ${llegan.length === 0 ? `a ${v} no le llega ninguna arista` : `los predecesores de ${v} ya tienen número`}, se le asigna el ${i}.${
          posibles.length > 1 ? ` También ${posibles.length === 2 ? `podía ir ${posibles[1]}` : `podían ir ${enLista(posibles.slice(1))}`}; va el primero en orden.` : ''}`
      }));
    });

    const lambda = {};
    const predecesores = { [inicio]: null };
    const filas = [];
    const simbolo = (v) => `λ${sub(numero.get(v))}`;
    const comun = (cuantos, actual) => ({
      caminos: true,
      algoritmo: ALGORITMOS.BELLMAN,
      fase: 'bellman',
      numerados: n,
      evaluados: cuantos,
      etiquetas: Object.fromEntries(orden.map((v, k) => [v, k < cuantos
        ? { texto: `${simbolo(v)} = ${valor(lambda[v])}`, clase: v === actual ? 'temporal' : 'permanente' }
        : { texto: String(k), clase: 'ordinal' }])),
      estados: Object.fromEntries(orden.slice(0, cuantos).map((v) => [v, v === actual ? 'evaluacion' : 'rango'])),
      marcadas: {},
      tabla: {
        cabecera: ['Vértice', 'λⱼ = min(λᵢ + vᵢⱼ)', 'λ', 'Viene de'],
        filas: filas.map((f) => ({ ...f, actual: f.vertice === actual }))
      },
      tituloCalculo: `Bellman desde ${inicio} · λⱼ = min(λᵢ + vᵢⱼ)`
    });

    orden.forEach((v, j) => {
      const llegan = caminos.llegadas(grafo, v).sort((x, y) => numero.get(x.origen) - numero.get(y.origen));
      // El inicio vale 0 aunque le lleguen aristas: los de antes son ∞.
      const sumas = v === inicio ? [] : llegan.map((a) => ({ arista: a, suma: lambda[a.origen] + a.peso }));
      const mejor = sumas.reduce((m, s) => (m === null || s.suma < m.suma ? s : m), null);
      lambda[v] = v === inicio ? 0 : mejor ? mejor.suma : Infinity;
      if (mejor && Number.isFinite(mejor.suma)) predecesores[v] = mejor.arista.origen;
      const dentro = sumas.map((s) => `${valor(lambda[s.arista.origen])} + ${s.arista.peso}`);
      const escrito = v === inicio ? '0' : dentro.length ? `min{${dentro.join(', ')}}` : 'no le llega ninguna';
      filas.push({ vertice: v, celdas: [v, escrito, valor(lambda[v]), predecesores[v] || (v === inicio ? 'inicio' : '—')] });
      const base = comun(j + 1, v);
      const mensaje = v === inicio ? `${simbolo(v)} = 0: ${v} es el inicio.`
        : sumas.length === 0 ? `${simbolo(v)} = ∞: a ${v} no le llega ninguna arista, así que no se alcanza desde ${inicio}.`
          : !Number.isFinite(lambda[v]) ? `${simbolo(v)} = ∞: sus predecesores no se alcanzan desde ${inicio}.`
            : sumas.length === 1 ? `${simbolo(v)} = ${dentro[0]} = ${lambda[v]}: a ${v} solo se llega desde ${mejor.arista.origen}.`
              : `${simbolo(v)} = min{${sumas.map((s) => valor(s.suma)).join(', ')}} = ${lambda[v]}: se comparan, y la menor viene de ${mejor.arista.origen}.`;
      pasos.push(crearPaso(sumas.length > 1 ? TIPOS_PASO.COMPARACION : TIPOS_PASO.CALCULO, {
        ...base,
        marcadas: Object.fromEntries(sumas.map((s) => [s.arista.nombre, s === mejor && Number.isFinite(s.suma) ? 'evaluacion' : 'descartada'])),
        calculo: sumas.length
          ? sumas.map((s) => ({
            etiqueta: `${simbolo(s.arista.origen)} + v`,
            expresion: `${valor(lambda[s.arista.origen])} + ${s.arista.peso}`,
            resultado: valor(s.suma),
            activa: s === mejor
          }))
          : [{ etiqueta: simbolo(v), expresion: v === inicio ? 'inicio' : 'sin predecesores', resultado: valor(lambda[v]), activa: true }],
        mensaje
      }));
    });

    const base = comun(n, null);
    pasos.push(cierre({
      grafo, comun: base, inicio, fin, predecesores, distancias: lambda, estados: base.estados,
      mensajeInicial: `Bellman terminado, ${simbolo(fin)} = ${valor(lambda[fin])}.`
    }));
    return pasos;
  }

  window.CC2.algoritmos.caminos = { recorrer };
})();
