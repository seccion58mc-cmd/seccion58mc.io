import { collection, getDocs, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { LISTA_PLANTA, LISTA_EVENTUAL } from './listaOficial.js';

let registros = [];
let registroActual = null;
let filtroActual = 'TODOS';

// Listas oficiales activas: las subidas (localStorage) o las de listaOficial.js por defecto
let listaPlanta = cargarListaGuardada('listaOficialPlanta') || LISTA_PLANTA;
let listaEventual = cargarListaGuardada('listaOficialEventual') || LISTA_EVENTUAL;
let importTipo = null;

function cargarListaGuardada(key) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return Array.isArray(v) && v.length ? v : null;
    } catch { return null; }
}

function nombreCompleto(obj) {
    if (!obj) return '';
    return [obj.nombres, obj.apellidoPaterno, obj.apellidoMaterno].filter(Boolean).join(' ');
}

document.addEventListener('DOMContentLoaded', () => {
    if (!verificarAutenticacion()) return;

    cargarRegistros();
    configurarEventos();
});

function verificarAutenticacion() {
    const estaAutenticado = sessionStorage.getItem('pdfAuth') === 'true';
    if (!estaAutenticado) {
        window.location.href = '../../index.html';
        return false;
    }
    return true;
}

function configurarEventos() {
    document.getElementById('searchInput').addEventListener('input', filtrarRegistros);

    document.querySelectorAll('#filtroTipo .filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#filtroTipo .filtro-btn').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            filtroActual = btn.dataset.filtro;
            filtrarRegistros();
        });
    });

    // Modales
    document.getElementById('closeModal').addEventListener('click', cerrarModalEditar);
    document.getElementById('btnCancelarEditar').addEventListener('click', cerrarModalEditar);
    document.getElementById('btnCancelarEliminar').addEventListener('click', cerrarModalEliminar);
    document.getElementById('formEditar').addEventListener('submit', guardarCambios);
    document.getElementById('btnConfirmarEliminar').addEventListener('click', confirmarEliminacion);

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Validación numérica de los campos del modal de edición
    document.getElementById('editNumEmpleado').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 8);
    });
    ['editTelefonoEmpleado', 'editC1Telefono', 'editC2Telefono'].forEach(id => {
        document.getElementById(id).addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
    });

    // PDFs
    document.getElementById('pdfTodos').addEventListener('click', () => generarPDF('TODOS'));
    document.getElementById('pdfPlanta').addEventListener('click', () => generarPDF('PLANTA'));
    document.getElementById('pdfEventual').addEventListener('click', () => generarPDF('EVENTUAL'));

    // Importar listas oficiales (Excel / Word)
    document.getElementById('btnImportPlanta').addEventListener('click', () => abrirSelector('PLANTA'));
    document.getElementById('btnImportEventual').addEventListener('click', () => abrirSelector('EVENTUAL'));
    document.getElementById('btnResetListas').addEventListener('click', restaurarListas);
    document.getElementById('fileImport').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        await importarLista(importTipo, file);
    });
}

// ============================================================
// IMPORTAR LISTAS OFICIALES (Excel / Word)
// ============================================================
function abrirSelector(tipo) {
    importTipo = tipo;
    document.getElementById('fileImport').click();
}

function limpiarNombres(arr) {
    return arr.map(s => (s ?? '').toString().trim().replace(/\s+/g, ' ').toUpperCase()).filter(Boolean);
}

async function extraerNombres(file) {
    const buf = await file.arrayBuffer();
    if (file.name.toLowerCase().endsWith('.docx')) {
        const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
        return limpiarNombres(value.split('\n'));
    }
    // .xlsx / .xls / .csv: toma la primera columna de la primera hoja
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    return limpiarNombres(filas.map(f => f[0]));
}

async function importarLista(tipo, file) {
    if (!file || !tipo) return;
    try {
        const nombres = await extraerNombres(file);
        if (!nombres.length) { alert('No se encontraron nombres en el archivo.'); return; }
        const key = tipo === 'PLANTA' ? 'listaOficialPlanta' : 'listaOficialEventual';
        localStorage.setItem(key, JSON.stringify(nombres));
        if (tipo === 'PLANTA') listaPlanta = nombres; else listaEventual = nombres;
        renderFaltantes();
        alert(`✓ Lista de ${tipo} actualizada: ${nombres.length} nombres`);
    } catch (e) {
        console.error('Error al importar lista:', e);
        alert('No se pudo leer el archivo. Usa Excel (.xlsx/.csv) o Word (.docx) con un nombre por fila.');
    }
}

