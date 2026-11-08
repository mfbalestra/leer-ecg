// Valores normales que el entrenador enseña, con la fuente de cada uno. Ningún número de este
// archivo sale de memoria: cada entrada cita la página de donde se tomó, leída el 2026-11-07.

export type Fuente = { titulo: string; url: string; cita: string }

export const FUENTES = {
  papel: {
    titulo: 'LITFL, ECG Rate Interpretation',
    url: 'https://litfl.com/ecg-rate-interpretation/',
    cita: 'The standard paper speed is 25mm/sec: 1 SMALL square (1mm) = 0.04 sec (40ms); 5 SMALL squares (5mm) = 1 LARGE square = 0.2 sec (200ms)',
  },
  calibracion: {
    titulo: 'ECGpedia, Basics',
    url: 'https://en.ecgpedia.org/wiki/Basics',
    cita: "Down left is the 'paper speed' (25 mm/s on the horizontal axis), the sensitivity (10mm/mV)",
  },
  frecuenciaMetodos: {
    titulo: 'LITFL, ECG Rate Interpretation',
    url: 'https://litfl.com/ecg-rate-interpretation/',
    cita: 'Divide 300 by the number of large squares between R-R interval. Divide 1500 by number of small squares between R-R interval.',
  },
  // El método de conteo es una sola regla (latidos contados × 60 ÷ segundos de la ventana); la
  // fuente lo muestra con una tira de 10 s × 6 y el entrenador usa una ventana de 6 s × 10.
  conteo: {
    titulo: 'LITFL, ECG Rate Interpretation',
    url: 'https://litfl.com/ecg-rate-interpretation/',
    cita: 'The number of complexes (count R waves) on the rhythm strip gives the average rate over a ten-second period. This is multiplied by 6 (10 seconds x 6 = 1 minute)',
  },
  bradicardia: {
    titulo: 'LITFL, Sinus Bradycardia',
    url: 'https://litfl.com/sinus-bradycardia-ecg-library/',
    cita: 'Sinus rhythm with a resting heart rate of < 60 bpm in adults',
  },
  taquicardia: {
    titulo: 'LITFL, Sinus tachycardia',
    url: 'https://litfl.com/sinus-tachycardia-ecg-library/',
    cita: 'Sinus rhythm with resting heart rate (HR) > 100 bpm in adults',
  },
  pr: {
    titulo: 'LITFL, PR Interval',
    url: 'https://litfl.com/pr-interval-ecg-library/',
    cita: 'The normal PR interval is between 120 – 200 ms (0.12-0.20s) in duration (three to five small squares). If the PR interval is > 200 ms, first degree heart block is said to be present.',
  },
  qrs: {
    titulo: 'LITFL, QRS Interval',
    url: 'https://litfl.com/qrs-interval-ecg-library/',
    cita: 'Normal QRS width is 70-100 ms. A QRS duration > 100 ms is abnormal. A QRS duration > 120 ms is required for the diagnosis of bundle branch block or ventricular rhythm',
  },
  ondaP: {
    titulo: 'LITFL, P wave',
    url: 'https://litfl.com/p-wave-ecg-library/',
    cita: 'Normal duration: < 0.12 s (< 120ms or 3 small squares). Amplitude < 2.5 mm (0.25mV) in the limb leads',
  },
  qt: {
    titulo: 'LITFL, QT Interval',
    url: 'https://litfl.com/qt-interval-ecg-library/',
    cita: 'QTc is prolonged if > 440ms in men or > 460ms in women. QTC = QT / √ RR',
  },
  puntoJ: {
    titulo: 'LITFL, J point',
    url: 'https://litfl.com/j-point-ecg-library/',
    cita: 'The J point is the the junction between the termination of the QRS complex and the beginning of the ST segment.',
  },
  st: {
    titulo: 'LITFL, The ST Segment',
    url: 'https://litfl.com/st-segment-ecg-library/',
    cita: 'The ST segment is the flat, isoelectric section of the ECG between the end of the S wave (the J point) and the beginning of the T wave.',
  },
} as const satisfies Record<string, Fuente>

/** Límites normales, en milisegundos y latidos por minuto. */
export const NORMAL = {
  frecuencia: { minLpm: 60, maxLpm: 100 },
  pr: { minMs: 120, maxMs: 200 },
  qrs: { maxMs: 100, bloqueoMs: 120 },
  ondaP: { maxMs: 120, maxMm: 2.5 },
  qtc: { maxHombresMs: 440, maxMujeresMs: 460 },
} as const

export type JuicioFrecuencia = 'bradicardia' | 'normal' | 'taquicardia'
export type JuicioPr = 'corto' | 'normal' | 'largo'
export type JuicioQrs = 'angosto' | 'ancho'

export function juzgarFrecuencia(lpm: number): JuicioFrecuencia {
  if (lpm < NORMAL.frecuencia.minLpm) return 'bradicardia'
  if (lpm > NORMAL.frecuencia.maxLpm) return 'taquicardia'
  return 'normal'
}

export function juzgarPr(ms: number): JuicioPr {
  if (ms < NORMAL.pr.minMs) return 'corto'
  if (ms > NORMAL.pr.maxMs) return 'largo'
  return 'normal'
}

export function juzgarQrs(ms: number): JuicioQrs {
  return ms > NORMAL.qrs.maxMs ? 'ancho' : 'angosto'
}
