import { collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// ── Reglas del proceso ─────────────────────────────────────
const MAX_HIJOS      = 2;
const INGRESO_MAXIMO = '2026-02';          // febrero 2026; de marzo en adelante no aplica
const MAX_DIGITOS_EMPLEADO = 9;            // el numero de empleado tiene menos de 10 digitos
const NIVELES        = ['Preescolar', 'Primaria', 'Secundaria', 'Preparatoria', 'Universidad'];

// Firestore topa en 1 MiB por documento y base64 infla ~33%.
// 700 KB de archivo => ~956 KB de base64, con margen para el resto de campos.
const MAX_BYTES = 700 * 1024;

// Tope de lo que aceptamos ANTES de comprimir. Los escaneos de acta/boleta
// andan en 3-4 MB; arriba de 30 MB ya es un archivo raro y rasterizarlo
// tumbaria el navegador del trabajador.
const MAX_BYTES_ENTRADA = 30 * 1024 * 1024;

let hijosCount = 0;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    configurarEventos();
    agregarHijo(); // un hijo por defecto
});

function configurarEventos() {
    ['nombre', 'apellidoPaterno', 'apellidoMaterno'].forEach(id => {
        document.getElementById(id).addEventListener('input', function () {
            const pos = this.selectionStart;
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '').toUpperCase();
            this.setSelectionRange(pos, pos);
        });
    });

    document.getElementById('numEmpleado').addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, MAX_DIGITOS_EMPLEADO);
    });

    document.getElementById('btnAgregarHijo').addEventListener('click', agregarHijo);
    document.getElementById('becasForm').addEventListener('submit', validarYConfirmar);
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
    document.getElementById('btnConfirmar').addEventListener('click', enviar);
    document.getElementById('btnCerrarExito').addEventListener('click', () => {
        cerrarModal();
        location.reload();
    });
}

// ── Agregar / quitar hijo ──────────────────────────────────
function agregarHijo() {
    if (document.querySelectorAll('#hijosLista .hijo-card').length >= MAX_HIJOS) {
        return mostrarError(`Solo puedes registrar un maximo de ${MAX_HIJOS} hijos.`);
    }

    hijosCount++;
    const div = document.createElement('div');
    div.className = 'hijo-card';

    div.innerHTML = `
        <div class="hijo-numero">${hijosCount}</div>
        <button type="button" class="btn-eliminar-hijo">Eliminar</button>
        <div class="hijo-fields">
            <div class="hijo-field">
                <label>Nombre completo del hijo/a *</label>
                <input type="text" class="hijo-nombre" placeholder="NOMBRE APELLIDOS" autocomplete="off">
            </div>
            <div class="hijo-field">
                <label>Nivel escolar *</label>
                <select class="hijo-nivel">
                    <option value="">Selecciona un nivel</option>
                    ${NIVELES.map(n => `<option value="${n}">${n}</option>`).join('')}
                </select>
            </div>
            <div class="hijo-field">
                <label>Acta de nacimiento *</label>
                <input type="file" class="hijo-acta" accept="application/pdf,image/*">
                <span class="file-estado"></span>
            </div>
            <div class="hijo-field">
                <label>Boleta de calificaciones *</label>
                <input type="file" class="hijo-boleta" accept="application/pdf,image/*">
                <span class="file-estado"></span>
            </div>
        </div>
    `;

    document.getElementById('hijosLista').appendChild(div);

    div.querySelector('.hijo-nombre').addEventListener('input', function () {
        const pos = this.selectionStart;
        this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '').toUpperCase();
        this.setSelectionRange(pos, pos);
    });

    div.querySelector('.btn-eliminar-hijo').addEventListener('click', () => {
        div.remove();
        actualizarNumerosHijos();
    });

    // Prepara (y comprime) el archivo apenas se elige, para avisar del peso al momento
    div.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', () => previsualizarArchivo(input));
    });

    actualizarNumerosHijos();
}

function actualizarNumerosHijos() {
    document.querySelectorAll('#hijosLista .hijo-card').forEach((card, i) => {
        card.querySelector('.hijo-numero').textContent = i + 1;
    });
}

