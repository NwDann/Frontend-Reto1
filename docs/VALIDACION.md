# Validación de Optilogic 2.0

17 de octubre de 2026. Node.js 22.14.0 y npm 11.21.1 en Linux. Los scripts enumeran los archivos de prueba para funcionar también en Windows; no se realizó una ejecución nativa de Windows.

## Código y pruebas

- `npm run build`: TypeScript y Vite 8.0.16 completados. El paquete de reportes es grande y se carga al solicitar una exportación.
- `npm test`: **29 pruebas aprobadas**. Cubren cliente HTTP, rutas/cuerpos de FastAPI, 401 y HTML de Vercel, 422, fallos de red sin reintentos de escritura, errores por recurso, payloads de insumos/puntos/despachos, stock sin descuento duplicado, fechas de Ecuador y valores opcionales desconocidos.
- Optimización: carga desde despachos seleccionados, origen independiente, matriz correspondiente a los puntos, precio por costos/margen, cotización externa por km o fija, peajes no duplicados, capacidad y acreditación, bloqueo de cotizaciones cero.
- Demanda: sin pronósticos fabricados ante poco histórico; semanas cerradas; huecos no convertidos a cero sin cobertura confirmada; validación reservada de cuatro semanas sin fuga de datos.
- Renderizado de los 11 módulos y Centro de alertas con registros y con fuentes faltantes. El mapa pide cargar al proveedor y OSRM es una elección explícita. Esto no equivale a QA interactivo completo en navegador.
- Exportaciones: Excel real leído con ExcelJS, números y fórmula de valoración; PDF válido y tablas paginadas; CSV protege texto con apariencia de fórmula. Se renderizó y revisó el PDF de inventario con datos de prueba.
- Proxy opcional: solo rutas documentadas, upstream fijo, cuerpo enviado una vez y 401 preservado.
- `npm audit` completo: cero vulnerabilidades reportadas en la comprobación de esta entrega. Vite permanece en la revisión corregida 8.0.16 y se conserva la sustitución compatible de uuid para ExcelJS.

Node 22.14 muestra un aviso experimental al ejecutar TypeScript en las pruebas; los tests pasan con esa función habilitada. Los avisos de dependencias indirectas obsoletas pueden continuar en `npm ci`.

## Comprobaciones reales de API

Origen comprobado: `https://backend-reto1-log-stica-env-os-olive.vercel.app`.

- GET `/openapi.json`, `/health`, insumos, críticos/proyección, puntos de servicio, personal, rutas, despachos, contratos e indicadores: HTTP 200.
- CORS de lectura para `http://localhost:5173` y OPTIONS de `/api/despachos` para POST JSON: HTTP 200.
- POST `/api/inventario/calcular-sugerido`: HTTP 200, cálculo coherente con el área y factor enviados. Es un endpoint de cálculo; no se crearon, editaron o eliminaron registros operativos durante las pruebas.
- La URL preview nueva no permitió recuperar JSON: primeros intentos HTTP 401 y posteriormente HTML/redirección de acceso. Se documenta esa limitación; no se afirma haber validado sus registros o la equivalencia de su base de datos.

## Mapas y límite de verificación

La revisión automática rechazó una consulta de prueba de OSRM porque enviaba coordenadas del backend a un tercero. Se continuó con una alternativa de menor exposición: matrices y respuestas controladas con coordenadas de prueba, sin repetir esa consulta empresarial. No se comprobó una ruta vial en vivo con esas ubicaciones.

El producto carga mapas externos solo tras la elección del usuario y permite habilitar explícitamente el envío de origen/destinos a OSRM. No se contó con una clave Google Maps: clave, facturación y dominios autorizados requieren una comprobación en el proyecto del usuario. Las pruebas verifican la estructura de integración y los controles; no certifican esa autorización externa.
