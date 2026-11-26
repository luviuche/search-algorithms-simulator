(function () {
  // **La tabla de aristas del editor de un grafo** (2026-11-26, CLAUDE.md
  // 6.13): cómo se nombran los vértices, cómo se lee el texto de siempre en
  // filas «de cuál a cuál» y cómo se vuelve a escribir. El editor
  // (`vista/componentes/editor-grafo.js`) escribe ese texto y cada tema lo lee
  // con su lector, así que lo que sale de aquí tiene que leerse igual allá.
  //
  // Una fila es { desde, hasta, peso, nombre }: los vértices por su lugar
  // (0 es el primero), el peso como se escribió ('' es sin peso) y el nombre
  // de la arista solo si el texto lo traía.

  // Los nombres de los vértices: `n:1` es 1, 2, 3…; `n:0`, 0, 1, 2…; `A` y
  // `a`, las letras. Un archivo puede traer otro comienzo (`n:4`).
  function nombresDe(esquema, n) {
    const cuantos = Math.max(0, n || 0);
    if (esquema === 'A' || esquema === 'a') {
      const base = esquema.charCodeAt(0);
      return Array.from({ length: cuantos }, (_, i) => String.fromCharCode(base + i));
    }
    const desde = Number(String(esquema).slice(2)) || 0;
    return Array.from({ length: cuantos }, (_, i) => String(desde + i));
  }

  function rotuloDeEsquema(esquema) {
    if (esquema === 'n:otro') return 'Desde otro número';
    const [a, b, c] = nombresDe(esquema, 3);
    return `${a}, ${b}, ${c}…`;
  }

  // Si una forma de nombrar vale en el tema. `n:*` deja empezar los números
  // donde se quiera: en las operaciones, G₂ suele empezar en 2.
  function vale(esquema, esquemas) {
    if (esquemas.includes(esquema)) return true;
    if (!String(esquema).startsWith('n:')) return false;
    const desde = Number(esquema.slice(2));
    return esquemas.includes('n:*') || (desde > 0 && esquemas.some((e) => e.startsWith('n:')));
  }

  // El nombre que el lector le da a una arista sin nombre: la siguiente letra
  // que nadie usa, en el orden escrito.
  function letraEnOrden(indice) {
    const letra = (i) => String.fromCharCode(97 + i);
    return indice < 26 ? letra(indice) : letra(Math.floor(indice / 26) - 1) + letra(indice % 26);
  }

  function rotulosDeAristas(filas) {
    const usados = new Set(filas.map((f) => f.nombre).filter(Boolean));
    let siguiente = 0;
    return filas.map((fila) => {
      if (fila.nombre) return fila.nombre;
      while (usados.has(letraEnOrden(siguiente))) siguiente++;
      return letraEnOrden(siguiente++);
    });
  }

  const ES_NOMBRE = /^[a-zA-Z][0-9]{0,2}$/;

  // **Del texto a la tabla.** Devuelve el estado del editor, o por qué no cabe.
  function leerTexto(texto, { esquemas, pesos, maximo }) {
    const renglones = String(texto || '').split(/\r?\n|;/).map((r) => r.trim()).filter(Boolean);
    if (renglones.length === 0) return { valido: true, vacio: true };
    const conLetras = esquemas.some((e) => e === 'A' || e === 'a');
    const filasLeidas = [];
    const vertices = [];
    const ver = (v) => { if (!vertices.includes(v)) vertices.push(v); };
    for (const renglon of renglones) {
      const partes = renglon.split(/[\s,\-–>]+/).filter(Boolean);
      if (partes.length === 0 || partes.length > 3) return { valido: false, motivo: `«${renglon}» no es una arista que quepa en la tabla.` };
      if (partes.length === 1) { ver(partes[0]); continue; }
      let nombre = null;
      let peso = '';
      if (partes.length === 3) {
        // «1 2 5» es un peso; «a 1 2», un nombre. Con vértices de letra y
        // pesos, «A B 3» es un peso.
        const esPeso = pesos && /^[0-9]+$/.test(partes[2]) && (conLetras || !/^[a-zA-Z]/.test(partes[0]));
        if (esPeso) peso = partes.pop();
        else if (ES_NOMBRE.test(partes[0])) nombre = partes.shift();
        else return { valido: false, motivo: `«${renglon}» no es una arista que quepa en la tabla.` };
      }
      const [desde, hasta] = partes;
      ver(desde);
      ver(hasta);
      filasLeidas.push({ desde, hasta, peso, nombre });
    }
    // Qué nombres son: tienen que ser los primeros de una forma, todos.
    let esquema = null;
    if (vertices.every((v) => /^[0-9]+$/.test(v))) {
      const menor = Math.min(...vertices.map(Number));
      if (vale(`n:${menor}`, esquemas)) esquema = `n:${menor}`;
    } else if (vertices.every((v) => /^[A-Z]$/.test(v)) && esquemas.includes('A')) esquema = 'A';
    else if (vertices.every((v) => /^[a-z]$/.test(v)) && esquemas.includes('a')) esquema = 'a';
    if (!esquema) {
      return { valido: false, motivo: 'Sus vértices no van como 1, 2, 3… o A, B, C… —o mezclan números y letras—: la tabla no los puede nombrar.' };
    }
    const n = vertices.length;
    const nombres = nombresDe(esquema, n);
    const falta = nombres.find((v) => !vertices.includes(v));
    if (falta !== undefined) return { valido: false, motivo: `Sus vértices no van seguidos: falta el ${falta}. Agréguelo solo en su renglón, o siga en texto.` };
    if (n > maximo) return { valido: false, motivo: `Tiene ${n} vértices; caben hasta ${maximo}.` };
    const filas = filasLeidas.map((f) => ({ desde: nombres.indexOf(f.desde), hasta: nombres.indexOf(f.hasta), peso: f.peso, nombre: f.nombre }));
    return { valido: true, n, esquema, filas, ponderado: filas.some((f) => f.peso !== '') };
  }

  // **De la tabla al texto**: una arista por renglón y después los vértices
  // sin arista, solos en el suyo, que es como los lectores los dejan aislados.
  function comoTexto({ n, esquema, filas, ponderado }, conPesos) {
    if (!n) return '';
    const nombres = nombresDe(esquema, n);
    const tocados = new Set();
    const renglones = filas.map((fila) => {
      tocados.add(fila.desde);
      tocados.add(fila.hasta);
      const peso = conPesos && ponderado && fila.peso !== '' ? fila.peso : null;
      return [fila.nombre, nombres[fila.desde], nombres[fila.hasta], peso].filter((p) => p !== null && p !== undefined && p !== '').join(' ');
    });
    return renglones.concat(nombres.filter((_, i) => !tocados.has(i))).join('\n');
  }

  function claveDe(fila, dirigido) {
    return dirigido ? `${fila.desde}>${fila.hasta}` : [fila.desde, fila.hasta].sort((a, b) => a - b).join('-');
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.tablaDeAristas = { nombresDe, rotuloDeEsquema, vale, letraEnOrden, rotulosDeAristas, leerTexto, comoTexto, claveDe };
})();
