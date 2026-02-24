// Labels que se muestran en el header mientras el agente procesa cada nodo
export const STATUS_LABELS: Record<string, string> = {
  router: '🔀 Clasificando intención...',
  fetch_diff_qa: '📡 Obteniendo diff de GitHub...',
  fetch_diff_review: '📡 Obteniendo diff de GitHub...',
  qa_node: '🤔 Analizando código...',
  review_node: '🔬 Ejecutando code review...',
}

// Prompts predefinidos en el sidebar para facilitar el uso del agente
export const QUICK_PROMPTS = [
  { label: '🔍 Code Review completo', text: 'Realiza un code review completo de esta rama' },
  { label: '⚠️ Vulnerabilidades', text: '¿Qué vulnerabilidades de seguridad existen en estos cambios?' },
  { label: '🏗️ Arquitectura', text: 'Explica la arquitectura general de los cambios' },
  { label: '📈 Complejidad', text: '¿Qué funciones tienen alta complejidad ciclomática?' },
  { label: '🧪 Tests faltantes', text: '¿Hay tests faltantes para la nueva funcionalidad?' },
  { label: '🔗 Imports nuevos', text: '¿Qué nuevas dependencias o imports se agregaron?' },
]

// Genera un ID único para cada mensaje del chat
export const generateId = () => {
  return Math.random().toString(36).slice(2, 10)
}