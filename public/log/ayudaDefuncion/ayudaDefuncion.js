import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Variables globales
let beneficiariosCount = 0;

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    inicializarFormulario();
    configurarEventosFormulario();
    agregarFilaBeneficiario();
    agregarFilaBeneficiario();
    agregarFilaBeneficiario();
});

// ============================================================
// FORMULARIO
// ============================================================
function inicializarFormulario() {
    const fechaActual = new Date();
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fecha').value = fechaActual.toLocaleDateString('es-MX', opciones);
}

function configurarEventosFormulario() {
    // Convertir a mayúsculas mientras escribe
    const camposTexto = ['nombreTrabajador', 'numeroEmpleado'];
    camposTexto.forEach(id => {
        const campo = document.getElementById(id);
        campo.addEventListener('input', function() {
            const cursorPos = this.selectionStart;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(cursorPos, cursorPos);
        });
    });

    // Copiar nombre a firma automáticamente
    document.getElementById('nombreTrabajador').addEventListener('input', function() {
        document.getElementById('firma').value = this.value;
    });

    // Validar número de empleado (solo números, 8-10 dígitos)
    document.getElementById('numeroEmpleado').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 10) {
            this.value = this.value.slice(0, 10);
        }
    });

    // Validar teléfono (solo números)
    document.getElementById('telefono').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    // Botón agregar beneficiario
    document.getElementById('agregarBeneficiario').addEventListener('click', agregarFilaBeneficiario);

    // Submit del formulario
    document.getElementById('beneficiariosForm').addEventListener('submit', validarYMostrarConfirmacion);

    // Botones del modal confirmación
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
    document.getElementById('btnConfirmar').addEventListener('click', enviarFormulario);
    document.getElementById('btnCerrarExito').addEventListener('click', () => {
        cerrarModal();
        location.reload();
    });

    // Botón modal menor de edad beneficiario
    document.getElementById('btnCerrarMenorEdad').addEventListener('click', () => {
        document.getElementById('modalMenorEdad').style.display = 'none';
    });
}

// ============================================================
// CALCULAR EDAD
// ============================================================
function calcularEdad(fechaNac) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNac);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }
    return edad;
}

// ============================================================
// TABLA DE BENEFICIARIOS
// ============================================================
function agregarFilaBeneficiario() {
    beneficiariosCount++;
    const tbody = document.getElementById('beneficiariosBody');
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', beneficiariosCount);

    // Fecha máxima = hoy (no pueden ser del futuro)
    const hoy = new Date().toISOString().split('T')[0];

    tr.innerHTML = `
        <td data-label="Nombre del beneficiario"><input type="text" class="beneficiario-nombre" placeholder="Nombre completo" required></td>
        <td data-label="Fecha de nacimiento">
            <input type="date" class="beneficiario-fecha-nac" max="${hoy}" required>
            <div class="beneficiario-edad-info" style="display:none;"></div>
        </td>
        <td data-label="Parentesco">
            <select class="beneficiario-parentesco" required>
                <option value="">Seleccionar</option>
                <option value="ESPOSO(A)">ESPOSO(A)</option>
                <option value="HIJO(A)">HIJO(A)</option>
                <option value="PADRE">PADRE</option>
                <option value="MADRE">MADRE</option>
                <option value="HERMANO(A)">HERMANO(A)</option>
                <option value="OTRO">OTRO</option>
            </select>
        </td>
        <td data-label="Porcentaje"><input type="number" class="beneficiario-porcentaje" min="1" max="100" placeholder="%" required></td>
        <td data-label="">
            ${beneficiariosCount > 1 ? '<button type="button" class="btn-eliminar" onclick="eliminarBeneficiario(this)">Eliminar</button>' : ''}
        </td>
    `;

    tbody.appendChild(tr);

    // Mayúsculas en nombre
    const inputNombre = tr.querySelector('.beneficiario-nombre');
    inputNombre.addEventListener('input', function() {
        const cursorPos = this.selectionStart;
        this.value = this.value.toUpperCase();
        this.setSelectionRange(cursorPos, cursorPos);
    });

    // Validación de edad en tiempo real al cambiar fecha
    const inputFecha = tr.querySelector('.beneficiario-fecha-nac');
    const edadInfo = tr.querySelector('.beneficiario-edad-info');

    inputFecha.addEventListener('change', function() {
        if (!this.value) {
            edadInfo.style.display = 'none';
            return;
        }

        const edad = calcularEdad(this.value);
        edadInfo.style.display = 'block';

        if (edad < 18) {
            edadInfo.textContent = `⚠️ Menor de edad (${edad} años)`;
            edadInfo.className = 'beneficiario-edad-info edad-menor';
        } else {
            edadInfo.textContent = `✓ Mayor de edad (${edad} años)`;
            edadInfo.className = 'beneficiario-edad-info edad-mayor';
        }
    });
}

window.eliminarBeneficiario = function(btn) {
    btn.closest('tr').remove();
    beneficiariosCount = document.querySelectorAll('#beneficiariosBody tr').length;
};

