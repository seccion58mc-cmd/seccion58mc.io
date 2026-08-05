import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { limpiar, nombreZip } from './nombreZip.js';

// Mismo guardia de sesion que adminTrabajadores / datosPorTrabajador
if (sessionStorage.getItem('pdfAuth') !== 'true') {
    window.location.href = '../../index.html';
}

let registros = [];
let seleccionado = null;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cargarRegistros();
    document.getElementById('searchInput').addEventListener('input', render);
    document.getElementById('btnCerrarDetalle').addEventListener('click', cerrarDetalle);
    document.getElementById('btnDescargarZip').addEventListener('click', descargarZip);
    window.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) cerrarDetalle();
    });
});

// ── Cargar ─────────────────────────────────────────────────
async function cargarRegistros() {
    try {
        const snap = await getDocs(collection(window.db, 'becas'));
        registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        registros.sort((a, b) => (a.nombreCompleto || '').localeCompare(b.nombreCompleto || ''));

        const hijos = registros.reduce((n, r) => n + (r.hijos?.length || 0), 0);
        document.getElementById('totalRegistros').textContent = registros.length;
        document.getElementById('totalHijos').textContent     = hijos;
        document.getElementById('totalDocs').textContent      = hijos * 2;

        document.getElementById('loading').style.display = 'none';
        render();
    } catch (err) {
        console.error('Error al cargar becas:', err);
        document.getElementById('loading').innerHTML =
            '<i class="fa-solid fa-triangle-exclamation"></i> No se pudieron cargar las solicitudes.';
    }
}

// ── Render de los cuadritos ────────────────────────────────
function render() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const grid = document.getElementById('empleadosGrid');

    const visibles = registros.filter(r =>
        !q ||
        (r.nombreCompleto || '').toLowerCase().includes(q) ||
        (r.numEmpleado || '').toLowerCase().includes(q)
    );

    document.getElementById('emptyState').style.display = visibles.length ? 'none' : 'block';

    grid.innerHTML = visibles.map(r => `
        <div class="empleado-card" data-id="${r.id}">
            <div class="empleado-nombre">${r.nombreCompleto || '—'}</div>
            <div class="empleado-num">No. ${r.numEmpleado || '—'}</div>
            <div class="empleado-meta">
                <i class="fa-solid fa-child"></i> ${r.hijos?.length || 0} hijo(s)
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('.empleado-card').forEach(card => {
        card.addEventListener('click', () => abrirDetalle(card.dataset.id));
    });
}

// ── Detalle ────────────────────────────────────────────────
function abrirDetalle(id) {
    seleccionado = registros.find(r => r.id === id);
    if (!seleccionado) return;

    document.getElementById('detalleNombre').textContent = seleccionado.nombreCompleto;
    document.getElementById('detalleSub').textContent =
        `No. de empleado ${seleccionado.numEmpleado} · Ingreso: ${seleccionado.fechaIngreso || '—'}`;

    document.getElementById('detalleHijos').innerHTML = (seleccionado.hijos || []).map((h, i) => `
        <div class="hijo-row">
            <div class="hijo-row-nombre">${i + 1}. ${h.nombre}</div>
            <div class="hijo-row-nivel">${h.nivel}</div>
            <div class="hijo-row-docs">
                <span><i class="fa-solid fa-file-lines"></i> Acta de nacimiento</span>
                <span><i class="fa-solid fa-file-lines"></i> Boleta de calificaciones</span>
            </div>
        </div>
    `).join('');

    document.getElementById('modalDetalle').style.display = 'block';
}

function cerrarDetalle() {
    document.getElementById('modalDetalle').style.display = 'none';
    seleccionado = null;
}

// ── Descarga en ZIP ────────────────────────────────────────
async function descargarZip() {
    if (!seleccionado) return;

    const btn = document.getElementById('btnDescargarZip');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando ZIP...';

    try {
        const zip = new JSZip();

        for (const [i, hijo] of (seleccionado.hijos || []).entries()) {
            for (const [tipo, campoId] of [['Acta', 'actaId'], ['Boleta', 'boletaId']]) {
                const archivo = await leerArchivo(hijo[campoId]);
                if (!archivo) continue;
                const ext = archivo.mime === 'application/pdf' ? 'pdf' : 'jpg';
                zip.file(`Hijo${i + 1}_${limpiar(hijo.nombre)}_${tipo}.${ext}`, archivo.data, { base64: true });
            }
        }

        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        descargarBlob(blob, nombreZip(seleccionado));

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Descargado';
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);

    } catch (err) {
        console.error('Error al generar el ZIP:', err);
        btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error al descargar';
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 3000);
    }
}

async function leerArchivo(id) {
    if (!id) return null;
    const snap = await getDoc(doc(window.db, 'becasArchivos', id));
    return snap.exists() ? snap.data() : null;
}

function descargarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
}
