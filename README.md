# Optilogic · Nexo 2.0 — frontend conectado a FastAPI

Aplicación React/Vite con HTML, CSS/Tailwind y TypeScript/TSX compilado a JavaScript. Esta versión sustituye la demostración y la base paralela por **lecturas y escrituras directas en el backend FastAPI** que gestiona Supabase.

## Ejecutar en Windows

Requiere Node.js **22.14.0 o superior**. Se conserva Vite 8.0.16 con el parche de seguridad de la entrega anterior.

Extrae el proyecto y abre una terminal en su carpeta:

```bat
npm ci
copy .env.example .env
npm run dev
```

Abre `http://localhost:5173`. No necesitas credenciales de Supabase para consumir esta API. `node_modules/` se genera con `npm ci`; no se incluye en el ZIP. Los avisos `deprecated` de dependencias indirectas pueden aparecer sin impedir la instalación.

Si vienes de la versión 1.x, esta actualización reemplaza la aplicación completa. Usa una carpeta nueva o revisa los cambios con Git. Copia `.env.example` como nuevo `.env` y configura el destino correcto. Las antiguas variables de modo demo y claves Supabase ya no se utilizan. Los datos de la demostración anterior no se envían al backend ni se migran automáticamente.

## URL del backend y protección de Vercel

La URL nueva compartida es:

```text
https://backend-reto1-log-stica-env-git-94d7c4-dannys-projects-b34bf7fa.vercel.app
```

No se pudo obtener su OpenAPI como JSON: respondió con HTTP 401 en los primeros intentos y posteriormente con HTML de acceso/redirección. Por eso se utilizó el PDF **API Logística(2).pdf** para contrastar los cuerpos y se comprobó la URL pública que ya habías compartido:

```env
VITE_API_BASE_URL=https://backend-reto1-log-stica-env-os-olive.vercel.app
```

Esta dirección pública respondió a los recursos documentados y su contrato coincide con los cuerpos del PDF. No se presume que las dos URLs tengan siempre la misma base de datos o versión; el origen utilizado aparece en Configuración y en los reportes. El frontend no cambia a otra URL automáticamente ante un error.

Para usar el nuevo despliegue, el propietario debe habilitar el acceso que corresponda o suministrar su dominio público de producción. En Vercel, la protección se gestiona en **proyecto → Settings → Deployment Protection**. Después cambia `VITE_API_BASE_URL` por la raíz del backend, sin `/docs`, y reinicia Vite. Si el dominio incluye `/api`, el cliente lo normaliza para no duplicarlo.

Los errores de conexión, HTML inesperado, protección 401, validación 422 y fuentes parciales se muestran en pantalla. Una fuente fallida no se presenta como un catálogo vacío ni se sustituye con datos sintéticos.

## Qué ofrece cada módulo

| Módulo | Funciones de esta versión | Fuente / límite |
| --- | --- | --- |
| Vista general | Valor de inventario, OTIF, rutas activas, contratos, alertas y mapa | Insumos + KPI + rutas + despachos; cálculos derivados identificados |
| Optimización de rutas | Origen independiente, destinos reales, selección de despachos, carga y comparación propio/externo | Cálculo local sobre registros; distancia vial opcional OSRM y supuestos de costo |
| Inventario | Buscar, crear y editar insumos; conciliación explícita de saldo; cálculo sugerido por área | CRUD de insumos y POST calcular-sugerido |
| Compras | Reposición por mínimo y referencias de críticos; borradores exportables | La API no expone compras: los borradores no se envían, aprueban o reciben |
| Trazabilidad | Crear/consultar/editar despachos, priorizar producción, registrar fecha de entrega y visualizar su destino | La API no incluye archivos de guías, cantidades entregadas ni historial de movimientos físicos |
| Ubicaciones | CRUD de puntos de servicio y contratos; mapa y fichas | Sin categorías de bodega/oficina/prospecto/planta ni datos de contacto en el contrato actual |
| Gestión de flota | Vehículo y capacidad por ruta; estados; CRUD de personal; acreditación y disponibilidad | No es un catálogo de flota: no hay pólizas, mantenimiento, odómetro o costos mensuales |
| Predicción de demanda | Histórico de solicitudes por cliente/insumo; tres modelos locales solo si hay datos suficientes | Cantidad solicitada, no consumo físico. Mínimo 8 semanas cerradas; 4 reservadas para validar |
| Proveedores | Explica la fuente faltante y exporta la especificación de datos requerida | No se inventan proveedores o evaluaciones sin endpoints |
| Asistente Nexo | Búsqueda sobre registros con referencias a insumos, despachos, rutas y personal | Sin LLM ni lectura automática de documentos |
| Configuración | Estado por recurso, prueba de conexión, mapa, origen, zona horaria y objetivos de comparación | Preferencias locales; la API no expone autenticación de usuarios o perfiles |