// ── Preparacion y compresion de archivos ───────────────────
async function previsualizarArchivo(input) {
    const estado = input.nextElementSibling;
    const file = input.files[0];

    if (!file) {
        estado.textContent = '';
        estado.className = 'file-estado';
        input._preparado = null;
        return;
    }

    estado.textContent = 'Procesando archivo...';
    estado.className = 'file-estado file-estado--cargando';

    try {
        const preparado = await prepararArchivo(file, msg => { estado.textContent = msg; });
        input._preparado = preparado;
        estado.textContent = file.size > preparado.bytes
            ? `Listo — ${preparado.nombre} (${kb(preparado.bytes)}, comprimido desde ${mb(file.size)})`
            : `Listo — ${preparado.nombre} (${kb(preparado.bytes)})`;
        estado.className = 'file-estado file-estado--ok';
    } catch (err) {
        input._preparado = null;
        input.value = '';
        estado.textContent = err.message;
        estado.className = 'file-estado file-estado--error';
    }
}

// exportada para poder ejercitarla desde una pagina de prueba (ver README de becas)
export async function prepararArchivo(file, avisar = () => {}) {
    if (file.size > MAX_BYTES_ENTRADA) {
        throw new Error(`El archivo pesa ${mb(file.size)} y es demasiado grande para procesarlo. Vuelve a escanearlo con menos resolucion.`);
    }

    if (file.type === 'application/pdf') {
        if (file.size <= MAX_BYTES) {
            return { nombre: file.name, mime: 'application/pdf', bytes: file.size, data: await aBase64(file) };
        }
        avisar(`Comprimiendo PDF de ${mb(file.size)}, esto tarda unos segundos...`);
        const blob = await comprimirPDF(file);
        if (!blob) {
            throw new Error('No se pudo comprimir el PDF lo suficiente. Escanealo en blanco y negro o sube una foto de cada hoja.');
        }
        return { nombre: file.name, mime: 'application/pdf', bytes: blob.size, data: await aBase64(blob) };
    }

    if (file.type.startsWith('image/')) {
        avisar('Comprimiendo imagen...');
        const blob = await comprimirImagen(file);
        if (!blob) {
            throw new Error('No se pudo comprimir la imagen lo suficiente. Toma la foto de nuevo con menos resolucion.');
        }
        const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return { nombre, mime: 'image/jpeg', bytes: blob.size, data: await aBase64(blob) };
    }

    throw new Error('Formato no valido. Sube un PDF o una foto del documento.');
}

// ── Compresion de PDF ──────────────────────────────────────
// Un acta o boleta escaneada es un PDF con una imagen enorme adentro.
// Lo redibujamos pagina por pagina como JPEG y armamos un PDF nuevo:
// 3-4 MB bajan a unos cientos de KB. Se pierde el texto seleccionable,
// pero un escaneo ya era imagen de todos modos.
async function comprimirPDF(file) {
    const pdfjs = await cargarPdfJs();
    const datos = new Uint8Array(await file.arrayBuffer());

    let doc;
    try {
        doc = await pdfjs.getDocument({ data: datos }).promise;
    } catch (err) {
        console.error(err);
        throw new Error('No se pudo leer el PDF. Puede estar dañado o protegido con contraseña.');
    }

    // De mayor a menor calidad: nos quedamos con el primero que quepa.
    // Los ultimos pasos van en escala de grises, que es lo que mas peso
    // quita en un escaneo a color y casi no afecta la legibilidad.
    const intentos = [
        { escala: 1.5, calidad: 0.72, gris: false },
        { escala: 1.2, calidad: 0.60, gris: false },
        { escala: 1.0, calidad: 0.50, gris: false },
        { escala: 1.0, calidad: 0.45, gris: true  },
        { escala: 0.8, calidad: 0.40, gris: true  },
        { escala: 0.6, calidad: 0.35, gris: true  }
    ];

    // Con muchas paginas el presupuesto por pagina se acaba rapido; arrancamos
    // mas abajo en vez de gastar minutos en intentos que no van a caber.
    const desde = doc.numPages > 4 ? 3 : 0;

    for (const { escala, calidad, gris } of intentos.slice(desde)) {
        const blob = await rasterizar(doc, escala, calidad, gris);
        console.log(`becas: intento escala ${escala} calidad ${calidad}${gris ? ' gris' : ''} => ${Math.round(blob.size / 1024)} KB`);
        if (blob.size <= MAX_BYTES) return blob;
    }
    return null;
}

