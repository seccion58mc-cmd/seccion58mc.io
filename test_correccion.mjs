// Check de la correccion de departamento en la impresion de vacaciones.
// Correr con: node test_correccion.mjs
import assert from 'node:assert/strict';
import { aplicarCorreccionesDepto } from './public/log/pdfs/correccionDepto.js';

const UP1 = 'ACONDICIONAMIENTO UP1', UP2 = 'ACONDICIONAMIENTO UP2';
const reg = (folio, depto, hora, nombre, numEmpleado = 1) =>
    ({ folioFormulario: folio, depto, fechaEnvio: `2026-09-01T${hora}.000Z`, nombreCompleto: nombre, numEmpleado, carpeta: 'ACONDICIONAMIENTO A', cuatrimestre: '3er' });

// Los 18 registros reales de ACONDICIONAMIENTO A / 3er cuatrimestre
const datos = [
    reg(1, UP1, '01:37:56', 'GABRIELA PERALTA PÉREZ'),
    reg(2, UP1, '01:38:42', 'MARÍA DEL ROSARIO GÓMEZ GONZÁLEZ'),
    reg(3, UP1, '01:46:33', 'JUAN DANIEL PÉREZ PÉREZ'),
    reg(4, UP1, '01:54:29', 'DALIA LUCILA HERNÁNDEZ PERALTA'),
    reg(5, UP1, '01:56:05', 'OSCAR ALCÁNTARA CALIXTO'),
    reg(6, UP1, '01:58:23', 'JONATHAN FLORES SANDOVAL'),
    reg(7, UP1, '02:03:29', 'RICARDO LABASTIDA DE JESÚS'),
    reg(8, UP1, '02:11:09', 'DANIEL MENDOZA GONZÁLEZ'),
    reg(1, UP2, '01:40:29', 'JOSÉ ANTONIO SÁNCHEZ GABRIEL', 831953),
    reg(2, UP2, '01:43:14', 'JANNET SALAS TORRES'),
    reg(3, UP2, '01:48:00', 'NORMA DOMÍNGUEZ CONTRERAS'),
    reg(4, UP2, '01:50:12', 'VERÓNICA GONZÁLEZ ROSALES'),
    reg(5, UP2, '01:51:16', 'VICTORINO SALAZAR IGNACIO'),
    reg(6, UP2, '01:57:29', 'SERGIO ISAAC ROMERO GONZÁLEZ'),
    reg(7, UP2, '02:05:28', 'JOSÉ OMAR LARA SALAS'),
    reg(8, UP2, '02:08:12', 'JESÚS MANUEL SANDOVAL ORTIZ'),
    reg(9, UP2, '02:09:21', 'ALEJANDRO TRIANO ANDRADE'),
    reg(10, UP2, '02:13:05', 'GABRIELA CORREA ALFONZO')
];

aplicarCorreccionesDepto(datos, 'ACONDICIONAMIENTO A', '3er');

const lista = depto => datos.filter(r => r.depto === depto)
    .sort((a, b) => a.folioFormulario - b.folioFormulario)
    .map(r => `${r.folioFormulario} ${r.nombreCompleto}`);

// Jose Antonio queda 3ro en UP1: se registro 01:40:29, entre Ma. del Rosario y Juan Daniel
assert.deepEqual(lista(UP1), [
    '1 GABRIELA PERALTA PÉREZ',
    '2 MARÍA DEL ROSARIO GÓMEZ GONZÁLEZ',
    '3 JOSÉ ANTONIO SÁNCHEZ GABRIEL',
    '4 JUAN DANIEL PÉREZ PÉREZ',
    '5 DALIA LUCILA HERNÁNDEZ PERALTA',
    '6 OSCAR ALCÁNTARA CALIXTO',
    '7 JONATHAN FLORES SANDOVAL',
    '8 RICARDO LABASTIDA DE JESÚS',
    '9 DANIEL MENDOZA GONZÁLEZ'
]);

// UP2 se cierra el hueco: todos suben un lugar
assert.deepEqual(lista(UP2), [
    '1 JANNET SALAS TORRES',
    '2 NORMA DOMÍNGUEZ CONTRERAS',
    '3 VERÓNICA GONZÁLEZ ROSALES',
    '4 VICTORINO SALAZAR IGNACIO',
    '5 SERGIO ISAAC ROMERO GONZÁLEZ',
    '6 JOSÉ OMAR LARA SALAS',
    '7 JESÚS MANUEL SANDOVAL ORTIZ',
    '8 ALEJANDRO TRIANO ANDRADE',
    '9 GABRIELA CORREA ALFONZO'
]);

// Nadie se pierde ni se duplica
assert.equal(datos.length, 18);
assert.equal(lista(UP1).length + lista(UP2).length, 18);

// Otras areas y cuatrimestres no se tocan
const otra = [reg(1, UP2, '01:40:29', 'JOSÉ ANTONIO SÁNCHEZ GABRIEL', 831953)];
aplicarCorreccionesDepto(otra, 'ACONDICIONAMIENTO A', '2do');
assert.equal(otra[0].depto, UP2, 'el 2do cuatrimestre no debe cambiar');

console.log('OK — correccion de depto e impresion correctas');
