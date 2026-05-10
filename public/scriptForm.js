import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCcBqpSXsz_wqm3xyg0NSJYnvQTK0NhkXg",
    authDomain: "formatovacaciones.firebaseapp.com",
    projectId: "formatovacaciones",
    storageBucket: "formatovacaciones.firebasestorage.app",
    messagingSenderId: "753669687689",
    appId: "1:753669687689:web:b37af5de6ba6b1391ef958",
    measurementId: "G-LMKRM8VKM7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CUATRIMESTRES = {
    '1er': {
        label: '1ER CUATRIMESTRE 2026',
        mesesLabel: 'FEBRERO, MARZO, ABRIL, MAYO',
        meses: [
            { nombre: 'FEBRERO', year: 2026, monthNum: 2 },
            { nombre: 'MARZO',   year: 2026, monthNum: 3 },
            { nombre: 'ABRIL',   year: 2026, monthNum: 4 },
            { nombre: 'MAYO',    year: 2026, monthNum: 5 }
        ],
        festivosDefault: { 2: [2], 3: [16], 4: [2, 3], 5: [1, 10] }
    },
    '2do': {
        label: '2DO CUATRIMESTRE 2026',
        mesesLabel: 'JUNIO, JULIO, AGOSTO, SEPTIEMBRE',
        meses: [
            { nombre: 'JUNIO',      year: 2026, monthNum: 6 },
            { nombre: 'JULIO',      year: 2026, monthNum: 7 },
            { nombre: 'AGOSTO',     year: 2026, monthNum: 8 },
            { nombre: 'SEPTIEMBRE', year: 2026, monthNum: 9 }
        ],
        festivosDefault: { 6: [], 7: [], 8: [], 9: [16] }
    },
    '3er': {
        label: '3ER CUATRIMESTRE 2026-2027',
        mesesLabel: 'OCTUBRE, NOVIEMBRE, DICIEMBRE, ENERO',
        meses: [
            { nombre: 'OCTUBRE',   year: 2026, monthNum: 10 },
            { nombre: 'NOVIEMBRE', year: 2026, monthNum: 11 },
            { nombre: 'DICIEMBRE', year: 2026, monthNum: 12 },
            { nombre: 'ENERO',     year: 2027, monthNum: 1  }
        ],
        festivosDefault: { 10: [12], 11: [2, 16], 12: [12, 25], 1: [1] }
    }
};

let selectedDays = { mes1: [], mes2: [], mes3: [], mes4: [] };
let currentFolio = 1;
let currentCarpeta = '';
let currentCuatrimestre = '1er';
let festivosActuales = {};

const departmentConfig = {
    'FLUJOS': ['AC´S', 'MP´S', 'PT'],
    'FABRICACION': ['FABRICACION UP1', 'FABRICACION UP2', 'PESADAS'],
    'SERVICIOS': ['ETN'],
    'MECANICO ACONDICIONAMIENTO': ['MANTENIMIENTO UP1', 'MANTENIMIENTO UP2'],
    'ACONDICIONAMIENTO A': ['ACONDICIONAMIENTO UP1', 'ACONDICIONAMIENTO UP2'],
    'ACONDICIONAMIENTO B': ['ACONDICIONAMIENTO UP1', 'ACONDICIONAMIENTO UP2'],
    'ACONDICIONAMIENTO C': ['ACONDICIONAMIENTO UP1', 'ACONDICIONAMIENTO UP2'],
    'ACONDICIONAMIENTO D': ['ACONDICIONAMIENTO UP1', 'ACONDICIONAMIENTO UP2'],
    'MECANICO FABRICACION': ['MANTENIMIENTO']
};

