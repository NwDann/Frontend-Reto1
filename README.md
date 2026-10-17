# Optilogic Frontend · Nexo

Proyecto independiente de React + Vite, extraído de la versión de Nexo con las correcciones solicitadas. Incluye HTML, CSS con Tailwind, componentes TSX y JavaScript ejecutable generado en `dist/`. La arquitectura solicitada utiliza TypeScript (`App.tsx`, `main.tsx`, `api.ts`); Vite lo convierte a JavaScript para el navegador.

## Inicio rápido: demostración completa

Requiere **Node.js 24.13 o superior** y npm. No incluye `node_modules`: se genera al instalar las dependencias fijadas por `package-lock.json`.

```bash
cd optilogic-frontend
npm ci
cp .env.example .env
npm run dev
```

Abre `http://localhost:5173`. `.env.example` activa `VITE_DATA_MODE=demo`. Los datos sintéticos de CleanPro y Brillo, los cambios y los documentos se guardan en IndexedDB de ese navegador. También puedes crear una empresa vacía. Esta modalidad no requiere cuenta ni conexión a una base de datos y nunca se activa automáticamente si falla el servidor en modo conectado.

Los archivos de `dist/` incluidos permiten probar la compilación con `npm run preview`. No abras `index.html` con `file://`: los módulos necesitan un servidor HTTP. Para recompilar después de cambios usa `npm run build`.

## Modo conectado con Supabase

Las URL proporcionadas son un **backend FastAPI**, no la URL ni las credenciales de un proyecto Supabase. El contrato publicado no contiene usuarios, compras, proveedores, flota, documentos ni planes completos. Para conservar todos los módulos se incluye un servidor complementario Node que guarda el estado en tablas `nexo_*` de Supabase y verifica los permisos antes de ejecutar cada acción.

1. Usa tu proyecto Supabase. Ejecuta una sola vez `supabase/migrations/202610170001_nexo.sql` en su SQL Editor. Crea tablas nuevas y un bucket privado; no modifica las tablas existentes del reto.
2. Activa Email/Password en Supabase Auth. Configura Site URL y Redirect URLs con `http://localhost:5173` y la URL final de la aplicación. La confirmación de correo y recuperación requieren que Supabase tenga configurado el envío de correo.
3. Copia `.env.server.example` como `.env.server`. Completa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Esta clave pertenece solo al servidor.
4. En `.env`, establece `VITE_DATA_MODE=connected`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con la URL real y la clave pública anon/publishable. Deja `VITE_API_BASE_URL=/api` para el proxy local.
5. En dos terminales ejecuta:

```bash
npm run dev:server
```

```bash
npm run dev
```

6. Regístrate, confirma tu correo si corresponde, inicia sesión y crea un espacio de empresa. No se insertan datos sintéticos en los espacios conectados.
7. En Configuración puedes agregar por correo a usuarios ya registrados y confirmados, asignarles un rol, retirarlos y cambiar tu contraseña. El propietario conserva su acceso. Los administradores no pueden modificar a otros administradores ni al propietario.

Al cambiar `.env` debes reiniciar Vite y reconstruir para producción. `APP_ORIGIN` admite una lista de orígenes separados por comas; debe coincidir exactamente con el origen desde el que abres el frontend, incluido el puerto. Si abres `127.0.0.1` en lugar de `localhost`, agrégalo a esa variable.

**Nunca escribas una clave `service_role`, `sb_secret_*` o contraseña de PostgreSQL en una variable `VITE_*`: esas variables se publican en el navegador.** El frontend usa la clave pública para autenticación; el servidor valida el JWT con Supabase y ejecuta las reglas de negocio. Las tablas de estado no conceden escritura directa al navegador.

## Conexión con la API existente

Se consultó el OpenAPI real de ambas direcciones el 17 de octubre de 2026:

- `https://backend-reto1-log-stica-env-os-olive.vercel.app`
- `https://backend-reto1.onrender.com`

Ambas devolvieron el mismo contrato 1.0.0. La copia de referencia está en `docs/backend-openapi.json`. El esquema en vivo difiere del PDF en campos de despacho: incluye `descontar_stock` y no incluye `tipo_orden` en `DespachoCreate`; el SDK sigue el contrato recuperado.

`LOGISTICS_API_URL` selecciona el origen que consulta el servidor. En **Configuración → API del reto**, consulta el resumen e importa catálogo, saldos actuales, ubicaciones y personal en un espacio vacío. La importación verifica que el resumen no haya cambiado y se guarda de forma atómica. No importa despachos/rutas históricos para evitar descontar otra vez un stock que la API ya puede haber descontado. No inventa fechas de acreditación, vencimientos ni contenido de empaques que la API no proporciona; completa esos datos en sus fichas.

La importación es inicial, explícita y en una sola dirección. **No hay sincronización bidireccional automática.** A partir de ella, compras, guías y demás cambios de Nexo se guardan en las tablas `nexo_*`. El SDK tipado `LogisticsApi` permite además consumir el CRUD documentado si posteriormente se amplía la integración. No activa escrituras en el backend existente desde los formularios de Nexo ni duplica operaciones entre dos bases de datos. Véase `docs/API.md`.

## Módulos incluidos

