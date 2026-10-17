# Contratos y persistencia

## Backend del reto (existente)

La copia OpenAPI fue descargada de `/openapi.json` de las dos direcciones suministradas y ambas eran idénticas. La API expone:

| Recurso | Métodos documentados |
| --- | --- |
| `/api/insumos` | GET, POST |
| `/api/insumos/{id}` | GET, PATCH, DELETE |
| `/api/insumos/criticos-y-proyeccion` | GET |
| `/api/inventario/calcular-sugerido` | POST |
| `/api/puntos-servicio`, `/api/personal`, `/api/rutas`, `/api/despachos`, `/api/contratos` | GET, POST |
| Cada recurso anterior `/{id}` | GET, PATCH, DELETE |
| `/api/personal/validar-acreditacion` | GET |
| `/api/rutas/{id}/estado` | PATCH con JSON `{estado, notas_imprevisto?, tiene_adenda?}` |
| `/api/despachos/{id}/apurar-produccion` | PATCH |
| `/api/kpis/resumen` | GET |
| `/health` | GET |

OpenAPI no declara esquemas de seguridad ni compras, proveedores, miembros, flota, archivos o planes con instantáneas. En el contrato recuperado, `DespachoCreate.descontar_stock` vale `true` por defecto. Los formularios propios de Nexo no se envían directamente a estos endpoints: de hacerlo se perderían campos y se podrían descontar existencias dos veces. `LogisticsApi` es un SDK independiente que sigue los DTO de `backend.types.ts`.

La importación inicial transforma identificadores en `API-INS-{id}`, `API-PS-{id}` y `API-PER-{id}`. No transforma cantidades ni unidades. Rechaza coordenadas ausentes. Conserva como desconocidos el vencimiento del stock, contenido de agrupaciones y fecha de acreditación. El stock importado se asigna a bodega central como saldo inicial; revisa y distribuye ubicaciones físicas antes de operar.

## API complementaria incluida

Base local `/api`; todas las peticiones incluyen `Authorization: Bearer <JWT de Supabase>`. Excepto empresas, llevan `?company=<UUID>`.

| Ruta | Método | Resultado / cuerpo |
| --- | --- | --- |
| `companies` | GET / POST | Empresas accesibles y rol / crear `{name}` |
| `state` | GET | Estado completo del espacio |
| `action` | POST | `{action,payload}`; valida reglas y devuelve estado confirmado |
| `logistics/compare` | POST | `{points,inputs,matrix?}`; deriva datos de flota y compara |
| `assistant` | POST | `{query}`; respuesta y referencias estructuradas |
| `upload` | POST | FormData `file`, máximo 8 MB; `{id,name}` |
| `files/{id}` | GET | Documento privado del mismo espacio |
| `members` | GET | Miembros, solo administración |
| `members/save` | POST | `{email,role}` de una cuenta confirmada existente |
| `members/remove` | POST | `{userId}`; no modifica propietario ni a sí mismo |
| `legacy/preview` | GET | Catálogo, puntos, personal y huella del origen configurado |
| `legacy/import` | POST | `{fingerprint}`; importación inicial atómica, solo administración |

Errores del servidor: `{error: string}` con HTTP 400/401/403/404/409/413/500/503. No se reintentan automáticamente escrituras ni se cambia a otro servidor después de una respuesta ambigua.

## Permisos de escritura

| Rol | Alcance |
| --- | --- |
| owner | Todas las acciones del espacio; gestión de administradores |
| admin | Todas las acciones; usuarios operativos, sin modificar propietario u otros administradores |
| gerencia | Parámetros financieros, perfil del espacio y revisión de alertas |
| logistica | Planes, ejecución de rutas, ubicaciones, guías, responsables, flota, personal, gastos, viajes, peajes y alertas |
| bodega | Insumos, históricos, recepción de compras, confirmación de guías, traslados, responsables y alertas |
| compras | Solicitudes y estados previos a recepción, proveedores, catálogos, evaluaciones y alertas |
| consulta | Lectura, reportes y consultas; sin modificaciones |

Los miembros pueden leer los registros operativos completos de su espacio. No se implementa ocultación de columnas o precios por rol. `server/permissions.mjs` controla las acciones; `nexo_commit` vuelve a comprobar rol y acción dentro de la transacción. Cambiar el selector visual de alertas no concede permisos.

## Supabase

`nexo_workspaces` conserva el estado JSON de la lógica original, con revisión optimista; `nexo_memberships` controla accesos; `nexo_documents` referencia objetos privados; `nexo_audit` registra acciones. RLS permanece activado y no existen permisos directos de lectura/escritura para anon o authenticated sobre estas tablas. Solo el servidor con clave privada las usa después de validar al usuario.

No es una migración a tablas normalizadas de cada entidad. Se conserva este almacenamiento por espacio para mantener el comportamiento original y sus invariantes. Los documentos y las cuentas están separados del JSON. La importación del backend no implica replicación continua ni garantiza que el backend existente aplique sus propios permisos: esa configuración corresponde a su propietario.

El alta de usuarios y recuperación de contraseña se delegan a Supabase Auth; los límites de registro y envío de correo se configuran en Supabase. El servidor no expone una clave privada ni acepta un rol proporcionado por el navegador como autorización.
