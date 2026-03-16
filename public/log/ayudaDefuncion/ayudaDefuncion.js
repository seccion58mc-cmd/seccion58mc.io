import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Variables globales
let beneficiariosCount = 0;
let edadVerificada = 0;
let fechaNacimientoVerificada = '';

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    configurarVerificacionEdad();
});

// ============================================================
// VERIFICACIÓN DE EDAD AL INICIO
// ============================================================
function configurarVerificacionEdad() {
    // Limitar el max del datepicker a hoy
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaNacimiento').setAttribute('max', hoy);

    // Mostrar edad calculada en tiempo real al cambiar la fecha
    document.getElementById('fechaNacimiento').addEventListener('change', function() {
        const edad = calcularEdad(this.value);
        const edadDiv = document.getElementById('edadCalculada');
        const errorDiv = document.getElementById('errorEdad');

        if (this.value) {
            edadDiv.style.display = 'block';
            edadDiv.textContent = `Tu edad: ${edad} años`;
            errorDiv.style.display = 'none';
        } else {
            edadDiv.style.display = 'none';
        }
    });

    // Botón continuar
    document.getElementById('btnVerificarEdad').addEventListener('click', verificarEdad);

    // Botón regresar desde pantalla bloqueada
    document.getElementById('btnReintentar').addEventListener('click', () => {
        document.getElementById('bloqueadoMenorEdad').style.display = 'none';
        document.getElementById('verificacionEdad').style.display = 'block';
        document.getElementById('fechaNacimiento').value = '';
        document.getElementById('edadCalculada').style.display = 'none';
    });
}

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

function verificarEdad() {
    const fechaNac = document.getElementById('fechaNacimiento').value;
    const errorDiv = document.getElementById('errorEdad');

    if (!fechaNac) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Por favor selecciona tu fecha de nacimiento.';
        return;
    }

    const edad = calcularEdad(fechaNac);

    if (edad < 18) {
        // Mostrar pantalla de bloqueado
        document.getElementById('verificacionEdad').style.display = 'none';
        document.getElementById('bloqueadoMenorEdad').style.display = 'block';
    } else {
        // Mayor o igual a 18 → mostrar formulario
        edadVerificada = edad;
        fechaNacimientoVerificada = fechaNac;
        document.getElementById('verificacionEdad').style.display = 'none';
        document.getElementById('contenidoFormulario').style.display = 'block';
        inicializarFormulario();
        configurarEventosFormulario();
        agregarFilaBeneficiario();
        agregarFilaBeneficiario();
        agregarFilaBeneficiario();
    }
}

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

    // Botones del modal
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
    document.getElementById('btnConfirmar').addEventListener('click', enviarFormulario);
    document.getElementById('btnCerrarExito').addEventListener('click', () => {
        cerrarModal();
        location.reload();
    });
}

function agregarFilaBeneficiario() {
    beneficiariosCount++;
    const tbody = document.getElementById('beneficiariosBody');
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', beneficiariosCount);

    tr.innerHTML = `
        <td><input type="text" class="beneficiario-nombre" placeholder="Nombre completo" required></td>
        <td>
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
        <td><input type="number" class="beneficiario-porcentaje" min="1" max="100" placeholder="%" required></td>
        <td>
            ${beneficiariosCount > 1 ? '<button type="button" class="btn-eliminar" onclick="eliminarBeneficiario(this)">Eliminar</button>' : ''}
        </td>
    `;

    tbody.appendChild(tr);

    const inputNombre = tr.querySelector('.beneficiario-nombre');
    inputNombre.addEventListener('input', function() {
        const cursorPos = this.selectionStart;
        this.value = this.value.toUpperCase();
        this.setSelectionRange(cursorPos, cursorPos);
    });
}

window.eliminarBeneficiario = function(btn) {
    btn.closest('tr').remove();
    beneficiariosCount = document.querySelectorAll('#beneficiariosBody tr').length;
};

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
        const parentesco = fila.querySelector('.beneficiario-parentesco').value;
        const porcentaje = fila.querySelector('.beneficiario-porcentaje').value;

        if (nombre && parentesco && porcentaje) {
            beneficiarios.push({ nombre, parentesco, porcentaje });
        }
    });

    return beneficiarios;
}

function mostrarResumen(nombre, empleado, telefono, correo, beneficiarios) {
    const resumen = document.getElementById('resumenDatos');

    let htmlBeneficiarios = '<ul style="margin: 10px 0; padding-left: 20px;">';
    beneficiarios.forEach(b => {
        htmlBeneficiarios += `<li><strong>${b.nombre}</strong> - ${b.parentesco} - ${b.porcentaje}%</li>`;
    });
    htmlBeneficiarios += '</ul>';

    resumen.innerHTML = `
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Número de empleado:</strong> ${empleado}</p>
        <p><strong>Fecha de nacimiento:</strong> ${fechaNacimientoVerificada} (${edadVerificada} años)</p>
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
            fechaNacimiento: fechaNacimientoVerificada,
            edad: edadVerificada,
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