const supervisorConfig = {
    '1er': {
        'FLUJOS': ['RAQUEL FALCON', 'IVAN CONTRERAS', 'DAVID MORALES'],
        'FABRICACION': ['DAVID BUCIO', 'AIDA NAVARRO', 'PATRICIA DAVILA', 'BRENDA PALACIOS'],
        'SERVICIOS': ['MIGUEL GONZALEZ'],
        'MECANICO ACONDICIONAMIENTO': ['ANTONIO HERNANDEZ', 'ALBERTO SOLIS'],
        'ACONDICIONAMIENTO A': ['GILBERTO CRUZ'],
        'ACONDICIONAMIENTO B': ['CARINA ROJAS'],
        'ACONDICIONAMIENTO C': ['PERLA GARCIA', 'ANAITH POBLANO'],
        'ACONDICIONAMIENTO D': ['LUIS SOTO'],
        'MECANICO FABRICACION': ['FERNANADO HERNANDEZ']
    },
    '2do': {
        'FLUJOS': ['DAVID MORALES', 'MARÍA DE LA LUZ PÉREZ', 'IVAN CONTRERAS'],
        'FABRICACION': ['DAVID BUCIO', 'AIDA NAVARRO', 'PATRICIA DAVILA', 'BRENDA PALACIOS'],
        'SERVICIOS': ['MIGUEL GONZALEZ'],
        'MECANICO ACONDICIONAMIENTO': ['ANTONIO HERNANDEZ', 'ALBERTO SOLIS'],
        'ACONDICIONAMIENTO A': ['GERARDO SOTO', 'ARTURO FERNÁNDEZ'],
        'ACONDICIONAMIENTO B': ['CARINA ROJAS', 'PABLO HERNÁNDEZ'],
        'ACONDICIONAMIENTO C': ['ANAITH POBLANO', 'PERLA GARCÍA'],
        'ACONDICIONAMIENTO D': ['ÁNGEL MONROY'],
        'MECANICO FABRICACION': ['FERNANADO HERNANDEZ']
    },
    '3er': {
        'FLUJOS': ['DAVID MORALES', 'MARÍA DE LA LUZ PÉREZ', 'IVAN CONTRERAS'],
        'FABRICACION': ['DAVID BUCIO', 'AIDA NAVARRO', 'PATRICIA DAVILA', 'BRENDA PALACIOS'],
        'SERVICIOS': ['MIGUEL GONZALEZ'],
        'MECANICO ACONDICIONAMIENTO': ['ANTONIO HERNANDEZ', 'ALBERTO SOLIS'],
        'ACONDICIONAMIENTO A': ['GERARDO SOTO', 'ARTURO FERNÁNDEZ'],
        'ACONDICIONAMIENTO B': ['CARINA ROJAS', 'PABLO HERNÁNDEZ'],
        'ACONDICIONAMIENTO C': ['ANAITH POBLANO', 'PERLA GARCÍA'],
        'ACONDICIONAMIENTO D': ['ÁNGEL MONROY'],
        'MECANICO FABRICACION': ['FERNANADO HERNANDEZ']
    }
};

document.addEventListener('DOMContentLoaded', function () {
    initializePage();
    setupEventListeners();
    setupNotificationClose();
});

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notification-message');
    notification.className = `notification ${type}`;
    messageElement.textContent = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 5000);
}

function setupNotificationClose() {
    document.querySelector('.notification-close').addEventListener('click', function () {
        document.getElementById('notification').classList.remove('show');
    });
}

async function initializePage() {
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const formattedDate = utcDate.toISOString().split('T')[0];

    document.getElementById('fecha-display').textContent = formattedDate;
    document.getElementById('fecha-display').style.cssText =
        'padding:5px;background:#f0f0f0;border:1px solid #ccc;border-radius:3px;';
    document.getElementById('fecha').value = formattedDate;

    selectCuatrimestre('1er');
}

window.selectCuatrimestre = function (key) {
    currentCuatrimestre = key;
    const info = CUATRIMESTRES[key];

    document.querySelectorAll('.cuatri-btn').forEach(btn => btn.classList.remove('cuatri-btn-active'));
    const activeBtn = document.getElementById(`cuatri-btn-${key}`);
    if (activeBtn) activeBtn.classList.add('cuatri-btn-active');

    festivosActuales = {};
    info.meses.forEach(mes => {
        festivosActuales[mes.monthNum] = [...(info.festivosDefault[mes.monthNum] || [])];
    });

    document.getElementById('main-title').textContent =
        `FORMATO DE VACACIONES ${info.label} ${info.mesesLabel}`;

    info.meses.forEach((mes, i) => {
        const header = document.getElementById(`month-header-${i + 1}`);
        if (header) header.textContent = mes.nombre;
    });

    selectedDays = { mes1: [], mes2: [], mes3: [], mes4: [] };

    info.meses.forEach((mes, i) => {
        generateCalendar(`mes${i + 1}`, mes.year, mes.monthNum - 1, mes.monthNum);
    });

    // Actualizar supervisores si ya hay un área seleccionada
    const carpetaActual = document.getElementById('carpeta')?.value;
    if (carpetaActual) updateSupervisorOptions(carpetaActual);

    // Recargar folio para el cuatrimestre actual
    if (currentCarpeta) loadNextFolioForCarpeta(currentCarpeta);

    renderHolidayEditor();
    document.getElementById('holiday-editor').style.display = 'block';
};

