// Firebase configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy,
    doc as firestoreDoc,
    updateDoc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCcBqpSXsz_wqm3xyg0NSJYnvQTK0NhkXg",
    authDomain: "formatovacaciones.firebaseapp.com",
    projectId: "formatovacaciones",
    storageBucket: "formatovacaciones.firebasestorage.app",
    messagingSenderId: "753669687689",
    appId: "1:753669687689:web:b37af5de6ba6b1391ef958",
    measurementId: "G-LMKRM8VKM7"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Función para ordenar registros por folioFormulario
function sortRecords(records) {
    return records.sort((a, b) => {
        const folioA = a.folioFormulario || 0;
        const folioB = b.folioFormulario || 0;
        return folioA - folioB;
    });
}

// Función para truncar texto si es muy largo
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Función para obtener días festivos como string
function getHolidaysString(month) {
    const holidays2026 = {
        2: ['2 - Día de la Candelaria'],           // Febrero
        3: ['16 - Natalicio de Benito Juárez'],    // Marzo
        4: ['2 - Jueves Santo', '3 - Viernes Santo'], // Abril
        5: ['1 - Día del Trabajo', '10 - Día de la Madre'] // Mayo
    };
    return holidays2026[month] ? holidays2026[month].join(', ') : '-';
}

// Cargar jsPDF dinámicamente
async function loadJsPDF() {
    try {
        await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
        return true;
    } catch (error) {
        console.error('Error cargando jsPDF:', error);
        alert('Error al cargar el generador de PDF. Por favor, recarga la página.');
        return false;
    }
}

// Formatear fecha
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        let date;
        
        // Si es un timestamp de Firebase
        if (dateString.toDate) {
            date = dateString.toDate();
        } 
        // Si es una cadena ISO
        else if (typeof dateString === 'string') {
            date = new Date(dateString);
        }
        // Si ya es un objeto Date
        else if (dateString instanceof Date) {
            date = dateString;
        }
        // Otro caso
        else {
            return dateString;
        }
        
        // Convertir a hora local de México (UTC-6 o UTC-5 según horario de verano)
        return date.toLocaleDateString('es-MX', {
            timeZone: 'America/Mexico_City',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error('Error formateando fecha:', error, dateString);
        return 'Fecha inválida';
    }
}

