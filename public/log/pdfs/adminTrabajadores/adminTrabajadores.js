import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { LISTA_PLANTA, LISTA_EVENTUAL } from '../adminContactosEmergencia/listaOficial.js';

let trabajadores = [];      // [{ id, nombre, tipo, _semilla? }]

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('pdfAuth') !== 'true') {
        window.location.href = '../../index.html';
        return;
    }
    document.getElementById('searchInput').addEventListener('input', render);
    document.querySelectorAll('.form-alta').forEach(f => f.addEventListener('submit', darDeAlta));
    document.querySelectorAll('.alta-nombre').forEach(inp => {
        inp.addEventListener('input', function () { this.value = this.value.toUpperCase(); sugerir(this.closest('form')); });
        inp.addEventListener('focus', function () { sugerir(this.closest('form')); });
        inp.addEventListener('blur', function () {
            const box = this.closest('form').querySelector('.sugerencias');
            setTimeout(() => { box.hidden = true; }, 150);
        });
    });
    document.getElementById('btnSembrar').addEventListener('click', sembrar);
    cargar();
});

// ---- UI: modal de confirmación y toast (reemplazan a confirm()/alert() nativos) ----
function confirmar({ titulo, mensaje, textoOk = 'Confirmar', peligro = false }) {
    return new Promise(resolve => {
        const modal = document.getElementById('modalConfirm');
        modal.querySelector('.mc-titulo').textContent = titulo;
        modal.querySelector('.mc-mensaje').innerHTML = mensaje;
        const ok = modal.querySelector('.mc-ok');
        const cancel = modal.querySelector('.mc-cancel');
        ok.textContent = textoOk;
        ok.classList.toggle('mc-ok--peligro', peligro);
        modal.style.display = 'flex';
        const cerrar = val => { modal.style.display = 'none'; ok.onclick = cancel.onclick = modal.onclick = null; resolve(val); };
        ok.onclick = () => cerrar(true);
        cancel.onclick = () => cerrar(false);
        modal.onclick = e => { if (e.target === modal) cerrar(false); };
    });
}

function aviso(mensaje, tipo = 'ok') {
    const t = document.getElementById('toast');
    t.textContent = mensaje;
    t.className = 'toast toast--' + tipo + ' show';
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => t.classList.remove('show'), 2800);
}

