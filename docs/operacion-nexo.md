# Reglas de operación de la versión conectada

La persistencia pertenece a FastAPI/Supabase. La UI no mantiene un estado operativo paralelo ni emite `/api/action`.

- Stock nuevo: cero. Ficha editable: conserva el saldo. Conciliación: PATCH explícito del saldo global, sin fingir compra o movimiento.
- Despacho: cantidades solicitadas por insumo; bandera explícita de descuento al crear. La entrega posterior actualiza fechas/producción/ruta/costo, sin reenviar el descuento.
- Eliminar: exige confirmar ID y delega los efectos al backend; no afirma restitución de inventario.
- Rutas: guardan únicamente campos del contrato. La comparación de escenarios no modifica stock, no crea viajes ficticios y no convierte valor de mercadería en utilidad.
- Carga del simulador: suma las cantidades de los despachos pendientes seleccionados × peso/volumen/precio registrados. No incluye automáticamente todos los pedidos del cliente ni duplica existencias descontadas.
- Capacidad y conductor: proceden de la ruta seleccionada. Las condiciones mecánicas, seguros y tarifas no se deducen de esos registros.
- Proveedores y compras: sin CRUD remoto en esta API. Los borradores son documentos de preparación de esta sesión y están identificados.
- Demanda: solicitudes de semanas cerradas; sin series sintéticas, sin asumir cero en semanas faltantes salvo confirmación de cobertura completa.
- Alertas: se derivan de fuentes consultadas; no representan un motor de autorización ni datos que no existen.
- Mapa: coordenadas del backend y origen local separado. La vista de despacho es su destino actual, no un historial GPS. Los proveedores externos se activan explícitamente.

Consulta `API.md` para el contrato y `GOOGLE_MAPS.md` para mapas. Los costos del simulador se documentan en `modelo-4ropoa.md`.
