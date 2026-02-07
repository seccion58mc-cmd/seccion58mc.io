import { collection, getDocs, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

let registros = [];
let registroActual = null;
let beneficiariosEditCount = 0;

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
        const querySnapshot = await getDocs(collection(window.db, 'ayudaDefuncion'));
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

        return `
            <tr>
                <td>${registro.fecha || 'N/A'}</td>
                <td><strong>${registro.nombreTrabajador}</strong></td>
                <td>${registro.numeroEmpleado}</td>
                <td><div class="beneficiarios-list">${beneficiariosHTML}</div></td>
                <td>${registro.telefono}</td>
                <td>
                    <div class="action-buttons">
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
        registro.nombreTrabajador.toLowerCase().includes(searchTerm) ||
        registro.numeroEmpleado.toLowerCase().includes(searchTerm)
    );

    mostrarRegistros(filtrados);
}

// Funciones globales
window.editarRegistro = function(id) {
    registroActual = registros.find(r => r.id === id);
    if (!registroActual) return;

    // Llenar el formulario
    document.getElementById('editNombre').value = registroActual.nombreTrabajador;
    document.getElementById('editNumEmpleado').value = registroActual.numeroEmpleado;
    document.getElementById('editTelefono').value = registroActual.telefono;
    document.getElementById('editCorreo').value = registroActual.correo;

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
                <option value="ESPOSO(A)" ${datosBeneficiario?.parentesco === 'ESPOSO(A)' ? 'selected' : ''}>ESPOSO(A)</option>
                <option value="HIJO(A)" ${datosBeneficiario?.parentesco === 'HIJO(A)' ? 'selected' : ''}>HIJO(A)</option>
                <option value="PADRE" ${datosBeneficiario?.parentesco === 'PADRE' ? 'selected' : ''}>PADRE</option>
                <option value="MADRE" ${datosBeneficiario?.parentesco === 'MADRE' ? 'selected' : ''}>MADRE</option>
                <option value="HERMANO(A)" ${datosBeneficiario?.parentesco === 'HERMANO(A)' ? 'selected' : ''}>HERMANO(A)</option>
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
        const docRef = doc(window.db, 'ayudaDefuncion', registroActual.id);
        await updateDoc(docRef, {
            nombreTrabajador: document.getElementById('editNombre').value.toUpperCase(),
            numeroEmpleado: document.getElementById('editNumEmpleado').value.toUpperCase(),
            telefono: document.getElementById('editTelefono').value,
            correo: document.getElementById('editCorreo').value.toLowerCase(),
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

window.eliminarRegistro = function(id) {
    registroActual = registros.find(r => r.id === id);
    if (!registroActual) return;

    document.getElementById('nombreEliminar').textContent = registroActual.nombreTrabajador;
    document.getElementById('modalEliminar').style.display = 'block';
};

async function confirmarEliminacion() {
    if (!registroActual) return;

    try {
        await deleteDoc(doc(window.db, 'ayudaDefuncion', registroActual.id));
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
        const margin = 20;

        // Cargar y agregar el logo
        const logoImg = await cargarImagenBase64('../../../assets/sindicatoLogo.png');
        
        // Header - Título
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('SINDICATO NACIONAL DE TRABAJADORES DE LA INDUSTRIA QUÍMICA,', pageWidth / 2, 20, { align: 'center' });
        doc.text('PETROQUÍMICA, CARBOQUÍMICA, ENERGÍA Y GASES.', pageWidth / 2, 27, { align: 'center' });

        // Agregar logo centrado
        const logoWidth = 30;
        const logoHeight = 30;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logoImg, 'PNG', logoX, 32, logoWidth, logoHeight);

        doc.setFontSize(11);
        doc.text('COMITÉ EJECUTIVO LOCAL', pageWidth / 2, 68, { align: 'center' });
        doc.text('SECCIÓN 58', pageWidth / 2, 75, { align: 'center' });

        // Título del documento
        doc.setFontSize(14);
        doc.text('CARTA DE DESIGNACIÓN DE BENEFICIARIOS', pageWidth / 2, 90, { align: 'center' });

        // Contenido
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');

        let y = 105;
        doc.text(`Lugar y fecha: ${registro.fecha}`, margin, y);
        
        y += 10;
        doc.text('A quien corresponda: Sección 58', margin, y);

        y += 15;
        const textoInicio = `Por medio de la presente, yo ${registro.nombreTrabajador}, con número de empleado ${registro.numeroEmpleado}, manifiesto de manera libre y voluntaria que designo como beneficiarios a las siguientes personas:`;
        const lineasInicio = doc.splitTextToSize(textoInicio, pageWidth - 2 * margin);
        doc.text(lineasInicio, margin, y);
        y += lineasInicio.length * 7;

        // Tabla de beneficiarios
        y += 10;
        doc.setFont(undefined, 'bold');
        doc.text('NOMBRE', margin, y);
        doc.text('PARENTESCO', margin + 80, y);
        doc.text('PORCENTAJE', margin + 130, y);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);

        y += 10;
        doc.setFont(undefined, 'normal');
        registro.beneficiarios.forEach(benef => {
            doc.text(benef.nombre, margin, y);
            doc.text(benef.parentesco, margin + 80, y);
            doc.text(`${benef.porcentaje}%`, margin + 130, y);
            y += 8;
        });

        // Declaraciones
        y += 10;
        const textoDeclaracion = 'Declaro que los porcentajes asignados suman el 100% del beneficio correspondiente.';
        const lineasDeclaracion = doc.splitTextToSize(textoDeclaracion, pageWidth - 2 * margin);
        doc.text(lineasDeclaracion, margin, y);
        y += lineasDeclaracion.length * 7;

        y += 5;
        doc.setFont(undefined, 'bold');
        const textoAyuda = 'Esta designación aplica para la Ayuda de Defunción de trabajador ';
        const lineasAyuda = doc.splitTextToSize(textoAyuda, pageWidth - 2 * margin);
        doc.text(lineasAyuda, margin, y);
        y += lineasAyuda.length * 7;
        
        doc.setFont(undefined, 'normal');
        const textoValidez = '(tendrá validez a partir de la fecha de firma del presente documento.)';
        const lineasValidez = doc.splitTextToSize(textoValidez, pageWidth - 2 * margin);
        doc.text(lineasValidez, margin, y);
        y += lineasValidez.length * 7;

        y += 10;
        const textoRevoca = 'Asimismo, manifiesto que esta designación revoca y sustituye cualquier designación de beneficiarios realizada con anterioridad.';
        const lineasRevoca = doc.splitTextToSize(textoRevoca, pageWidth - 2 * margin);
        doc.text(lineasRevoca, margin, y);
        y += lineasRevoca.length * 7;

        y += 5;
        const textoFirma = 'Para los efectos legales correspondientes, firmo la presente en pleno uso de mis facultades.';
        const lineasFirma = doc.splitTextToSize(textoFirma, pageWidth - 2 * margin);
        doc.text(lineasFirma, margin, y);
        y += lineasFirma.length * 7;

        // Firma
        y += 15;
        doc.text('Atentamente,', margin, y);
        
        y += 15;
        doc.text('Firma: _______________________________________', margin, y);
        y += 2;
        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        doc.text(registro.firma, margin + 15, y);
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        y += 10;
        doc.text(`Teléfono: ${registro.telefono}`, margin, y);
        y += 7;
        doc.text(`Correo electrónico: ${registro.correo}`, margin, y);

        // Guardar
        doc.save(`Ayuda_Defuncion_${registro.nombreTrabajador}_${Date.now()}.pdf`);
        
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