function normalizar(s) {
    return (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ').trim();
}

// Solo para MOSTRAR/ORDENAR: reordena el texto guardado "APELLIDO... NOMBRE" a
// "NOMBRE APELLIDO...". No cambia lo que se guarda ni el matching de otros módulos.
// ponytail: heurística de 2 apellidos (soporta partículas tipo "DE LA"); un nombre
//           de pila muy largo puede quedar mal en casos raros. Ceiling aceptado.
const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'MC', 'SAN', 'SANTA']);
function nombrePrimero(full) {
    const orig = (full || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const norm = orig.map(w => normalizar(w));  // normalizado solo para detectar partículas
    let i = 0; const apeIdx = [];
    for (let slot = 0; slot < 2 && i < orig.length - 1; slot++) {
        while (i < orig.length - 1 && PARTICULAS.has(norm[i])) apeIdx.push(i++);
        if (i < orig.length - 1) apeIdx.push(i++);
    }
    return [...orig.slice(i), ...apeIdx.map(k => orig[k])].join(' ').trim();
}

// Busca nombres parecidos en la MISMA lista mientras se escribe, para evitar duplicados.
function sugerir(form) {
    const input = form.querySelector('.alta-nombre');
    const box = form.querySelector('.sugerencias');
    const tipo = form.dataset.tipo;
    const term = normalizar(input.value);
    const tokens = term.split(' ').filter(Boolean);

    if (tokens.length === 0 || term.length < 2) { box.hidden = true; return; }

    const mismos = trabajadores.filter(t => t.tipo === tipo);
    const exacto = mismos.some(t => normalizar(t.nombre) === term);
    const similares = mismos
        .filter(t => { const n = normalizar(t.nombre); return tokens.every(tk => n.includes(tk)); })
        .sort((a, b) => nombrePrimero(a.nombre).localeCompare(nombrePrimero(b.nombre)))
        .slice(0, 6);

    if (!exacto && !similares.length) { box.hidden = true; return; }

    box.innerHTML =
        (exacto ? '<div class="sug-existe">⚠ Ese nombre ya está en la lista</div>' : '') +
        similares.map(t => `<div class="sug-item">${nombrePrimero(t.nombre)}</div>`).join('');
    box.hidden = false;
}

async function cargar() {
    try {
        const snap = await getDocs(collection(window.db, 'trabajadores'));
        trabajadores = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Si aún no se siembra, mostramos la lista base (los que "ya estaban") como
        // filas sin guardar, para que se vean desde el principio.
        if (trabajadores.length === 0) {
            trabajadores = [
                ...LISTA_PLANTA.map(nombre => ({ id: null, nombre, tipo: 'PLANTA', _semilla: true })),
                ...LISTA_EVENTUAL.map(nombre => ({ id: null, nombre, tipo: 'EVENTUAL', _semilla: true })),
            ];
        }
        document.getElementById('loading').style.display = 'none';
        actualizarControles();
        render();
    } catch (e) {
        console.error('Error al cargar trabajadores:', e);
        document.getElementById('loading').textContent = 'Error al cargar. Revisa la conexión.';
    }
}

function actualizarControles() {
    const haySemilla = trabajadores.some(t => t._semilla);
    document.getElementById('btnSembrar').style.display = haySemilla ? 'inline-block' : 'none';
    document.getElementById('avisoSemilla').style.display = haySemilla ? 'block' : 'none';
}

async function darDeAlta(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const tipo = form.dataset.tipo;
    const input = form.querySelector('.alta-nombre');
    const nombre = normalizar(input.value);

    if (nombre.split(' ').length < 2) {
        aviso('Escribe el nombre completo (apellido y nombre).', 'error');
        return;
    }
    if (trabajadores.some(t => normalizar(t.nombre) === nombre && t.tipo === tipo)) {
        aviso('Ese trabajador ya está en la lista.', 'error');
        return;
    }
    const ok = await confirmar({ titulo: 'Dar de alta', mensaje: `Se agregará a <b>${nombre}</b> como <b>${tipo}</b>.`, textoOk: 'Dar de alta' });
    if (!ok) return;

    try {
        const ref = await addDoc(collection(window.db, 'trabajadores'), { nombre, tipo, timestamp: Date.now() });
        trabajadores.push({ id: ref.id, nombre, tipo });
        input.value = '';
        form.querySelector('.sugerencias').hidden = true;
        render();
        aviso('Trabajador dado de alta');
    } catch (err) {
        console.error('Error al dar de alta:', err);
        aviso('No se pudo dar de alta. Intenta de nuevo.', 'error');
    }
}

window.darDeBaja = async function (id) {
    const t = trabajadores.find(x => x.id === id);
    if (!t) return;
    const ok = await confirmar({
        titulo: 'Dar de baja',
        mensaje: `Se eliminará a <b>${t.nombre}</b> (${t.tipo}) de la base de datos.<br>Esta acción no se puede deshacer.`,
        textoOk: 'Dar de baja', peligro: true,
    });
    if (!ok) return;

    try {
        await deleteDoc(doc(window.db, 'trabajadores', id));
        trabajadores = trabajadores.filter(x => x.id !== id);
        render();
        aviso('Trabajador dado de baja');
    } catch (err) {
        console.error('Error al dar de baja:', err);
        aviso('No se pudo dar de baja. Intenta de nuevo.', 'error');
    }
};

// Siembra inicial: sube las listas base a Firestore una sola vez (solo si hay filas de semilla).
async function sembrar() {
    if (!trabajadores.some(t => t._semilla)) return;
    const total = LISTA_PLANTA.length + LISTA_EVENTUAL.length;
    const ok = await confirmar({
        titulo: 'Sembrar lista base',
        mensaje: `Se guardarán <b>${total}</b> trabajadores (${LISTA_PLANTA.length} planta + ${LISTA_EVENTUAL.length} eventuales) en la base de datos.`,
        textoOk: 'Sembrar',
    });
    if (!ok) return;

    try {
        const semilla = [
            ...LISTA_PLANTA.map(nombre => ({ nombre, tipo: 'PLANTA' })),
            ...LISTA_EVENTUAL.map(nombre => ({ nombre, tipo: 'EVENTUAL' })),
        ];
        // writeBatch soporta hasta 500 ops; aquí caben de sobra.
        const batch = writeBatch(window.db);
        semilla.forEach(s => batch.set(doc(collection(window.db, 'trabajadores')), { ...s, timestamp: Date.now() }));
        await batch.commit();
        aviso('Lista base guardada');
        cargar();
    } catch (err) {
        console.error('Error al sembrar:', err);
        aviso('No se pudo sembrar la lista.', 'error');
    }
}

function render() {
    const term = normalizar(document.getElementById('searchInput').value);
    const orden = (a, b) => nombrePrimero(a.nombre).localeCompare(nombrePrimero(b.nombre));
    const tokens = term.split(' ').filter(Boolean);
    const filtrar = arr => tokens.length
        ? arr.filter(t => { const n = normalizar(t.nombre); return tokens.every(tk => n.includes(tk)); })
        : arr;

    pintar('listaPlanta', 'cntPlanta', filtrar(trabajadores.filter(t => t.tipo === 'PLANTA').sort(orden)));
    pintar('listaEventual', 'cntEventual', filtrar(trabajadores.filter(t => t.tipo === 'EVENTUAL').sort(orden)));
}

function pintar(ulId, cntId, lista) {
    document.getElementById(cntId).textContent = lista.length;
    const ul = document.getElementById(ulId);
    if (!lista.length) {
        ul.innerHTML = '<li class="empty">Sin resultados.</li>';
        return;
    }
    ul.innerHTML = lista.map(t => `
        <li>
            <span class="nombre">${nombrePrimero(t.nombre)}</span>
            ${t._semilla
                ? '<span class="nota-semilla">sin guardar</span>'
                : `<button class="btn-baja" onclick="darDeBaja('${t.id}')" title="Dar de baja">🗑️</button>`}
        </li>`).join('');
}
