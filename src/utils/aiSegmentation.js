/**
 * aiSegmentation.js - Compatibilidad sin IA
 * MediaPipe Selfie Segmenter ha sido retirado del flujo en vivo
 * para eliminar latencia, sobrecarga de CPU/GPU y cortes robóticos.
 */

export async function getSegmentationEngine() {
  return null
}

export function isSegmentationReady() {
  return false
}

export function segmentPersonFromVideo() {
  return null
}
