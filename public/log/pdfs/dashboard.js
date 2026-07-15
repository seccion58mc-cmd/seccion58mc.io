// Dashboard home: recuadros de conteos reales + calendario con recordatorios.
// NO toca la lógica de PDF (appPdf.js). Reusa la app de Firebase ya inicializada.
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCcBqpSXsz_wqm3xyg0NSJYnvQTK0NhkXg",
    authDomain: "formatovacaciones.firebaseapp.com",
    projectId: "formatovacaciones",
    storageBucket: "formatovacaciones.firebasestorage.app",
    messagingSenderId: "753669687689",
    appId: "1:753669687689:web:b37af5de6ba6b1391ef958",
    measurementId: "G-LMKRM8VKM7"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

function init() {
    if (!$('cal-grid')) return; // solo corre en el dashboard

    // Recuadros: conteos reales por colección
    cargarStats();
    document.querySelectorAll('.stat-tile[data-goto]').forEach(t =>
        t.addEventListener('click', () => window.navigateTo && window.navigateTo(t.dataset.goto)));

    // Calendario + recordatorios
    const hoy = new Date();
    calState.year = hoy.getFullYear();
    calState.month = hoy.getMonth();
    calState.selected = ymd(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    $('cal-prev').addEventListener('click', () => cambiarMes(-1));
    $('cal-next').addEventListener('click', () => cambiarMes(1));
    $('cal-grid').addEventListener('click', e => {
        const btn = e.target.closest('.cal-day[data-date]');
        if (btn) seleccionar(btn.dataset.date);
    });
    $('rem-add-btn').addEventListener('click', agregarRecordatorio);
    $('rem-input').addEventListener('keydown', e => { if (e.key === 'Enter') agregarRecordatorio(); });
    $('rem-list').addEventListener('click', e => {
        const del = e.target.closest('.rem-del[data-id]');
        if (del) eliminarRecordatorio(del.dataset.id);
    });

    cargarRecordatorios().then(() => { renderCalendario(); renderRecordatorios(); renderProximos(); });
}

// ---------- Conteos ----------
async function cargarStats() {
    const pares = [
        ['stat-trabajadores', 'trabajadores'],
        ['stat-emergencia', 'contactosEmergencia'],
        ['stat-vacaciones', 'vacaciones'],
        ['stat-correos', 'ListadoCorreos'],
    ];
    await Promise.all(pares.map(async ([elId, col]) => {
        try {
            const snap = await getDocs(collection(db, col));
            const el = $(elId);
            if (el) el.textContent = snap.size.toLocaleString('es-MX');
        } catch (e) {
            const el = $(elId);
            if (el) el.textContent = '—';
        }
    }));
}

// ---------- Calendario ----------
const calState = { year: 0, month: 0, selected: null };
let recordatorios = {}; // { 'YYYY-MM-DD': [{id, texto}] }

function ymd(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fechaBonita(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
}

async function cargarRecordatorios() {
    recordatorios = {};
    try {
        const snap = await getDocs(collection(db, 'recordatorios'));
        snap.forEach(docu => {
            const r = docu.data();
            if (!r.fecha) return;
            (recordatorios[r.fecha] ||= []).push({ id: docu.id, texto: r.texto || '' });
        });
    } catch (e) {
        console.error('No se pudieron cargar recordatorios:', e);
    }
}

function cambiarMes(delta) {
    calState.month += delta;
    if (calState.month < 0) { calState.month = 11; calState.year--; }
    else if (calState.month > 11) { calState.month = 0; calState.year++; }
    renderCalendario();
}

function seleccionar(ds) {
    calState.selected = ds;
    renderCalendario();
    renderRecordatorios();
}

function renderCalendario() {
    $('cal-title').textContent = `${MESES[calState.month]} ${calState.year}`;
    const first = new Date(calState.year, calState.month, 1);
    const startCol = (first.getDay() + 6) % 7; // lunes = 0
    const dias = new Date(calState.year, calState.month + 1, 0).getDate();
    const hoy = new Date();
    const hoyStr = ymd(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    let html = '';
    for (let i = 0; i < startCol; i++) html += '<span class="cal-day cal-empty"></span>';
    for (let d = 1; d <= dias; d++) {
        const ds = ymd(calState.year, calState.month, d);
        const tiene = (recordatorios[ds] || []).length;
        const cls = ['cal-day'];
        if (ds === hoyStr) cls.push('is-today');
        if (ds === calState.selected) cls.push('is-selected');
        if (tiene) cls.push('has-rem');
        html += `<button class="${cls.join(' ')}" data-date="${ds}">${d}</button>`;
    }
    $('cal-grid').innerHTML = html;
}

// ---------- Avisos: proximo (rojo) + 3 siguientes (amarillo) ----------
function diffDias(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    const objetivo = new Date(y, m - 1, d); objetivo.setHours(0, 0, 0, 0);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / 86400000);
}

function etiquetaDias(n) {
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Manana';
    return `En ${n} dias`;
}

function renderProximos() {
    const cont = $('upcoming-card');
    if (!cont) return;

    const items = [];
    Object.keys(recordatorios).forEach(fecha => {
        const n = diffDias(fecha);
        if (n < 0) return; // ya pasaron
        recordatorios[fecha].forEach(r => items.push({ fecha, texto: r.texto, n }));
    });
    items.sort((a, b) => a.n - b.n);

    if (!items.length) {
        cont.innerHTML = '<div class="up-empty"><i class="fa-solid fa-calendar-check"></i> No tienes recordatorios proximos</div>';
        return;
    }

    const prox = items[0];
    const siguientes = items.slice(1, 4);

    let html = `
        <div class="up-red">
            <div class="up-red-ico"><i class="fa-solid fa-bell"></i></div>
            <div class="up-red-body">
                <span class="up-red-when">${etiquetaDias(prox.n)}</span>
                <span class="up-red-text">es tu evento que llamaste &laquo;${escapar(prox.texto)}&raquo;</span>
            </div>
        </div>`;

    if (siguientes.length) {
        html += '<div class="up-yellow-list">' + siguientes.map(s => `
            <div class="up-yellow">
                <span class="up-y-when">${etiquetaDias(s.n)}</span>
                <span class="up-y-text">${escapar(s.texto)}</span>
            </div>`).join('') + '</div>';
    }

    cont.innerHTML = html;
}

// ---------- Recordatorios ----------
function escapar(s) {
    return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderRecordatorios() {
    $('rem-date').textContent = calState.selected ? fechaBonita(calState.selected) : '';
    const lista = recordatorios[calState.selected] || [];
    $('rem-list').innerHTML = lista.length
        ? lista.map(r => `
            <li class="rem-item">
                <span class="rem-text">${escapar(r.texto)}</span>
                <button class="rem-del" data-id="${r.id}" aria-label="Eliminar recordatorio"><i class="fa-solid fa-trash-can"></i></button>
            </li>`).join('')
        : '<li class="rem-empty">Sin recordatorios este dia</li>';
}

async function agregarRecordatorio() {
    const input = $('rem-input');
    const texto = input.value.trim();
    if (!texto || !calState.selected) return;
    try {
        const ref = await addDoc(collection(db, 'recordatorios'), {
            fecha: calState.selected, texto, timestamp: Date.now()
        });
        (recordatorios[calState.selected] ||= []).push({ id: ref.id, texto });
        input.value = '';
        renderCalendario();
        renderRecordatorios();
        renderProximos();
    } catch (e) {
        console.error('No se pudo agregar el recordatorio:', e);
        swalTema({ icon: 'error', title: 'No se pudo guardar', text: 'Revisa la conexion e intenta de nuevo.' });
    }
}

async function eliminarRecordatorio(id) {
    const res = await swalTema({
        title: 'Eliminar recordatorio',
        text: 'Esta accion no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
    });
    if (!res.isConfirmed) return;
    try {
        await deleteDoc(doc(db, 'recordatorios', id));
        recordatorios[calState.selected] = (recordatorios[calState.selected] || []).filter(r => r.id !== id);
        renderCalendario();
        renderRecordatorios();
        renderProximos();
    } catch (e) {
        console.error('No se pudo eliminar:', e);
        swalTema({ icon: 'error', title: 'No se pudo eliminar', text: 'Intenta de nuevo.' });
    }
}

// SweetAlert2 con colores segun tema
function swalTema(opts) {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return Swal.fire({
        background: light ? '#FFFFFF' : '#131C2E',
        color: light ? '#0D1220' : '#F0F4FF',
        ...opts,
    });
}
