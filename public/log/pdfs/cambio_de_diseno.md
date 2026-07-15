# 🎨 Bitácora de Cambios de Diseño Front-End — SSMC Admin

Este documento detalla todas las mejoras de interfaz (UI), experiencia de usuario (UX) y rediseño de estilos aplicados al panel de administración central de **SSMC** y a cada una de sus subsecciones correspondientes.

---

## 1. Rediseño General: Estructura de Dashboard Premium
Se transformó por completo el antiguo panel plano en una plataforma moderna y limpia inspirada en centros de control corporativos de alta gama:

*   **Barra Lateral Colapsable (Sidebar):**
    *   Ubicada a la izquierda de la pantalla, agrupa todas las secciones de manera jerárquica (Dashboard, Vacaciones, Cenas, Correos, Afiliados, Trabajadores, Madres, Padres, etc.).
    *   Comportamiento responsive: Se colapsa automáticamente en pantallas móviles o mediante el botón de menú para optimizar el espacio útil de trabajo.
*   **Cabecera Inteligente (Header):**
    *   Muestra el título de la sección activa, el badge con el nombre del usuario conectado, y el control de cambio de tema.
    *   **Buscador Global Dinámico:** Integra una barra de búsqueda predictiva que asocia lo que escribe el usuario con las secciones disponibles y ofrece accesos directos dinámicos e instantáneos.
*   **Fondo de Partículas Tecnológicas:**
    *   Se implementó un canvas animado interactivo en el fondo utilizando `tsParticles` con sutiles nodos flotantes en tonos azules y blancos, proporcionando un aspecto de centro de comando premium sin afectar el rendimiento.
*   **Eliminación Completa de Emojis:**
    *   Se reemplazaron todos los emojis genéricos por iconos vectoriales consistentes y modernos de la librería **FontAwesome 6.5.0**.
*   **Modales Personalizados:**
    *   Se erradicaron las alertas nativas del navegador (`alert()`) por cuadros de diálogo modales oscuros premium usando **SweetAlert2** (`swalDark`), adaptados para encajar con la estética azul y negra.

---

## 2. Sistema Unificado de Modo Claro / Modo Oscuro
Se implementó un sistema inteligente y global para alternar entre temas:

*   **Ubicación Estratégica del Toggle:** El botón de cambio de tema (Sol/Luna) se colocó a un lado del badge de usuario en la cabecera principal, unificando el control del sistema y eliminando los botones redundantes de las subsecciones individuales.
*   **Persistencia en Sesión:** La preferencia se almacena en `localStorage` bajo la clave `adminTheme` de modo que se conserva al recargar o cambiar de página.
*   **Prevención de Parpadeos (Flash Avoidance):** Se insertó un script síncrono ultra-ligero en el `<head>` de todos los archivos HTML. Este lee el tema antes de renderizar la página, evitando "destellos" blancos molestos.
*   **Contraste y Legibilidad en Modo Claro:** 
    *   Se diseñaron hojas de estilo con el selector `[data-theme="light"]` adaptando fondos a tonos grises y blancos premium.
    *   Se corrigieron errores de contraste (como números de estadísticas blancos sobre fondos claros), asegurando que toda la información crítica sea visible.

---

## 3. Optimizaciones y Correcciones Específicas por Sección

### 📁 Datos por Trabajador
*   **Chips de Estatus Robustos:** Los indicadores de registros completados (✓), faltantes (✗) o no aplicables (–) se hicieron más grandes (`font-size: 13.5px`, `padding: 8px 12px`).
*   **Fondos Sólidos de Alto Impacto:** Se descartaron las transparencias tenues en favor de fondos sólidos oscuros con letras blancas (`#065F46` para aprobado, `#991B1B` para faltante y `#374151` para no aplica), haciendo que el usuario identifique de inmediato qué datos hacen falta.
*   Se eliminaron por completo los emojis dentro de los chips, incorporando iconos temáticos de FontAwesome en su lugar.

### 📞 Contactos de Emergencia
*   **Filtros Interactivos Corregidos:** Se eliminaron estilos inline que bloqueaban visualmente los botones de tipo de contrato ("Todos", "Planta", "Eventual"). Ahora el estado activo (`.is-active`) cambia de color y brillo dinámicamente al hacer clic.
*   **Limpieza de Interfaz:** Se removió la sección inferior de "Listas oficiales" y sus listados de nombres faltantes para simplificar la interfaz, enfocando la pantalla únicamente en la gestión de contactos y descarga de reportes PDF. Se blindó el JS para evitar errores de referencia en el DOM.

### 🐛 Corrección de Navegación (Bug "Sin registros para null")
*   Se corrigió el error en `appPdf.js` que disparaba falsas alertas de "Sin registros para null - FEBRERO..." al navegar por las secciones. El evento de escucha de clics ahora valida correctamente la presencia del atributo `data-service` antes de proceder con una consulta a la base de datos de Vacaciones.

---

*Diseño implementado con altos estándares de UI/UX modernos, paletas cromáticas armónicas y rendimiento fluido.*
