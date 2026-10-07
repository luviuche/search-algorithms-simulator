// Corre pruebas/humo.html en Edge headless y reporta el informe.
//
// A varios altos de ventana, porque así se detectaron las regresiones de
// layout: la pantalla se ancla al viewport y lo que cabe a 950 px puede no
// caber a 700. Sale con código 1 si alguna comprobación falla, para poder
// encadenarlo con otras órdenes.
//
//   node .claude/skills/verificar/scripts/humo.js            → 700, 800 y 950
//   node .claude/skills/verificar/scripts/humo.js 700        → solo ese alto
//   node .claude/skills/verificar/scripts/humo.js --informe  → el informe entero
//   node .claude/skills/verificar/scripts/humo.js 1280x633   → ancho y alto
//   node .claude/skills/verificar/scripts/humo.js --zoom     → la pantalla de
//       referencia (1920 × 950) al 80, 100, 125 y 150 % de zoom del navegador,
//       que para la página es una ventana de 2400 × 1188, 1920 × 950,
//       1536 × 760 y 1280 × 633 (CLAUDE.md 6.9).
const { volcar, salidaDe } = require('./navegador.js');

const ANCHO_POR_DEFECTO = 1500;
const ALTOS_POR_DEFECTO = [700, 800, 950];
const ZOOM = [
  { ancho: 2400, alto: 1188, nombre: '80 %' },
  { ancho: 1920, alto: 950, nombre: '100 %' },
  { ancho: 1536, alto: 760, nombre: '125 %' },
  { ancho: 1280, alto: 633, nombre: '150 %' }
];

function corridaEn({ ancho = ANCHO_POR_DEFECTO, alto }) {
  const volcado = volcar({ ruta: 'pruebas/humo.html', ancho, alto });
  const salida = salidaDe(volcado);
  if (salida === null) {
    return { fallas: 1, lineas: ['sin informe: el volcado no trae #salida (¿subir el presupuesto de tiempo virtual?)'] };
  }

  const lineas = salida.split('\n');
  // La primera línea es el resultado; las que empiezan por ✕ son las
  // comprobaciones que fallaron, y EXCEPCIÓN/ERROR lo que ni llegó a correr.
  const malas = lineas.filter((linea) => /^(✕|EXCEPCIÓN|ERROR)/.test(linea.trim()));
  return { resumen: lineas[0], fallas: malas.length, lineas: malas, salida };
}

// Cada argumento suelto es un alto (`700`) o un ancho por alto (`1280x633`).
const argumentos = process.argv.slice(2);
const informeEntero = argumentos.includes('--informe');
const tamanos = argumentos.includes('--zoom')
  ? ZOOM
  : argumentos
    .map((argumento) => {
      const partes = argumento.split('x').map(Number);
      if (partes.length === 2 && partes.every((n) => Number.isFinite(n) && n > 0)) {
        return { ancho: partes[0], alto: partes[1] };
      }
      return Number.isFinite(partes[0]) && partes[0] > 0 && partes.length === 1 ? { alto: partes[0] } : null;
    })
    .filter(Boolean);

// El informe entero es de un solo tamaño: leerlo tres veces no dice nada
// nuevo, y lo que se busca ahí es el registro paso a paso de las pruebas.
if (informeEntero) {
  const corrida = corridaEn(tamanos[0] || { alto: 950 });
  console.log(corrida.salida || corrida.lineas.join('\n'));
  process.exit(corrida.fallas > 0 ? 1 : 0);
}

let fallas = 0;

for (const tamano of (tamanos.length ? tamanos : ALTOS_POR_DEFECTO.map((alto) => ({ alto })))) {
  const corrida = corridaEn(tamano);
  fallas += corrida.fallas;
  const ancho = tamano.ancho || ANCHO_POR_DEFECTO;
  console.log(`\n── humo a ${ancho} × ${tamano.alto}${tamano.nombre ? ` (zoom ${tamano.nombre})` : ''} ──`);
  console.log(corrida.resumen || '');
  for (const linea of corrida.lineas) console.log('  ' + linea.trim());
}

if (fallas > 0) {
  console.log(`\n${fallas} comprobación(es) fallaron.`);
  console.log('Para leer el informe entero: node .claude/skills/verificar/scripts/humo.js --informe');
}
process.exit(fallas > 0 ? 1 : 0);