function restaurarListas() {
    if (!confirm('¿Restaurar las listas oficiales por defecto? Se borrarán las listas subidas en este navegador.')) return;
    localStorage.removeItem('listaOficialPlanta');
    localStorage.removeItem('listaOficialEventual');
    listaPlanta = LISTA_PLANTA;
    listaEventual = LISTA_EVENTUAL;
    renderFaltantes();
    alert('✓ Listas restauradas a las de por defecto');
}

// ============================================================
// LISTAS OFICIALES (tachar registrados / mostrar faltantes)
// ============================================================
function normalizar(s) {
    return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')        .replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Busca el id del registro que contiene todos los tokens del nombre. null si no existe.
function buscarRegistroId(linea, regSets) {
    const tokens = normalizar(linea).split(' ').filter(Boolean);
    if (!tokens.length) return null;
    const hit = regSets.find(rs => tokens.every(t => rs.set.has(t)));
    return hit ? hit.id : null;
}

function renderLista(nombres, regSets, ulId, countId) {
    let faltan = 0;
    const html = nombres.map(linea => {
        const id = buscarRegistroId(linea, regSets);
        if (id) {
            return `<li class="reg-ok" onclick="editarRegistro('${id}')" title="Ver registro">${linea}</li>`;
        }
        faltan++;
        return `<li class="reg-falta">${linea}</li>`;
    }).join('');
    document.getElementById(ulId).innerHTML = html;
    document.getElementById(countId).textContent = faltan;
}

function renderFaltantes() {
    const regSets = registros.map(r => ({
        id: r.id,
        set: new Set(normalizar([r.apellidoPaterno, r.apellidoMaterno, r.nombres].join(' ')).split(' ').filter(Boolean))
    }));
    renderLista(listaPlanta, regSets, 'plantaLista', 'plantaFaltanCount');
    renderLista(listaEventual, regSets, 'eventualLista', 'eventualFaltanCount');
}

// ============================================================
// CARGA Y RENDER
// ============================================================
async function cargarRegistros() {
    try {
        const querySnapshot = await getDocs(collection(window.db, 'contactosEmergencia'));
        registros = [];

        querySnapshot.forEach((d) => {
            registros.push({ id: d.id, ...d.data() });
        });

        registros.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        actualizarEstadisticas();
        filtrarRegistros();
        renderFaltantes();
    } catch (error) {
        console.error('Error al cargar registros:', error);
        alert('Error al cargar los registros');
    }
}

function actualizarEstadisticas() {
    document.getElementById('totalRegistros').textContent = registros.length;
    document.getElementById('totalPlanta').textContent = registros.filter(r => r.tipoTrabajador === 'PLANTA').length;
    document.getElementById('totalEventual').textContent = registros.filter(r => r.tipoTrabajador === 'EVENTUAL').length;
}

function filtrarRegistros() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    let filtrados = registros;

    if (filtroActual !== 'TODOS') {
        filtrados = filtrados.filter(r => r.tipoTrabajador === filtroActual);
    }

    if (searchTerm) {
        filtrados = filtrados.filter(r =>
            nombreCompleto(r).toLowerCase().includes(searchTerm) ||
            (r.numeroEmpleado || '').toLowerCase().includes(searchTerm)
        );
    }

    mostrarRegistros(filtrados);
}