function renderHolidayEditor() {
    const info = CUATRIMESTRES[currentCuatrimestre];
    const container = document.getElementById('holiday-months-container');
    container.innerHTML = '';

    info.meses.forEach((mes, i) => {
        const monthNum = mes.monthNum;
        const dias = festivosActuales[monthNum] || [];

        const tagsHtml = dias.length > 0
            ? dias.map(d => `
                <span style="display:inline-flex;align-items:center;gap:3px;background:#c62828;color:#fff;
                    border-radius:4px;padding:2px 7px;font-size:12px;font-weight:600;margin:2px;">
                    ${d}
                    <button onclick="removeFestivo(${monthNum},${d})"
                        style="background:none;border:none;color:#fff;cursor:pointer;padding:0;font-size:13px;line-height:1;
                        display:flex;align-items:center;">&times;</button>
                </span>`).join('')
            : '<span style="color:#999;font-size:12px;">Sin dias festivos</span>';

        const monthDiv = document.createElement('div');
        monthDiv.style.cssText =
            'border:1px solid #ddd;border-radius:8px;padding:10px 14px;flex:1;min-width:140px;background:#fff;';
        monthDiv.innerHTML = `
            <div style="font-weight:700;font-size:13px;color:#333;margin-bottom:6px;">${mes.nombre}</div>
            <div id="festivos-tags-${monthNum}"
                style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:8px;min-height:24px;">
                ${tagsHtml}
            </div>
            <div style="display:flex;gap:4px;">
                <input type="number" id="festivo-input-${monthNum}" min="1" max="31" placeholder="Dia"
                    style="width:60px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;">
                <button onclick="addFestivo(${monthNum})"
                    style="background:#1565c0;color:#fff;border:none;border-radius:4px;
                    padding:4px 10px;cursor:pointer;font-size:16px;font-weight:700;line-height:1;">+</button>
            </div>
        `;
        container.appendChild(monthDiv);
    });
}

window.addFestivo = function (monthNum) {
    const input = document.getElementById(`festivo-input-${monthNum}`);
    const day = parseInt(input.value);
    if (!day || day < 1 || day > 31) return;
    if (!festivosActuales[monthNum]) festivosActuales[monthNum] = [];
    if (festivosActuales[monthNum].includes(day)) { input.value = ''; return; }

    festivosActuales[monthNum].push(day);
    festivosActuales[monthNum].sort((a, b) => a - b);
    input.value = '';

    renderHolidayEditor();
    const info = CUATRIMESTRES[currentCuatrimestre];
    const idx = info.meses.findIndex(m => m.monthNum === monthNum);
    if (idx !== -1) {
        const mes = info.meses[idx];
        generateCalendar(`mes${idx + 1}`, mes.year, mes.monthNum - 1, mes.monthNum);
    }
};

window.removeFestivo = function (monthNum, day) {
    if (!festivosActuales[monthNum]) return;
    festivosActuales[monthNum] = festivosActuales[monthNum].filter(d => d !== day);

    renderHolidayEditor();
    const info = CUATRIMESTRES[currentCuatrimestre];
    const idx = info.meses.findIndex(m => m.monthNum === monthNum);
    if (idx !== -1) {
        const mes = info.meses[idx];
        generateCalendar(`mes${idx + 1}`, mes.year, mes.monthNum - 1, mes.monthNum);
    }
};

window.borrarRegistrosAnteriores = async function () {
    if (!confirm('¿Estas seguro de que deseas borrar TODOS los registros de vacaciones?\n\nEsta accion no se puede deshacer.')) return;
    if (!confirm('Confirma una vez mas: ¿Borrar TODOS los registros de vacaciones?')) return;

    try {
        showNotification('Eliminando registros...', 'success');
        const snapshot = await getDocs(collection(db, 'vacaciones'));
        await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
        showNotification(`${snapshot.docs.length} registros eliminados correctamente`, 'success');
        if (currentCarpeta) loadNextFolioForCarpeta(currentCarpeta);
    } catch (error) {
        showNotification('Error al eliminar registros: ' + error.message, 'error');
    }
};

function setupEventListeners() {
    document.getElementById('carpeta').addEventListener('change', function () {
        currentCarpeta = this.value;
        updateDepartmentOptions(this.value);
        updateSupervisorOptions(this.value);
        loadNextFolioForCarpeta(this.value);
    });

    document.getElementById('vacations-form').addEventListener('submit', function (e) {
        e.preventDefault();
        showConfirmationModal();
    });

    document.getElementById('empleado-num').addEventListener('input', function () {
        if (this.value.length > 8) this.value = this.value.slice(0, 8);
    });
}

