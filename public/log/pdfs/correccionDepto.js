// Correcciones puntuales de departamento — SOLO afectan la impresion del PDF.
// La base de datos no se toca: los registros se corrigen en memoria antes de imprimir.
//
// Caso 831953: JOSE ANTONIO SANCHEZ GABRIEL se registro en ACONDICIONAMIENTO UP2
// del 3er cuatrimestre, pero su departamento real es UP1 (su supervisor, FERNANDO
// ROMERO, es el de UP1). Al moverlo se renumeran ambos departamentos por hora de
// registro, que es el mismo criterio con el que se asignan los folios al enviar.
//
// ponytail: lista hardcodeada a proposito. Si esto se vuelve frecuente, la solucion
// correcta es corregir el registro en Firestore, no seguir agregando lineas aqui.
export const CORRECCIONES_DEPTO = [
    {
        numEmpleado: 831953,
        carpeta: 'ACONDICIONAMIENTO A',
        cuatrimestre: '3er',
        deptoErroneo: 'ACONDICIONAMIENTO UP2',
        deptoReal: 'ACONDICIONAMIENTO UP1'
    }
];

// Mueve a los trabajadores mal registrados a su departamento real y renumera los
// departamentos afectados por fechaEnvio. Muta los objetos recibidos (son copias
// del snapshot de Firestore) y devuelve el mismo arreglo.
export function aplicarCorreccionesDepto(records, carpeta, cuatrimestre, correcciones = CORRECCIONES_DEPTO) {
    const aplicables = correcciones.filter(c => c.carpeta === carpeta && c.cuatrimestre === cuatrimestre);
    if (aplicables.length === 0) return records;

    const deptosTocados = new Set();
    aplicables.forEach(c => {
        const registro = records.find(r =>
            Number(r.numEmpleado) === Number(c.numEmpleado) && r.depto === c.deptoErroneo);
        if (!registro) return;
        registro.depto = c.deptoReal;
        deptosTocados.add(c.deptoErroneo);
        deptosTocados.add(c.deptoReal);
    });

    deptosTocados.forEach(depto => {
        records
            .filter(r => r.depto === depto)
            .sort((a, b) => (a.fechaEnvio || '').localeCompare(b.fechaEnvio || ''))
            .forEach((r, i) => { r.folioFormulario = i + 1; });
    });

    return records;
}