function mostrarRegistros(data) {
    const tbody = document.getElementById('tableBody');
    const table = document.getElementById('registrosTable');
    const loading = document.getElementById('loadingSpinner');
    const emptyState = document.getElementById('emptyState');

    loading.style.display = 'none';

    if (data.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    tbody.innerHTML = data.map(registro => {
        const tipoClass = registro.tipoTrabajador === 'PLANTA' ? 'tipo-pill--planta' : 'tipo-pill--eventual';

        return `
            <tr>
                <td><span class="tipo-pill ${tipoClass}">${registro.tipoTrabajador || 'N/A'}</span></td>
                <td>${registro.numeroEmpleado || 'N/A'}</td>
                <td><strong>${nombreCompleto(registro) || 'N/A'}</strong></td>
                <td>${registro.telefonoEmpleado || 'N/A'}</td>
                <td>${renderContacto(registro.contacto1)}</td>
                <td>${renderContacto(registro.contacto2)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" onclick="editarRegistro('${registro.id}')">
                            ✏️ Editar
                        </button>
                        <button class="btn-action btn-delete" onclick="eliminarRegistro('${registro.id}')">
                            🗑️ Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderContacto(contacto) {
    if (!contacto || !contacto.nombres) {
        return '<span class="sin-contacto">Sin registrar</span>';
    }
    return `
        <div class="contacto-cell">
            <strong>${nombreCompleto(contacto)}</strong>
            <span>${contacto.parentesco || ''} · ${contacto.telefono || ''}</span>
        </div>
    `;
}

// ============================================================
// EDICIÓN
// ============================================================
window.editarRegistro = function(id) {
    registroActual = registros.find(r => r.id === id);
    if (!registroActual) return;

    document.getElementById('editTipo').value = registroActual.tipoTrabajador || 'PLANTA';
    document.getElementById('editNumEmpleado').value = registroActual.numeroEmpleado || '';
    document.getElementById('editTelefonoEmpleado').value = registroActual.telefonoEmpleado || '';
    document.getElementById('editNombres').value = registroActual.nombres || '';
    document.getElementById('editApellidoPaterno').value = registroActual.apellidoPaterno || '';
    document.getElementById('editApellidoMaterno').value = registroActual.apellidoMaterno || '';

    const c1 = registroActual.contacto1 || {};
    document.getElementById('editC1Nombres').value = c1.nombres || '';
    document.getElementById('editC1ApellidoPaterno').value = c1.apellidoPaterno || '';
    document.getElementById('editC1ApellidoMaterno').value = c1.apellidoMaterno || '';
    document.getElementById('editC1Parentesco').value = c1.parentesco || 'ESPOSO(A)';
    document.getElementById('editC1Telefono').value = c1.telefono || '';

    const c2 = registroActual.contacto2 || {};
    document.getElementById('editC2Nombres').value = c2.nombres || '';
    document.getElementById('editC2ApellidoPaterno').value = c2.apellidoPaterno || '';
    document.getElementById('editC2ApellidoMaterno').value = c2.apellidoMaterno || '';
    document.getElementById('editC2Parentesco').value = c2.parentesco || '';
    document.getElementById('editC2Telefono').value = c2.telefono || '';

    document.getElementById('modalEditar').style.display = 'block';
};

async function guardarCambios(e) {
    e.preventDefault();

    if (!registroActual) return;

    const numEmpleado = document.getElementById('editNumEmpleado').value.trim();
    const telefonoEmpleado = document.getElementById('editTelefonoEmpleado').value.trim();

    if (numEmpleado.length === 0 || numEmpleado.length > 8) {
        alert('El número de empleado debe tener máximo 8 dígitos');
        return;
    }

    if (telefonoEmpleado.length !== 10) {
        alert('El teléfono del empleado debe tener exactamente 10 dígitos');
        return;
    }

    const nombres = document.getElementById('editNombres').value.trim().toUpperCase();
    const apellidoPaterno = document.getElementById('editApellidoPaterno').value.trim().toUpperCase();
    const apellidoMaterno = document.getElementById('editApellidoMaterno').value.trim().toUpperCase();

    if (!nombres || !apellidoPaterno) {
        alert('El nombre y apellido paterno del empleado son obligatorios');
        return;
    }

    const c1Nombres = document.getElementById('editC1Nombres').value.trim().toUpperCase();
    const c1ApellidoPaterno = document.getElementById('editC1ApellidoPaterno').value.trim().toUpperCase();
    const c1ApellidoMaterno = document.getElementById('editC1ApellidoMaterno').value.trim().toUpperCase();
    const c1Parentesco = document.getElementById('editC1Parentesco').value;
    const c1Telefono = document.getElementById('editC1Telefono').value.trim();

    if (!c1Nombres || !c1ApellidoPaterno || c1Telefono.length !== 10) {
        alert('El Contacto de emergencia 1 es obligatorio (nombre, apellido paterno y teléfono a 10 dígitos)');
        return;
    }

    const c2Nombres = document.getElementById('editC2Nombres').value.trim().toUpperCase();
    const c2ApellidoPaterno = document.getElementById('editC2ApellidoPaterno').value.trim().toUpperCase();
    const c2ApellidoMaterno = document.getElementById('editC2ApellidoMaterno').value.trim().toUpperCase();
    const c2Parentesco = document.getElementById('editC2Parentesco').value;
    const c2Telefono = document.getElementById('editC2Telefono').value.trim();

    let contacto2 = null;
    const c2TieneAlgo = c2Nombres || c2ApellidoPaterno || c2ApellidoMaterno || c2Parentesco || c2Telefono;
    if (c2TieneAlgo) {
        if (!c2Nombres || !c2ApellidoPaterno || !c2Parentesco || c2Telefono.length !== 10) {
            alert('Completa todos los campos obligatorios del Contacto de emergencia 2 o déjalos todos vacíos');
            return;
        }
        contacto2 = { nombres: c2Nombres, apellidoPaterno: c2ApellidoPaterno, apellidoMaterno: c2ApellidoMaterno, parentesco: c2Parentesco, telefono: c2Telefono };
    }

    try {
        const docRef = doc(window.db, 'contactosEmergencia', registroActual.id);
        await updateDoc(docRef, {
            tipoTrabajador: document.getElementById('editTipo').value,
            numeroEmpleado: numEmpleado,
            telefonoEmpleado: telefonoEmpleado,
            nombres: nombres,
            apellidoPaterno: apellidoPaterno,
            apellidoMaterno: apellidoMaterno,
            contacto1: { nombres: c1Nombres, apellidoPaterno: c1ApellidoPaterno, apellidoMaterno: c1ApellidoMaterno, parentesco: c1Parentesco, telefono: c1Telefono },
            contacto2: contacto2
        });

        alert('✓ Registro actualizado exitosamente');
        cerrarModalEditar();
        cargarRegistros();
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('Error al guardar los cambios');
    }
}

function cerrarModalEditar() {
    document.getElementById('modalEditar').style.display = 'none';
    registroActual = null;
}

// ============================================================
// ELIMINACIÓN
// ============================================================
window.eliminarRegistro = function(id) {
    registroActual = registros.find(r => r.id === id);
    if (!registroActual) return;

    document.getElementById('nombreEliminar').textContent = nombreCompleto(registroActual);
    document.getElementById('modalEliminar').style.display = 'block';
};

async function confirmarEliminacion() {
    if (!registroActual) return;

    try {
        await deleteDoc(doc(window.db, 'contactosEmergencia', registroActual.id));
        alert('✓ Registro eliminado exitosamente');
        cerrarModalEliminar();
        cargarRegistros();
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar el registro');
    }
}

function cerrarModalEliminar() {
    document.getElementById('modalEliminar').style.display = 'none';
    registroActual = null;
}

// ============================================================
// GENERACIÓN DE PDF
// ============================================================
function filaContacto(contacto) {
    if (!contacto || !contacto.nombres) return 'Sin registrar';
    return `${nombreCompleto(contacto)}\n${contacto.parentesco || ''} - ${contacto.telefono || ''}`;
}

function dibujarTabla(doc, titulo, datos, margin, startY, colorRGB) {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(colorRGB[0], colorRGB[1], colorRGB[2]);
    doc.text(titulo, margin, startY);

    doc.autoTable({
        startY: startY + 4,
        head: [['#', 'No. Empleado', 'Nombre', 'Teléfono', 'Contacto de emergencia 1', 'Contacto de emergencia 2']],
        body: datos.map((r, i) => [
            i + 1,
            r.numeroEmpleado || 'N/A',
            nombreCompleto(r) || 'N/A',
            r.telefonoEmpleado || 'N/A',
            filaContacto(r.contacto1),
            filaContacto(r.contacto2)
        ]),
        theme: 'grid',
        headStyles: { fillColor: colorRGB, textColor: 255, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', valign: 'middle' },
        margin: { left: margin, right: margin },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 28, halign: 'center' },
            2: { cellWidth: 55 },
            3: { cellWidth: 28, halign: 'center' },
            4: { cellWidth: 65 },
            5: { cellWidth: 65 }
        },
        didDrawPage: function(data) {
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(130, 130, 130);
            doc.setFont(undefined, 'normal');
            doc.text(`Página ${data.pageNumber}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
            doc.text('CONFIDENCIAL - Uso interno', margin, pageHeight - 8);
        }
    });

    return doc.lastAutoTable.finalY;
}