async function loadNextFolioForCarpeta(carpeta) {
    if (!carpeta) {
        document.getElementById('folio-number').textContent = '001';
        return;
    }
    try {
        const q = query(
            collection(db, 'vacaciones'),
            where('carpeta', '==', carpeta),
            where('cuatrimestre', '==', currentCuatrimestre),
            orderBy('folioFormulario', 'desc'),
            limit(1)
        );
        const snapshot = await getDocs(q);
        currentFolio = snapshot.empty ? 1 : snapshot.docs[0].data().folioFormulario + 1;
        document.getElementById('folio-number').textContent = String(currentFolio).padStart(3, '0');
    } catch {
        try {
            const q = query(
                collection(db, 'vacaciones'),
                where('carpeta', '==', carpeta)
            );
            const snapshot = await getDocs(q);
            let maxFolio = 0;
            snapshot.forEach(d => {
                const data = d.data();
                // Solo contar registros del mismo cuatrimestre
                if ((data.cuatrimestre || '1er') === currentCuatrimestre && data.folioFormulario > maxFolio) {
                    maxFolio = data.folioFormulario;
                }
            });
            currentFolio = maxFolio + 1;
            document.getElementById('folio-number').textContent = String(currentFolio).padStart(3, '0');
        } catch {
            document.getElementById('folio-number').textContent = '001';
        }
    }
}

function updateDepartmentOptions(carpeta) {
    const select = document.getElementById('departamento');
    select.innerHTML = '<option value="">Seleccione un departamento</option>';
    if (carpeta && departmentConfig[carpeta]) {
        departmentConfig[carpeta].forEach(dept => {
            const opt = document.createElement('option');
            opt.value = dept;
            opt.textContent = dept;
            select.appendChild(opt);
        });
    }
}

function updateSupervisorOptions(carpeta) {
    const select = document.getElementById('supervisor');
    select.innerHTML = '<option value="">Seleccione un supervisor</option>';
    const config = supervisorConfig[currentCuatrimestre] || supervisorConfig['1er'];
    if (carpeta && config[carpeta]) {
        config[carpeta].forEach(sup => {
            const opt = document.createElement('option');
            opt.value = sup;
            opt.textContent = sup;
            select.appendChild(opt);
        });
    }
}

// month is 0-indexed (JS Date convention), monthNum is 1-indexed (actual month)
function generateCalendar(mesKey, year, month, monthNum) {
    const calendar = document.getElementById(`calendar-${mesKey}`);
    if (!calendar) return;
    calendar.innerHTML = '';

    ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        calendar.appendChild(header);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthFestivos = festivosActuales[monthNum] || [];

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day disabled';
        calendar.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        if (monthFestivos.includes(day)) {
            dayEl.classList.add('holiday');
            dayEl.title = 'Dia festivo';
        } else {
            if (selectedDays[mesKey]?.includes(day)) dayEl.classList.add('selected');
            dayEl.addEventListener('click', () => selectDay(mesKey, day, dayEl));
        }
        calendar.appendChild(dayEl);
    }
}

async function selectDay(mesKey, day, element) {
    if (element.classList.contains('holiday')) {
        showDayInfo('Este es un dia festivo y no se puede seleccionar');
        return;
    }

    const carpeta = document.getElementById('carpeta').value;
    const departamento = document.getElementById('departamento').value;

    if (!carpeta || !departamento) {
        showNotification('Por favor seleccione primero el area y departamento', 'error');
        return;
    }

    const count = await getSelectedDateCount(carpeta, departamento, mesKey, day);
    if (count > 0) {
        showDayInfo(`${count} persona(s) de su area y departamento ya han registrado esta fecha`);
    }

    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
        selectedDays[mesKey] = selectedDays[mesKey].filter(d => d !== day);
    } else {
        element.classList.add('selected');
        selectedDays[mesKey] = [...(selectedDays[mesKey] || []), day].sort((a, b) => a - b);
    }
}

async function getSelectedDateCount(carpeta, departamento, mesKey, day) {
    try {
        const q = query(
            collection(db, 'vacaciones'),
            where('carpeta', '==', carpeta),
            where('depto', '==', departamento)
        );
        const snapshot = await getDocs(q);
        const mesNum = getMonthNumber(mesKey);
        let count = 0;
        snapshot.forEach(d => {
            if (d.data()[`diasMes${mesNum}`]?.includes(day)) count++;
        });
        return count;
    } catch {
        return 0;
    }
}