// ============================================================
// VALIDACIÓN Y CONFIRMACIÓN
// ============================================================
function validarYMostrarConfirmacion(e) {
    e.preventDefault();

    const erroresAnteriores = document.querySelectorAll('.error-message');
    erroresAnteriores.forEach(error => error.remove());

    const nombreTrabajador = document.getElementById('nombreTrabajador').value.trim();
    const numeroEmpleado = document.getElementById('numeroEmpleado').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const correo = document.getElementById('correo').value.trim();

    if (!nombreTrabajador || !numeroEmpleado) {
        mostrarError('Por favor complete todos los campos del trabajador');
        return;
    }

    if (numeroEmpleado.length < 8 || numeroEmpleado.length > 10) {
        mostrarError('El número de empleado debe tener entre 8 y 10 dígitos');
        return;
    }

    if (telefono.length !== 10) {
        mostrarError('El teléfono debe tener exactamente 10 dígitos');
        return;
    }

    if (!correo.includes('@')) {
        mostrarError('El correo electrónico debe contener un @');
        return;
    }

    // Validar beneficiarios (incluyendo edad)
    const filas = document.querySelectorAll('#beneficiariosBody tr');
    let hayFilasCompletas = false;

    for (const fila of filas) {
        const nombre = fila.querySelector('.beneficiario-nombre').value.trim();
        const fechaNac = fila.querySelector('.beneficiario-fecha-nac').value;
        const parentesco = fila.querySelector('.beneficiario-parentesco').value;
        const porcentaje = fila.querySelector('.beneficiario-porcentaje').value;

        // Ignorar filas vacías
        if (!nombre && !fechaNac && !parentesco && !porcentaje) continue;

        // Fila parcialmente llena
        if (!nombre || !fechaNac || !parentesco || !porcentaje) {
            mostrarError('Todos los campos de cada beneficiario son obligatorios (nombre, fecha de nacimiento, parentesco y porcentaje)');
            return;
        }

        // Validar que sea mayor de edad
        const edad = calcularEdad(fechaNac);
        if (edad < 18) {
            // Mostrar modal de menor de edad
            document.getElementById('modalMenorEdadTexto').textContent =
                `"${nombre.toUpperCase()}" tiene ${edad} año${edad === 1 ? '' : 's'} de edad y no puede ser registrado como beneficiario.`;
            document.getElementById('modalMenorEdad').style.display = 'block';
            return;
        }

        hayFilasCompletas = true;
    }

    const beneficiarios = obtenerBeneficiarios();

    if (beneficiarios.length === 0) {
        mostrarError('Debe agregar al menos un beneficiario');
        return;
    }

    const totalPorcentaje = beneficiarios.reduce((sum, b) => sum + parseInt(b.porcentaje), 0);

    if (totalPorcentaje !== 100) {
        mostrarError(`Los porcentajes deben sumar exactamente 100%. Actualmente suman: ${totalPorcentaje}%`);
        return;
    }

    mostrarResumen(nombreTrabajador, numeroEmpleado, telefono, correo, beneficiarios);
}

function obtenerBeneficiarios() {
    const filas = document.querySelectorAll('#beneficiariosBody tr');
    const beneficiarios = [];

    filas.forEach(fila => {
        const nombre = fila.querySelector('.beneficiario-nombre').value.trim().toUpperCase();
        const fechaNac = fila.querySelector('.beneficiario-fecha-nac').value;
        const parentesco = fila.querySelector('.beneficiario-parentesco').value;
        const porcentaje = fila.querySelector('.beneficiario-porcentaje').value;

        if (nombre && fechaNac && parentesco && porcentaje) {
            const edad = calcularEdad(fechaNac);
            beneficiarios.push({ nombre, fechaNac, edad, parentesco, porcentaje });
        }
    });

    return beneficiarios;
}

function mostrarResumen(nombre, empleado, telefono, correo, beneficiarios) {
    const resumen = document.getElementById('resumenDatos');

    let htmlBeneficiarios = '<ul style="margin: 10px 0; padding-left: 20px;">';
    beneficiarios.forEach(b => {
        htmlBeneficiarios += `<li><strong>${b.nombre}</strong> - ${b.parentesco} - Nac: ${b.fechaNac} (${b.edad} años) - ${b.porcentaje}%</li>`;
    });
    htmlBeneficiarios += '</ul>';

    resumen.innerHTML = `
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Número de empleado:</strong> ${empleado}</p>
        <p><strong>Teléfono:</strong> ${telefono}</p>
        <p><strong>Correo:</strong> ${correo}</p>
        <p><strong>Beneficiarios:</strong></p>
        ${htmlBeneficiarios}
        <p><strong>Fecha:</strong> ${document.getElementById('fecha').value}</p>
        <hr style="margin: 15px 0;">
        <p style="color: #e74c3c; font-weight: bold;">¿Está seguro de que todos los datos son correctos?</p>
    `;

    document.getElementById('modalConfirmacion').style.display = 'block';
}

async function enviarFormulario() {
    const btnConfirmar = document.getElementById('btnConfirmar');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Enviando...';

    try {
        const datos = {
            fecha: document.getElementById('fecha').value,
            nombreTrabajador: document.getElementById('nombreTrabajador').value.toUpperCase(),
            numeroEmpleado: document.getElementById('numeroEmpleado').value.toUpperCase(),
            beneficiarios: obtenerBeneficiarios(),
            firma: document.getElementById('firma').value.toUpperCase(),
            telefono: document.getElementById('telefono').value,
            correo: document.getElementById('correo').value.toLowerCase(),
            fechaRegistro: new Date().toISOString(),
            timestamp: Date.now()
        };

        await addDoc(collection(window.db, 'ayudaDefuncion'), datos);

        document.getElementById('modalConfirmacion').style.display = 'none';
        document.getElementById('modalExito').style.display = 'block';

    } catch (error) {
        console.error('Error al guardar:', error);
        alert('Hubo un error al guardar la información. Por favor intente nuevamente.');
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar y Enviar';
    }
}

function mostrarError(mensaje) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = mensaje;

    const form = document.getElementById('beneficiariosForm');
    form.insertBefore(errorDiv, form.firstChild);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => errorDiv.remove(), 5000);
}

function cerrarModal() {
    document.getElementById('modalConfirmacion').style.display = 'none';
    document.getElementById('modalExito').style.display = 'none';

    const btnConfirmar = document.getElementById('btnConfirmar');
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Confirmar y Enviar';
}