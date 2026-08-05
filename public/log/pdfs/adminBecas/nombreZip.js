// Nombre del ZIP y de los archivos que van dentro.
// Vive aparte de adminBecas.js para poder probarlo en Node (ver test_becas.mjs en la raiz).

// "JUAN RAMIREZ VARGAS" => "JuanRamirezVargas"
export function limpiar(texto) {
    return (texto || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita acentos
        .replace(/[^a-zA-Z\s]/g, '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');
}

// 12345 + "JUAN RAMIREZ VARGAS" => "12345JuanRamirezVargas.zip"
export function nombreZip(reg) {
    return `${reg.numEmpleado}${limpiar(reg.nombreCompleto)}.zip`;
}