function getMonthNumber(mesKey) {
    return { mes1: 1, mes2: 2, mes3: 3, mes4: 4 }[mesKey] || 1;
}

function showDayInfo(message) {
    document.getElementById('day-info-content').textContent = message;
    document.getElementById('day-info-modal').style.display = 'block';
}

function closeDayInfoModal() {
    document.getElementById('day-info-modal').style.display = 'none';
}

async function showConfirmationModal() {
    const empleadoNum = document.getElementById('empleado-num').value;
    const carpeta = document.getElementById('carpeta').value;

    if (!empleadoNum) {
        showNotification('Por favor ingresa tu numero de empleado', 'error');
        return;
    }
    if (!carpeta) {
        showNotification('Por favor selecciona un area', 'error');
        return;
    }

    const existing = await checkExistingSubmission(empleadoNum);
    if (existing) {
        showNotification('Ya has solicitado tus vacaciones para este cuatrimestre. Espera al siguiente periodo.', 'error');
        return;
    }

    const totalDays = Object.values(selectedDays).flat().length;
    if (totalDays === 0) {
        showNotification('Por favor selecciona al menos un dia de vacaciones', 'error');
        return;
    }

    const info = CUATRIMESTRES[currentCuatrimestre];
    let selectedDaysText = '';
    ['mes1', 'mes2', 'mes3', 'mes4'].forEach((key, i) => {
        if (selectedDays[key]?.length > 0) {
            selectedDaysText += `${info.meses[i].nombre}: ${selectedDays[key].join(', ')}\n`;
        }
    });

    document.getElementById('selected-days').innerHTML = `<pre>${selectedDaysText}</pre>`;
    document.getElementById('confirmation-modal').style.display = 'block';
}

async function checkExistingSubmission(empleadoNum) {
    try {
        const q = query(
            collection(db, 'vacaciones'),
            where('numEmpleado', '==', parseInt(empleadoNum)),
            where('cuatrimestre', '==', currentCuatrimestre)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch {
        return false;
    }
}

async function confirmSubmission() {
    try {
        const now = new Date();
        const utcDate = new Date(Date.UTC(
            now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
            now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()
        ));

        const info = CUATRIMESTRES[currentCuatrimestre];

        const formData = {
            folioFormulario: currentFolio,
            numEmpleado: parseInt(document.getElementById('empleado-num').value),
            depto: document.getElementById('departamento').value,
            nombreCompleto: document.getElementById('nombre-completo').value.toUpperCase(),
            supervisor: document.getElementById('supervisor').value,
            fechaEnvio: utcDate.toISOString(),
            diasMes1: selectedDays.mes1,
            diasMes2: selectedDays.mes2,
            diasMes3: selectedDays.mes3,
            diasMes4: selectedDays.mes4,
            carpeta: document.getElementById('carpeta').value,
            cuatrimestre: currentCuatrimestre,
            festivosMes1: [...(festivosActuales[info.meses[0].monthNum] || [])],
            festivosMes2: [...(festivosActuales[info.meses[1].monthNum] || [])],
            festivosMes3: [...(festivosActuales[info.meses[2].monthNum] || [])],
            festivosMes4: [...(festivosActuales[info.meses[3].monthNum] || [])]
        };

        await addDoc(collection(db, 'vacaciones'), formData);

        showNotification('Solicitud enviada correctamente. Tu folio es: ' + String(currentFolio).padStart(3, '0'));
        document.getElementById('confirmation-modal').style.display = 'none';

        document.getElementById('vacations-form').reset();
        selectedDays = { mes1: [], mes2: [], mes3: [], mes4: [] };

        info.meses.forEach((mes, i) => {
            generateCalendar(`mes${i + 1}`, mes.year, mes.monthNum - 1, mes.monthNum);
        });

        loadNextFolioForCarpeta(currentCarpeta);

    } catch (error) {
        console.error('Error submitting form:', error);
        try {
            const q = query(
                collection(db, 'vacaciones'),
                where('carpeta', '==', document.getElementById('carpeta').value),
                where('folioFormulario', '==', currentFolio)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                currentFolio++;
                await confirmSubmission();
            } else {
                showNotification('Error inesperado al enviar la solicitud. Por favor, intenta nuevamente.', 'error');
            }
        } catch {
            showNotification('Error al enviar la solicitud', 'error');
        }
    }
}

function editSubmission() {
    document.getElementById('confirmation-modal').style.display = 'none';
}

window.confirmSubmission = confirmSubmission;
window.editSubmission = editSubmission;
window.closeDayInfoModal = closeDayInfoModal;
