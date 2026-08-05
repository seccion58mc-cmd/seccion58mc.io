// Check del nombre de los ZIP del proceso de becas.
// Correr con: node test_becas.mjs
import assert from 'node:assert/strict';
import { limpiar, nombreZip } from './public/log/pdfs/adminBecas/nombreZip.js';

// El caso que pidio el usuario
assert.equal(nombreZip({ numEmpleado: '12345', nombreCompleto: 'JUAN RAMIREZ' }), '12345JuanRamirez.zip');

// Nombre completo con apellido materno
assert.equal(nombreZip({ numEmpleado: '12345', nombreCompleto: 'JUAN RAMIREZ VARGAS' }), '12345JuanRamirezVargas.zip');

// Acentos y enies fuera: el nombre viaja en un nombre de archivo
assert.equal(limpiar('JUÁN RAMÍREZ'), 'JuanRamirez');
assert.equal(limpiar('MUÑOZ PEÑA'), 'MunozPena');

// Espacios de mas no meten mayusculas sueltas ni cadenas vacias
assert.equal(limpiar('  ANA   MARIA  LOPEZ '), 'AnaMariaLopez');

// Nada que rompa la ruta del archivo descargado
assert.equal(limpiar('JUAN/PEREZ..\\LOPEZ'), 'Juanperezlopez');
assert.equal(limpiar(''), '');
assert.equal(limpiar(undefined), '');

console.log('OK — nombres de ZIP correctos');
