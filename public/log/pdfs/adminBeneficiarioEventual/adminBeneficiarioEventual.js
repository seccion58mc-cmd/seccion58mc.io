import { collection, getDocs, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

let registros = [];
let registroActual = null;
let beneficiariosEditCount = 0;

// Testigos fijos
const TESTIGO_1 = "MARIA DEL ROSARIO GÓMEZ GONZÁLEZ";
const TESTIGO_2 = " ";

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    cargarRegistros();
    configurarEventos();
});

function configurarEventos() {
    // Búsqueda
    document.getElementById('searchInput').addEventListener('input', filtrarRegistros);

    // Modales
    document.getElementById('closeModal').addEventListener('click', cerrarModalEditar);
    document.getElementById('btnCancelarEditar').addEventListener('click', cerrarModalEditar);
    document.getElementById('btnCancelarEliminar').addEventListener('click', cerrarModalEliminar);

    // Formulario de edición
    document.getElementById('formEditar').addEventListener('submit', guardarCambios);
    document.getElementById('btnAgregarBeneficiario').addEventListener('click', agregarBeneficiarioEditar);

    // Eliminar
    document.getElementById('btnConfirmarEliminar').addEventListener('click', confirmarEliminacion);

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

async function cargarRegistros() {
    try {
        const querySnapshot = await getDocs(collection(window.db, 'beneficiarioEventual'));
        registros = [];
        
        querySnapshot.forEach((doc) => {
            registros.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Ordenar por fecha (más reciente primero)
        registros.sort((a, b) => b.timestamp - a.timestamp);

        actualizarEstadisticas();
        mostrarRegistros(registros);
    } catch (error) {
        console.error('Error al cargar registros:', error);
        alert('Error al cargar los registros');
    }
}

function actualizarEstadisticas() {
    document.getElementById('totalRegistros').textContent = registros.length;
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
        const beneficiariosHTML = registro.beneficiarios.map(b =>
            `<div class="beneficiario-item">${b.nombre} - ${b.parentesco} (${b.porcentaje}%)</div>`
        ).join('');

        const entregado = !!registro.entregado;
        const rowClass = entregado ? 'row-entregado' : '';
        const btnEntregadoClass = entregado ? 'btn-entregado-active' : 'btn-entregado';
        const btnEntregadoTexto = entregado ? '✓ Entregado' : '☐ Marcar entregado';

        return `
            <tr class="${rowClass}">
                <td>${registro.fecha || 'N/A'}</td>
                <td><strong>${registro.nombreTrabajador}</strong></td>
                <td><div class="beneficiarios-list">${beneficiariosHTML}</div></td>
                <td>${registro.empresa}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action ${btnEntregadoClass}" onclick="toggleEntregado('${registro.id}')">
                            ${btnEntregadoTexto}
                        </button>
                        <button class="btn-action btn-edit" onclick="editarRegistro('${registro.id}')">
                            ✏️ Editar
                        </button>
                        <button class="btn-action btn-delete" onclick="eliminarRegistro('${registro.id}')">
                            🗑️ Eliminar
                        </button>
                        <button class="btn-action btn-pdf" onclick="descargarPDF('${registro.id}')">
                            📄 PDF
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarRegistros() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const filtrados = registros.filter(registro => 
        registro.nombreTrabajador.toLowerCase().includes(searchTerm)
    );

    mostrarRegistros(filtrados);
}

// Funciones globales
window.editarRegistro = function(id) {
    registroActual = registros.find(r => r.id === id);
    if (!registroActual) return;

    // Llenar el formulario
    document.getElementById('editNombre').value = registroActual.nombreTrabajador;

    // Cargar beneficiarios
    const container = document.getElementById('beneficiariosContainer');
    container.innerHTML = '';
    beneficiariosEditCount = 0;

    registroActual.beneficiarios.forEach(beneficiario => {
        agregarBeneficiarioEditar(beneficiario);
    });

    document.getElementById('modalEditar').style.display = 'block';
};

function agregarBeneficiarioEditar(datosBeneficiario = null) {
    beneficiariosEditCount++;
    const container = document.getElementById('beneficiariosContainer');
    
    const div = document.createElement('div');
    div.className = 'beneficiario-group';
    div.setAttribute('data-id', beneficiariosEditCount);
    
    div.innerHTML = `
        <h4>Beneficiario ${beneficiariosEditCount}</h4>
        ${beneficiariosEditCount > 1 ? `<button type="button" class="btn-remove-beneficiario" onclick="removerBeneficiarioEditar(${beneficiariosEditCount})">✕</button>` : ''}
        <div class="form-group">
            <label>Nombre:</label>
            <input type="text" class="benef-nombre" value="${datosBeneficiario?.nombre || ''}" required>
        </div>
        <div class="form-group">
            <label>Parentesco:</label>
            <select class="benef-parentesco" required>
                <option value="">Seleccionar</option>
                <option value="HIJO" ${datosBeneficiario?.parentesco === 'HIJO' ? 'selected' : ''}>HIJO</option>
                <option value="HIJA" ${datosBeneficiario?.parentesco === 'HIJA' ? 'selected' : ''}>HIJA</option>
                <option value="ESPOSO" ${datosBeneficiario?.parentesco === 'ESPOSO' ? 'selected' : ''}>ESPOSO</option>
                <option value="ESPOSA" ${datosBeneficiario?.parentesco === 'ESPOSA' ? 'selected' : ''}>ESPOSA</option>
                <option value="PADRE" ${datosBeneficiario?.parentesco === 'PADRE' ? 'selected' : ''}>PADRE</option>
                <option value="MADRE" ${datosBeneficiario?.parentesco === 'MADRE' ? 'selected' : ''}>MADRE</option>
                <option value="HERMANO" ${datosBeneficiario?.parentesco === 'HERMANO' ? 'selected' : ''}>HERMANO</option>
                <option value="HERMANA" ${datosBeneficiario?.parentesco === 'HERMANA' ? 'selected' : ''}>HERMANA</option>
                <option value="OTRO" ${datosBeneficiario?.parentesco === 'OTRO' ? 'selected' : ''}>OTRO</option>
            </select>
        </div>
        <div class="form-group">
            <label>Porcentaje:</label>
            <input type="number" class="benef-porcentaje" min="1" max="100" value="${datosBeneficiario?.porcentaje || ''}" required>
        </div>
    `;
    
    container.appendChild(div);
}

window.removerBeneficiarioEditar = function(id) {
    const elemento = document.querySelector(`.beneficiario-group[data-id="${id}"]`);
    if (elemento) {
        elemento.remove();
    }
};

async function guardarCambios(e) {
    e.preventDefault();

    if (!registroActual) return;

    try {
        // Recopilar beneficiarios
        const beneficiarios = [];
        const grupos = document.querySelectorAll('.beneficiario-group');
        
        grupos.forEach(grupo => {
            const nombre = grupo.querySelector('.benef-nombre').value.trim().toUpperCase();
            const parentesco = grupo.querySelector('.benef-parentesco').value;
            const porcentaje = grupo.querySelector('.benef-porcentaje').value;
            
            if (nombre && parentesco && porcentaje) {
                beneficiarios.push({ nombre, parentesco, porcentaje });
            }
        });

        // Validar que sumen 100%
        const totalPorcentaje = beneficiarios.reduce((sum, b) => sum + parseInt(b.porcentaje), 0);
        if (totalPorcentaje !== 100) {
            alert(`Los porcentajes deben sumar 100%. Actualmente suman: ${totalPorcentaje}%`);
            return;
        }

        // Actualizar en Firebase
        const docRef = doc(window.db, 'beneficiarioEventual', registroActual.id);
        await updateDoc(docRef, {
            nombreTrabajador: document.getElementById('editNombre').value.toUpperCase(),
            beneficiarios: beneficiarios,
            firma: document.getElementById('editNombre').value.toUpperCase()
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

window.toggleEntregado = async function(id) {
    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    const yaEntregado = !!registro.entregado;
    const mensaje = yaEntregado
        ? '¿Estás seguro que NO has entregado este PDF? Se deseleccionará.'
        : '¿Estás seguro que ya entregaste este PDF?';

    if (!confirm(mensaje)) return;

    try {
        const docRef = doc(window.db, 'beneficiarioEventual', id);
        await updateDoc(docRef, {
            entregado: !yaEntregado,
            fechaEntrega: !yaEntregado ? new Date().toISOString() : null
        });
        registro.entregado = !yaEntregado;
        registro.fechaEntrega = !yaEntregado ? new Date().toISOString() : null;
        filtrarRegistros();
    } catch (error) {
        console.error('Error al actualizar entrega:', error);
        alert('Error al actualizar el estado de entrega');
    }
};

window.eliminarRegistro = function(id) {
    registroActual = registros.find(r => r.id === id);
    if (!registroActual) return;

    document.getElementById('nombreEliminar').textContent = registroActual.nombreTrabajador;
    document.getElementById('modalEliminar').style.display = 'block';
};

async function confirmarEliminacion() {
    if (!registroActual) return;

    try {
        await deleteDoc(doc(window.db, 'beneficiarioEventual', registroActual.id));
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

window.descargarPDF = async function(id) {
    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Configuración
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 18;

        // Cargar y agregar el logo
        const logoImg = await cargarImagenBase64('../../../assets/sindicatoLogo.png');

        // Header - Título (más compacto)
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        doc.text('Sindicato Nacional de Trabajadores de la Industria Química, Petroquímica,', pageWidth / 2, 14, { align: 'center' });
        doc.text('Carboquímica, Energía y Gases', pageWidth / 2, 19, { align: 'center' });

        // Logo más pequeño y más arriba
        const logoWidth = 22;
        const logoHeight = 22;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logoImg, 'PNG', logoX, 22, logoWidth, logoHeight);

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('COMITÉ NACIONAL', pageWidth / 2, 50, { align: 'center' });

        // Contenido
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        let y = 62;
        doc.setFont(undefined, 'bold');
        doc.text('FECHA:', margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(registro.fecha, margin + 18, y);

        y += 8;
        doc.setFont(undefined, 'bold');
        doc.text('NOMBRE:', margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(registro.nombreTrabajador, margin + 22, y);

        // Empresa
        y += 12;
        doc.setFontSize(9);
        doc.text('TRABAJADOR EVENTUAL DE LA EMPRESA:', pageWidth / 2, y, { align: 'center' });
        
        y += 8;
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text('COSBEL, S. A. DE C. V. (Sección 58)', pageWidth / 2, y, { align: 'center' });

        // Designación de beneficiarios
        y += 12;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        const textoDesigno = 'DESIGNO COMO MIS BENEFICIARIOS:';
        doc.text(textoDesigno, pageWidth / 2, y, { align: 'center' });
        doc.line(margin + 35, y + 1, pageWidth - margin - 35, y + 1);

        // Tabla de beneficiarios
        y += 8;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('NOMBRE', margin, y);
        doc.text('PARENTESCO', margin + 80, y);
        doc.text('PORCENTAJE', margin + 135, y);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);

        y += 8;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9.5);
        registro.beneficiarios.forEach(benef => {
            doc.text(benef.nombre, margin, y);
            doc.text(benef.parentesco, margin + 80, y);
            doc.text(`${benef.porcentaje}%`, margin + 140, y);
            y += 7;
        });

        // Verificar si necesitamos una nueva página
        if (y > pageHeight - 80) {
            doc.addPage();
            y = 20;
        }

        // Nota legal
        y += 10;
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        const textoLegal = 'EN CASO DE FALLECER TENIENDO CONTRATO VIGENTE CON LA EMPRESA ANTES MENCIONADA.';
        doc.text(textoLegal, pageWidth / 2, y, { align: 'center' });

        // Firma del trabajador
        y += 15;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('FIRMA DEL TRABAJADOR', pageWidth / 2, y, { align: 'center' });
        
        // Línea de firma centrada
        y += 12;
        const firmaLineStartX = margin + 35;
        const firmaLineEndX = pageWidth - margin - 35;
        doc.line(firmaLineStartX, y, firmaLineEndX, y);
        
        // Nombre DEBAJO de la línea
        y += 5;
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        doc.text(registro.firma, pageWidth / 2, y, { align: 'center' });

        // Testigos
        y += 16;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        
        const col1X = margin + 35;
        const col2X = pageWidth - margin - 35;
        
        doc.text('TESTIGOS', col1X, y, { align: 'center' });
        doc.text('TESTIGOS', col2X, y, { align: 'center' });
        
        y += 16;
        // Líneas de firma de testigos
        doc.line(col1X - 30, y, col1X + 30, y);
        doc.line(col2X - 30, y, col2X + 30, y);
        
        // Nombres de testigos DEBAJO de las líneas
        y += 5;
        doc.setFontSize(8);
        doc.setFont(undefined, 'italic');
        doc.text(TESTIGO_1, col1X, y, { align: 'center' });
        doc.text(TESTIGO_2, col2X, y, { align: 'center' });
        
        y += 5;
        doc.setFontSize(7.5);
        doc.setFont(undefined, 'bold');
        doc.text('NOMBRE Y FECHA', col1X, y, { align: 'center' });
        doc.text('NOMBRE Y FECHA', col2X, y, { align: 'center' });

        // Guardar
        doc.save(`PolizasEventual_${registro.nombreTrabajador}_${Date.now()}.pdf`);
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('Error al generar el PDF. Por favor intente nuevamente.');
    }
};

// Función auxiliar para cargar imagen como base64
function cargarImagenBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
        };
        
        img.onerror = function() {
            console.error('Error al cargar la imagen');
            reject(new Error('No se pudo cargar el logo'));
        };
        
        img.src = url;
    });
}