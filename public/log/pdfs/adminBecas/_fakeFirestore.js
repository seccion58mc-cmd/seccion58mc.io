// Firestore de mentiras, en memoria. Solo existe para _pruebaAdmin.html:
// el import map de esa pagina lo pone en lugar del SDK real.
export const datos = { becas: {}, becasArchivos: {} };

export function reset(becas = {}, archivos = {}) {
    datos.becas = structuredClone(becas);
    datos.becasArchivos = structuredClone(archivos);
}

export const collection = (db, nombre) => ({ _col: nombre });
export const doc = (db, nombre, id) => ({ _col: nombre, _id: id });
export const where = (campo, op, valor) => ({ campo, op, valor });
export const query = (col, ...filtros) => ({ ...col, _filtros: filtros });

export async function getDocs(ref) {
    let filas = Object.entries(datos[ref._col] || {});
    for (const f of ref._filtros || []) {
        filas = filas.filter(([, v]) => f.op === '==' && v[f.campo] === f.valor);
    }
    const docs = filas.map(([id, v]) => ({ id, data: () => structuredClone(v) }));
    return { docs, size: docs.length, empty: docs.length === 0, forEach: cb => docs.forEach(cb) };
}

export async function getDoc(ref) {
    const v = datos[ref._col]?.[ref._id];
    return { exists: () => !!v, id: ref._id, data: () => v && structuredClone(v) };
}

export async function updateDoc(ref, cambios) {
    if (!datos[ref._col]?.[ref._id]) throw new Error('no existe: ' + ref._id);
    Object.assign(datos[ref._col][ref._id], structuredClone(cambios));
}

export async function deleteDoc(ref) {
    delete datos[ref._col]?.[ref._id];
}
