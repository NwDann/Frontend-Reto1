# Activar Google Maps en Optilogic

El mapa sin clave está disponible con Leaflet/OpenStreetMap. Los enlaces a Google Maps y Waze tampoco requieren una clave de tu proyecto. Una clave es necesaria para el **mapa nativo de Google dentro de la app**.

## Configurar Google Cloud

1. Crea o selecciona un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita facturación y **Maps JavaScript API** en ese proyecto. Revisa sus precios/cuotas y configura las alertas de presupuesto que necesites.
3. Crea una API key. Aplica restricción de aplicación **Websites / HTTP referrers**, por ejemplo `http://localhost:5173/*`, `http://127.0.0.1:5173/*` y `https://tu-dominio/*`.
4. Restringe la clave a **Maps JavaScript API**. El código actual no necesita Places, Geocoding o Routes API.
5. Para los marcadores avanzados, crea un Map ID de JavaScript y cópialo. El código usa `DEMO_MAP_ID` si lo dejas vacío, útil para probar; utiliza un Map ID propio al publicar.

Fuentes: [configurar clave y facturación](https://developers.google.com/maps/documentation/javascript/get-api-key), [restricciones de seguridad](https://developers.google.com/maps/api-security-best-practices), [marcadores avanzados y Map ID](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).

## Variables y archivos exactos

En `.env`, en la raíz del proyecto:

```env
VITE_MAP_PROVIDER=google
VITE_GOOGLE_MAPS_API_KEY=TU_CLAVE_DE_MAPS_JAVASCRIPT
VITE_GOOGLE_MAPS_MAP_ID=TU_MAP_ID
```

Reinicia `npm run dev`. Si ya guardaste preferencias de mapa en ese navegador, selecciona **Google Maps** en Configuración y guarda. Para producción, declara estas variables en el entorno de compilación y vuelve a ejecutar `npm run build`.

| Archivo | Función |
| --- | --- |
| `src/services/config.ts` | Lee `VITE_GOOGLE_MAPS_API_KEY`, proveedor y Map ID |
| `src/services/google-maps.ts` | Carga Maps JavaScript de forma asíncrona y reporta problemas de clave/conexión |
| `src/components/LiveMap.tsx` | Crea el mapa, marcadores avanzados, selección por clic, ajuste de vista y línea de referencia |
| `src/components/Planner.tsx` | Conserva el origen y el orden optimizado; decide si consultar OSRM |
| `src/services/roads.ts` | Solicita matriz/recorrido al servidor OSRM seleccionado |

La clave es visible en el navegador por diseño; las restricciones de API y dominio son necesarias. Nunca la sustituyas por una clave privada de Supabase o una contraseña de base de datos.

## Qué cambia y qué permanece

El mapa nativo muestra calles de Google y permite seleccionar coordenadas. Su carga es explícita mediante el botón de la vista y puede generar consumo de Google Maps Platform. Los marcadores usan las ubicaciones disponibles; no se inventa una bodega o una clasificación de cliente.

El cálculo vial actual utiliza OSRM. Su casilla informa que se enviarán el origen y destinos a ese proveedor al comparar. El precio sugerido y la selección de escenario son cálculos de frontend con sus supuestos. Este proyecto no usa Directions/Routes API de Google ni tráfico en vivo; activar Google Maps no modifica automáticamente la fuente de tiempos de viaje.

Si más adelante quieres tiempos de Google Routes, integra ese servicio por su contrato oficial, con controles de facturación y las credenciales adecuadas en el servidor. No mezcles una clave privada de servidor con variables `VITE_*`.

## Problemas comunes

- Mapa no habilitado: verifica que la preferencia de Configuración sea Google y pulsa el botón para cargarlo.
- Clave rechazada / watermark: revisa API habilitada, facturación y referrer exacto, incluido el dominio/puerto.
- Cambiaste `.env` y no se aplica: reinicia Vite o reconstruye la app publicada.
- Mapa correcto pero sin línea: el mapa y el cálculo vial son servicios distintos; activa OSRM y comprueba su disponibilidad.
- Sin coordenadas del cliente: completa el punto de servicio en Ubicaciones mediante el PATCH de la API.

La implementación se entregó sin una clave del usuario; la carga con una clave y su facturación necesitan verificarse en su proyecto Google Cloud.
