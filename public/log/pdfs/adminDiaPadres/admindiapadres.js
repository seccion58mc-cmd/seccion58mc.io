import { collection, getDocs, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

let registros = [];
let registroActual = null;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cargarRegistros();
    configurarEventos();
});

function configurarEventos() {
    document.getElementById('searchInput').addEventListener('input', filtrarRegistros);
    document.getElementById('filtroContrato').addEventListener('change', filtrarRegistros);

    // Eliminar
    document.getElementById('btnCancelarEliminar').addEventListener('click', cerrarModalEliminar);
    document.getElementById('btnConfirmarEliminar').addEventListener('click', confirmarEliminacion);

    // Botones de impresion
    document.getElementById('btnImprimirPlanta').addEventListener('click', () => imprimirListado('PLANTA'));
    document.getElementById('btnImprimirEventual').addEventListener('click', () => imprimirListado('EVENTUAL'));
    document.getElementById('btnImprimirTodos').addEventListener('click', () => imprimirListado('TODOS'));

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// ── Cargar registros ───────────────────────────────────────
async function cargarRegistros() {
    try {
        const querySnapshot = await getDocs(collection(window.db, 'diapadre'));
        registros = [];

        querySnapshot.forEach((docSnap) => {
            registros.push({ id: docSnap.id, ...docSnap.data() });
        });

        registros.sort((a, b) => b.timestamp - a.timestamp);

        actualizarEstadisticas();
        mostrarRegistros(registros);
    } catch (error) {
        console.error('Error al cargar registros:', error);
        alert('Error al cargar los registros.');
    }
}

function actualizarEstadisticas() {
    const planta   = registros.filter(r => r.contrato === 'PLANTA').length;
    const eventual = registros.filter(r => r.contrato === 'EVENTUAL').length;

    document.getElementById('totalRegistros').textContent = registros.length;
    document.getElementById('totalPlanta').textContent    = planta;
    document.getElementById('totalEventual').textContent  = eventual;
}

// ── Mostrar tabla ──────────────────────────────────────────
function mostrarRegistros(data) {
    const tbody    = document.getElementById('tableBody');
    const table    = document.getElementById('registrosTable');
    const loading  = document.getElementById('loadingSpinner');
    const empty    = document.getElementById('emptyState');

    loading.style.display = 'none';

    if (data.length === 0) {
        table.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    tbody.innerHTML = data.map((registro, index) => {
        const badgeClass  = registro.contrato === 'PLANTA' ? 'badge-planta' : 'badge-eventual';
        const hijosTexto  = registro.hijos && registro.hijos.length > 0
            ? registro.hijos.map(h => `${h.edad} ${h.unidad}`).join('<br>')
            : 'Sin hijos registrados';

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${registro.fecha || 'N/A'}</td>
                <td><strong>${registro.nombre}</strong></td>
                <td>${registro.edad} años</td>
                <td><span class="badge-contrato ${badgeClass}">${registro.contrato}</span></td>
                <td><div class="hijos-resumen">${hijosTexto}</div></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-delete" onclick="eliminarRegistro('${registro.id}')">
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ── Filtrar ────────────────────────────────────────────────
function filtrarRegistros() {
    const busqueda = document.getElementById('searchInput').value.toLowerCase();
    const contrato = document.getElementById('filtroContrato').value;

    const filtrados = registros.filter(r => {
        const coincideNombre   = r.nombre.toLowerCase().includes(busqueda);
        const coincideContrato = contrato === '' || r.contrato === contrato;
        return coincideNombre && coincideContrato;
    });

    mostrarRegistros(filtrados);
}

// ── Eliminar ───────────────────────────────────────────────
window.eliminarRegistro = function(id) {
    registroActual = registros.find(r => r.id === id);
    if (!registroActual) return;
    document.getElementById('nombreEliminar').textContent = registroActual.nombre;
    document.getElementById('modalEliminar').style.display = 'block';
};

async function confirmarEliminacion() {
    if (!registroActual) return;
    try {
        await deleteDoc(doc(window.db, 'diapadre', registroActual.id));
        cerrarModalEliminar();
        cargarRegistros();
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar el registro.');
    }
}

function cerrarModalEliminar() {
    document.getElementById('modalEliminar').style.display = 'none';
    registroActual = null;
}

// ── IMPRIMIR LISTADO PDF ───────────────────────────────────
async function imprimirListado(tipo) {
    const { jsPDF } = window.jspdf;

    // Filtrar según tipo
    let lista;
    let tituloTipo;

    if (tipo === 'PLANTA') {
        lista      = registros.filter(r => r.contrato === 'PLANTA');
        tituloTipo = 'TRABAJADORES DE PLANTA';
    } else if (tipo === 'EVENTUAL') {
        lista      = registros.filter(r => r.contrato === 'EVENTUAL');
        tituloTipo = 'TRABAJADORES EVENTUALES';
    } else {
        lista      = [...registros];
        tituloTipo = 'TODOS LOS TRABAJADORES';
    }

    if (lista.length === 0) {
        alert(`No hay registros de tipo "${tipo === 'TODOS' ? 'todos' : tipo}" para imprimir.`);
        return;
    }

    try {
        const docPDF   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        const pageW    = docPDF.internal.pageSize.getWidth();
        const margin   = 18;

        // ── Intento cargar logo ──
        let logoData = null;
        try {
            logoData = await cargarImagenBase64('../../../assets/sindicatoLogo.png');
        } catch (_) { /* si falla el logo, se omite sin romper */ }

        const dibujarEncabezado = (pageNum) => {
            // Cabecera institucional
            docPDF.setFontSize(9);
            docPDF.setFont(undefined, 'bold');
            docPDF.setTextColor(30, 64, 175);
            docPDF.text('SINDICATO NACIONAL DE TRABAJADORES DE LA INDUSTRIA QUIMICA,', pageW / 2, 14, { align: 'center' });
            docPDF.text('PETROQUIMICA, CARBOQUIMICA, ENERGIA Y GASES — SECCION 58', pageW / 2, 19, { align: 'center' });

            // Logo
            if (logoData) {
                docPDF.addImage(logoData, 'PNG', (pageW - 20) / 2, 22, 20, 20);
            }

            const yDespuesLogo = logoData ? 45 : 24;

            // Titulo del listado
            docPDF.setFontSize(13);
            docPDF.setFont(undefined, 'bold');
            docPDF.setTextColor(30, 64, 175);
            docPDF.text('LISTADO — DÍA DEL PADRE, 18 DE JUNIO', pageW / 2, yDespuesLogo, { align: 'center' });

            // Tipo de contrato resaltado
            docPDF.setFontSize(11);
            docPDF.setTextColor(2, 132, 199);
            docPDF.text(tituloTipo, pageW / 2, yDespuesLogo + 7, { align: 'center' });

            // Fecha de impresion y total
            docPDF.setFontSize(8);
            docPDF.setFont(undefined, 'normal');
            docPDF.setTextColor(120, 120, 120);
            const fechaHoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
            docPDF.text(`Fecha de impresión: ${fechaHoy}`, margin, yDespuesLogo + 14);
            docPDF.text(`Total registrados: ${lista.length}`, pageW - margin, yDespuesLogo + 14, { align: 'right' });

            if (pageNum > 1) {
                docPDF.setFontSize(8);
                docPDF.setTextColor(150, 150, 150);
                docPDF.text(`Página ${pageNum}`, pageW - margin, yDespuesLogo + 14, { align: 'right' });
            }

            return yDespuesLogo + 18;
        };

        const yTabla = dibujarEncabezado(1);

        // ── Tabla principal ──
        const columnas = [
            { header: '#',         dataKey: 'num'      },
            { header: 'Nombre',    dataKey: 'nombre'   },
            { header: 'Edad',      dataKey: 'edad'     },
        ];

        if (tipo === 'TODOS') {
            columnas.push({ header: 'Contrato', dataKey: 'contrato' });
        }

        columnas.push(
            { header: 'No. Hijos', dataKey: 'totalHijos' },
            { header: 'Detalle de hijos', dataKey: 'hijosDetalle' }
        );

        const filas = lista.map((r, i) => {
            const hijosDetalle = r.hijos && r.hijos.length > 0
                ? r.hijos.map(h => `${h.edad} ${h.unidad}`).join('\n')
                : '—';

            const fila = {
                num:         i + 1,
                nombre:      r.nombre,
                edad:        `${r.edad} años`,
                totalHijos:  r.totalHijos || (r.hijos ? r.hijos.length : 0),
                hijosDetalle
            };

            if (tipo === 'TODOS') fila.contrato = r.contrato;

            return fila;
        });

        const colorHead = tipo === 'PLANTA'   ? [30, 64, 175]   // azul fuerte
                        : tipo === 'EVENTUAL' ? [220, 38, 38]  // rojo
                        :                      [51, 65, 85];    // gris azulado

        docPDF.autoTable({
            startY:   yTabla,
            columns:  columnas,
            body:     filas,
            margin:   { left: margin, right: margin },
            styles: {
                fontSize:   9,
                cellPadding: 4,
                valign:     'middle',
                textColor:  [40, 40, 60],
                lineColor:  [200, 200, 220],
                lineWidth:  0.2,
            },
            headStyles: {
                fillColor:  colorHead,
                textColor:  255,
                fontStyle:  'bold',
                fontSize:   9,
                halign:     'center',
            },
            alternateRowStyles: {
                fillColor: tipo === 'PLANTA'   ? [219, 234, 254]  // azul claro
                         : tipo === 'EVENTUAL' ? [254, 226, 226]  // rojo claro
                         :                      [241, 245, 249],  // gris claro
            },
            columnStyles: {
                num:         { halign: 'center', cellWidth: 10  },
                edad:        { halign: 'center', cellWidth: 22  },
                totalHijos:  { halign: 'center', cellWidth: 22  },
                contrato:    { halign: 'center', cellWidth: 26  },
                hijosDetalle:{ cellWidth: 'auto'                 },
            },
            didDrawPage: (hookData) => {
                const pageCount = docPDF.internal.getNumberOfPages();
                docPDF.setFontSize(8);
                docPDF.setTextColor(160, 160, 160);
                docPDF.text(
                    `Página ${hookData.pageNumber} de ${pageCount}`,
                    pageW / 2,
                    docPDF.internal.pageSize.getHeight() - 10,
                    { align: 'center' }
                );

                docPDF.setDrawColor(180, 200, 230);
                docPDF.setLineWidth(0.3);
                docPDF.line(margin, docPDF.internal.pageSize.getHeight() - 14, pageW - margin, docPDF.internal.pageSize.getHeight() - 14);
            }
        });

        if (tipo !== 'TODOS') {
            const yFinal = docPDF.lastAutoTable.finalY + 10;
            const pageH  = docPDF.internal.pageSize.getHeight();

            if (yFinal + 20 < pageH - 20) {
                docPDF.setFontSize(9);
                docPDF.setFont(undefined, 'bold');
                docPDF.setTextColor(30, 64, 175);
                docPDF.text(`Total de trabajadores registrados (${tituloTipo}): ${lista.length}`, margin, yFinal);
            }
        }

        const fecha   = new Date().toISOString().split('T')[0];
        const archivo = `Listado_DiaPadre_${tipo}_${fecha}.pdf`;
        docPDF.save(archivo);

    } catch (error) {
        console.error('Error al generar PDF de listado:', error);
        alert('Error al generar el listado. Por favor intenta nuevamente.');
    }
}

// ── Cargar imagen como base64 ──────────────────────────────
function cargarImagenBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width  = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('No se pudo cargar el logo'));
        img.src = url;
    });
}