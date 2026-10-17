# Validación de la entrega

Fecha: 17 de octubre de 2026. Entorno: Node.js 24.19.0.

- `npm run build`: TypeScript sin errores y compilación de Vite completada. Vite avisa del tamaño de los paquetes: las bibliotecas de reportes se cargan al solicitar una exportación.
- `npm test`: 56 pruebas aprobadas, incluidas las 47 pruebas de dominio de la aplicación de referencia.
- Exportación Excel: lectura del archivo generado con ExcelJS, tipos numéricos, fórmula de valoración y saldos por ubicación.
- Exportación PDF: firma/formato validado y páginas generadas. Se renderizaron y revisaron visualmente reportes de resumen e inventario.
- PostgreSQL: migración ejecutada con PGlite, transacciones, revisión optimista, auditoría, permisos SQL, protección del propietario y rechazo de usuarios sin acceso. Matriz de roles contrastada entre servidor y SQL.
- HTTP: estado del servidor, requisito de autenticación/configuración y rechazo de orígenes no autorizados.
- API real: `/openapi.json` recuperado de Vercel y Render con contenido idéntico. Consultas GET correctas en `/health`, `/api/insumos`, `/api/puntos-servicio`, `/api/personal` y `/api/kpis/resumen` de Vercel. Sin mutaciones en la API externa.
- Dependencias de ejecución: `npm audit --omit=dev` sin vulnerabilidades reportadas en la comprobación de esta entrega. Se fijó una sustitución compatible de `uuid` para ExcelJS.

No se utilizaron credenciales de Supabase del usuario: Auth, Storage y la migración quedan pendientes de una prueba contra su proyecto real después de configurar las variables. Las pruebas SQL locales no sustituyen esa comprobación. No se ejecutaron pruebas de navegador completas en este entorno.

El código de dominio procede del proyecto Nexo, revisión `c5502a1d97d064e09457e68f9050dd2514ba2cdd`. Se conservaron las reglas y se adaptaron las capas de conexión, autenticación, archivos y reportes. Esta entrega no publica cambios en el sitio existente.
