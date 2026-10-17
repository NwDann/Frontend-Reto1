# Adaptación del modelo 4ROPOA

Nota de portabilidad: este documento conserva la correspondencia histórica del modelo. El comportamiento vigente y los datos automáticos de flota están descritos en `operacion-nexo.md` y cubiertos por las pruebas del proyecto.

Referencia del usuario: Modelo 4ROPOA - Versión Limpia.xlsm. El archivo original se leyó sin editarlo ni ejecutar macros.

| Referencia | Aplicación en Nexo |
| --- | --- |
| Planificación del viaje C4:C19 | Bodega, destinos geográficos, vehículo, conductores, carga y guías de limpieza. |
| Planificación C24:C29 | Combustible USD/galón, km/galón, conductores, alimentación, peajes y otros gastos. |
| Planificación C33:C36 | Galones = km / rendimiento × vehículos. Combustible = galones × precio. Total = suma de los componentes identificados. |
| Planificación C37:C40 | Contribución del servicio, margen, costo por km y costo por tonelada. El margen de un servicio de limpieza también descuenta sus otros costos, ingresados por el usuario. |
| Planificación C41 | CO₂ = galones × factor editable. El 10.21 inicial procede del ejemplo del archivo; no se presume un factor universal para todos los combustibles. |
| Planificación C42 | Ingreso mínimo del servicio = (logística + otros costos) / (1 − margen objetivo). |
| Tiempo y riesgo C20:C23 | Conducción, atención por parada, descansos, disponibilidad del operador, salida y cierre del circuito. |
| Tiempo y riesgo C26:C35 | Factores declarados de carretera, clima, noche, carga, experiencia, revisión técnica y velocidad referencial. Se evitan comparaciones de texto que puedan omitir una condición. |
| Mantenimiento | Reserva editable por km y condición declarada de mantenimiento previo. |
| Seguros y comunicación C67 | Costos fijos mensuales por vehículo, asignados a los viajes mensuales; seguro de carga adicional por circuito. |
| KPIs logísticos | Costo por entrega, km y tonelada, ocupación por peso y volumen, retorno en vacío, cumplimiento de plazo y OTD declarado del operador. |
| Sostenibilidad 4R | Retornos con carga, emisiones estimadas y consolidación de destinos. No se fabrica un índice 4R ni un historial de cumplimiento. |

## Diferencias por modalidad

Flota propia incluye combustible, pago fijo y horario de conductores, alimentación, peajes, otros gastos, reserva de mantenimiento, fijos asignados y seguro de carga por viaje. Los fijos ingresados deben excluir rubros que ya se hayan incluido en otros componentes.

Servicio externo incluye tarifa base, tarifa por km, tarifa por parada y recargos. Combustible, conductor, peajes y seguros internos no se suman otra vez. Para una cotización cerrada, la tarifa variable por km y por parada se dejan en cero.

Los proveedores de insumos tienen catálogos de producto, precio, plazo y pedido mínimo. Una solicitud solo permite un proveedor que tenga una oferta registrada para ese producto. El precio vigente se conserva en la solicitud; un cambio posterior de catálogo no revaloriza una compra anterior.

## Cartografía y alcance

El mapa de selección usa Leaflet 1.9.4 con calles de OpenStreetMap, atribución visible y enlaces de ubicación/recorrido a Google Maps. No se presenta como un mapa nativo de Google. Una integración nativa de Google requiere una clave de Maps Platform.

Al generar escenarios puede consultarse una matriz vial OSRM. Si no está disponible, se señala el uso de aproximaciones geográficas. El mapa dibuja un recorrido vial de referencia cuando el proveedor responde; no suministra tráfico en vivo, restricciones para vehículos pesados ni validación de mercancías peligrosas.

El algoritmo evalúa secuencias de hasta siete destinos para cada modalidad. Primero intenta cumplir capacidad, requisitos declarados y plazo. Costo prioriza el costo; tiempo prioriza la espera ponderada (peso 4 a destinos urgentes); riesgo prioriza el riesgo declarado; equilibrio usa 55% costo, 30% tiempo y 15% riesgo. Entre secuencias de una misma modalidad el criterio temporal es la espera de atención; entre modalidades el criterio temporal del equilibrio es el tiempo total del circuito.

Si hay varios vehículos, se modela el mismo circuito para cada uno con carga agregada y costos multiplicados. No se resuelve un problema de asignación de flota con rutas independientes.

## Conciliación de referencia

Con 540 km, 10 km/galón, un vehículo, un conductor, combustible 3.2 USD/galón, pago de conductor 20 USD, alimentación 15 USD, peajes 15 USD y otros 5 USD, sin gastos adicionales:

- 54 galones; combustible 172.80 USD.
- Total logístico 227.80 USD.
- Ingreso 350 USD; contribución 122.20 USD y margen 34.9142857%.
- Emisiones al factor de referencia: 551.34 kg.
- Ingreso mínimo a margen 20%: 284.75 USD.

Este caso está cubierto por una prueba independiente que verifica los resultados del ejemplo del archivo.
