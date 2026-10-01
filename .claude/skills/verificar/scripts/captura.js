// Fotografía la aplicación en un estado concreto, con pruebas/captura.html.
//
//   node .claude/skills/verificar/scripts/captura.js <consulta> [destino.png] [--alto 950] [--ancho 1500] [--quieto]
//
//   node .claude/skills/verificar/scripts/captura.js "vista=anidados&n=10&l=4&paso=fin"
//   node .claude/skills/verificar/scripts/captura.js vista=encadenamiento cadena.png
//
// Sin destino, la captura va a capturas/<vista>.png fuera del repositorio
// —en el directorio temporal— porque son material de trabajo y no del
// proyecto: las que llegaron a `docs/` se borraron a propósito.
const os = require('os');
const path = require('path');
const { fotografiar } = require('./navegador.js');

// `--quieto` no lleva valor: se saca antes de leer los demás.
const quieto = process.argv.includes('--quieto');
const argumentos = process.argv.slice(2).filter((a) => a !== '--quieto');
const valorDe = (bandera, porDefecto) => {
  const i = argumentos.indexOf(bandera);
  return i === -1 ? porDefecto : Number(argumentos[i + 1]);
};

// Los sueltos son la consulta y el destino: una bandera se lleva por delante
// su propio valor.
const sueltos = [];
for (let i = 0; i < argumentos.length; i++) {
  if (argumentos[i].startsWith('--')) {
    i++;
    continue;
  }
  sueltos.push(argumentos[i]);
}

const consulta = sueltos[0];
if (!consulta) {
  console.error('Falta la consulta. Ejemplo: "vista=anidados&n=10&l=4&paso=fin"');
  console.error('Vistas: menu, secuencial, binaria, hash, hash-libre, anidados, encadenamiento,');
  console.error('        arbol-digital, residuos, residuos-multiples,');
  console.error('        eliminar-secuencial, eliminar-binaria, eliminar-hash.');
  process.exit(2);
}

const vista = (consulta.match(/vista=([^&]+)/) || [null, 'captura'])[1];
const destino = sueltos[1] || path.join(os.tmpdir(), 'cc2-capturas', `${vista}.png`);

const escrita = fotografiar({
  ruta: 'pruebas/captura.html',
  consulta,
  destino,
  alto: valorDe('--alto', 950),
  ancho: valorDe('--ancho', 1500),
  quieto
});

console.log(escrita);