| Módulo | Comportamiento conservado |
| --- | --- |
| Vista general | Valor y cobertura del inventario, contexto financiero, rutas y red geográfica por tipo de ubicación. |
| Optimización de rutas | Origen independiente, flota registrada, escenarios por costo/tiempo/riesgo, tarifas externas por km o viaje, verificaciones derivadas, detalle completo del plan. |
| Inventario | Registro/búsqueda de insumos, stock inicial cero, existencias por ubicación, agrupaciones con contenido y reposición siempre disponible. |
| Compras | Solicitudes nuevas, catálogos por proveedor, estados, detalles permanentes, recepción confirmada y costo promedio ponderado. |
| Trazabilidad | Guías, adjuntos, responsables, diferencias, movimientos y mapa del movimiento seleccionado. |
| Ubicaciones | Bodegas, oficinas, puntos de venta, clientes, futuros clientes, plantas y puntos de servicio; próxima visita solo en prospectos. |
| Gestión de flota | Vehículos, capacidad, costos, obligaciones, personal, mantenimientos y viajes registrados. |
| Predicción de demanda | Histórico por cliente/insumo, tres modelos, validación con cuatro semanas reservadas y datos sintéticos identificados. |
| Proveedores | RUC, contactos, catálogos y evaluaciones vinculadas a operaciones realizadas. |
| Asistente Nexo | Búsqueda estructurada sobre los datos del espacio con referencias y reintentos. No utiliza un LLM ni lee automáticamente PDFs. |
| Configuración | Perfil del espacio, idioma/región, zona horaria, usuarios, contraseña, conexión/importación de la API. |

Incluye además un centro de alertas por área. Ese filtro visual es independiente de los permisos reales del usuario.

## Reportes Excel, PDF, CSV y JSON

El botón **Reportes** de la barra superior permite descargar un módulo o todos:

- Excel `.xlsx`: varias hojas, filtros, filas inmovilizadas, números reales y fórmula de valoración del inventario.
- PDF `.pdf`: tablas paginadas con encabezados, fecha de corte, empresa, numeración y datos sintéticos identificados. Las tablas anchas se separan en grupos de columnas conservando su identificador. Exportar todo incluye el histórico y puede producir muchas páginas.
- CSV `.csv`: UTF-8, comillas y protección de texto que comienza como fórmula.
- JSON `.json`: tablas y metadatos del reporte. La copia completa del estado se descarga desde Configuración y cada plan conserva su JSON completo desde el detalle.

Las descargas CSV y JSON existentes se mantienen. Las importaciones disponibles siguen siendo CSV/JSON para guías y CSV para histórico de demanda; no se promete importar Excel, OCR ni extraer datos automáticamente de un PDF adjunto.

## Reglas que no cambian

La recepción de una compra y la confirmación de una guía se ejecutan una sola vez. Una guía descuenta lo despachado y registra lo entregado; una diferencia genera alerta. Un traslado conserva stock global. Las agrupaciones no multiplican automáticamente el saldo contable. Las cotizaciones externas por km y por viaje son mutuamente excluyentes. Guardar un plan no duplica peajes; completarlo registra un viaje una sola vez. Los precios sugeridos separan transporte, insumos, mano de obra y margen. Los pronósticos no reservan stock ni fabrican consumos para clientes sin histórico.

En modo conectado, estas reglas se ejecutan nuevamente en el servidor con los registros reales del espacio. Una revisión optimista y una transacción de PostgreSQL evitan perder cambios simultáneos; cada cambio registra actor, acción y revisión en `nexo_audit`.

Los datos de perfil y preferencias existentes pertenecen al espacio de empresa y se comparten entre sus miembros. La identidad, contraseña y rol corresponden a cada cuenta de Supabase. El campo de correo de contacto del perfil no cambia el correo de autenticación.

## Arquitectura

```text
optilogic-frontend/
├── public/
├── src/
│   ├── services/
│   │   ├── api.ts                 # HTTP, JWT, adjuntos y SDK FastAPI
│   │   ├── backend.types.ts       # Tipos generados del OpenAPI recuperado
│   │   ├── config.ts / supabase.ts
│   │   ├── demo.ts                # IndexedDB, solo modo demo explícito
│   │   ├── report-data.ts / reports.ts
│   ├── auth/AuthProvider.tsx
│   ├── components/                # Vistas y formularios de los módulos
│   ├── lib/                       # Reglas de negocio portadas
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── server/                        # API complementaria Node + Supabase
├── supabase/migrations/
├── tests/
├── docs/
├── scripts/generate-api-types.mjs
├── dist/                          # HTML, CSS y JavaScript compilados de demo
├── index.html
├── package.json / package-lock.json
├── tailwind.config.js / postcss.config.js
├── tsconfig.json / vite.config.ts
└── .env.example / .env.server.example
```

`node_modules/` aparece después de `npm ci`. `npm run api:types` regenera los tipos desde la copia OpenAPI; no consulta ni modifica la API.

## Verificación y producción

```bash
npm test
npm run build
npm start
```

`npm start` sirve `dist/` y `/api` desde el servidor Node. Para producción, compila con las variables públicas de modo conectado y configura las variables privadas del servidor mediante tu proveedor. Usa Node 24, configura `HOST=0.0.0.0` cuando lo requiera el hosting y publica detrás de HTTPS. El frontend estático también puede alojarse por separado indicando en `VITE_API_BASE_URL` la URL HTTPS de este servidor con su sufijo `/api`.

La entrega se verificó con TypeScript, compilación Vite y pruebas de reglas, reportes, conector HTTP y migración SQL en PostgreSQL embebido (PGlite). La API real se consultó solo en lectura; no se modificaron sus datos. No se dispuso de credenciales del proyecto Supabase, por lo que la migración, Auth y Storage no se ejecutaron contra tu cuenta. La revisión visual cubrió los PDFs generados; no se ejecutó una prueba de navegador de todas las vistas en este entorno.

El mapa embebido conserva OpenStreetMap/Leaflet y recorridos de referencia OSRM, con enlaces a Google Maps y Waze. No incluye tráfico en vivo ni rutas oficiales de Google. El asistente es búsqueda guiada y la predicción es estadística. Los límites y fórmulas están documentados en `docs/operacion-nexo.md` y `docs/modelo-4ropoa.md`.
