# Operación de Nexo · revisión de módulos

Esta actualización conserva el espacio de cada empresa y amplía su estado JSON en Supabase (o IndexedDB en modo de demostración). `upgradeEnterprise` añade el esquema una vez y no sustituye los registros ya ampliados. Las empresas nuevas sin datos de demostración no reciben vehículos, consumos, contactos ni objetivos financieros inventados.

## Datos automáticos y decisiones de ruta

- Vehículos propios y externos se registran en Flota. Capacidad, combustible por galón, conductor, costo horario, póliza, revisión, mantenimiento y aptitud declarada para químicos se consultan del registro en el servidor. Los valores enviados por el cliente no sustituyen estas verificaciones.
- La ventana disponible es hora límite menos hora de salida, en hora continental de Ecuador. Incluye conducción, descarga/verificación, pausas y regreso si aplica.
- La velocidad mostrada es distancia / tiempo de conducción. Con matriz OSRM se usan tiempos de red vial; sin ella se aproxima la distancia geográfica y se usa la velocidad calculada del histórico de viajes (o la referencia general si aún no hay viajes).
- El recuento mensual procede de viajes completados. Completar una ruta crea un viaje una sola vez y actualiza el odómetro. Un viaje histórico registrado manualmente no modifica el odómetro actual.
- La asignación por viaje de costos fijos y prima de mercadería en tránsito utiliza viajes completados en el mes + el viaje que se está evaluando. Es una convención de gestión explícita, no una distribución contable definitiva de fin de mes.
- Mantenimiento por km es un presupuesto de desgaste para cotizar. Los pagos reales se registran aparte y no se suman de nuevo a una simulación.
- El transporte externo se calcula con distancia × tarifa por km + recargos + peajes estimados del catálogo. No incorpora combustible ni conductor propios. El recargo original se conserva separado para que guardar una ruta no vuelva a sumar los peajes.
- Los peajes provienen de zonas y clases de vehículo registradas. Se usa una tarifa por zona, con preferencia por la clase específica. Regresar supone un segundo paso. No se detectan casetas sobre la geometría vial ni se consultan tarifas en vivo. El catálogo sintético está identificado. La falta de tarifa se muestra como pendiente.
- Precio sugerido del servicio, sin impuestos = (transporte + insumos de guías programadas + horas del personal de limpieza × costo/hora + otros costos directos) / (1 − margen sobre ventas). La ausencia de guías se avisa como precio incompleto. No se simula un ingreso cobrado.
- El índice de riesgo interno es una ayuda operativa, no una probabilidad. La flota propia combina condiciones declaradas de ruta, químicos, experiencia y obligaciones. El externo usa el puntaje de evaluaciones del proveedor, normalizado a 0–35; sin evaluaciones usa 17,5 como supuesto de comparación y lo identifica como desconocido. Se exige viabilidad documental y de capacidad antes de ordenar por la prioridad del usuario.
- Las pólizas son referencias privadas registradas por la empresa. El sistema no consulta autoridades ni aseguradoras, no certifica habilitación legal y no presume cobertura de todos los químicos. Mercadería en tránsito y póliza del vehículo se presentan por separado.

## Inventario, compras y trazabilidad

Una referencia nueva comienza con stock cero y sin vencimiento ficticio. El buscador permite seleccionar una referencia existente o crear otra. Las compras recibidas aumentan stock según cantidad confirmada, actualizan costo promedio ponderado y conservan responsables. Una compra parcial se cierra con una alerta de diferencia: la reposición restante requiere una solicitud nueva. No es una gestión de recepciones parciales sucesivas.

Las salidas descuentan la cantidad despachada y conservan la cantidad entregada. Las diferencias permanecen visibles para su investigación. El término legado `recibido` se mantiene en el esquema de guías por compatibilidad; la interfaz muestra **entregado** para salidas y **recibido** para compras. Los traslados internos conservan el stock global y registran ubicaciones y responsables. No es posible usar para una salida central existencias que estén en otra ubicación.

Los saldos se desglosan por ubicación. El vencimiento de la referencia central es la fecha más temprana registrada; esta revisión no incorpora un kardex completo por número de lote ni trazabilidad de varios vencimientos del mismo insumo en una ubicación.

Las recomendaciones descuentan compras abiertas, conservan la unidad del catálogo y muestran su fórmula. La cobertura usa consumo reciente por referencia, consolidado desde series de clientes cuando existe; la rotación se presenta como indicador base, con saldo de apertura y actual, no como cierre contable certificado. El valor de existencias se compara con objetivos internos editables. Las cuentas para insumos, consumo y transporte se registran como etiquetas del plan contable de la empresa; no se generan asientos.

Las evaluaciones nuevas solo pueden asociarse una vez a una compra recibida/rechazada o un transporte externo completado. Las evaluaciones anteriores a esta revisión se conservan como historial legado.

## Predicción por cliente

Cada serie contiene cliente, insumo, semana cerrada, cantidad, servicios, área y origen. Los datos sintéticos de 24 semanas se generan únicamente para espacios de demostración y se identifican tanto en registros como en interfaz.

