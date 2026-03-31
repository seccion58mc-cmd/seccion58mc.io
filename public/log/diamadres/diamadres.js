import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// ── Estado global ──────────────────────────────────────────
let hijosCount = 0;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    inicializarFecha();
    configurarEventos();
    agregarHijo(); // un hijo por defecto
});

function inicializarFecha() {
    const hoy = new Date();
    document.getElementById('fecha').value =
        hoy.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function configurarEventos() {
    // Nombre → solo letras, mayúsculas automáticas
    document.getElementById('nombre').addEventListener('input', function () {
        const pos = this.selectionStart;
        this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '').toUpperCase();
        this.setSelectionRange(pos, pos);
    });

    // Edad → solo números
    document.getElementById('edad').addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    document.getElementById('btnAgregarHijo').addEventListener('click', agregarHijo);
    document.getElementById('diaMadresForm').addEventListener('submit', validarYConfirmar);
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
    document.getElementById('btnConfirmar').addEventListener('click', enviar);
    document.getElementById('btnCerrarExito').addEventListener('click', () => {
        cerrarModal();
        location.reload();
    });
}

// ── Agregar hijo ───────────────────────────────────────────
function agregarHijo() {
    hijosCount++;
    const lista = document.getElementById('hijosLista');
    const div = document.createElement('div');
    div.className = 'hijo-card';
    div.setAttribute('data-id', hijosCount);

    div.innerHTML = `
        <div class="hijo-numero">${hijosCount}</div>
        <div class="hijo-fields">
            <div class="hijo-field">
                <label>Edad</label>
                <div class="hijo-field-edad">
                    <input type="number" class="hijo-edad-valor" placeholder="0" min="0" max="999" required>
                    <select class="hijo-edad-unidad">
                        <option value="años">años</option>
                        <option value="meses">meses</option>
                    </select>
                </div>
            </div>
        </div>
        <button type="button" class="btn-eliminar-hijo" onclick="eliminarHijo(this)">Eliminar</button>
    `;

    lista.appendChild(div);

    // Edad hijo → no negativos
    div.querySelector('.hijo-edad-valor').addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    actualizarNumerosHijos();
}

window.eliminarHijo = function (btn) {
    btn.closest('.hijo-card').remove();
    actualizarNumerosHijos();
};

function actualizarNumerosHijos() {
    document.querySelectorAll('#hijosLista .hijo-card').forEach((card, i) => {
        card.querySelector('.hijo-numero').textContent = i + 1;
    });
}

// ── Validación ─────────────────────────────────────────────
function validarYConfirmar(e) {
    e.preventDefault();
    document.querySelectorAll('.error-message').forEach(el => el.remove());

    const nombre   = document.getElementById('nombre').value.trim();
    const edad     = parseInt(document.getElementById('edad').value);
    const contrato = document.querySelector('input[name="contrato"]:checked');

    if (!nombre)
        return mostrarError('Por favor ingresa tu nombre completo.');

    if (!/^[A-ZÁÉÍÓÚÜÑ\s]+$/.test(nombre))
        return mostrarError('El nombre solo puede contener letras, sin números ni caracteres especiales.');

    if (isNaN(edad) || edad < 18 || edad > 95)
        return mostrarError('La edad debe estar entre 18 y 95 años.');

    if (!contrato)
        return mostrarError('Selecciona el tipo de contrato: Planta o Eventual.');

    const tarjetasHijos = document.querySelectorAll('#hijosLista .hijo-card');

    if (tarjetasHijos.length === 0)
        return mostrarError('Debes registrar al menos un hijo/a.');

    for (const card of tarjetasHijos) {
        const val = card.querySelector('.hijo-edad-valor').value;
        const num = parseInt(val);
        if (val === '' || isNaN(num) || num < 0)
            return mostrarError('La edad de cada hijo/a es obligatoria y no puede ser negativa.');
    }

    mostrarResumen(nombre, edad, contrato.value, obtenerHijos());
}

function obtenerHijos() {
    const hijos = [];
    document.querySelectorAll('#hijosLista .hijo-card').forEach(card => {
        hijos.push({
            edad:    parseInt(card.querySelector('.hijo-edad-valor').value),
            unidad:  card.querySelector('.hijo-edad-unidad').value
        });
    });
    return hijos;
}

function mostrarResumen(nombre, edad, contrato, hijos) {
    let htmlHijos = '<ul style="margin:8px 0 0; padding-left:20px;">';
    hijos.forEach(h => {
        htmlHijos += `<li>${h.edad} ${h.unidad}</li>`;
    });
    htmlHijos += '</ul>';

    document.getElementById('resumenDatos').innerHTML = `
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Edad:</strong> ${edad} años</p>
        <p><strong>Contrato:</strong> ${contrato}</p>
        <p><strong>Hijos (${hijos.length}):</strong>${htmlHijos}</p>
        <p><strong>Fecha:</strong> ${document.getElementById('fecha').value}</p>
        <hr style="margin:14px 0; border:none; border-top:1px solid #e5e0f0;">
        <p style="color:#7c3aed; font-weight:700;">Por favor verifica que todos los datos sean correctos antes de confirmar.</p>
    `;

    document.getElementById('modalConfirmacion').style.display = 'block';
}

// ── Enviar a Firebase ──────────────────────────────────────
async function enviar() {
    const btn = document.getElementById('btnConfirmar');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const hijos = obtenerHijos();
        const datos = {
            fecha:          document.getElementById('fecha').value,
            nombre:         document.getElementById('nombre').value.trim().toUpperCase(),
            edad:           parseInt(document.getElementById('edad').value),
            contrato:       document.querySelector('input[name="contrato"]:checked').value,
            hijos:          hijos,
            totalHijos:     hijos.length,
            fechaRegistro:  new Date().toISOString(),
            timestamp:      Date.now()
        };

        await addDoc(collection(window.db, 'diamadres'), datos);

        document.getElementById('modalConfirmacion').style.display = 'none';
        document.getElementById('modalExito').style.display = 'block';

    } catch (err) {
        console.error('Error al guardar:', err);
        alert('Hubo un error al guardar la información. Por favor intenta nuevamente.');
        btn.disabled = false;
        btn.textContent = 'Confirmar y Enviar';
    }
}

// ── Helpers ────────────────────────────────────────────────
function mostrarError(msg) {
    const div = document.createElement('div');
    div.className = 'error-message';
    div.textContent = msg;
    const form = document.getElementById('diaMadresForm');
    form.insertBefore(div, form.firstChild);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => div.remove(), 6000);
}

function cerrarModal() {
    document.getElementById('modalConfirmacion').style.display = 'none';
    document.getElementById('modalExito').style.display = 'none';
    const btn = document.getElementById('btnConfirmar');
    btn.disabled = false;
    btn.textContent = 'Confirmar y Enviar';
}