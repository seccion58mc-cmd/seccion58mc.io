import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Variables globales
let beneficiariosCount = 0;
let edadVerificada = 0;
let fechaNacimientoVerificada = '';

// Testigos fijos
const TESTIGO_1 = "MARIA DEL ROSARIO GÓMEZ GONZÁLEZ";
const TESTIGO_2 = " ";

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
        // Mostrar pantalla bloqueada
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
    const dia = fechaActual.getDate();
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const mes = meses[fechaActual.getMonth()];
    const anio = fechaActual.getFullYear();
    document.getElementById('fecha').value = `Ciudad de México, a ${dia} de ${mes} del ${anio}.`;
}

function configurarEventosFormulario() {
    // Convertir a mayúsculas mientras escribe
    const campoNombre = document.getElementById('nombreTrabajador');
    campoNombre.addEventListener('input', function() {
        const cursorPos = this.selectionStart;
        this.value = this.value.toUpperCase();
        this.setSelectionRange(cursorPos, cursorPos);
    });

    // Copiar nombre a firma automáticamente
    campoNombre.addEventListener('input', function() {
        document.getElementById('firmaTrabajador').value = this.value;
    });

    // Botón agregar beneficiario
    document.getElementById('agregarBeneficiario').addEventListener('click', agregarFilaBeneficiario);

    // Submit del formulario
    document.getElementById('beneficiarioEventualForm').addEventListener('submit', validarYMostrarConfirmacion);

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
                <option value="HIJO">HIJO</option>
                <option value="HIJA">HIJA</option>
                <option value="ESPOSO">ESPOSO</option>
                <option value="ESPOSA">ESPOSA</option>
                <option value="PADRE">PADRE</option>
                <option value="MADRE">MADRE</option>
                <option value="HERMANO">HERMANO</option>
                <option value="HERMANA">HERMANA</option>
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

    if (!nombreTrabajador) {
        mostrarError('Por favor ingrese el nombre del trabajador');
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

    mostrarResumen(nombreTrabajador, beneficiarios);
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

function mostrarResumen(nombre, beneficiarios) {
    const resumen = document.getElementById('resumenDatos');

    let htmlBeneficiarios = '<ul style="margin: 10px 0; padding-left: 20px;">';
    beneficiarios.forEach(b => {
        htmlBeneficiarios += `<li><strong>${b.nombre}</strong> - ${b.parentesco} - ${b.porcentaje}%</li>`;
    });
    htmlBeneficiarios += '</ul>';

    resumen.innerHTML = `
        <p><strong>Fecha:</strong> ${document.getElementById('fecha').value}</p>
        <p><strong>Nombre del Trabajador:</strong> ${nombre}</p>
        <p><strong>Fecha de nacimiento:</strong> ${fechaNacimientoVerificada} (${edadVerificada} años)</p>
        <p><strong>Empresa:</strong> COSBEL, S. A. DE C. V. (Sección 58)</p>
        <hr style="margin: 15px 0;">
        <p><strong>Beneficiarios:</strong></p>
        ${htmlBeneficiarios}
        <hr style="margin: 15px 0;">
        <p><strong>Testigo 1:</strong> ${TESTIGO_1}</p>
        <p><strong>Testigo 2:</strong> ${TESTIGO_2}</p>
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
            fechaNacimiento: fechaNacimientoVerificada,
            edad: edadVerificada,
            empresa: "COSBEL, S. A. DE C. V. (Sección 58)",
            beneficiarios: obtenerBeneficiarios(),
            firma: document.getElementById('firmaTrabajador').value.toUpperCase(),
            testigos: [
                { nombre: TESTIGO_1, fecha: document.getElementById('fecha').value },
                { nombre: TESTIGO_2, fecha: document.getElementById('fecha').value }
            ],
            fechaRegistro: new Date().toISOString(),
            timestamp: Date.now()
        };

        await addDoc(collection(window.db, 'beneficiarioEventual'), datos);

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

    const form = document.getElementById('beneficiarioEventualForm');
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