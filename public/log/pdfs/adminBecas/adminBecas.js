import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where }
    from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { limpiar, nombreZip, nombreBase } from './nombreZip.js';

// Mismo guardia de sesion que adminTrabajadores / datosPorTrabajador
if (sessionStorage.getItem('pdfAuth') !== 'true') {
    window.location.href = '../../index.html';
}

// Mismos valores que el formulario publico (public/log/becas/becas.js)
const NIVELES = ['Preescolar', 'Primaria', 'Secundaria', 'Preparatoria', 'Universidad'];
const INGRESO_MAXIMO = '2026-05';
const CAMPOS = ['edNombre', 'edApellidoPaterno', 'edApellidoMaterno', 'edNumEmpleado', 'edFechaIngreso'];

let registros = [];
let seleccionado = null;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cargarRegistros();
    document.getElementById('searchInput').addEventListener('input', render);
    document.getElementById('btnCerrarDetalle').addEventListener('click', cerrarDetalle);
    document.getElementById('btnDescargarZip').addEventListener('click', descargarZip);
    document.getElementById('btnDescargarTodo').addEventListener('click', descargarTodo);

    document.getElementById('btnEditar').addEventListener('click', () => modoEdicion(true));
    document.getElementById('btnCancelarEdicion').addEventListener('click', () => {
        modoEdicion(false);
        abrirDetalle(seleccionado.id); // devuelve los campos a como estaban
    });
    document.getElementById('btnGuardar').addEventListener('click', guardarCambios);

    document.getElementById('btnEliminar').addEventListener('click', abrirConfirmarEliminar);
    document.getElementById('btnCancelarEliminar').addEventListener('click', () => {
        document.getElementById('modalEliminar').style.display = 'none';
    });
    document.getElementById('btnConfirmarEliminar').addEventListener('click', eliminarRegistro);

    // Solo letras y mayusculas en los campos de nombre; solo digitos en el numero
    ['edNombre', 'edApellidoPaterno', 'edApellidoMaterno'].forEach(id => {
        document.getElementById(id).addEventListener('input', function () {
            const pos = this.selectionStart;
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '').toUpperCase();
            this.setSelectionRange(pos, pos);
        });
    });
    document.getElementById('edNumEmpleado').addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 9);
    });

    window.addEventListener('click', e => {
        if (e.target.id === 'modalEliminar') e.target.style.display = 'none';
        else if (e.target.classList.contains('modal')) cerrarDetalle();
    });
});

// ── Cargar ─────────────────────────────────────────────────
async function cargarRegistros() {
    try {
        const snap = await getDocs(collection(window.db, 'becas'));
        registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        registros.sort((a, b) => (a.nombreCompleto || '').localeCompare(b.nombreCompleto || ''));

        actualizarStats();
        document.getElementById('loading').style.display = 'none';
        render();
    } catch (err) {
        console.error('Error al cargar becas:', err);
        document.getElementById('loading').innerHTML =
            '<i class="fa-solid fa-triangle-exclamation"></i> No se pudieron cargar las solicitudes.';
    }
}