También hay un centro de alertas por área. Ese selector es un filtro de visualización, no un mecanismo de permisos.

## Operaciones que sí se guardan en Supabase a través de la API

Los formularios llaman a los POST/PATCH/DELETE documentados de insumos, puntos de servicio, personal, rutas, despachos y contratos. La interfaz confirma el éxito solo después de recibir respuesta del backend y vuelve a consultar los recursos.

- Un insumo nuevo comienza en stock cero. Editar su nombre, mínimo, precio, peso o volumen conserva el saldo. «Ajustar saldo» envía un PATCH explícito de `stock_actual`; no genera una recepción de compra ni un movimiento contable.
- Al crear un despacho, el usuario elige `descontar_stock`. El backend lo aplica al crear, no al registrar después la fecha real de entrega. Si se creó sin descontar, el contrato no expone una operación posterior dedicada a descontarlo.
- Actualizar un despacho solo envía ruta, fechas, costo de envío y estado de producción. No vuelve a enviar `descontar_stock` ni las líneas, y no simula recepción física por cantidades.
- Los cambios de estado de ruta usan PATCH `/api/rutas/{id}/estado` con estado, notas y bandera de adenda.
- Las eliminaciones requieren confirmar el ID. El backend decide sus validaciones y relaciones; no se presume que eliminar un despacho restituya stock.
- Si se pierde la conexión durante una escritura, se pide actualizar los registros antes de repetir. No hay reintentos automáticos ni escritura en dos bases de datos.

No se agregaron tablas, funciones SQL o migraciones a tu Supabase. El backend existente es la única fuente de persistencia operativa. Se retiraron el login y las tablas paralelas de la versión anterior porque no forman parte de la API proporcionada.

## Mapas y optimización

El mapa conserva Leaflet/OpenStreetMap y enlaces a Google Maps/Waze. También hay un proveedor Google Maps integrado. Consulta **`docs/GOOGLE_MAPS.md`** para los pasos exactos.

Las vistas muestran primero un control para cargar el mapa externo. La elección se conserva en la sesión. Puedes introducir o pegar coordenadas sin cargarlo. El origen de bodega se guarda como preferencia del navegador, por backend: no es una ubicación almacenada en la API ni el origen histórico de un despacho.

Para optimizar:

1. Selecciona o introduce el origen, elige entre 1 y 7 destinos de la API y los despachos pendientes que realmente transportarás.
2. Selecciona una ruta de referencia para consultar vehículo, capacidad y conductor. Sin esa referencia, esos controles quedan sin verificar. La modalidad externa compara una cotización declarada sobre la misma operación, no un proveedor identificado por la API.
3. Completa costos de transporte propio y/o tarifa externa por km o fija por viaje. Los importes empiezan en cero y las modalidades activas requieren cotizaciones válidas. Peajes y demás costos se ingresan como supuestos porque el backend no los devuelve.
4. Si quieres red vial, activa **«Consultar distancias y recorridos viales con OSRM»**: al comparar se comparten con ese proveedor las coordenadas seleccionadas. Sin activarlo, se usa aproximación geográfica, claramente identificada. Si el servicio vial falla o no devuelve una matriz completa, se informa la aproximación.
5. Compara costo, tiempo o equilibrio; revisa advertencias de carga, contrato y acreditación. La velocidad es un resultado de distancia/tiempo. La hora disponible incluye conducción, descarga, pausas y retorno si corresponde.
6. Descarga el análisis completo en JSON o la comparación en PDF antes de salir. El backend puede guardar una operación de ruta, pero su contrato no almacena origen, orden óptimo, geometría ni supuestos de costos. Asigna despachos a las rutas desde Trazabilidad.

El precio sugerido sin impuestos = `(transporte + insumos de los despachos seleccionados + otros insumos + mano de obra + otros costos directos) / (1 − margen/100)`. Usa el precio unitario registrado como referencia; no representa una venta cobrada ni una utilidad contable. No se descuenta stock al comparar ni se resta de nuevo una demanda que el backend ya pudo descontar.

OSRM aporta tiempos de conducción sin tráfico en vivo. Google Maps, cuando se activa, aporta la visualización; este código no llama a Routes API ni a tráfico de Google. Para producción puedes sustituir `VITE_OSRM_BASE_URL` por tu servicio de rutas autorizado.

## Indicadores financieros y predicción

La respuesta real del backend se interpreta literalmente:

- `rentabilidad_por_ruta` mide cumplimiento de un umbral de **valor de mercadería**, no utilidad después de costos.
- `tasa_mermas` es un **proxy de insumos bajo mínimo**, según `mermas_detalle.nota`; no mide diferencias físicas o pérdidas.
- No se calcula rotación contable sin consumo por periodo e inventario promedio. Tampoco vencimientos sin lotes/fechas.

