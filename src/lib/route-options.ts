export const RISK_OPTIONS = {
  weatherRisk: [
    "Despejado o nublado · buena visibilidad",
    "Llovizna ocasional",
    "Lluvia moderada",
    "Lluvia intensa",
    "Niebla densa o visibilidad reducida",
    "Condiciones severas · tormenta o inundación",
  ],
  roadRisk: [
    "Vía en buen estado y señalizada",
    "Desgaste leve o tramos irregulares",
    "Baches o señalización incompleta",
    "Obras o desvíos importantes",
    "Deterioro severo o acceso difícil",
    "Afectación crítica · validar acceso antes de salir",
  ],
  nightRisk: [
    "Sin conducción nocturna",
    "Hasta 20% del recorrido de noche",
    "Más de 20% y hasta 40% de noche",
    "Más de 40% y hasta 60% de noche",
    "Más de 60% y hasta 80% de noche",
    "Más de 80% del recorrido de noche",
  ],
} as const;
export const riskOptionLabel = (key: string, value: number) =>
  key in RISK_OPTIONS
    ? RISK_OPTIONS[key as keyof typeof RISK_OPTIONS][value] || String(value)
    : String(value);