function actualizarStats() {
    const hijos = registros.reduce((n, r) => n + (r.hijos?.length || 0), 0);
    document.getElementById('totalRegistros').textContent = registros.length;
    document.getElementById('totalHijos').textContent     = hijos;
    document.getElementById('totalDocs').textContent      = hijos * 2;
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

    // escapado porque las reglas de Firestore permiten que cualquiera escriba
    // en 'becas'; sin esto, un nombre con HTML corre codigo en el panel
    grid.innerHTML = visibles.map(r => `
        <div class="empleado-card" data-id="${escapar(r.id)}">
            <div class="empleado-nombre">${escapar(r.nombreCompleto) || '—'}</div>
            <div class="empleado-num">No. ${escapar(r.numEmpleado) || '—'}</div>
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

    // Campos editables del trabajador
    valor('edNombre',          seleccionado.nombre);
    valor('edApellidoPaterno', seleccionado.apellidoPaterno);
    valor('edApellidoMaterno', seleccionado.apellidoMaterno);
    valor('edNumEmpleado',     seleccionado.numEmpleado);
    valor('edFechaIngreso',    seleccionado.fechaIngreso);

    document.getElementById('detalleHijos').innerHTML = (seleccionado.hijos || []).map((h, i) => `
        <div class="hijo-row">
            <div class="hijo-row-titulo">Hijo/a ${i + 1}</div>
            <div class="campos-grid">
                <div class="campo">
                    <label>Nombre</label>
                    <input type="text" class="ed-hijo-nombre" data-i="${i}" value="${escapar(h.nombre)}" disabled>
                </div>
                <div class="campo">
                    <label>Nivel escolar</label>
                    <select class="ed-hijo-nivel" data-i="${i}" disabled>
                        ${NIVELES.map(n => `<option value="${n}" ${n === h.nivel ? 'selected' : ''}>${n}</option>`).join('')}
                        ${NIVELES.includes(h.nivel) ? '' : `<option value="${escapar(h.nivel)}" selected>${escapar(h.nivel)}</option>`}
                    </select>
                </div>
            </div>
            <div class="hijo-row-docs">
                <span><i class="fa-solid fa-file-lines"></i> Acta de nacimiento</span>
                <span><i class="fa-solid fa-file-lines"></i> Boleta de calificaciones</span>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.ed-hijo-nombre').forEach(inp => {
        inp.addEventListener('input', function () {
            const pos = this.selectionStart;
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '').toUpperCase();
            this.setSelectionRange(pos, pos);
        });
    });

    modoEdicion(false);
    document.getElementById('modalDetalle').style.display = 'block';
}

function cerrarDetalle() {
    document.getElementById('modalDetalle').style.display = 'none';
    modoEdicion(false);
    seleccionado = null;
}

// ── Edicion ────────────────────────────────────────────────
// Los documentos no se editan aqui: si un acta o boleta esta mal, el
// trabajador tiene que volver a llenar el formulario. Editar archivos
// desde el panel seria otra pantalla de subida entera.
function modoEdicion(activo) {
    CAMPOS.forEach(id => document.getElementById(id).disabled = !activo);
    document.querySelectorAll('.ed-hijo-nombre, .ed-hijo-nivel')
        .forEach(el => el.disabled = !activo);

    mostrar('btnEditar',          !activo);
    mostrar('btnDescargarZip',    !activo);
    mostrar('btnEliminar',        !activo);
    mostrar('btnGuardar',          activo);
    mostrar('btnCancelarEdicion',  activo);

    aviso('');
}

async function guardarCambios() {
    const v = id => document.getElementById(id).value.trim();
    const nombre = v('edNombre'), paterno = v('edApellidoPaterno'), materno = v('edApellidoMaterno');
    const numEmpleado = v('edNumEmpleado'), fechaIngreso = v('edFechaIngreso');

    if (!nombre || !paterno || !materno) return aviso('Nombre y apellidos no pueden quedar vacios.', true);
    if (!numEmpleado)                     return aviso('Falta el numero de empleado.', true);
    if (!fechaIngreso)                    return aviso('Falta la fecha de ingreso.', true);
    if (fechaIngreso > INGRESO_MAXIMO)    return aviso('La fecha de ingreso debe ser mayo de 2026 o antes.', true);

    const hijos = (seleccionado.hijos || []).map((h, i) => ({
        ...h,
        nombre: document.querySelector(`.ed-hijo-nombre[data-i="${i}"]`).value.trim(),
        nivel:  document.querySelector(`.ed-hijo-nivel[data-i="${i}"]`).value
    }));
    if (hijos.some(h => !h.nombre)) return aviso('El nombre de cada hijo/a es obligatorio.', true);

    const btn = document.getElementById('btnGuardar');
    btn.disabled = true;
    aviso('Guardando...');

    try {
        // El numero de empleado sigue siendo unico despues de editarlo
        if (numEmpleado !== seleccionado.numEmpleado) {
            const choca = await getDocs(query(
                collection(window.db, 'becas'), where('numEmpleado', '==', numEmpleado)));
            if (!choca.empty) {
                btn.disabled = false;
                return aviso(`Ya existe otra solicitud con el numero de empleado ${numEmpleado}.`, true);
            }
        }

        const cambios = {
            nombre, apellidoPaterno: paterno, apellidoMaterno: materno,
            nombreCompleto: `${nombre} ${paterno} ${materno}`,
            numEmpleado, fechaIngreso, hijos
        };
        await updateDoc(doc(window.db, 'becas', seleccionado.id), cambios);

        Object.assign(seleccionado, cambios);
        const i = registros.findIndex(r => r.id === seleccionado.id);
        if (i >= 0) Object.assign(registros[i], cambios);

        modoEdicion(false);
        abrirDetalle(seleccionado.id);
        render();
        aviso('Cambios guardados.');
    } catch (err) {
        console.error('Error al guardar:', err);
        aviso('No se pudieron guardar los cambios. Intenta de nuevo.', true);
    } finally {
        btn.disabled = false;
    }
}

