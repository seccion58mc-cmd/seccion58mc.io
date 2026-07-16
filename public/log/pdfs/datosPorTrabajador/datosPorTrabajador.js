import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { cargarTrabajadores } from '../adminContactosEmergencia/listaOficial.js';

// Colecciones a revisar. count: cuenta para el % de completitud.
// tipo: solo aplica a ese tipo de trabajador. condicional: se muestra pero no cuenta (depende de género/caso).
const DATASETS = [
    { key: 'ingresos',            label: 'Alta Sindicato',       icon: 'fa-solid fa-file-signature', count: true },
    { key: 'contactosEmergencia', label: 'Contactos Emergencia', icon: 'fa-solid fa-phone', count: true },
    { key: 'vacaciones',          label: 'Vacaciones',           icon: 'fa-solid fa-umbrella-beach', count: true },
    { key: 'ListadoCorreos',      label: 'Correo',               icon: 'fa-solid fa-envelope', count: true },
    { key: 'ayudaDefuncion',      label: 'Ayuda Defunción',      icon: 'fa-solid fa-ribbon', count: true },
    { key: 'fiestaFinAnio',       label: 'Fiesta Fin de Año',    icon: 'fa-solid fa-champagne-glasses', count: true },
    { key: 'cenaNavidenia',       label: 'Cena Navideña',        icon: 'fa-solid fa-utensils', count: true },
    { key: 'beneficiarioEventual',label: 'Benef. Eventual',      icon: 'fa-solid fa-user-tie', count: true, tipo: 'EVENTUAL' },
    { key: 'diamadres',           label: 'Día de las Madres',    icon: 'fa-solid fa-venus', condicional: true },
    { key: 'diapadre',            label: 'Día del Padre',        icon: 'fa-solid fa-mars', condicional: true },
];

// Campos donde puede venir el nombre en cualquiera de las colecciones.
const NAME_FIELDS = ['nombreCompleto', 'nombre', 'nombres', 'nombreTrabajador', 'apellidoPaterno', 'apellidoMaterno'];

let trabajadores = []; // [{ nombre, tipo, tiene:{key:bool} }]
let tokenSets = {};    // { key: [Set, Set, ...] }
let filtroTipo = 'TODOS';

document.addEventListener('DOMContentLoaded', () => {
    if (!verificarAutenticacion()) return;
    document.getElementById('searchInput').addEventListener('input', render);
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            filtroTipo = btn.dataset.filtro;
            render();
        });
    });
    cargar();
});

function verificarAutenticacion() {
    if (sessionStorage.getItem('pdfAuth') !== 'true') {
        window.location.href = '../../index.html';
        return false;
    }
    return true;
}

function normalizar(s) {
    return (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokensDeDoc(data) {
    const partes = NAME_FIELDS.map(f => data[f]).filter(Boolean).join(' ');
    return new Set(normalizar(partes).split(' ').filter(Boolean));
}

function tiene(nombreOficial, key) {
    const tokens = normalizar(nombreOficial).split(' ').filter(Boolean);
    if (!tokens.length) return false;
    return (tokenSets[key] || []).some(set => tokens.every(t => set.has(t)));
}

async function cargar() {
    try {
        await Promise.all(DATASETS.map(async ds => {
            const snap = await getDocs(collection(window.db, ds.key));
            tokenSets[ds.key] = snap.docs.map(d => tokensDeDoc(d.data()));
        }));

        const { planta, eventual } = await cargarTrabajadores();
        trabajadores = [
            ...planta.map(n => construir(n, 'PLANTA')),
            ...eventual.map(n => construir(n, 'EVENTUAL')),
        ];

        document.getElementById('loading').style.display = 'none';
        render();
    } catch (e) {
        console.error('Error al cargar:', e);
        document.getElementById('loading').textContent = 'Error al cargar los datos. Revisa la conexión.';
    }
}

function aplica(ds, tipo) {
    if (ds.tipo && ds.tipo !== tipo) return false;
    return true;
}

function construir(nombre, tipo) {
    const estados = {};
    DATASETS.forEach(ds => { estados[ds.key] = aplica(ds, tipo) ? tiene(nombre, ds.key) : null; });
    return { nombre, tipo, estados };
}

// Completitud: solo datasets con count:true que aplican al tipo.
function completitud(t) {
    const relevantes = DATASETS.filter(ds => ds.count && aplica(ds, t.tipo));
    const ok = relevantes.filter(ds => t.estados[ds.key]).length;
    return { ok, total: relevantes.length };
}

function render() {
    const term = normalizar(document.getElementById('searchInput').value);
    let lista = trabajadores;
    if (filtroTipo !== 'TODOS') lista = lista.filter(t => t.tipo === filtroTipo);
    if (term) lista = lista.filter(t => normalizar(t.nombre).includes(term));

    // Stats sobre el filtro actual (sin buscador para que no salte)
    const base = filtroTipo === 'TODOS' ? trabajadores : trabajadores.filter(t => t.tipo === filtroTipo);
    const completos = base.filter(t => { const c = completitud(t); return c.ok === c.total; }).length;
    document.getElementById('statTotal').textContent = base.length;
    document.getElementById('statCompletos').textContent = completos;
    document.getElementById('statFaltantes').textContent = base.length - completos;

    const cont = document.getElementById('grid');
    if (!lista.length) {
        cont.innerHTML = '<p class="empty">Sin resultados.</p>';
        return;
    }
    cont.innerHTML = lista.map(cardHTML).join('');
}

function cardHTML(t) {
    const c = completitud(t);
    const pct = c.total ? Math.round((c.ok / c.total) * 100) : 0;
    const nivel = pct === 100 ? 'full' : pct >= 50 ? 'mid' : 'low';

    const chips = DATASETS.map(ds => {
        const st = t.estados[ds.key];
        const cls = st === null ? 'na' : st ? 'ok' : 'falta';
        const brandIcon = st === null ? 'fa-solid fa-minus' : st ? 'fa-solid fa-check' : 'fa-solid fa-xmark';
        const titulo = st === null ? `${ds.label}: no aplica` : st ? `${ds.label}: registrado` : `${ds.label}: FALTA`;
        return `<span class="chip chip--${cls}" title="${titulo}"><i class="${ds.icon}"></i> ${ds.label} <i class="${brandIcon} chip-status-icon"></i></span>`;
    }).join('');

    return `
        <article class="card">
            <div class="card-top">
                <span class="tipo-pill tipo-pill--${t.tipo.toLowerCase()}">${t.tipo}</span>
                <span class="score score--${nivel}">${c.ok}/${c.total}</span>
            </div>
            <h3 class="card-nombre">${t.nombre}</h3>
            <div class="bar"><div class="bar-fill bar-fill--${nivel}" style="width:${pct}%"></div></div>
            <div class="chips">${chips}</div>
        </article>`;
}

// ponytail: token-match reusa la lógica ya probada de adminContactosEmergencia; si un nombre
// homónimo colisiona, mostrará "tiene" de más. Aceptable para un tablero informativo.