Se requieren ocho semanas consecutivas para comparar promedio móvil ponderado, tendencia lineal y estacional ingenuo de cuatro semanas. Los últimos cuatro datos se reservan para validación; se elige por MAE y se informa WAPE cuando existe base distinta de cero. Después se reajusta con todo el histórico. Una frecuencia futura distinta reescala las cantidades por servicios previstos / promedio reciente de servicios. El rango de sensibilidad usa el MAE acumulado y no se presenta como intervalo probabilístico.

El stock es compartido entre clientes. La vista individual no reserva existencias ni aprueba compras. Un cliente futuro sin historial suficiente muestra falta de datos. Importar un CSV real reemplaza únicamente la serie cliente/insumo seleccionada, rechaza duplicados y fechas futuras y permite consultar/exportar los registros usados.

## Asistente y configuración

El asistente realiza consultas estructuradas a inventario, compras, guías, flota, contactos, contexto financiero y predicción por cliente. Devuelve identificadores de registros como fuentes, maneja saludos y consultas sin coincidencias y ofrece reintento cuando falla la conexión. No es un modelo generativo ni interpreta PDF/imágenes sin estructurar.

Configuración administra nombre, correo, cargo, formatos regionales españoles, zona horaria y avisos del espacio. El plan del espacio se identifica como prototipo; no se simulan suscripciones comerciales ni cobros. Los planes de operación activos son rutas guardadas reales.

## Verificación

`node --test tests/*.test.mjs` cubre fórmulas 4ROPOA, estados de compra, recepciones parciales, transacciones de stock, registros de flota, recuento mensual, peajes sin duplicar, precio sugerido, evaluaciones vinculadas, separación de datos reales/sintéticos, validación temporal de modelos y respuestas con fuentes. TypeScript y el build de producción verifican la integración de los módulos.

## Ampliación de planificación, unidades y ubicaciones

El punto de partida de una planificación puede ser la bodega central o una coordenada independiente seleccionada en el mapa. El origen independiente se guarda dentro del plan y no crea ni modifica ubicaciones del directorio. La matriz vial, la distancia aproximada, los tiempos, el retorno y el enlace de Google Maps utilizan ese origen. La casilla de regreso se refiere al punto de partida. Las ubicaciones de stock y las guías conservan sus propios registros.

La cotización externa elige exclusivamente USD/km o USD/viaje. En modalidad fija no se suma el componente por km; en modalidad por km no se suma una tarifa fija. Recargos y peajes se distinguen de la cotización original para que volver a calcular o guardar el plan no los duplique. Una casilla permite señalar que la tarifa ya incluye peajes. Las opciones de clima, vía y horario tienen descripciones específicas para cada puntaje.

Los planes nuevos conservan una copia del origen, destinos, contactos, vehículo, conductor, insumos y guías usados al calcular. El detalle permite consultar costos, indicadores, parámetros, documentos de referencia y descargar el registro completo. Se distingue entre guías usadas para calcular la carga y guías asignadas a la ejecución. Los planes anteriores muestran sus datos conservados y avisan cuando una ficha histórica completa no existe; no se rellena con información presentada como histórica.

Las presentaciones agrupadas (caja, paquete, pallet, bulto, fardo, saco, rollo, kit, caneca u otra agrupación) pueden definir cantidad de contenido y unidad de contenido. Por ejemplo, 3 cajas con 12 unidades cada una se registran como 3 cajas y se muestran como equivalentes a 36 unidades. El costo, el peso y el volumen siguen siendo por unidad de inventario (una caja en el ejemplo). No se multiplica el kardex, no se cambia la valoración por añadir contenido y no se inventa el contenido de referencias antiguas. Una referencia nueva agrupada exige su definición; una referencia anterior puede completarla desde su ficha.

Preparar reposición permanece disponible aunque la recomendación automática sea cero; se abre una solicitud editable con cantidad inicial de al menos una unidad de inventario. Ver detalle de compra permanece disponible para cada estado, junto a las acciones del proceso.

La vista geográfica de trazabilidad selecciona un movimiento concreto y muestra solamente su origen y destino. Los movimientos nuevos conservan las coordenadas conocidas al registrar la operación. Para registros antiguos se informa si se usan ubicaciones actuales. No se inventan coordenadas de proveedores; el usuario puede completar los extremos que faltan. La ruta dibujada es una referencia vial y no una trayectoria GPS observada.

El directorio admite bodegas, oficinas, puntos de venta, clientes, clientes futuros, plantas de producción y puntos de servicio. El formulario de próxima atención/visita se muestra exclusivamente para clientes futuros; al guardar una clasificación diferente se elimina esa fecha del registro editable. Bodegas, oficinas y plantas propias no requieren un contrato de cliente para aparecer como destinos de una planificación.


## Portabilidad de esta entrega

El servidor de Sites y sus enlaces de archivos fueron sustituidos por `server/index.mjs`, Supabase Auth, tablas `nexo_*` y almacenamiento privado. La lógica de dominio permanece en `src/lib/`. Las exportaciones reales Excel y PDF se implementan en `src/services/reports.ts`. Véase el README para activar la conexión y `docs/API.md` para los límites del backend del reto.