El pronóstico local agrega detalles por cliente, insumo y semana de fecha programada. Se excluyen semanas aún abiertas en la zona horaria elegida. Las semanas sin registros son desconocidas hasta que el usuario confirme cobertura completa; solo entonces se consideran cero solicitudes. Se comparan promedio ponderado, tendencia lineal y patrón estacional de cuatro semanas con cuatro semanas reservadas; el modelo con menor MAE se reajusta con todo el histórico. Sin base suficiente, no se fabrica una predicción. El histórico de despachos no acredita consumo físico.

## Reportes

**Reportes** permite exportar Excel real, PDF paginado, CSV y JSON de los registros consultados. Incluye fuente, fechas de consulta y errores por recurso. Excel conserva números, filtros y fórmula de valoración de inventario. Los borradores de compra y análisis de ruta tienen sus propias descargas y se identifican como preparación/cálculo local.

Los borradores viven solo en memoria de la sesión de la app y se pierden al recargar. Las preferencias viven en almacenamiento del navegador. El frontend no guarda copias ocultas de los registros como sustituto del backend.

## CORS y proxy opcional

La API pública respondió al origen `http://localhost:5173` y al preflight de POST. Si tu dominio de frontend no está permitido, el backend debe ajustar CORS o puedes usar el proxy del proyecto:

```env
VITE_API_BASE_URL=/api
API_UPSTREAM_URL=https://backend-reto1-log-stica-env-os-olive.vercel.app
```

`npm run dev` usa el proxy de Vite automáticamente. Para servir una compilación con el proxy Node:

```bat
npm run build
npm start
```

Abre `http://127.0.0.1:3001`. `.env.server.example` permite configurar HOST/PORT o el upstream del servidor opcional. Para desplegar en un servidor Node configura `HOST=0.0.0.0` si tu proveedor lo necesita y publica por HTTPS. En hosting estático puedes usar la URL absoluta del backend y CORS, o configurar su proxy equivalente. Cambiar variables `VITE_*` exige reiniciar Vite/recompilar.

El proxy solo expone las rutas documentadas hacia un upstream configurado. No evita la protección de Vercel ni añade permisos de usuario.

## Usuarios y credenciales

El Swagger no declara autenticación ni endpoints de usuarios. Un login únicamente en el frontend no protegería los endpoints públicos. La gestión de usuarios requiere que el backend valide tokens y permisos; esa ampliación está identificada en Configuración y en `docs/API.md`. No hay un formulario de login ficticio.

No incluyas claves `service_role`, claves secretas o contraseñas de PostgreSQL en variables `VITE_*`: llegan al navegador. La clave de Maps JavaScript es pública de cliente y debe restringirse por API y dominio; no es una credencial de Supabase.

## Estructura

```text
optilogic-frontend/
├── public/
├── src/
│   ├── services/
│   │   ├── api.ts / client.ts       # Cliente HTTP y DTO, sin base paralela
│   │   ├── backend.types.ts         # Generado del OpenAPI comprobado
│   │   ├── config.ts / load.ts      # Entorno y consultas por recurso
│   │   ├── google-maps.ts / roads.ts
│   │   └── reports.ts
│   ├── components/                 # Los 11 módulos y formularios
│   ├── lib/                        # Cálculos, predicción, alertas y serialización
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── server/index.mjs                # Servidor estático/proxy opcional
├── tests/
├── docs/backend-openapi.json
├── docs/GOOGLE_MAPS.md
├── scripts/
├── dist/                           # Compilación HTML/CSS/JavaScript
├── index.html
├── package.json / package-lock.json
├── tailwind.config.js / postcss.config.js
├── vite.config.ts / tsconfig.json
└── .env.example / .env.server.example
```

## Comprobaciones

```bat
npm test
npm run build
npm audit
```

Las pruebas incluyen cliente HTTP, cuerpos de formularios, fechas de Ecuador, errores de fuentes, optimización/costos, predicción sin datos sintéticos, renderizado de las pantallas, exportaciones y proxy. Las escrituras se prueban con respuestas controladas; no se crearon, editaron o eliminaron registros del backend real. Se consultaron sus recursos y el cálculo sugerido, que respondió correctamente.

No se dispuso de una clave Google: su autorización y facturación no se comprobaron en vivo. La consulta vial con coordenadas del backend fue rechazada por la revisión automática del entorno; esa integración se verificó con matrices y respuestas de prueba, sin compartir esas coordenadas. No se realizó QA completo de navegador; se verificó renderizado de componentes y se revisaron PDFs generados. Los resultados concretos de esta entrega están en `docs/VALIDACION.md`.
