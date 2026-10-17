# Costos del simulador conectado y referencia 4ROPOA

Esta versión conserva la idea del modelo de planificación y costos, adaptada a las fuentes realmente disponibles. No aplica automáticamente datos de vehículos, pólizas, clima, gastos mensuales o tarifas que la API no ofrece.

## Cálculo

- Distancia/tiempo: matriz OSRM si el usuario habilita la consulta; si no, distancia geográfica × factor declarado y velocidad de referencia, marcadas como aproximación.
- Se evalúan todas las permutaciones de hasta 7 destinos y se incluye el retorno al origen elegido si corresponde.
- Tiempo total = conducción + número de destinos × minutos de descarga/verificación + pausas.
- Transporte propio = distancia / km por galón × precio de galón + tiempo total / 60 × costo horario del conductor + fijo asignado al viaje + distancia × reserva de mantenimiento + peajes declarados.
- Transporte externo = distancia × tarifa por km **o** tarifa fija por viaje, más recargos y peajes no incluidos en la cotización. No se suman combustible, conductor o mantenimiento propios al externo.
- Carga y valor de insumos = líneas de despachos pendientes seleccionados × peso, volumen y precio de su unidad registrada.
- Costo directo del servicio = transporte + insumos de los despachos + otros insumos declarados + mano de obra de limpieza + otros costos directos.
- Precio sugerido sin impuestos = costo directo / (1 − margen sobre ventas / 100).

La referencia de capacidad/conductor es la misma operación de ruta seleccionada. La API no identifica propiedad del vehículo ni proveedor externo: las dos modalidades son hipótesis de cotización, no una clasificación persistida de flota. Antes de ejecutar, verifica que la capacidad y condiciones correspondan al transportista que realmente contratarás.

## Elección

Se prioriza pasar las validaciones disponibles y el plazo. Luego se aplica costo, tiempo o puntuación equilibrada 60% costo normalizado + 40% tiempo normalizado. Las verificaciones disponibles incluyen carga vs capacidad, contrato validado y acreditación/disponibilidad del conductor. La ausencia de referencia o datos produce advertencias; no certifica habilitación, cobertura legal o seguridad del viaje.

Los planes nuevos se pueden descargar con entradas, métricas y referencias. La API no tiene un endpoint para persistir ese análisis completo, por lo que su listado de rutas muestra solo la información realmente guardada.