// ── Eliminacion ────────────────────────────────────────────
function abrirConfirmarEliminar() {
    if (!seleccionado) return;
    document.getElementById('textoEliminar').textContent =
        `${seleccionado.nombreCompleto} — No. ${seleccionado.numEmpleado}`;
    document.getElementById('modalEliminar').style.display = 'block';
}

async function eliminarRegistro() {
    if (!seleccionado) return;
    const btn = document.getElementById('btnConfirmarEliminar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Eliminando...';

    try {
        // Primero los archivos: si algo falla a media, el registro sigue
        // ahi y se puede reintentar. Al reves quedarian PDFs sin dueño.
        const ids = (seleccionado.hijos || []).flatMap(h => [h.actaId, h.boletaId]).filter(Boolean);
        await Promise.all(ids.map(id => deleteDoc(doc(window.db, 'becasArchivos', id))));
        await deleteDoc(doc(window.db, 'becas', seleccionado.id));

        registros = registros.filter(r => r.id !== seleccionado.id);
        actualizarStats();
        document.getElementById('modalEliminar').style.display = 'none';
        cerrarDetalle();
        render();
    } catch (err) {
        console.error('Error al eliminar:', err);
        alert('No se pudo eliminar la solicitud. Intenta de nuevo.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash"></i> Si, eliminar';
    }
}

// ── Helpers de UI ──────────────────────────────────────────
const valor   = (id, v) => { document.getElementById(id).value = v || ''; };
const mostrar = (id, v) => { document.getElementById(id).style.display = v ? '' : 'none'; };

function aviso(msg, esError = false) {
    const el = document.getElementById('avisoEdicion');
    el.textContent = msg;
    el.className = 'aviso-edicion' + (msg ? (esError ? ' aviso-edicion--error' : ' aviso-edicion--ok') : '');
}

function escapar(t) {
    return String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
        await agregarDocumentos(zip, seleccionado, '');

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

// Todas las solicitudes visibles en un solo ZIP, una carpeta por trabajador.
// JSZip crea las carpetas solo con poner "/" en el nombre del archivo.
// ponytail: se arma en memoria del navegador; con cientos de solicitudes
// conviene filtrar antes de descargar (el boton respeta el buscador).
async function descargarTodo() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const visibles = registros.filter(r =>
        !q ||
        (r.nombreCompleto || '').toLowerCase().includes(q) ||
        (r.numEmpleado || '').toLowerCase().includes(q)
    );
    if (!visibles.length) return;

    const btn = document.getElementById('btnDescargarTodo');
    const original = btn.innerHTML;
    btn.disabled = true;

    try {
        const zip = new JSZip();
        for (const [n, reg] of visibles.entries()) {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preparando ${n + 1} de ${visibles.length}...`;
            await agregarDocumentos(zip, reg, `${nombreBase(reg)}/`);
        }

        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        descargarBlob(blob, `Becas_${visibles.length}Solicitudes.zip`);

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Descargado';
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);

    } catch (err) {
        console.error('Error al generar el ZIP completo:', err);
        btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error al descargar';
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 3000);
    }
}

async function agregarDocumentos(zip, reg, prefijo) {
    for (const [i, hijo] of (reg.hijos || []).entries()) {
        for (const [tipo, campoId] of [['Acta', 'actaId'], ['Boleta', 'boletaId']]) {
            const archivo = await leerArchivo(hijo[campoId]);
            if (!archivo) continue;
            const ext = archivo.mime === 'application/pdf' ? 'pdf' : 'jpg';
            zip.file(`${prefijo}Hijo${i + 1}_${limpiar(hijo.nombre)}_${tipo}.${ext}`, archivo.data, { base64: true });
        }
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
