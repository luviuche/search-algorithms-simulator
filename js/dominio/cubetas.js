(function () {
  const estructuras = window.CC2.dominio.estructura;

  // Otras búsquedas dinámicas: la estructura es una tabla de `n` cubetas, cada
  // una con `r` renglones fijos. A diferencia de todo lo demás en el proyecto,
  // `n` no lo fija el estudiante para toda la vida de la estructura: crece al
  // expandir y decrece al reducir (confirmado con el usuario, 2026-09-06).
  const MODOS_EXPANSION = Object.freeze({ TOTAL: 'total', PARCIAL: 'parcial' });

  // ¿`n` es `base · 2^k` para algún entero k ≥ 0? Devuelve ese `k`, o `null` si
  // `n` no pertenece a esa serie geométrica.
  function potenciaDesde(n, base) {
    if (n % base !== 0) return null;
    let k = 0;
    let valor = base;
    while (valor < n) {
      valor *= 2;
      k++;
    }
    return valor === n ? k : null;
  }

  // Cuánto crece `n` al expandir. En total, se duplica sin más. En parcial, la
  // secuencia de tamaños son dos series intercaladas que se doblan cada una
  // por su cuenta —serie A: n0, 2·n0, 4·n0…; serie B: n0+1, 2(n0+1), 4(n0+1)…—
  // y cada expansión salta de una serie a la otra (confirmado contra el
  // taller resuelto: con n0=2 da 2 → 3 → 4 → 6 → 8…).
  function siguienteN(n, n0, modo) {
    if (modo === MODOS_EXPANSION.TOTAL) return n * 2;
    const kA = potenciaDesde(n, n0);
    if (kA !== null) return (n0 + 1) * Math.pow(2, kA);
    const kB = potenciaDesde(n, n0 + 1);
    if (kB !== null) return n0 * Math.pow(2, kB + 1);
    // No debería pasar: `n` siempre viene de esta misma serie, porque nace en
    // n0 y solo se mueve por `siguienteN`/`anteriorN`.
    return n * 2;
  }

  // Deshace exactamente el último paso de `siguienteN`, sin necesidad de
  // guardar un historial de tamaños: alcanza con saber `n0` y el `n` actual.
  // En total esto equivale a dividir entre dos —dividir es el caso particular
  // de "deshacer el último doblado"—, y nunca baja del `n` con que se creó la
  // estructura.
  function anteriorN(n, n0, modo) {
    if (n <= n0) return null;
    if (modo === MODOS_EXPANSION.TOTAL) {
      const previo = n / 2;
      return previo >= n0 ? previo : null;
    }
    const kA = potenciaDesde(n, n0);
    if (kA !== null) return kA === 0 ? null : (n0 + 1) * Math.pow(2, kA - 1);
    const kB = potenciaDesde(n, n0 + 1);
    if (kB !== null) return n0 * Math.pow(2, kB);
    return null;
  }

  // Densidad para decidir si expandir: claves ya intentadas —incluida la que
  // acaba de chocar, si chocó— sobre la capacidad total de la tabla (n × r).
  // `pendientes` son las claves que ya se intentaron pero todavía no están
  // colocadas: la que chocó y espera en la fila «Col». Cuentan, porque la
  // regla mide **claves intentadas** y chocar es justo el caso en que una no
  // llegó a entrar. Sin contarla, la pantalla mostraría 7/9 = 77,8 % en el
  // mismo instante en que el taller escribe 8/9 = 88,89 % (CLAUDE.md 5.7).
  function densidadExpandir(estructura, pendientes = 0) {
    const r = estructura.parametros.r;
    return (estructuras.cantidadClaves(estructura) + pendientes) / (estructura.n * r);
  }

  // Densidad para decidir si reducir: es otra cuenta, no la misma dividida al
  // revés (confirmado contra el taller: no multiplica por `r`). Compara
  // claves restantes contra la cantidad de cubetas, no contra su capacidad.
  function densidadReducir(estructura) {
    return estructuras.cantidadClaves(estructura) / estructura.n;
  }

  function validarR(entrada) {
    const r = Number(entrada);
    if (!Number.isInteger(r) || r < 1) {
      return { valido: false, mensaje: 'Registros por cubeta (r) inválido: debe ser un entero de al menos 1.' };
    }
    return { valido: true, valor: r };
  }

  // El modo parcial arranca dos series en n0 y n0 + 1: con n0 = 1 se
  // encimarían (1, 2, 4… contra 2, 4, 8…) y la serie dejaría de ser
  // reversible sin ambigüedad. Se exige n0 ≥ 2 solo en ese modo.
  function validarModoExpansion(entrada, { n }) {
    if (entrada !== MODOS_EXPANSION.TOTAL && entrada !== MODOS_EXPANSION.PARCIAL) {
      return { valido: false, mensaje: 'Modo de expansión inválido: debe ser total o parcial.' };
    }
    if (entrada === MODOS_EXPANSION.PARCIAL && n < 2) {
      return { valido: false, mensaje: 'La expansión parcial necesita un n inicial de al menos 2.' };
    }
    return { valido: true, valor: entrada };
  }

  function validarUmbral(entrada, etiqueta) {
    const porcentaje = Number(entrada);
    if (!Number.isFinite(porcentaje) || porcentaje <= 0) {
      return { valido: false, mensaje: `${etiqueta} inválido: debe ser un porcentaje mayor que 0.` };
    }
    return { valido: true, valor: porcentaje / 100 };
  }

  // La inversa de `validarUmbral`: el umbral guardado (fracción) como se
  // digita (porcentaje), para volver a validarlo al abrir un archivo. Se
  // redondea a doce cifras porque la fracción ya trae el error de dividir
  // por cien: 0.29 × 100 da 28.999999999999996, no 29.
  function umbralComoTexto(fraccion) {
    return String(Number((Number(fraccion) * 100).toPrecision(12)));
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.cubetas = {
    MODOS_EXPANSION,
    siguienteN,
    anteriorN,
    densidadExpandir,
    densidadReducir,
    validarR,
    validarModoExpansion,
    validarUmbral,
    umbralComoTexto
  };
})();
