# Contrato real y alcance del frontend 2.0

El PDF API Logística(2).pdf se contrastó con el OpenAPI recuperado de la URL pública de Vercel. La URL preview solicitada no entregó un contrato JSON accesible (401/HTML de acceso), por lo que no se presume acceso a su base de datos. El origen se configura en `.env`; no hay cambio automático a otro servidor.

## Endpoints usados

| Recurso | Operaciones de la interfaz |
| --- | --- |
| `/api/insumos` y `/{id}` | Lista, crear, editar ficha, conciliación directa de stock y eliminar |
| `/api/insumos/criticos-y-proyeccion` | Riesgos y déficit publicados por el backend |
| `/api/inventario/calcular-sugerido` | POST de cálculo por área: punto, insumo, consumo opcional |
| `/api/puntos-servicio` y `/{id}` | Lista, crear, editar y eliminar puntos |
| `/api/personal` y `/{id}` | Lista, crear, editar y eliminar personal |
| `/api/personal/validar-acreditacion` | Filtro de acreditados y disponibles |
| `/api/rutas` y `/{id}` | Lista, detalle, crear y editar operación de ruta |
| `/api/rutas/{id}/estado` | PATCH con estado, notas de imprevisto y bandera de adenda |
| `/api/despachos` y `/{id}` | Lista, detalle, crear, actualizar campos permitidos y eliminar |
| `/api/despachos/{id}/apurar-produccion` | PATCH para prioridad de producción |
| `/api/contratos` y `/{id}` | Lista, crear, editar y eliminar contrato |
| `/api/kpis/resumen` | Indicadores publicados, con su interpretación real |
| `/health` | Prueba de disponibilidad del backend |

No existen `/api/state`, `/api/action`, empresas, compras, proveedores, carga de documentos o miembros en la interfaz de esta versión. `src/services/client.ts` contiene el cliente tipado; `src/services/backend.types.ts` se genera de `docs/backend-openapi.json` con `npm run api:types`.

## Ejemplo: nuevo despacho

```json
{
  "punto_servicio_id": 2,
  "fecha_programada": "2026-10-17T13:00:00.000Z",
  "ruta_id": null,
  "costo_envio": 10,
  "detalles": [
    { "insumo_id": 1, "cantidad_solicitada": 2, "es_promocion": false }
  ],
  "descontar_stock": true
}
```

Los IDs del ejemplo son ilustrativos: los formularios utilizan los que realmente devuelve el backend. `descontar_stock` se envía solo al crear. PATCH de despacho admite ruta, fechas, estado de producción y costo; no incluye detalles ni un nuevo descuento de existencias. Las fechas se convierten de la zona horaria elegida a ISO UTC.

## Datos insuficientes para otros requerimientos iniciales

| Requerimiento | Ampliación necesaria |
| --- | --- |
| Solicitudes de compra, aprobación y recepción | Entidades/endpoints de compras y recepciones con actualización transaccional de stock |
| Proveedores, catálogos y riesgo | Directorio y relaciones proveedor-insumo; evaluaciones vinculadas a operaciones cerradas |
| Lotes, vencimientos, balances por bodega y rotación | Movimientos/lotes, ubicaciones de stock y consumo histórico contable |
| Cantidad despachada vs entregada, receptor y documentos | Campos/operaciones de confirmación y almacenamiento de guías |
| Vehículos activos, obligaciones, gastos y odómetro | Catálogo de flota y mantenimiento; rutas no reemplazan esa entidad |
| Planes optimizados guardados íntegros | Origen, destinos ordenados, geometría, parámetros, costos e instantáneas por plan |
| Clientes futuros, oficinas, plantas y contacto | Tipo de ubicación, datos de contacto, estado prospecto y próxima visita |
| Usuarios y permisos | Autenticación, validación de tokens y autorización en los endpoints del backend |
| Predicción de consumo real | Series de consumo/servicios por cliente y cobertura histórica confirmada |

El frontend no acepta un formulario y luego muestra éxito fingiendo que esa información se guardó donde no existe un endpoint. Sus borradores y cálculos locales están identificados como tales.

## Semántica de indicadores

La consulta real de `kpis/resumen` identifica `mermas_detalle.nota` como un proxy basado en stock por debajo del mínimo. `rentabilidad_por_ruta` devuelve rutas con valor mayor/igual al umbral USD y porcentaje de cumplimiento. No se convierten esos resultados en utilidad o merma física.

## Fallos, permisos y concurrencia

No hay reintentos automáticos de POST/PATCH/DELETE. Si la respuesta se pierde, la operación puede haberse aplicado: el mensaje pide actualizar antes de repetir. Los errores 422 muestran el campo que reporta FastAPI. Un error parcial deja esa fuente sin datos, con su error; no genera datos sintéticos.

El cliente comprueba la presencia de los números que utiliza para valorar inventario y carga. No sustituye un stock ausente por cero. Los tipos autogenerados siguen el esquema; las comprobaciones adicionales están en `validateRecord`.

La aplicación no implementa transacciones o permisos que correspondan al backend. El Swagger no declara autenticación. La protección del despliegue de Vercel y el filtrado visual por área no equivalen a roles de usuarios de la app. Configura autenticación/autorización en el backend antes de tratar ese requisito como implementado.
