// Estado abierto/cerrado (Config/<id>) y limpieza de registros, compartido por los formularios y sus paneles admin
import { doc, getDoc, setDoc, collection, getDocs, getCountFromServer, query, limit, writeBatch } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

async function estaAbierto(db, id) {
    try {
        const snap = await getDoc(doc(db, 'Config', id));
        return !(snap.exists() && snap.data().habilitado === false);
    } catch (e) { return true; }
}

// Público: si está cerrado oculta el formulario y muestra el aviso. firestore.rules también bloquea el create.
export async function bloquearSiCerrado(db, id, formId) {
    if (await estaAbierto(db, id)) return false;
    const form = document.getElementById(formId);
    form.style.display = 'none';
    form.insertAdjacentHTML('afterend', `
        <div style="text-align:center;padding:40px 20px;">
            <h2>Formulario cerrado</h2>
            <p>En este momento no se están recibiendo respuestas.</p>
        </div>`);
    return true;
}

// Diálogo propio (mismo aspecto en todos los paneles). `input`: texto que hay que escribir para habilitar el botón.
function dialogo({ icono, color, titulo, html, input, confirmar = 'Aceptar', cancelar }) {
    return new Promise(resolve => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
        const b = 'flex:1;padding:12px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;border:1px solid ';
        ov.innerHTML = `
            <div style="background:#111827;color:#F0F4FF;border:1px solid rgba(255,255,255,.1);border-radius:16px;width:100%;max-width:420px;padding:28px;text-align:center;box-shadow:0 10px 60px rgba(0,0,0,.7);">
                <div style="width:56px;height:56px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:24px;color:${color};background:${color}26;"><i class="fa-solid ${icono}"></i></div>
                <h3 style="margin:0 0 8px;font-size:20px;color:#F0F4FF;">${titulo}</h3>
                <p style="margin:0;color:#8FA3C0;font-size:14px;line-height:1.5;">${html}</p>
                ${input ? '<input type="text" autocomplete="off" style="width:100%;box-sizing:border-box;margin-top:16px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);color:#F0F4FF;font-size:15px;text-align:center;letter-spacing:2px;outline:none;">' : ''}
                <div style="display:flex;gap:10px;margin-top:22px;">
                    ${cancelar ? `<button type="button" class="fc-no" style="${b}rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#F0F4FF;">${cancelar}</button>` : ''}
                    <button type="button" class="fc-si" style="${b}${color};background:${color};color:#fff;">${confirmar}</button>
                </div>
            </div>`;
        document.body.appendChild(ov);

        const si = ov.querySelector('.fc-si');
        const campo = ov.querySelector('input');
        const cerrar = r => { document.removeEventListener('keydown', tecla); ov.remove(); resolve(r); };
        const tecla = e => { if (e.key === 'Escape') cerrar(false); };
        document.addEventListener('keydown', tecla);
        ov.addEventListener('click', e => { if (e.target === ov) cerrar(false); });
        si.addEventListener('click', () => cerrar(true));
        if (cancelar) ov.querySelector('.fc-no').addEventListener('click', () => cerrar(false));
        if (campo) {
            const revisar = () => {
                const ok = campo.value.trim().toUpperCase() === input;
                si.disabled = !ok;
                si.style.opacity = ok ? '1' : '.4';
                si.style.cursor = ok ? 'pointer' : 'not-allowed';
            };
            campo.placeholder = `Escribe ${input}`;
            campo.addEventListener('input', revisar);
            revisar();
            campo.focus();
        }
    });
}

const pedirBorrar = total => dialogo({
    icono: 'fa-triangle-exclamation', color: '#EF4444', titulo: '¿Borrar todos los registros?',
    html: `Se eliminarán <strong style="color:#F0F4FF;">${total}</strong> registros de forma permanente.<br>Para confirmar escribe <strong style="color:#EF4444;">BORRAR</strong>.`,
    input: 'BORRAR', confirmar: 'Sí, borrar', cancelar: 'Cancelar'
});

const aviso = (msg, error = false) => dialogo({
    icono: error ? 'fa-circle-xmark' : 'fa-circle-check', color: error ? '#EF4444' : '#22C55E',
    titulo: error ? 'Ocurrió un error' : 'Listo', html: msg
});

// Admin: barra con estado, botón habilitar/deshabilitar y limpiar registros.
// Solo borra las colecciones indicadas en `colecciones`.
export async function montarControl(db, id, colecciones, { ancla = '.admin-container > header', alLimpiar } = {}) {
    const barra = document.createElement('div');
    barra.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0;padding:12px 16px;border:1px solid rgba(128,128,128,.35);border-radius:10px;';
    const btn = 'padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;border:1px solid ';
    barra.innerHTML = `
        <span class="fc-estado" style="font-weight:700;margin-right:auto;"></span>
        <button type="button" class="fc-toggle" style="${btn}rgba(128,128,128,.5);background:transparent;color:inherit;"></button>
        <button type="button" class="fc-limpiar" style="${btn}rgba(239,68,68,.4);background:rgba(239,68,68,.15);color:#f87171;"><i class="fa-solid fa-trash-can"></i> Limpiar registros</button>`;
    document.querySelector(ancla).after(barra);

    const estado = barra.querySelector('.fc-estado');
    const toggle = barra.querySelector('.fc-toggle');
    let abierto = await estaAbierto(db, id);

    function pintar() {
        estado.textContent = abierto ? 'Estado: ABIERTO' : 'Estado: CERRADO';
        estado.style.color = abierto ? '#4ade80' : '#f87171';
        toggle.textContent = abierto ? 'Deshabilitar formulario' : 'Habilitar formulario';
    }
    pintar();

    toggle.addEventListener('click', async () => {
        const nuevo = !abierto;
        if (!await dialogo({
            icono: nuevo ? 'fa-lock-open' : 'fa-lock', color: nuevo ? '#22C55E' : '#EF4444',
            titulo: nuevo ? 'Habilitar formulario' : 'Deshabilitar formulario',
            html: nuevo ? 'El formulario volverá a recibir respuestas de los trabajadores.' : 'Dejará de recibir respuestas y los trabajadores verán el aviso de formulario cerrado.',
            confirmar: nuevo ? 'Habilitar' : 'Deshabilitar', cancelar: 'Cancelar'
        })) return;
        try {
            await setDoc(doc(db, 'Config', id), { habilitado: nuevo }, { merge: true });
            abierto = nuevo;
            pintar();
        } catch (err) { aviso('No se pudo cambiar el estado: ' + err.message, true); }
    });

    barra.querySelector('.fc-limpiar').addEventListener('click', async () => {
        try {
            const conteos = await Promise.all(colecciones.map(c => getCountFromServer(collection(db, c))));
            const total = conteos.reduce((n, s) => n + s.data().count, 0);
            if (!total) return aviso('No hay registros para borrar.');
            if (!await pedirBorrar(total)) return;
            for (const c of colecciones) {
                for (;;) {
                    const snap = await getDocs(query(collection(db, c), limit(500)));
                    if (snap.empty) break;
                    const batch = writeBatch(db);
                    snap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
            }
            await aviso(`Se eliminaron ${total} registros.`);
            if (alLimpiar) alLimpiar();
        } catch (err) { aviso('Error al borrar registros: ' + err.message, true); }
    });
}
