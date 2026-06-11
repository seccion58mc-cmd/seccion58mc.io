# Sección 58 - SSMC

Sitio del Sindicato Nacional de Trabajadores de la Industria Química (Sección 58).
Frontend estático (HTML/CSS/JS vainilla) servido con Firebase Hosting, base de datos Firestore y Cloud Functions.

`src/` está vacío (carpetas placeholder sin uso). Todo el código real vive en `public/` y `functions/`.

## Carpetas raíz

- `public/` — todo el frontend.
- `functions/` — Cloud Functions (`index.js`, actualmente solo boilerplate).
- `firestore.rules` / `firestore.indexes.json` — reglas e índices de Firestore.
- `firebase.json` / `.firebaserc` — configuración de despliegue.
- `generate-firebase-config.js` — genera `public/firebase-config.js` a partir de `.env`.

## Panel de Trabajadores (formularios públicos, sin login)

| Ruta | Descripción |
|---|---|
| `public/index.html` + `scriptForm.js` + `styleForm.css` | Formato de Vacaciones — el trabajador elige cuatrimestre, área, supervisor y días de vacaciones en calendario. |
| `public/festividadAnual/` | Registro para la Fiesta del 12 de Diciembre. |
| `public/eleccionObsequio/` | Elección de obsequio fin de año (cena navideña: pavo/pierna). |
| `public/log/afiliacion/` | Solicitud de Afiliación al sindicato. |
| `public/log/ayudaDefuncion/` | Designación de Beneficiarios (ayuda por defunción). |
| `public/log/diamadres/` | Registro Día de las Madres. |
| `public/log/diapadres/diapadres.html` | Registro Día del Padre. |
| `public/log/listadoCorreos/` | Registro de correo electrónico del trabajador. |
| `public/log/polizasEventual/` | Designación de beneficiarios para trabajadores eventuales. |

## Panel de Admin (`public/log/`)

| Ruta | Descripción |
|---|---|
| `public/log/index.html` | Login (valida contra colección `pacoLog` en Firestore, guarda `sessionStorage.pdfAuth`). |
| `public/log/pdfs/index.html` + `appPdf.js` | Dashboard principal — genera PDFs: lista de asistentes fiesta, listas pavo/pierna, vacaciones por área (con selector de cuatrimestre), listado de correos. Es el hub que enlaza a todo lo demás. |
| `public/log/afiliados/` (`admin.js`/`admin.css`) | Gestión de Afiliados: altas, bajas, reingresos. |
| `public/log/pdfs/adminAyudaDefuncion/` | Admin de designaciones de beneficiarios (ayuda defunción). |
| `public/log/pdfs/adminBeneficiarioEventual/` | Admin de beneficiarios de trabajadores eventuales. |
| `public/log/pdfs/adminDiaMadres/` | Admin de registros Día de las Madres. |
| `public/log/pdfs/adminDiaPadres/` | Admin de registros Día del Padre. |

> **Nota de seguridad:** solo `log/index.html` y `log/pdfs/appPdf.js` validan `sessionStorage.pdfAuth`.
> Las subcarpetas `afiliados/`, `adminAyudaDefuncion/`, `adminBeneficiarioEventual/`, `adminDiaMadres/` y `adminDiaPadres/`
> no verifican sesión — solo dependen de no compartir el link directo.
