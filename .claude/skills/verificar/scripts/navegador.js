// Edge headless: dónde está, cómo se le habla y cómo se le saca el informe.
//
// Vive aquí y no en cada comando escrito a mano porque las tres trampas de
// este entorno ya costaron tiempo más de una vez:
//
//   1. `--screenshot` necesita **ruta absoluta de Windows**. Con una relativa
//      falla con "Access is denied" y no dice por qué.
//   2. El `#salida` del volcado se extrae con una expresión regular sobre el
//      HTML, no con `sed`: el `<pre>` lleva atributo `style`, su texto es
//      multilínea, y grepear el volcado entero cuenta las palabras del propio
//      script y da falsos positivos.
//   3. Sin `--virtual-time-budget` suficiente el volcado sale a medias, con
//      pruebas que ni siquiera llegaron a correr.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

// scripts/ → verificar/ → skills/ → .claude/ → raíz del repositorio.
const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');

const CANDIDATOS = [
  process.env.CC2_EDGE,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

function navegador() {
  for (const ruta of CANDIDATOS) {
    if (fs.existsSync(ruta)) return ruta;
  }
  throw new Error(
    'No se encontró msedge.exe. Buscado en:\n  ' + CANDIDATOS.join('\n  ')
    + '\nSi está en otro sitio, indicarlo con la variable de entorno CC2_EDGE.'
  );
}

// La aplicación se abre por file:// (CLAUDE.md 4): no hay servidor que
// levantar, y por eso tampoco hay nada que apagar después.
function urlDe(rutaRelativa, consulta = '') {
  const url = pathToFileURL(path.join(RAIZ, rutaRelativa)).href;
  const limpia = String(consulta).replace(/^\?/, '');
  return limpia ? `${url}?${limpia}` : url;
}

function correr(banderas, { capturarSalida = false } = {}) {
  const resultado = spawnSync(navegador(), [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    ...banderas
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });

  if (resultado.error) throw resultado.error;
  return capturarSalida ? resultado.stdout : '';
}

function volcar({ ruta, consulta = '', ancho = 1500, alto = 950, presupuesto = 30000 }) {
  return correr([
    `--window-size=${ancho},${alto}`,
    `--virtual-time-budget=${presupuesto}`,
    '--dump-dom',
    urlDe(ruta, consulta)
  ], { capturarSalida: true });
}

// `quieto` pide al navegador movimiento reducido: la aplicación salta las
// animaciones (FLIP, fundidos) y la foto sale con todo ya en su sitio. Sin
// él, el navegador sin interfaz congela las animaciones en su primer cuadro.
function fotografiar({ ruta, consulta = '', destino, ancho = 1500, alto = 950, presupuesto = 15000, quieto = false }) {
  // Absoluta siempre: es la trampa 1.
  const absoluto = path.resolve(destino);
  fs.mkdirSync(path.dirname(absoluto), { recursive: true });
  correr([
    `--window-size=${ancho},${alto}`,
    `--virtual-time-budget=${presupuesto}`,
    `--screenshot=${absoluto}`,
    ...(quieto ? ['--force-prefers-reduced-motion'] : []),
    urlDe(ruta, consulta)
  ]);
  if (!fs.existsSync(absoluto)) {
    throw new Error(`Edge no escribió la captura en ${absoluto}.`);
  }
  return absoluto;
}

// El informe de la prueba de humo vive en un <pre id="salida"> del volcado.
function salidaDe(volcado) {
  const encontrado = volcado.match(/<pre id="salida"[^>]*>([\s\S]*?)<\/pre>/);
  if (!encontrado) return null;
  return encontrado[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

module.exports = { RAIZ, navegador, urlDe, volcar, fotografiar, salidaDe };
