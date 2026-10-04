(function () {
  const LIMITE_DURO_N = 10000;
  const UMBRAL_ADVERTENCIA_N = 500;
  // La clave más larga que se puede representar sin perder cifras: una de 15
  // dígitos llega a 999 999 999 999 999, por debajo del entero seguro de
  // JavaScript (2⁵³ − 1 ≈ 9 × 10¹⁵); una de 16 ya no siempre cabe, y dos
  // claves distintas podían salir como el mismo número —un duplicado falso, o
  // una comparación equivocada en binaria—.
  const L_MAXIMA = 15;

  function rangoValido(l) {
    return { min: Math.pow(10, l - 1), max: Math.pow(10, l) - 1 };
  }

  function clavesDistintasPosibles(l) {
    return 9 * Math.pow(10, l - 1);
  }

  // Cota superior de comparaciones de la búsqueda binaria: ⌈log₂ n⌉ (CLAUDE.md 5.2).
  // Se muestra en métricas junto al conteo real para que el estudiante compare.
  function maximoPasosBinaria(n) {
    if (n <= 0) return 0;
    return Math.ceil(Math.log2(n));
  }

  // El límite derivado de l se valida al crear la estructura, no al insertar
  // (CLAUDE.md 3.5). Sin `l` —otras búsquedas dinámicas, CLAUDE.md 5.7, donde
  // la clave no tiene longitud fija— no hay tope de claves distintas que
  // derivar, así que esa cota no aplica: solo queda el límite duro.
  //
  // **Las invariantes no dependen de quién llame** (CLAUDE.md 3.2): el
  // formulario ya bloquea `n = 0` o `l = 2.5`, pero abrir un archivo o
  // cualquier otro camino llega aquí sin pasar por él, así que la forma de `n`
  // y de `l` se comprueba también aquí.
  function validarTamano(n, l) {
    if (!Number.isInteger(n) || n < 1) {
      return { valido: false, mensaje: 'Tamaño inválido: n debe ser un número entero de al menos 1.' };
    }
    if (l !== undefined && (!Number.isInteger(l) || l < 1 || l > L_MAXIMA)) {
      return {
        valido: false,
        mensaje: `Longitud de clave inválida: l debe ser un número entero entre 1 y ${L_MAXIMA}.`
      };
    }
    if (n > LIMITE_DURO_N) {
      return {
        valido: false,
        mensaje: `Tamaño inviable: el límite máximo de la estructura es ${LIMITE_DURO_N} casillas.`
      };
    }
    if (l !== undefined) {
      const maxDistintas = clavesDistintasPosibles(l);
      if (n > maxDistintas) {
        return {
          valido: false,
          mensaje: `Tamaño inviable: para l = ${l} solo existen ${maxDistintas} claves distintas.`
        };
      }
    }
    return {
      valido: true,
      advertencia: n > UMBRAL_ADVERTENCIA_N
        ? `Con n = ${n} casillas, la ejecución paso a paso deja de ser observable.`
        : null
    };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.limites = {
    LIMITE_DURO_N,
    UMBRAL_ADVERTENCIA_N,
    L_MAXIMA,
    rangoValido,
    clavesDistintasPosibles,
    maximoPasosBinaria,
    validarTamano
  };
})();
