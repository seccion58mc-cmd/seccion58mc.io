import { db } from '../firebase-config.js';
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

let contacto2Activo = false;

document.addEventListener('DOMContentLoaded', () => {
    configurarTipoToggle();
    configurarValidacionNumerica();
    configurarMayusculas();
    configurarContacto2();

    document.getElementById('contactoForm').addEventListener('submit', validarYMostrarConfirmacion);
    document.getElementById('btnCancelar').addEventListener('click', () => {
        document.getElementById('modalConfirmacion').style.display = 'none';
    });
    document.getElementById('btnConfirmar').addEventListener('click', enviarFormulario);
    document.getElementById('btnCerrarExito').addEventListener('click', () => {
        location.reload();
    });
});

// ============================================================
// TIPO DE TRABAJADOR (PLANTA / EVENTUAL)
// ============================================================
function configurarTipoToggle() {
    const toggle = document.getElementById('tipoToggle');
    const botones = toggle.querySelectorAll('.tipo-btn');

    botones.forEach(btn => {
        btn.addEventListener('click', () => {
            botones.forEach(b => {
                b.classList.remove('is-active');
                b.setAttribute('aria-checked', 'false');
            });
            btn.classList.add('is-active');
            btn.setAttribute('aria-checked', 'true');
            toggle.dataset.tipo = btn.dataset.tipo;
            toggle.classList.remove('is-invalid');
        });
    });
}

// ============================================================
// VALIDACIONES DE INPUT
// ============================================================
function configurarValidacionNumerica() {
    document.getElementById('numeroEmpleado').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 8);
    });

    ['telefonoEmpleado', 'contacto1Telefono', 'contacto2Telefono'].forEach(id => {
        document.getElementById(id).addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
    });
}

function configurarMayusculas() {
    ['nombreEmpleado', 'contacto1Nombre', 'contacto2Nombre'].forEach(id => {
        document.getElementById(id).addEventListener('input', function() {
            const cursorPos = this.selectionStart;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(cursorPos, cursorPos);
        });
    });
}

// ============================================================
// CONTACTO 2 (OPCIONAL)
// ============================================================
function configurarContacto2() {
    const placeholder = document.getElementById('contacto2Placeholder');
    const campos = document.getElementById('contacto2Fields');

    document.getElementById('btnAgregarContacto2').addEventListener('click', () => {
        contacto2Activo = true;
        placeholder.hidden = true;
        campos.hidden = false;
    });

    document.getElementById('btnQuitarContacto2').addEventListener('click', () => {
        contacto2Activo = false;
        campos.hidden = true;
        placeholder.hidden = false;
        document.getElementById('contacto2Nombre').value = '';
        document.getElementById('contacto2Parentesco').value = '';
        document.getElementById('contacto2Telefono').value = '';
    });
}