async function rasterizar(doc, escala, calidad, gris = false) {
    const { jsPDF } = window.jspdf;
    let salida = null;

    for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale: escala });
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (gris) aGrises(ctx, canvas);

        const jpeg = canvas.toDataURL('image/jpeg', calidad);
        const orientacion = canvas.width > canvas.height ? 'l' : 'p';

        if (!salida) {
            salida = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height], orientation: orientacion });
        } else {
            salida.addPage([canvas.width, canvas.height], orientacion);
        }
        salida.addImage(jpeg, 'JPEG', 0, 0, canvas.width, canvas.height);
    }

    return salida.output('blob');
}

function aGrises(ctx, canvas) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
}

let pdfjsCargado = null;
function cargarPdfJs() {
    // ponytail: se carga solo cuando alguien sube un PDF pesado; son 300 KB
    // que la mayoria de los trabajadores nunca va a bajar.
    pdfjsCargado ||= import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs')
        .then(lib => {
            lib.GlobalWorkerOptions.workerSrc =
                'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
            return lib;
        });
    return pdfjsCargado;
}

async function comprimirImagen(file) {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(bitmap.width  * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    for (const calidad of [0.7, 0.55, 0.4, 0.3]) {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', calidad));
        if (blob && blob.size <= MAX_BYTES) return blob;
    }
    return null;
}

function aBase64(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload  = () => resolve(fr.result.split(',')[1]);
        fr.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        fr.readAsDataURL(blob);
    });
}

const kb = bytes => `${Math.round(bytes / 1024)} KB`;
const mb = bytes => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : kb(bytes);

// ── Validacion ─────────────────────────────────────────────
function validarYConfirmar(e) {
    e.preventDefault();
    document.querySelectorAll('.error-message').forEach(el => el.remove());

    const d = leerDatos();

    if (!d.nombre || !d.apellidoPaterno || !d.apellidoMaterno)
        return mostrarError('Escribe tu nombre, apellido paterno y apellido materno.');

    if (!d.numEmpleado)
        return mostrarError('Escribe tu numero de empleado.');

    if (d.numEmpleado.length > MAX_DIGITOS_EMPLEADO)
        return mostrarError(`El numero de empleado no puede tener mas de ${MAX_DIGITOS_EMPLEADO} digitos.`);

    if (!d.fechaIngreso)
        return mostrarError('Selecciona tu fecha de ingreso.');

    // La regla es por mes, asi que comparamos solo el YYYY-MM.
    if (d.fechaIngreso.slice(0, 7) > INGRESO_MAXIMO)
        return mostrarError('Solo participan quienes ingresaron en febrero de 2026 o antes. Con fecha de ingreso de marzo de 2026 en adelante no se puede registrar.');

    const tarjetas = document.querySelectorAll('#hijosLista .hijo-card');

    if (tarjetas.length === 0)
        return mostrarError('Debes registrar al menos un hijo/a.');

    for (const [i, card] of [...tarjetas].entries()) {
        const n = i + 1;
        if (!card.querySelector('.hijo-nombre').value.trim())
            return mostrarError(`Escribe el nombre del hijo/a ${n}.`);
        if (!card.querySelector('.hijo-nivel').value)
            return mostrarError(`Selecciona el nivel escolar del hijo/a ${n}.`);
        if (!card.querySelector('.hijo-acta')._preparado)
            return mostrarError(`Falta el acta de nacimiento del hijo/a ${n}.`);
        if (!card.querySelector('.hijo-boleta')._preparado)
            return mostrarError(`Falta la boleta de calificaciones del hijo/a ${n}.`);
    }

    mostrarResumen(d);
}

function leerDatos() {
    const v = id => document.getElementById(id).value.trim();
    return {
        nombre:          v('nombre'),
        apellidoPaterno: v('apellidoPaterno'),
        apellidoMaterno: v('apellidoMaterno'),
        numEmpleado:     v('numEmpleado'),
        fechaIngreso:    v('fechaIngreso'),
        hijos: [...document.querySelectorAll('#hijosLista .hijo-card')].map(card => ({
            nombre: card.querySelector('.hijo-nombre').value.trim(),
            nivel:  card.querySelector('.hijo-nivel').value,
            acta:   card.querySelector('.hijo-acta')._preparado,
            boleta: card.querySelector('.hijo-boleta')._preparado
        }))
    };
}