function generarPDF(tipo) {
    const planta = registros.filter(r => r.tipoTrabajador === 'PLANTA');
    const eventual = registros.filter(r => r.tipoTrabajador === 'EVENTUAL');

    let datos;
    if (tipo === 'PLANTA') datos = planta;
    else if (tipo === 'EVENTUAL') datos = eventual;
    else datos = registros;

    if (datos.length === 0) {
        alert('No hay registros para generar el PDF.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;

    // Encabezado
    doc.setFillColor(30, 60, 114);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('CONTACTOS DE EMERGENCIA - SECCIÓN 58', pageWidth / 2, 11, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, 18, { align: 'center' });

    let y = 34;

    if (tipo === 'TODOS') {
        if (planta.length > 0) {
            y = dibujarTabla(doc, `PLANTA (${planta.length})`, planta, margin, y, [41, 128, 185]) + 14;
        }
        if (eventual.length > 0) {
            if (y > doc.internal.pageSize.getHeight() - 40) {
                doc.addPage();
                y = 20;
            }
            dibujarTabla(doc, `EVENTUALES (${eventual.length})`, eventual, margin, y, [255, 107, 53]);
        }
    } else if (tipo === 'PLANTA') {
        dibujarTabla(doc, `PLANTA (${planta.length})`, planta, margin, y, [41, 128, 185]);
    } else {
        dibujarTabla(doc, `EVENTUALES (${eventual.length})`, eventual, margin, y, [255, 107, 53]);
    }

    const sufijo = tipo === 'TODOS' ? 'completo' : tipo.toLowerCase();
    doc.save(`contactos_emergencia_${sufijo}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
