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

async function pedirBorrar(total) {
    const texto = `Se eliminarán ${total} registros de forma permanente. Para confirmar escribe BORRAR`;
    if (window.Swal) {
        const r = await Swal.fire({
            title: '¿Seguro que quieres borrar TODO?',
            html: `Se eliminarán <strong>${total}</strong> registros de forma permanente.<br>Para confirmar escribe <strong style="color:#ef4444;">BORRAR</strong>:`,
            icon: 'warning',
            input: 'text',
            inputAttributes: { autocapitalize: 'characters', autocomplete: 'off' },
            showCancelButton: true,
            focusCancel: true,
            confirmButtonText: 'Sí, borrar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#DC2626',
            cancelButtonColor: '#374151',
            background: '#111827',
            color: '#F0F4FF',
            preConfirm: v => (v || '').trim().toUpperCase() === 'BORRAR' || Swal.showValidationMessage('Debes escribir BORRAR para confirmar')
        });
        return r.isConfirmed;
    }
    return (prompt(texto) || '').trim().toUpperCase() === 'BORRAR';
}

const aviso = msg => window.Swal
    ? Swal.fire({ text: msg, background: '#111827', color: '#F0F4FF', confirmButtonColor: '#2979FF' })
    : alert(msg);

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
        if (!confirm(nuevo ? '¿Habilitar el formulario? Volverá a recibir respuestas.' : '¿Deshabilitar el formulario? Dejará de recibir respuestas.')) return;
        try {
            await setDoc(doc(db, 'Config', id), { habilitado: nuevo }, { merge: true });
            abierto = nuevo;
            pintar();
        } catch (err) { aviso('No se pudo cambiar el estado: ' + err.message); }
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
        } catch (err) { aviso('Error al borrar registros: ' + err.message); }
    });
}
