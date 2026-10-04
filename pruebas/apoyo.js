// Los archivos de dominio/algoritmos usan el patrón window.CC2.<capa>.<modulo>
// pensado para <script> clásicos en el navegador. Node no tiene `window`;
// este shim lo simula para poder requerirlos tal cual desde las pruebas.
global.window = global;

// La lista sale del manifiesto, la misma que carga el navegador: solo el grupo
// de cálculo puro, que es el que no toca el DOM (js/manifiesto.js).
const { PUROS } = require('../js/manifiesto.js');
for (const ruta of PUROS) require(`../js/${ruta}`);

module.exports = window.CC2;