function mostrarResumen(d) {
    const hijos = d.hijos.map((h, i) => `
        <li><strong>Hijo/a ${i + 1}:</strong> ${h.nombre} — ${h.nivel}<br>
        <span style="font-size:.9em;color:#5a5a6a;">Acta: ${h.acta.nombre} (${kb(h.acta.bytes)}) &middot; Boleta: ${h.boleta.nombre} (${kb(h.boleta.bytes)})</span></li>
    `).join('');

    document.getElementById('resumenDatos').innerHTML = `
        <p><strong>Nombre:</strong> ${d.nombre} ${d.apellidoPaterno} ${d.apellidoMaterno}</p>
        <p><strong>Numero de empleado:</strong> ${d.numEmpleado}</p>
        <p><strong>Fecha de ingreso:</strong> ${d.fechaIngreso}</p>
        <p><strong>Hijos registrados (${d.hijos.length}):</strong></p>
        <ul style="margin:8px 0 0; padding-left:20px;">${hijos}</ul>
        <hr style="margin:14px 0; border:none; border-top:1px solid #dfe3ee;">
        <p style="color:#1e40af; font-weight:700;">Verifica que todos los datos y documentos sean correctos antes de confirmar.</p>
    `;

    document.getElementById('modalConfirmacion').style.display = 'block';
}

// ── Enviar a Firebase ──────────────────────────────────────
async function enviar() {
    const btn = document.getElementById('btnConfirmar');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const d = leerDatos();

        // Un solo registro por numero de empleado
        const yaExiste = await getDocs(query(
            collection(window.db, 'becas'),
            where('numEmpleado', '==', d.numEmpleado)
        ));
        if (!yaExiste.empty) {
            cerrarModal();
            return mostrarError(`El numero de empleado ${d.numEmpleado} ya tiene un registro de becas. Solo se permite uno por trabajador.`);
        }

        // ponytail: los archivos se suben antes que el registro. Si el registro falla,
        // quedan documentos huerfanos en becasArchivos que nadie lee (el admin solo
        // descarga los ids listados en el registro). Limpiarlos no vale el codigo.
        const hijos = [];
        for (const h of d.hijos) {
            hijos.push({
                nombre:  h.nombre,
                nivel:   h.nivel,
                actaId:   await subirArchivo(d.numEmpleado, 'acta',   h.acta),
                boletaId: await subirArchivo(d.numEmpleado, 'boleta', h.boleta)
            });
        }

        await addDoc(collection(window.db, 'becas'), {
            nombre:          d.nombre,
            apellidoPaterno: d.apellidoPaterno,
            apellidoMaterno: d.apellidoMaterno,
            nombreCompleto:  `${d.nombre} ${d.apellidoPaterno} ${d.apellidoMaterno}`,
            numEmpleado:     d.numEmpleado,
            fechaIngreso:    d.fechaIngreso,
            hijos,
            totalHijos:      hijos.length,
            fechaRegistro:   new Date().toISOString(),
            timestamp:       Date.now()
        });

        document.getElementById('modalConfirmacion').style.display = 'none';
        document.getElementById('modalExito').style.display = 'block';

    } catch (err) {
        console.error('Error al guardar:', err);
        cerrarModal();
        mostrarError('Hubo un error al enviar tu registro. Revisa tu conexion e intenta nuevamente.');
    }
}

async function subirArchivo(numEmpleado, tipo, archivo) {
    const ref = await addDoc(collection(window.db, 'becasArchivos'), {
        numEmpleado,
        tipo,
        nombre:    archivo.nombre,
        mime:      archivo.mime,
        bytes:     archivo.bytes,
        data:      archivo.data,
        timestamp: Date.now()
    });
    return ref.id;
}

// ── Helpers ────────────────────────────────────────────────
function mostrarError(msg) {
    const div = document.createElement('div');
    div.className = 'error-message';
    div.textContent = msg;
    const form = document.getElementById('becasForm');
    form.insertBefore(div, form.firstChild);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => div.remove(), 8000);
}

function cerrarModal() {
    document.getElementById('modalConfirmacion').style.display = 'none';
    document.getElementById('modalExito').style.display = 'none';
    const btn = document.getElementById('btnConfirmar');
    btn.disabled = false;
    btn.textContent = 'Confirmar y Enviar';
}