// ============================================================
// VALIDACIÓN Y RESUMEN
// ============================================================
function validarYMostrarConfirmacion(e) {
    e.preventDefault();

    const tipoTrabajador = document.getElementById('tipoToggle').dataset.tipo || '';
    const numeroEmpleado = document.getElementById('numeroEmpleado').value.trim();
    const nombreEmpleado = document.getElementById('nombreEmpleado').value.trim();
    const telefonoEmpleado = document.getElementById('telefonoEmpleado').value.trim();

    const contacto1Nombre = document.getElementById('contacto1Nombre').value.trim();
    const contacto1Parentesco = document.getElementById('contacto1Parentesco').value;
    const contacto1Telefono = document.getElementById('contacto1Telefono').value.trim();

    if (!tipoTrabajador) {
        document.getElementById('tipoToggle').classList.add('is-invalid');
        mostrarNotificacion('Selecciona si eres trabajador de Planta o Eventual', 'error');
        return;
    }

    if (numeroEmpleado.length === 0 || numeroEmpleado.length > 8) {
        mostrarNotificacion('El número de empleado debe tener máximo 8 dígitos', 'error');
        return;
    }

    if (!nombreEmpleado) {
        mostrarNotificacion('Ingresa tu nombre completo', 'error');
        return;
    }

    if (telefonoEmpleado.length !== 10) {
        mostrarNotificacion('Tu teléfono debe tener exactamente 10 dígitos', 'error');
        return;
    }

    if (!contacto1Nombre || !contacto1Parentesco || contacto1Telefono.length !== 10) {
        mostrarNotificacion('Completa los datos del Contacto de emergencia 1 (nombre, parentesco y teléfono a 10 dígitos)', 'error');
        return;
    }

    let contacto2 = null;
    if (contacto2Activo) {
        const contacto2Nombre = document.getElementById('contacto2Nombre').value.trim();
        const contacto2Parentesco = document.getElementById('contacto2Parentesco').value;
        const contacto2Telefono = document.getElementById('contacto2Telefono').value.trim();

        if (!contacto2Nombre || !contacto2Parentesco || contacto2Telefono.length !== 10) {
            mostrarNotificacion('Completa los datos del Contacto de emergencia 2 o quítalo si no lo necesitas', 'error');
            return;
        }

        contacto2 = { nombre: contacto2Nombre, parentesco: contacto2Parentesco, telefono: contacto2Telefono };
    }

    const datos = {
        tipoTrabajador,
        numeroEmpleado,
        nombreEmpleado: nombreEmpleado.toUpperCase(),
        telefonoEmpleado,
        contacto1: { nombre: contacto1Nombre.toUpperCase(), parentesco: contacto1Parentesco, telefono: contacto1Telefono },
        contacto2
    };

    mostrarResumen(datos);
}

function mostrarResumen(datos) {
    const resumen = document.getElementById('resumenDatos');

    let html = `
        <div class="resumen-section">
            <strong>Tipo:</strong> ${datos.tipoTrabajador}<br>
            <strong>No. de empleado:</strong> ${datos.numeroEmpleado}<br>
            <strong>Nombre:</strong> ${datos.nombreEmpleado}<br>
            <strong>Teléfono:</strong> ${datos.telefonoEmpleado}
        </div>
        <div class="resumen-section">
            <strong>Contacto de emergencia 1</strong><br>
            ${datos.contacto1.nombre} (${datos.contacto1.parentesco}) - ${datos.contacto1.telefono}
        </div>
    `;

    if (datos.contacto2) {
        html += `
        <div class="resumen-section">
            <strong>Contacto de emergencia 2</strong><br>
            ${datos.contacto2.nombre} (${datos.contacto2.parentesco}) - ${datos.contacto2.telefono}
        </div>
        `;
    }

    resumen.innerHTML = html;

    document.getElementById('modalConfirmacion').dataset.payload = JSON.stringify(datos);
    document.getElementById('modalConfirmacion').style.display = 'block';
}

// ============================================================
// ENVÍO A FIREBASE
// ============================================================
async function enviarFormulario() {
    const btnConfirmar = document.getElementById('btnConfirmar');
    const datos = JSON.parse(document.getElementById('modalConfirmacion').dataset.payload);

    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Enviando...';

    try {
        await addDoc(collection(db, 'contactosEmergencia'), {
            ...datos,
            fechaRegistro: new Date().toISOString(),
            timestamp: Date.now()
        });

        document.getElementById('modalConfirmacion').style.display = 'none';
        document.getElementById('modalExito').style.display = 'block';
    } catch (error) {
        console.error('Error al guardar:', error);
        mostrarNotificacion('Hubo un error al guardar la información. Intenta nuevamente.', 'error');
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Sí, enviar';
    }
}

// ============================================================
// NOTIFICACIONES
// ============================================================
function mostrarNotificacion(mensaje, tipo = 'error') {
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notification-message');

    notification.className = `notification ${tipo}`;
    messageElement.textContent = mensaje;
    notification.classList.add('show');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => notification.classList.remove('show'), 4000);
}
