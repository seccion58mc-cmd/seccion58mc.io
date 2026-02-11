import { collection, addDoc, query, where, getDocs, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // Configurar año actual en el footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // Configurar fecha máxima para ingreso (no fechas futuras)
    const fechaIngresoInput = document.getElementById('fechaIngreso');
    const hoy = new Date();
    fechaIngresoInput.max = hoy.toISOString().split('T')[0];

    // Actualizar antigüedad cuando cambia la fecha de ingreso
    fechaIngresoInput.addEventListener('change', actualizarAntiguedad);

    // Función para calcular y mostrar la antigüedad CON DÍAS
    function actualizarAntiguedad() {
        const fechaIngreso = new Date(fechaIngresoInput.value);
        
        if (isNaN(fechaIngreso.getTime())) {
            document.getElementById('antiguedadCalculada').textContent = '-- años -- meses -- días';
            return;
        }

        const hoy = new Date();
        
        // Validar que no sea fecha futura
        if (fechaIngreso > hoy) {
            mostrarError('La fecha de ingreso no puede ser futura');
            fechaIngresoInput.value = '';
            document.getElementById('antiguedadCalculada').textContent = '-- años -- meses -- días';
            return;
        }

        // Calcular antigüedad exacta con días
        const antiguedad = calcularAntiguedadExacta(fechaIngreso, hoy);
        
        // Mostrar antigüedad
        const antiguedadTexto = formatearAntiguedad(antiguedad);
        document.getElementById('antiguedadCalculada').textContent = antiguedadTexto;
    }

    // Función para calcular antigüedad exacta (años, meses, días)
    function calcularAntiguedadExacta(fechaInicio, fechaFin) {
        let años = fechaFin.getFullYear() - fechaInicio.getFullYear();
        let meses = fechaFin.getMonth() - fechaInicio.getMonth();
        let dias = fechaFin.getDate() - fechaInicio.getDate();

        // Si los días son negativos, ajustar meses
        if (dias < 0) {
            // Obtener último día del mes anterior
            const ultimoDiaMesAnterior = new Date(
                fechaFin.getFullYear(),
                fechaFin.getMonth(),
                0
            ).getDate();
            
            dias = ultimoDiaMesAnterior - fechaInicio.getDate() + fechaFin.getDate();
            meses--;
        }

        // Si los meses son negativos, ajustar años
        if (meses < 0) {
            meses += 12;
            años--;
        }

        return {
            años: años,
            meses: meses,
            dias: dias,
            fechaInicio: fechaInicio,
            fechaFin: fechaFin
        };
    }

    // Función para formatear la antigüedad en texto
    function formatearAntiguedad(antiguedad) {
        const partes = [];
        
        if (antiguedad.años > 0) {
            partes.push(`${antiguedad.años} año${antiguedad.años !== 1 ? 's' : ''}`);
        }
        
        if (antiguedad.meses > 0) {
            partes.push(`${antiguedad.meses} mes${antiguedad.meses !== 1 ? 'es' : ''}`);
        }
        
        if (antiguedad.dias > 0) {
            partes.push(`${antiguedad.dias} día${antiguedad.dias !== 1 ? 's' : ''}`);
        }
        
        // Si no hay antigüedad (menos de 1 día)
        if (partes.length === 0) {
            return "Menos de 1 día";
        }
        
        return partes.join(' ');
    }

    // Función para convertir nombres a mayúsculas
    function convertirAMayusculas(event) {
        const input = event.target;
        const cursorPos = input.selectionStart;
        input.value = input.value.toUpperCase();
        input.setSelectionRange(cursorPos, cursorPos);
    }

    // Aplicar conversión a mayúsculas a los campos de nombre
    ['nombres', 'apellidoPaterno', 'apellidoMaterno'].forEach(campoId => {
        const elemento = document.getElementById(campoId);
        if (elemento) {
            elemento.addEventListener('input', convertirAMayusculas);
        }
    });

    // Validar que los correos coincidan en tiempo real
    document.getElementById('correo').addEventListener('input', validarCorreos);
    document.getElementById('confirmaCorreo').addEventListener('input', validarCorreos);

    // Validar duplicados de correo en tiempo real (con debounce)
    let debounceTimer;
    document.getElementById('correo').addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (e.target.value && validarFormatoCorreo(e.target.value)) {
                verificarCorreoDuplicado(e.target.value);
            }
        }, 800); // 800ms de delay
    });

    function validarCorreos() {
        const correo = document.getElementById('correo').value;
        const confirmaCorreo = document.getElementById('confirmaCorreo').value;
        const correoInput = document.getElementById('correo');
        const confirmaInput = document.getElementById('confirmaCorreo');

        // Remover mensajes de error previos
        removerMensajesError();

        // Validar formato básico de correo
        if (correo && !validarFormatoCorreo(correo)) {
            mostrarErrorCampo(correoInput, 'Formato de correo inválido. Debe contener @ y un dominio válido');
            return false;
        }

        // Validar coincidencia si ambos campos tienen valor
        if (correo && confirmaCorreo && correo !== confirmaCorreo) {
            mostrarErrorCampo(confirmaInput, 'Los correos no coinciden');
            return false;
        }

        // Si coinciden y son válidos
        if (correo && confirmaCorreo && correo === confirmaCorreo && validarFormatoCorreo(correo)) {
            mostrarExitoCampo(confirmaInput, '✓ Correos coinciden');
        }

        return true;
    }

    // Función para verificar si el correo ya existe en la base de datos
    async function verificarCorreoDuplicado(correo) {
        try {
            const correosRef = collection(window.db, 'ListadoCorreos');
            const q = query(correosRef, where('correo', '==', correo));
            const querySnapshot = await getDocs(q);
            
            const correoInput = document.getElementById('correo');
            
            if (!querySnapshot.empty) {
                // Correo ya existe
                mostrarErrorCampo(correoInput, '❌ Este correo ya está registrado en el sistema');
                // Deshabilitar botón de envío
                document.getElementById('btnEnviar').disabled = true;
                document.getElementById('btnEnviar').innerHTML = '<i class="fas fa-ban"></i> Correo ya registrado';
                return true;
            } else {
                // Correo disponible
                mostrarExitoCampo(correoInput, '✓ Correo disponible');
                // Habilitar botón de envío
                document.getElementById('btnEnviar').disabled = false;
                document.getElementById('btnEnviar').innerHTML = '<i class="fas fa-paper-plane"></i> Registrar Correo';
                return false;
            }
        } catch (error) {
            console.error('Error al verificar correo:', error);
            return false;
        }
    }

    function validarFormatoCorreo(correo) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(correo);
    }

    function mostrarErrorCampo(input, mensaje) {
        input.style.borderColor = '#e74c3c';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensaje}`;
        
        // Remover mensaje previo si existe
        const mensajePrevio = input.parentNode.querySelector('.error-message, .success-message');
        if (mensajePrevio) {
            mensajePrevio.remove();
        }
        
        input.parentNode.appendChild(errorDiv);
    }

    function mostrarExitoCampo(input, mensaje) {
        input.style.borderColor = '#27ae60';
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${mensaje}`;
        
        // Remover mensaje previo si existe
        const mensajePrevio = input.parentNode.querySelector('.error-message, .success-message');
        if (mensajePrevio) {
            mensajePrevio.remove();
        }
        
        input.parentNode.appendChild(successDiv);
    }

    function removerMensajesError() {
        const mensajes = document.querySelectorAll('.error-message, .success-message');
        mensajes.forEach(msg => msg.remove());
    }

    // Botón limpiar
    document.getElementById('btnLimpiar').addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas limpiar el formulario? Se perderán todos los datos ingresados.')) {
            document.getElementById('formCorreos').reset();
            document.getElementById('antiguedadCalculada').textContent = '-- años -- meses -- días';
            removerMensajesError();
            
            // Restablecer bordes a color normal
            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => input.style.borderColor = '');
            
            // Habilitar botón de envío
            document.getElementById('btnEnviar').disabled = false;
            document.getElementById('btnEnviar').innerHTML = '<i class="fas fa-paper-plane"></i> Registrar Correo';
        }
    });

    // Funciones para mostrar/ocultar loading
    function showLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-overlay';
        loadingDiv.id = 'loadingOverlay';
        loadingDiv.innerHTML = `
            <div class="spinner"></div>
            <p>Registrando tu correo...</p>
        `;
        document.body.appendChild(loadingDiv);
    }

    function hideLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.remove();
        }
    }

    // Función para mostrar modal de éxito
    function showSuccessModal(message) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-icon success-icon">
                    <i class="fas fa-check"></i>
                </div>
                <h2>¡Registro Exitoso!</h2>
                <p>${message}</p>
                <div class="modal-buttons">
                    <button class="btn-primary" onclick="this.closest('.modal').remove(); location.reload()">Aceptar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Función para mostrar modal de error
    function showErrorModal(message) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-icon error-icon">
                    <i class="fas fa-times"></i>
                </div>
                <h2>Error en el Registro</h2>
                <p>${message}</p>
                <div class="modal-buttons">
                    <button class="btn-primary" onclick="this.closest('.modal').remove()">Entendido</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Función para mostrar modal de correo duplicado
    function showDuplicateModal(correo) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-icon error-icon">
                    <i class="fas fa-user-slash"></i>
                </div>
                <h2>Correo ya Registrado</h2>
                <p>El correo <strong>${correo}</strong> ya está registrado en nuestro sistema.</p>
                <p>No se permiten registros duplicados. Si crees que esto es un error, contacta al administrador del sistema.</p>
                <div class="modal-buttons">
                    <button class="btn-primary" onclick="this.closest('.modal').remove(); location.reload()">Entendido</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Función auxiliar para mostrar error simple
    function mostrarError(mensaje) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-icon warning-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2>Validación Requerida</h2>
                <p>${mensaje}</p>
                <div class="modal-buttons">
                    <button class="btn-primary" onclick="this.closest('.modal').remove()">Entendido</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Envío del formulario
    document.getElementById('formCorreos').addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validar formulario
        if (!validarFormulario()) {
            return;
        }

        // Verificar si el correo ya fue marcado como duplicado
        const correo = document.getElementById('correo').value.trim();
        const btnEnviar = document.getElementById('btnEnviar');
        
        if (btnEnviar.disabled) {
            showErrorModal('No puedes registrar este correo porque ya está registrado en el sistema.');
            return;
        }

        // Mostrar loading
        showLoading();

        try {
            // Verificar duplicado nuevamente (doble verificación)
            const correosRef = collection(window.db, 'ListadoCorreos');
            const q = query(correosRef, where('correo', '==', correo));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                hideLoading();
                showDuplicateModal(correo);
                return;
            }

            // Si no existe, proceder con el registro
            await enviarRegistro(correo);

        } catch (error) {
            hideLoading();
            console.error('Error al verificar correo:', error);
            
            if (error.code === 'permission-denied') {
                showErrorModal('Error de permisos. Por favor, contacta al administrador del sistema.');
            } else {
                showErrorModal('Ocurrió un error al verificar el correo. Por favor, intenta nuevamente.');
            }
        }
    });

    async function enviarRegistro(correo) {
        try {
            // Obtener valores del formulario
            const nombres = document.getElementById('nombres').value.trim().toUpperCase();
            const apellidoPaterno = document.getElementById('apellidoPaterno').value.trim().toUpperCase();
            const apellidoMaterno = document.getElementById('apellidoMaterno').value.trim().toUpperCase();
            const fechaIngreso = document.getElementById('fechaIngreso').value;

            // Calcular antigüedad exacta CON DÍAS
            const fechaIngresoObj = new Date(fechaIngreso);
            const hoy = new Date();
            
            const antiguedad = calcularAntiguedadExacta(fechaIngresoObj, hoy);
            const antiguedadTexto = formatearAntiguedad(antiguedad);

            // Preparar datos para guardar
            const datosCorreo = {
                // Datos personales (nombres en mayúsculas)
                nombreCompleto: `${nombres} ${apellidoPaterno} ${apellidoMaterno}`,
                nombres: nombres,
                apellidoPaterno: apellidoPaterno,
                apellidoMaterno: apellidoMaterno,
                
                // Correo (respetando mayúsculas/minúsculas exactas)
                correo: correo,
                
                // Datos de antigüedad CON DÍAS
                fechaIngreso: fechaIngreso,
                antiguedadAnios: antiguedad.años,
                antiguedadMeses: antiguedad.meses,
                antiguedadDias: antiguedad.dias,
                antiguedadTotal: antiguedadTexto,
                
                // Metadatos
                fechaRegistro: Timestamp.now(),
                fechaActualizacion: Timestamp.now(),
                activo: true
            };

            // Guardar en Firestore
            await addDoc(collection(window.db, 'ListadoCorreos'), datosCorreo);

            hideLoading();
            showSuccessModal('Tu correo ha sido registrado exitosamente. Recibirás las comunicaciones del sindicato en tu dirección de correo electrónico.');

        } catch (error) {
            hideLoading();
            console.error('Error al registrar correo:', error);
            
            if (error.code === 'permission-denied') {
                showErrorModal('No tienes permisos para realizar esta acción. Por favor, contacta al administrador del sistema.');
            } else {
                showErrorModal('Ocurrió un error al registrar tu correo. Por favor, intenta nuevamente. Error: ' + error.message);
            }
        }
    }

    function validarFormulario() {
        // Remover mensajes de error previos
        removerMensajesError();

        // Validar nombres
        const nombres = document.getElementById('nombres').value.trim();
        const paterno = document.getElementById('apellidoPaterno').value.trim();
        const materno = document.getElementById('apellidoMaterno').value.trim();

        if (!nombres || !paterno || !materno) {
            mostrarError('Todos los campos de nombre son obligatorios');
            return false;
        }

        // Validar correos
        const correo = document.getElementById('correo').value.trim();
        const confirmaCorreo = document.getElementById('confirmaCorreo').value.trim();

        if (!correo || !confirmaCorreo) {
            mostrarError('Ambos campos de correo son obligatorios');
            return false;
        }

        if (!validarFormatoCorreo(correo)) {
            mostrarError('El formato del correo electrónico no es válido. Debe contener @ y un dominio válido.');
            return false;
        }

        if (correo !== confirmaCorreo) {
            mostrarError('Los correos electrónicos no coinciden. Por favor verifica.');
            return false;
        }

        // Validar fecha de ingreso
        const fechaIngreso = document.getElementById('fechaIngreso').value;
        if (!fechaIngreso) {
            mostrarError('La fecha de ingreso es obligatoria');
            return false;
        }

        const fechaIngresoObj = new Date(fechaIngreso);
        const hoy = new Date();

        if (fechaIngresoObj > hoy) {
            mostrarError('La fecha de ingreso no puede ser futura');
            return false;
        }

        // Validar términos
        if (!document.getElementById('aceptoTerminos').checked) {
            mostrarError('Debes aceptar los términos y condiciones para continuar');
            return false;
        }

        return true;
    }
});