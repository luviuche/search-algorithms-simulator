(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const transformaciones = window.CC2.dominio.transformaciones;
  const { TRANSFORMACIONES, fusionar, complemento, vecinosDe, incidentes, transformar, mismos } = transformaciones;

  // Operaciones sobre un solo grafo (CLAUDE.md 5.19): la traza. Cada paso
  // lleva G tal como entró y G′ **tal como va** (`parcial`), y qué resaltar en
  // cada uno (`marcas.g` y `marcas.r`: vértices con su estado, y aristas
  // [u, v, estado]). El último paso lleva la cuenta de |V′| y |A′|.

  const NOMBRES = Object.freeze({
    [TRANSFORMACIONES.INSERTAR_VERTICE]: 'Insertar vértice',
    [TRANSFORMACIONES.BORRAR_VERTICE]: 'Borrar vértice',
    [TRANSFORMACIONES.INSERTAR_ARISTA]: 'Insertar arista',
    [TRANSFORMACIONES.BORRAR_ARISTA]: 'Borrar arista',
    [TRANSFORMACIONES.FUSIONAR_VERTICES]: 'Fusionar vértices',
    [TRANSFORMACIONES.CONTRAER_ARISTA]: 'Fusionar (contraer) arista',
    [TRANSFORMACIONES.COMPLEMENTO]: 'Complemento'
  });

  const escrita = (arista) => arista.join('–');
  const cuantas = (n) => `${n} ${n === 1 ? 'arista' : 'aristas'}`;
  const cuantos = (n) => `${n} ${n === 1 ? 'vértice' : 'vértices'}`;
  const conjunto = (lista) => (lista.length ? `{${lista.join(', ')}}` : '∅');

  // Cómo se llama el resultado, con los datos dentro.
  function simbolo(operacion, datos) {
    switch (operacion) {
      case TRANSFORMACIONES.INSERTAR_VERTICE: return `G + ${datos.vertice}`;
      case TRANSFORMACIONES.BORRAR_VERTICE: return `G − ${datos.vertice}`;
      case TRANSFORMACIONES.INSERTAR_ARISTA: return `G + ${escrita(datos.par)}`;
      case TRANSFORMACIONES.BORRAR_ARISTA: return `G − ${escrita(datos.par)}`;
      case TRANSFORMACIONES.COMPLEMENTO: return 'Ḡ';
      case TRANSFORMACIONES.CONTRAER_ARISTA: return `G / ${escrita(datos.par)}`;
      default: return `G con ${datos.par.join(' y ')} fusionados`;
    }
  }

  function recorrer(grafo, operacion, datos = {}) {
    const n = grafo.vertices.length;
    const m = grafo.aristas.length;
    const final = transformar(grafo, operacion, datos);
    const titulo = simbolo(operacion, datos);
    // Todos los vértices que aparecen, para que G y G′ se dibujen con cada uno
    // en el mismo sitio; el fundido va en el medio de los dos que fundió.
    const universo = operacion === TRANSFORMACIONES.INSERTAR_VERTICE ? final.vertices : grafo.vertices;
    const funde = operacion === TRANSFORMACIONES.FUSIONAR_VERTICES || operacion === TRANSFORMACIONES.CONTRAER_ARISTA;
    const comun = {
      transformacion: operacion,
      g: grafo,
      universo,
      fundido: funde ? { nombre: datos.par.join(','), de: datos.par } : null,
      nombreResultado: titulo,
      tituloCalculo: NOMBRES[operacion]
    };
    const pasos = [];
    const paso = (parcial, marcas, linea, mensaje) => pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...comun,
      parcial,
      marcas: { g: { vertices: {}, aristas: [], ...marcas.g }, r: { vertices: {}, aristas: [], ...marcas.r } },
      calculo: [{ ...linea, activa: true }],
      mensaje
    }));
    const terminar = (cuentaV, cuentaA, dicho) => pasos.push(crearPaso(TIPOS_PASO.CONSTRUIDO, {
      ...comun,
      parcial: final,
      marcas: { g: { vertices: {}, aristas: [] }, r: { vertices: {}, aristas: [] } },
      cuenta: { vertices: { ...cuentaV, valor: final.vertices.length }, aristas: { ...cuentaA, valor: final.aristas.length } },
      calculo: [
        { etiqueta: '|V′|', expresion: `${cuentaV.formula} = ${cuentaV.numeros}`, resultado: String(final.vertices.length), activa: false },
        { etiqueta: '|A′|', expresion: `${cuentaA.formula} = ${cuentaA.numeros}`, resultado: String(final.aristas.length), activa: true }
      ],
      mensaje: `${titulo}: ${cuantos(final.vertices.length)} y ${cuantas(final.aristas.length)}. ${dicho}`
    }));
    const mismaV = { formula: '|V|', numeros: String(n) };

    switch (operacion) {
      case TRANSFORMACIONES.INSERTAR_VERTICE: {
        const { vertice, vecinos } = datos;
        let aristas = grafo.aristas;
        paso({ vertices: final.vertices, aristas }, { r: { vertices: { [vertice]: 'evaluacion' } } },
          { etiqueta: 'V′', expresion: `V ∪ {${vertice}}`, resultado: cuantos(n + 1) },
          `Se inserta el vértice ${vertice}${vecinos.length ? `, que se une con ${conjunto(vecinos)}` : ', aislado: no se une con ninguno'}.`);
        for (const w of vecinos) {
          aristas = aristas.concat([[vertice, w]]);
          paso({ vertices: final.vertices, aristas },
            { g: { vertices: { [w]: 'rango' } }, r: { vertices: { [vertice]: 'evaluacion', [w]: 'rango' }, aristas: [[vertice, w, 'evaluacion']] } },
            { etiqueta: `${vertice}–${w}`, expresion: 'arista nueva', resultado: 'entra' },
            `Entra la arista ${vertice}–${w}.`);
        }
        terminar({ formula: '|V| + 1', numeros: `${n} + 1` }, { formula: `|A| + gr(${vertice})`, numeros: `${m} + ${vecinos.length}` },
          `Un vértice más, y ${cuantas(vecinos.length)} ${vecinos.length === 1 ? 'nueva' : 'nuevas'}.`);
        break;
      }
      case TRANSFORMACIONES.BORRAR_VERTICE: {
        const { vertice } = datos;
        const quitar = incidentes(grafo, vertice);
        let aristas = grafo.aristas;
        paso({ vertices: grafo.vertices, aristas }, { g: { vertices: { [vertice]: 'evaluacion' } }, r: { vertices: { [vertice]: 'evaluacion' } } },
          { etiqueta: `gr(${vertice})`, expresion: `vecinos ${conjunto(vecinosDe(grafo, vertice))}`, resultado: String(quitar.length) },
          quitar.length ? `Al borrar ${vertice} se van sus ${cuantas(quitar.length)}: ${quitar.map(escrita).join(', ')}.`
            : `El vértice ${vertice} está aislado: no se lleva ninguna arista.`);
        for (const arista of quitar) {
          aristas = aristas.filter((a) => a !== arista);
          paso({ vertices: grafo.vertices, aristas },
            { g: { vertices: { [vertice]: 'evaluacion' }, aristas: [[...arista, 'evaluacion']] }, r: { vertices: { [vertice]: 'evaluacion' }, aristas: [[...arista, 'descartada']] } },
            { etiqueta: escrita(arista), expresion: `incide en ${vertice}`, resultado: 'se borra' },
            `Se borra la arista ${escrita(arista)}.`);
        }
        paso(final, { g: { vertices: { [vertice]: 'evaluacion' } } },
          { etiqueta: 'V′', expresion: `V − {${vertice}}`, resultado: cuantos(n - 1) }, `Se borra el vértice ${vertice}.`);
        terminar({ formula: '|V| − 1', numeros: `${n} − 1` }, { formula: `|A| − gr(${vertice})`, numeros: `${m} − ${quitar.length}` },
          `Se va ${vertice} con las aristas que lo tocaban.`);
        break;
      }
      case TRANSFORMACIONES.INSERTAR_ARISTA: {
        const [u, v] = datos.par;
        paso(grafo, { g: { vertices: { [u]: 'rango', [v]: 'rango' } }, r: { vertices: { [u]: 'rango', [v]: 'rango' } } },
          { etiqueta: `${u}–${v}`, expresion: '∉ A', resultado: 'no está' }, `${u} y ${v} no son adyacentes: se puede insertar la arista ${u}–${v}.`);
        paso(final, { r: { vertices: { [u]: 'rango', [v]: 'rango' }, aristas: [[u, v, 'evaluacion']] } },
          { etiqueta: 'A′', expresion: `A ∪ {${u}–${v}}`, resultado: cuantas(m + 1) }, `Entra la arista ${u}–${v}.`);
        terminar(mismaV, { formula: '|A| + 1', numeros: `${m} + 1` }, 'Los vértices no cambian.');
        break;
      }
      case TRANSFORMACIONES.BORRAR_ARISTA: {
        const [u, v] = datos.par;
        paso(grafo, { g: { vertices: { [u]: 'rango', [v]: 'rango' }, aristas: [[u, v, 'evaluacion']] }, r: { aristas: [[u, v, 'evaluacion']] } },
          { etiqueta: `${u}–${v}`, expresion: '∈ A', resultado: 'está' }, `La arista ${u}–${v} está en G: se va a borrar.`);
        paso(final, { g: { aristas: [[u, v, 'evaluacion']] }, r: { vertices: { [u]: 'rango', [v]: 'rango' }, aristas: [[u, v, 'descartada']] } },
          { etiqueta: 'A′', expresion: `A − {${u}–${v}}`, resultado: cuantas(m - 1) }, `Se borra la arista ${u}–${v}; sus extremos ${u} y ${v} se quedan.`);
        terminar(mismaV, { formula: '|A| − 1', numeros: `${m} − 1` }, 'Los vértices no cambian.');
        break;
      }
      case TRANSFORMACIONES.COMPLEMENTO: {
        let aristas = [];
        for (const grupo of complemento(grafo).grupos) {
          aristas = aristas.concat(grupo.aristas);
          const u = grupo.vertice;
          const marcas = grupo.aristas.map(([p, q]) => [p, q, 'evaluacion']);
          paso({ vertices: grafo.vertices, aristas },
            { g: { vertices: { [u]: 'rango' }, aristas: incidentes(grafo, u).map((a) => [...a, 'rango']) }, r: { vertices: { [u]: 'rango' }, aristas: marcas } },
            { etiqueta: `N(${u})`, expresion: conjunto(vecinosDe(grafo, u)), resultado: cuantas(grupo.aristas.length) },
            grupo.aristas.length ? `Vértice ${u}: en G no es adyacente a ${grupo.aristas.map((a) => a[1]).join(', ')}; entra${grupo.aristas.length === 1 ? '' : 'n'} ${grupo.aristas.map(escrita).join(', ')}.`
              : `Vértice ${u}: no falta ninguna arista con los que siguen.`);
        }
        terminar(mismaV, { formula: 'n(n − 1)/2 − |A|', numeros: `${n * (n - 1) / 2} − ${m}` },
          'Los mismos vértices, y las aristas que le faltaban a G para ser completo.');
        break;
      }
      default:
        recorrerFusion();
    }

    function recorrerFusion() {
      const [u, v] = datos.par;
      const { nuevo, cambios, base } = fusionar(grafo, u, v);
      const esArista = operacion === TRANSFORMACIONES.CONTRAER_ARISTA;
      let aristas = base.aristas;
      paso({ vertices: base.vertices, aristas },
        {
          g: { vertices: { [u]: 'evaluacion', [v]: 'evaluacion' }, aristas: esArista ? [[u, v, 'evaluacion']] : [] },
          r: { vertices: { [nuevo]: 'evaluacion' } }
        },
        { etiqueta: 'V′', expresion: `V − {${u}, ${v}} ∪ {${nuevo}}`, resultado: cuantos(n - 1) },
        esArista ? `Se contrae la arista ${u}–${v}: sus extremos se funden en el vértice «${nuevo}».`
          : `${u} y ${v} se funden en el vértice «${nuevo}», que se une con los vecinos de los dos.`);
      for (const cambio of cambios) {
        const arista = escrita(cambio.arista);
        const enG = { vertices: { [u]: 'evaluacion', [v]: 'evaluacion' }, aristas: [[...cambio.arista, 'evaluacion']] };
        if (cambio.tipo === 'pasa') {
          aristas = aristas.concat([cambio.nueva]);
          paso({ vertices: base.vertices, aristas }, { g: enG, r: { vertices: { [nuevo]: 'evaluacion', [cambio.otro]: 'rango' }, aristas: [[...cambio.nueva, 'evaluacion']] } },
            { etiqueta: arista, expresion: `${cambio.extremo} pasa a «${nuevo}»`, resultado: `«${nuevo}»–${cambio.otro}` },
            `La arista ${arista} pasa a ser «${nuevo}»–${cambio.otro}.`);
        } else if (cambio.tipo === 'paralela') {
          paso({ vertices: base.vertices, aristas }, { g: enG, r: { vertices: { [nuevo]: 'evaluacion', [cambio.otro]: 'rango' } } },
            { etiqueta: arista, expresion: `paralela a «${nuevo}»–${cambio.otro}`, resultado: 'se descarta' },
            `La arista ${arista} quedaría paralela a «${nuevo}»–${cambio.otro}, que ya está: se descarta.`);
        } else {
          paso({ vertices: base.vertices, aristas }, { g: enG, r: { vertices: { [nuevo]: 'evaluacion' } } },
            { etiqueta: arista, expresion: `lazo en «${nuevo}»`, resultado: 'se descarta' },
            esArista ? `La arista ${arista} es la que se contrae: desaparece.`
              : `La arista ${arista} unía a los dos: quedaría un lazo, y se descarta.`);
        }
      }
      const lazos = cambios.filter((c) => c.tipo === 'lazo').length;
      const paralelas = cambios.filter((c) => c.tipo === 'paralela').length;
      const nombreLazo = esArista ? 'contraída' : 'lazos';
      terminar({ formula: '|V| − 1', numeros: `${n} − 1` },
        { formula: `|A| − ${nombreLazo} − paralelas`, numeros: `${m} − ${lazos} − ${paralelas}` },
        paralelas || (lazos && !esArista) ? 'Queda un grafo simple: lo que sería lazo o paralela se descartó.' : 'No quedaron lazos ni paralelas que descartar.');
    }

    return pasos;
  }

  window.CC2.algoritmos.transformaciones = { recorrer, NOMBRES, simbolo, mismos };
})();