// Función para obtener datos de cena navideña
async function obtenerDatosCena(tipoCena) {
    try {
        let querySnapshot;
        
        if (tipoCena === 'TODOS') {
            querySnapshot = await getDocs(collection(db, 'cenaNavidenia'));
        } else {
            const q = query(
                collection(db, 'cenaNavidenia'), 
                where('tipoCena', '==', tipoCena)
            );
            querySnapshot = await getDocs(q);
        }
        
        const datos = [];
        querySnapshot.forEach((doc) => {
            datos.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenar por número de empleado
        return datos.sort((a, b) => {
            if (a.numEmpleado && b.numEmpleado) {
                return a.numEmpleado.localeCompare(b.numEmpleado);
            }
            return 0;
        });
    } catch (error) {
        console.error('Error obteniendo datos de cena:', error);
        throw new Error('No se pudieron obtener los datos de la cena');
    }
}

// Generar PDF para cena navideña
async function generarPDFCena(tipoCena) {
    try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = `Generando PDF para ${tipoCena}...`;
        loadingMsg.style.position = 'fixed';
        loadingMsg.style.top = '20px';
        loadingMsg.style.left = '50%';
        loadingMsg.style.transform = 'translateX(-50%)';
        loadingMsg.style.background = '#4CAF50';
        loadingMsg.style.color = 'white';
        loadingMsg.style.padding = '10px 20px';
        loadingMsg.style.borderRadius = '5px';
        loadingMsg.style.zIndex = '1000';
        document.body.appendChild(loadingMsg);
        
        // Obtener datos
        const datos = await obtenerDatosCena(tipoCena);
        
        if (datos.length === 0) {
            alert(`No se encontraron registros para ${tipoCena}`);
            document.body.removeChild(loadingMsg);
            return;
        }

        // Cargar jsPDF
        const jsPDFLoaded = await loadJsPDF();
        if (!jsPDFLoaded) {
            document.body.removeChild(loadingMsg);
            return;
        }

        // Crear PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPosition = 20;
        
        // Título
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(198, 40, 40); // Rojo navideño
        doc.text(`ELECCION DE OBSEQUIOS FIN DE AÑO - ${tipoCena}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Fecha de generación
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Preparar datos para la tabla
        const tableData = datos.map((item, index) => [
            index + 1,
            item.numEmpleado || 'N/A',
            item.nombre || 'N/A',
            item.tipoCena || 'N/A',
            '' // Espacio para firma
        ]);

        // Máximo ancho en vertical
        doc.autoTable({
            startY: yPosition,
            head: [['#', 'N° Empleado', 'Nombre', 'Cena', 'Firma']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [198, 40, 40],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                overflow: 'linebreak',
                minCellHeight: 8
            },
            margin: { left: 5, right: 5 },
            tableWidth: 190, // Casi el ancho total de la página
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 35 },
                2: { cellWidth: 65 },  // Nombre más ancho
                3: { cellWidth: 30 },
                4: { cellWidth: 45 }   // Firma más ancha
            }
        });
        
        // Guardar PDF
        const fileName = `cena_navidenia_${tipoCena.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        
        // Eliminar mensaje de carga
        document.body.removeChild(loadingMsg);
        
    } catch (error) {
        console.error('Error generando PDF de cena:', error);
        alert('Error al generar el PDF: ' + error.message);
    }
}





// Función para generar PDF de vacaciones
async function generatePDF(servicio) {
       try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = `Generando PDF para ${servicio}...`;
        loadingMsg.style.position = 'fixed';
        loadingMsg.style.top = '20px';
        loadingMsg.style.left = '50%';
        loadingMsg.style.transform = 'translateX(-50%)';
        loadingMsg.style.background = '#4CAF50';
        loadingMsg.style.color = 'white';
        loadingMsg.style.padding = '10px 20px';
        loadingMsg.style.borderRadius = '5px';
        loadingMsg.style.zIndex = '1000';
        document.body.appendChild(loadingMsg);
        
        // Consultar datos de Firebase
        let data = [];
        try {
            const q = query(
                collection(db, 'vacaciones'), 
                where('carpeta', '==', servicio)
            );
            
            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
            });
            
            // Ordenar localmente
            data = sortRecords(data);
            
        } catch (firestoreError) {
            console.error('Error en consulta Firestore:', firestoreError);
            try {
                const q = query(collection(db, 'vacaciones'));
                const querySnapshot = await getDocs(q);
                
                querySnapshot.forEach((doc) => {
                    const record = doc.data();
                    if (record.carpeta === servicio) {
                        data.push({ id: doc.id, ...record });
                    }
                });
                
                data = sortRecords(data);
                
            } catch (alternativeError) {
                console.error('Error en consulta alternativa:', alternativeError);
                throw new Error('No se pudieron obtener los datos');
            }
        }

        if (data.length === 0) {
            alert(`No se encontraron registros para ${servicio}`);
            document.body.removeChild(loadingMsg);
            return;
        }

        // Cargar jsPDF
        const jsPDFLoaded = await loadJsPDF();
        if (!jsPDFLoaded) {
            document.body.removeChild(loadingMsg);
            return;
        }

        // Crear PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración inicial
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let yPosition = margin;
        let currentPage = 1;

        // Título principal (solo en primera página)
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('SOLICITUD DE VACACIONES 1er CUATRIMESTRE 2026', pageWidth / 2, yPosition, { align: 'center' });
        doc.setFontSize(14);
        doc.text('FEBRERO, MARZO, ABRIL, MAYO', pageWidth / 2, yPosition + 7, { align: 'center' });
        yPosition += 20;
        
        // Línea decorativa
        doc.setDrawColor(150, 150, 150);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 15;

        // Procesar cada registro
        for (let i = 0; i < data.length; i++) {
            const record = data[i];
            
            // Verificar si necesitamos nueva página
            if (yPosition > pageHeight - 100 && i > 0) {
                doc.addPage();
                currentPage++;
                yPosition = margin;
            }

            // Folio
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(`FOLIO: ${servicio} ${String(record.folioFormulario || (i + 1)).padStart(3, '0')}`, margin, yPosition);
            yPosition += 8;

            // Información del empleado - Formato vertical
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            
            // Número de empleado
            doc.text('Nº DE EMPLEADO:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${record.numEmpleado || 'N/A'}`, margin + 40, yPosition);
            yPosition += 6;

            // Supervisor
            doc.setFont(undefined, 'normal');
            doc.text('SUPERVISOR:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${record.supervisor || 'N/A'}`, margin + 32, yPosition);
            yPosition += 6;

            // Departamento
            doc.setFont(undefined, 'normal');
            doc.text('DEPARTAMENTO:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${record.depto || 'N/A'}`, margin + 37, yPosition);
            yPosition += 6;

            // Fecha
            doc.setFont(undefined, 'normal');
            doc.text('FECHA:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${formatDate(record.fechaEnvio) || 'N/A'}`, margin + 22, yPosition);
            yPosition += 6;

            // Nombre completo
            doc.setFont(undefined, 'normal');
            doc.text('NOMBRE COMPLETO:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${record.nombreCompleto || 'N/A'}`, margin + 45, yPosition);
            yPosition += 10;

            // Tabla de días - Encabezado
            const tableTop = yPosition;
            const tableWidth = pageWidth - margin * 2;
            const col1Width = 30; // MES
            const col2Width = 90; // DÍAS (aumentado para mostrar todos los días)
            const col3Width = tableWidth - col1Width - col2Width; // FESTIVOS
            
            // Encabezados de tabla
            doc.setFont(undefined, 'bold');
            doc.setTextColor(255, 255, 255);
            doc.setFillColor(60, 60, 60);
            doc.rect(margin, tableTop, tableWidth, 8, 'F');
            
            // Encabezados centrados
            doc.text('MES', margin + col1Width / 2, tableTop + 5, { align: 'center' });
            doc.text('DÍAS', margin + col1Width + col2Width / 2, tableTop + 5, { align: 'center' });
            doc.text('FESTIVOS', margin + col1Width + col2Width + col3Width / 2, tableTop + 5, { align: 'center' });
            
            yPosition += 10;

            // Datos de la tabla
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            
            // Función para agregar fila de tabla
            const addTableRow = (mes, diasSolicitados, diasFestivos) => {
                // Fondo gris claro para filas
                if ((yPosition - tableTop) % 2 === 0) {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(margin, yPosition - 2, tableWidth, 8, 'F');
                }
                
                // Mes (centrado)
                doc.text(mes, margin + col1Width / 2, yPosition + 4, { align: 'center' });
                
                // Días solicitados (sin truncar para mostrar todos los días)
                const diasText = diasSolicitados || '-';
                doc.text(diasText, margin + col1Width + col2Width / 2, yPosition + 4, { align: 'center' });
                
                // Días festivos (centrado)
                const festivosText = diasFestivos || '-';
                doc.text(truncateText(festivosText, 25), margin + col1Width + col2Width + col3Width / 2, yPosition + 4, { align: 'center' });
                
                yPosition += 8;
            };

            // Filas de la tabla para el 1er cuatrimestre 2026
            addTableRow('FEBRERO', record.diasMes1?.join(', ') || '-', '2 - Día de la Candelaria');
            addTableRow('MARZO', record.diasMes2?.join(', ') || '-', '16 - Natalicio de Benito Juárez');
            addTableRow('ABRIL', record.diasMes3?.join(', ') || '-', '2-3 - Jueves y Viernes Santo');
            addTableRow('MAYO', record.diasMes4?.join(', ') || '-', '1 - Día del Trabajo, 10 - Día de la Madre');

            // Borde de la tabla
            doc.setDrawColor(0, 0, 0);
            doc.rect(margin, tableTop, tableWidth, yPosition - tableTop);

            // Espacio entre registros
            yPosition += 15;

            // Línea separadora entre registros (excepto el último)
            if (i < data.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.line(margin, yPosition, pageWidth - margin, yPosition);
                yPosition += 10;
            }

            // Número de página
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Página ${currentPage}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        // Guardar PDF
        const fileName = `vacaciones_${servicio}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        
        // Eliminar mensaje de carga
        document.body.removeChild(loadingMsg);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        alert('Error al generar el PDF: ' + error.message);
    }
}

// Función para obtener datos de fiesta fin de año
async function obtenerDatosFiestaFinAnio() {
    try {
        const querySnapshot = await getDocs(collection(db, 'fiestaFinAnio'));
        
        const datos = [];
        querySnapshot.forEach((doc) => {
            datos.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenar por número de empleado
        return datos.sort((a, b) => {
            if (a.numEmpleado && b.numEmpleado) {
                return a.numEmpleado.localeCompare(b.numEmpleado);
            }
            return 0;
        });
    } catch (error) {
        console.error('Error obteniendo datos de fiesta fin de año:', error);
        throw new Error('No se pudieron obtener los datos de la fiesta');
    }
}

// Generar PDF para fiesta fin de año
// Generar PDF para fiesta fin de año
async function generarPDFFiestaFinAnio() {
    try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = 'Generando lista de asistentes a Celebración Anual...';
        loadingMsg.style.position = 'fixed';
        loadingMsg.style.top = '20px';
        loadingMsg.style.left = '50%';
        loadingMsg.style.transform = 'translateX(-50%)';
        loadingMsg.style.background = '#3498db';
        loadingMsg.style.color = 'white';
        loadingMsg.style.padding = '10px 20px';
        loadingMsg.style.borderRadius = '5px';
        loadingMsg.style.zIndex = '1000';
        document.body.appendChild(loadingMsg);
        
        // Obtener datos
        const datos = await obtenerDatosFiestaFinAnio();
        
        if (datos.length === 0) {
            alert('No se encontraron registros para la Celebración Anual');
            document.body.removeChild(loadingMsg);
            return;
        }

        // Cargar jsPDF
        const jsPDFLoaded = await loadJsPDF();
        if (!jsPDFLoaded) {
            document.body.removeChild(loadingMsg);
            return;
        }

        // Crear PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPosition = 20;
        
        // Título principal
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(41, 128, 185); // Azul corporativo
        doc.text('LISTA DE ASISTENTES - CELEBRACIÓN A LA VIRGEN', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        // Subtítulo
        doc.setFontSize(14);
        doc.setTextColor(52, 73, 94);
        doc.text('Confirmación de Asistencia', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        // Fecha de generación
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Estadísticas
        doc.setFontSize(10);
        doc.setTextColor(52, 73, 94);
        doc.text(`Total de asistentes confirmados: ${datos.length}`, margin, yPosition);
        yPosition += 8;
        
        // Preparar datos para la tabla
        const tableData = datos.map((item, index) => [
            index + 1,
            item.numEmpleado || 'N/A',
            item.nombre || `${item.apellidoPaterno || ''} ${item.apellidoMaterno || ''}`.trim(),
            '' // Espacio para firma
        ]);

        // Crear tabla
        doc.autoTable({
            startY: yPosition,
            head: [['#', 'N° Empleado', 'Nombre Completo', 'Firma']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10,
                cellPadding: 5,
                overflow: 'linebreak',
                minCellHeight: 10
            },
            margin: { left: 10, right: 10 },
            tableWidth: 190,
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 100 },  // Nombre completo más ancho
                3: { cellWidth: 40 }    // Firma
            },
            didDrawPage: function(data) {
                // Agregar número de página
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(
                    `Página ${data.pageNumber}`, 
                    data.settings.margin.left, 
                    doc.internal.pageSize.height - 10
                );
            }
        });
        
        // Guardar PDF
        const fileName = `lista_asistentes_celebracion_anual_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        
        // Eliminar mensaje de carga
        document.body.removeChild(loadingMsg);
        
    } catch (error) {
        console.error('Error generando PDF de celebración anual:', error);
        alert('Error al generar el PDF: ' + error.message);
    }
}

// ─────────────────────────────────────────────
//  GESTIÓN DE CORREOS  (panel + PDF con links)
// ─────────────────────────────────────────────

// Función para obtener datos de correos electrónicos
async function obtenerDatosCorreos() {
    try {
        const querySnapshot = await getDocs(
            query(collection(db, 'ListadoCorreos'), orderBy('nombreCompleto', 'asc'))
        );
        const datos = [];
        querySnapshot.forEach((d) => {
            datos.push({ id: d.id, ...d.data() });
        });
        return datos;
    } catch (error) {
        console.error('Error obteniendo datos de correos:', error);
        throw new Error('No se pudieron obtener los datos de correos electrónicos');
    }
}

// Abrir panel de gestión de correos
async function abrirPanelCorreos() {
    // Overlay / modal
    const overlay = document.createElement('div');
    overlay.id = 'correos-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;
        display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
        background:#fff;border-radius:14px;width:100%;max-width:1100px;
        box-shadow:0 10px 40px rgba(0,0,0,.25);overflow:hidden;margin:auto;
    `;

    panel.innerHTML = `
        <div style="background:linear-gradient(135deg,#16a085,#1abc9c);padding:22px 28px;display:flex;align-items:center;justify-content:space-between;">
            <div>
                <h2 style="margin:0;color:#fff;font-size:20px;">📧 Gestión de Correos Electrónicos</h2>
                <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;" id="correos-subtitulo">Cargando...</p>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button id="btn-generar-pdf-correos" style="
                    background:#fff;color:#16a085;border:none;padding:10px 18px;
                    border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;
                    display:flex;align-items:center;gap:6px;
                ">📄 Generar PDF</button>
                <button id="btn-cerrar-panel-correos" style="
                    background:rgba(255,255,255,.2);color:#fff;border:2px solid rgba(255,255,255,.5);
                    padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;
                ">✕ Cerrar</button>
            </div>
        </div>
        <div style="padding:20px;">
            <input id="correos-buscar" type="text" placeholder="🔍 Buscar por nombre o correo..."
                style="width:100%;padding:10px 14px;border:2px solid #e0e0e0;border-radius:8px;
                font-size:14px;margin-bottom:16px;outline:none;box-sizing:border-box;">
            <div id="correos-tabla-wrapper" style="overflow-x:auto;">
                <p style="text-align:center;color:#888;padding:40px;">Cargando datos...</p>
            </div>
        </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Cerrar al hacer clic fuera del panel
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cerrarPanelCorreos();
    });
    document.getElementById('btn-cerrar-panel-correos').addEventListener('click', cerrarPanelCorreos);

    // Cargar datos
    let datos = [];
    try {
        datos = await obtenerDatosCorreos();
    } catch (err) {
        document.getElementById('correos-tabla-wrapper').innerHTML =
            `<p style="color:red;text-align:center;padding:30px;">Error al cargar datos: ${err.message}</p>`;
        return;
    }

    document.getElementById('correos-subtitulo').textContent =
        `Total registrados: ${datos.length} correos`;

    renderTablaCorreos(datos);

    // Búsqueda en tiempo real
    document.getElementById('correos-buscar').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtrados = datos.filter(d =>
            (d.nombreCompleto || '').toLowerCase().includes(term) ||
            (d.correo || '').toLowerCase().includes(term)
        );
        renderTablaCorreos(filtrados, datos);
    });

    // Generar PDF
    document.getElementById('btn-generar-pdf-correos').addEventListener('click', () => {
        generarPDFCorreos(datos);
    });

    function cerrarPanelCorreos() {
        document.body.removeChild(overlay);
    }

    function renderTablaCorreos(lista, todosDatos = datos) {
        const wrapper = document.getElementById('correos-tabla-wrapper');
        if (lista.length === 0) {
            wrapper.innerHTML = '<p style="text-align:center;color:#888;padding:30px;">No se encontraron registros.</p>';
            return;
        }

        const filas = lista.map((item, idx) => `
            <tr style="border-bottom:1px solid #f0f0f0;transition:background .15s;" 
                onmouseover="this.style.background='#f0faf8'" onmouseout="this.style.background=''">
                <td style="padding:10px 12px;text-align:center;color:#888;font-size:13px;">${idx + 1}</td>
                <td style="padding:10px 12px;font-weight:500;font-size:14px;">${escHtml(item.nombreCompleto || 'N/A')}</td>
                <td style="padding:10px 12px;">
                    <a href="mailto:${escHtml(item.correo || '')}"
                       style="color:#16a085;text-decoration:none;font-size:14px;font-weight:500;"
                       title="Enviar correo a ${escHtml(item.correo || '')}">
                        📧 ${escHtml(item.correo || 'N/A')}
                    </a>
                </td>
                <td style="padding:10px 12px;font-size:13px;color:#555;">${item.fechaIngreso ? formatDate(item.fechaIngreso) : 'N/A'}</td>
                <td style="padding:10px 12px;font-size:13px;color:#555;">${escHtml(item.antiguedadTotal || 'N/A')}</td>
                <td style="padding:10px 12px;font-size:13px;color:#555;">${item.fechaRegistro ? formatDate(item.fechaRegistro) : 'N/A'}</td>
                <td style="padding:10px 12px;text-align:center;">
                    <div style="display:flex;gap:6px;justify-content:center;">
                        <button onclick="editarCorreo('${item.id}')"
                            style="background:#3498db;color:#fff;border:none;padding:6px 12px;
                            border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                            ✏️ Editar
                        </button>
                        <button onclick="eliminarCorreo('${item.id}','${escHtml(item.nombreCompleto || '')}')"
                            style="background:#e74c3c;color:#fff;border:none;padding:6px 12px;
                            border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                            🗑️ Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        wrapper.innerHTML = `
            <table style="width:100%;border-collapse:collapse;min-width:750px;">
                <thead>
                    <tr style="background:#16a085;color:#fff;">
                        <th style="padding:12px;font-size:13px;">#</th>
                        <th style="padding:12px;font-size:13px;text-align:left;">Nombre Completo</th>
                        <th style="padding:12px;font-size:13px;text-align:left;">Correo Electrónico</th>
                        <th style="padding:12px;font-size:13px;">Fecha Ingreso</th>
                        <th style="padding:12px;font-size:13px;">Antigüedad</th>
                        <th style="padding:12px;font-size:13px;">Fecha Registro</th>
                        <th style="padding:12px;font-size:13px;">Acciones</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        `;

        // Callbacks globales para los botones dentro de la tabla
        window.editarCorreo = async (id) => {
            const registro = todosDatos.find(d => d.id === id) || lista.find(d => d.id === id);
            if (!registro) return;

            const nuevoNombre = prompt('Nombre completo:', registro.nombreCompleto || '');
            if (nuevoNombre === null) return;
            const nuevoCorreo = prompt('Correo electrónico:', registro.correo || '');
            if (nuevoCorreo === null) return;
            const nuevaAntiguedad = prompt('Antigüedad:', registro.antiguedadTotal || '');
            if (nuevaAntiguedad === null) return;

            try {
                await updateDoc(firestoreDoc(db, 'ListadoCorreos', id), {
                    nombreCompleto: nuevoNombre.trim(),
                    correo: nuevoCorreo.trim(),
                    antiguedadTotal: nuevaAntiguedad.trim()
                });
                // Refrescar datos
                const idx = todosDatos.findIndex(d => d.id === id);
                if (idx !== -1) {
                    todosDatos[idx].nombreCompleto = nuevoNombre.trim();
                    todosDatos[idx].correo = nuevoCorreo.trim();
                    todosDatos[idx].antiguedadTotal = nuevaAntiguedad.trim();
                }
                document.getElementById('correos-subtitulo').textContent =
                    `Total registrados: ${todosDatos.length} correos`;
                const term = document.getElementById('correos-buscar').value.toLowerCase();
                const filtrados = term
                    ? todosDatos.filter(d =>
                        (d.nombreCompleto || '').toLowerCase().includes(term) ||
                        (d.correo || '').toLowerCase().includes(term))
                    : todosDatos;
                renderTablaCorreos(filtrados, todosDatos);
                mostrarToast('✅ Registro actualizado correctamente', '#16a085');
            } catch (err) {
                alert('Error al actualizar: ' + err.message);
            }
        };

        window.eliminarCorreo = async (id, nombre) => {
            if (!confirm(`¿Eliminar a "${nombre}" de la base de datos?\nEsta acción no se puede deshacer.`)) return;
            try {
                await deleteDoc(firestoreDoc(db, 'ListadoCorreos', id));
                const idx = todosDatos.findIndex(d => d.id === id);
                if (idx !== -1) todosDatos.splice(idx, 1);
                document.getElementById('correos-subtitulo').textContent =
                    `Total registrados: ${todosDatos.length} correos`;
                const term = document.getElementById('correos-buscar').value.toLowerCase();
                const filtrados = term
                    ? todosDatos.filter(d =>
                        (d.nombreCompleto || '').toLowerCase().includes(term) ||
                        (d.correo || '').toLowerCase().includes(term))
                    : todosDatos;
                renderTablaCorreos(filtrados, todosDatos);
                mostrarToast('🗑️ Registro eliminado correctamente', '#e74c3c');
            } catch (err) {
                alert('Error al eliminar: ' + err.message);
            }
        };
    }
}

// Pequeño toast de confirmación
function mostrarToast(msg, color = '#333') {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `
        position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
        background:${color};color:#fff;padding:12px 24px;border-radius:8px;
        font-size:15px;font-weight:600;z-index:99999;
        box-shadow:0 4px 15px rgba(0,0,0,.25);
    `;
    document.body.appendChild(t);
    setTimeout(() => document.body.removeChild(t), 3000);
}

// Escape HTML básico
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Generar PDF con enlaces mailto en cada correo
async function generarPDFCorreos(datos) {
    if (!datos || datos.length === 0) {
        alert('No hay datos para generar el PDF.');
        return;
    }

    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = 'Generando PDF con enlaces de correo...';
    loadingMsg.style.cssText = `
        position:fixed;top:20px;left:50%;transform:translateX(-50%);
        background:#16a085;color:#fff;padding:10px 20px;
        border-radius:5px;z-index:99999;font-weight:600;
    `;
    document.body.appendChild(loadingMsg);

    try {
        const jsPDFLoaded = await loadJsPDF();
        if (!jsPDFLoaded) { document.body.removeChild(loadingMsg); return; }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // ── Encabezado ──
        doc.setFillColor(22, 160, 133);
        doc.rect(0, 0, pageWidth, 28, 'F');
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('LISTADO DE CORREOS ELECTRÓNICOS REGISTRADOS', pageWidth / 2, 12, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Sindicato Nacional de Trabajadores', pageWidth / 2, 20, { align: 'center' });

        let yPos = 35;
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`, margin, yPos);
        doc.text(`Total de correos: ${datos.length}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 5;

        // ── Tabla con autoTable, pero añadimos los links manualmente ──
        const colWidths = { 0:10, 1:65, 2:75, 3:30, 4:45, 5:30 };
        const colX = [margin];
        Object.values(colWidths).forEach((w, i) => {
            if (i < Object.keys(colWidths).length - 1)
                colX.push(colX[i] + w + 2);
        });

        doc.autoTable({
            startY: yPos,
            head: [['#','Nombre Completo','Correo Electrónico','Fecha Ingreso','Antigüedad','Fecha Registro']],
            body: datos.map((item, i) => [
                i + 1,
                item.nombreCompleto || 'N/A',
                item.correo || 'N/A',
                item.fechaIngreso ? formatDate(item.fechaIngreso) : 'N/A',
                item.antiguedadTotal || 'N/A',
                item.fechaRegistro ? formatDate(item.fechaRegistro) : 'N/A'
            ]),
            theme: 'grid',
            headStyles: { fillColor:[22,160,133], textColor:255, fontStyle:'bold', fontSize:9 },
            styles: { fontSize:8, cellPadding:3, overflow:'linebreak', minCellHeight:9 },
            margin: { left: margin, right: margin },
            columnStyles: {
                0: { cellWidth:10, halign:'center' },
                1: { cellWidth:65 },
                2: { cellWidth:75, textColor:[22,160,133] }, // color de link
                3: { cellWidth:30, halign:'center' },
                4: { cellWidth:45 },
                5: { cellWidth:30, halign:'center' }
            },
            // Añadir enlace mailto en la celda de correo
            didDrawCell: function(hookData) {
                if (hookData.section === 'body' && hookData.column.index === 2) {
                    const correo = datos[hookData.row.index]?.correo;
                    if (correo && correo !== 'N/A') {
                        doc.link(
                            hookData.cell.x,
                            hookData.cell.y,
                            hookData.cell.width,
                            hookData.cell.height,
                            { url: `mailto:${correo}` }
                        );
                    }
                }
            },
            didDrawPage: function(data) {
                doc.setFontSize(8);
                doc.setTextColor(130,130,130);
                doc.text(`Página ${data.pageNumber}`, pageWidth - margin, pageHeight - 8, { align:'right' });
                doc.text('CONFIDENCIAL - Uso interno', margin, pageHeight - 8);
            }
        });

        doc.save(`listado_correos_${new Date().toISOString().slice(0,10)}.pdf`);
        document.body.removeChild(loadingMsg);
        mostrarToast('📄 PDF generado con éxito', '#16a085');

    } catch (error) {
        console.error('Error generando PDF de correos:', error);
        document.body.removeChild(loadingMsg);
        alert('Error al generar el PDF: ' + error.message);
    }
}



// Verificar autenticación
function verificarAutenticacion() {
    const estaAutenticado = sessionStorage.getItem('pdfAuth') === 'true';
    const usuario = sessionStorage.getItem('user');
    
    if (!estaAutenticado || !usuario) {
        // Redirigir a la página de login
        window.location.href = '../index.html';
        return false;
    }
    
    return true;
}

// Función para cerrar sesión
function logout() {
    if (confirm('¿Estás seguro de que quieres salir?')) {
        // Limpiar sessionStorage
        sessionStorage.removeItem('pdfAuth');
        sessionStorage.removeItem('user');
        
        // Redirigir a la página principal de login
        window.location.href = '../index.html';
    }
}

// Inicializar la aplicación
function initApp() {
    // Verificar autenticación primero
    if (!verificarAutenticacion()) {
        return;
    }
    
    // Mostrar información del usuario logeado
    const usuario = sessionStorage.getItem('user');
    console.log(`Usuario autenticado: ${usuario}`);
    
    // Agregar event listeners a los botones de áreas
    document.querySelectorAll('.service-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const service = e.currentTarget.getAttribute('data-service');
            if (service === 'PAVO' || service === 'PIERNA') {
                generarPDFCena(service);
            } else if (service === 'FIESTA_FIN_ANIO') {
                generarPDFFiestaFinAnio();
            } else if (service === 'LISTADO_CORREOS') {
                abrirPanelCorreos();
            } else {
                generatePDF(service);
            }
        });
    });
    
    // Agregar event listener al botón de cerrar sesión
    document.getElementById('logout-btn').addEventListener('click', logout);
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);