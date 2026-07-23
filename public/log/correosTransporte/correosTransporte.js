import { collection, addDoc, query, where, getDocs, getDoc, doc as fdoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const COLECCION = 'CorreosTransporte';

document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);
    $('currentYear').textContent = new Date().getFullYear();

    // Verificar si el formulario esta habilitado desde el panel admin
    try {
        const cfg = await getDoc(fdoc(window.db, 'Config', 'correosTransporte'));
        if (cfg.exists() && cfg.data().habilitado === false) {
            $('formTransporte').style.display = 'none';
            const aviso = document.createElement('div');
            aviso.className = 'declaracion';
            aviso.style.textAlign = 'center';
            aviso.innerHTML = `
                <p><i class="fas fa-lock" style="font-size:1.5rem;"></i></p>
                <p><strong>El registro esta cerrado temporalmente.</strong></p>
                <p>En este momento no se estan recibiendo respuestas. Intenta mas tarde.</p>`;
            document.querySelector('.main-content').appendChild(aviso);
            return;
        }
    } catch (e) {
        console.error('No se pudo verificar el estado del formulario:', e);
    }

    // Nombres en MAYUSCULAS. El correo se guarda tal cual lo escriben.
    ['apellidoPaterno', 'apellidoMaterno', 'primerNombre', 'segundoNombre'].forEach(id => {
        $(id).addEventListener('input', e => {
            const pos = e.target.selectionStart;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(pos, pos);
        });
    });

    // Telefono: solo digitos, maximo 10, con contador
    $('telefono').addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
        const n = e.target.value.length;
        $('telCount').textContent = `${n}/10`;
        $('telCount').classList.toggle('ok', n === 10);
        $('telField').classList.toggle('ok', n === 10);
    });

    const correoValido = c => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

    function modal(icono, clase, titulo, texto, recargar = false) {
        const m = document.createElement('div');
        m.className = 'modal';
        m.style.display = 'block';
        m.innerHTML = `
            <div class="modal-content">
                <div class="modal-icon ${clase}"><i class="fas ${icono}"></i></div>
                <h2>${titulo}</h2>
                <p>${texto}</p>
                <div class="modal-buttons">
                    <button class="btn-primary" onclick="this.closest('.modal').remove();${recargar ? 'location.reload()' : ''}">Entendido</button>
                </div>
            </div>`;
        document.body.appendChild(m);
    }
    const error = txt => modal('fa-exclamation-triangle', 'warning-icon', 'Validacion requerida', txt);

    function showLoading(on) {
        if (!on) return document.getElementById('loadingOverlay')?.remove();
        const d = document.createElement('div');
        d.className = 'loading-overlay';
        d.id = 'loadingOverlay';
        d.innerHTML = '<div class="spinner"></div><p>Registrando tus datos...</p>';
        document.body.appendChild(d);
    }

    $('btnLimpiar').addEventListener('click', () => {
        if (!confirm('¿Deseas limpiar el formulario?')) return;
        $('formTransporte').reset();
        $('telCount').textContent = '0/10';
        $('telCount').classList.remove('ok');
        $('telField').classList.remove('ok');
    });

    $('formTransporte').addEventListener('submit', async e => {
        e.preventDefault();

        const datos = {
            apellidoPaterno: $('apellidoPaterno').value.trim().toUpperCase(),
            apellidoMaterno: $('apellidoMaterno').value.trim().toUpperCase(),
            primerNombre: $('primerNombre').value.trim().toUpperCase(),
            segundoNombre: $('segundoNombre').value.trim().toUpperCase(),
            correo: $('correo').value.trim(),
            telefono: $('telefono').value.trim()
        };
        const confirmaCorreo = $('confirmaCorreo').value.trim();

        if (!datos.apellidoPaterno || !datos.apellidoMaterno || !datos.primerNombre)
            return error('Apellido paterno, materno y primer nombre son obligatorios.');
        if (!datos.correo.includes('@') || !correoValido(datos.correo))
            return error('El correo debe ser valido y contener el simbolo @. Recuerda que debe ser tu correo <strong>personal</strong>.');
        if (datos.correo !== confirmaCorreo)
            return error('Los correos no coinciden. Por favor verifica.');
        if (!/^\d{10}$/.test(datos.telefono))
            return error('El telefono debe tener exactamente 10 digitos.');
        if (!$('aceptoTerminos').checked)
            return error('Debes confirmar que los datos son verIdicos.');

        showLoading(true);
        try {
            const dup = await getDocs(query(collection(window.db, COLECCION), where('correo', '==', datos.correo)));
            if (!dup.empty) {
                showLoading(false);
                return modal('fa-user-slash', 'error-icon', 'Correo ya registrado',
                    `El correo <strong>${datos.correo}</strong> ya esta registrado en el sistema.`, true);
            }

            await addDoc(collection(window.db, COLECCION), {
                ...datos,
                nombreCompleto: `${datos.primerNombre} ${datos.segundoNombre} ${datos.apellidoPaterno} ${datos.apellidoMaterno}`.replace(/\s+/g, ' ').trim(),
                fechaRegistro: Timestamp.now(),
                activo: true
            });

            showLoading(false);
            modal('fa-check', 'success-icon', '¡Registro exitoso!',
                'Tus datos de transporte fueron registrados correctamente.', true);
        } catch (err) {
            showLoading(false);
            console.error(err);
            modal('fa-times', 'error-icon', 'Error en el registro',
                'Ocurrio un error al registrar tus datos. Intenta nuevamente. ' + err.message);
        }
    });
});
