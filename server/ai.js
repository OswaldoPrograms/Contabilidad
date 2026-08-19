const tools = require('./tools');
const time = require('./time');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 5;
const SYSTEM_PROMPT = 'Eres Luna, el asistente de la aplicación "Mi Asistente". Dispones de herramientas reales para crear, buscar, editar, completar y eliminar tareas, y para guardar y consultar personas. Usa las herramientas cuando el usuario pida una acción o información de sus datos. Para crear_tarea solo es imprescindible un título o acción identificable: ejecuta primero y no preguntes por hora, prioridad, descripción, recordatorio, etiquetas ni tipo. Si el usuario proporciona una fecha sin hora, crea la tarea sin hora; si omite los demás campos, usa priority medium, type task, description vacío, reminder none y tags []. Si falta una fecha fundamental para una cita o existe una ambigüedad que pueda cambiar significativamente la acción, haz solo esa pregunta imprescindible. Las recomendaciones son opcionales, deben hacerse después de ejecutar la acción y nunca bloquearla. Tras ejecutar una acción, responde en una o dos frases y haz como máximo una recomendación o pregunta adicional sobre uno o dos datos realmente útiles para el contexto; elige los más relevantes y no enumeres alternativas. No digas que falta la hora ni uses frases genéricas como "¿quieres añadir algo más?", "¿quieres cambiar algo?" o "¿quieres crear otra?". Para personas, guarda inmediatamente el nombre y el contexto disponible sin pedir teléfono, correo u otros campos. La información puede completarse progresivamente mediante crear_persona y editar_persona. Antes de crear una persona, usa buscar_personas cuando haya una posibilidad razonable de coincidencia; si la búsqueda devuelve una coincidencia clara, actualízala en lugar de crear otra. Si devuelve varias personas plausibles, pregunta cuál es antes de modificar o relacionar datos. Si devuelve una sola coincidencia clara, usa su identificador internamente. En mensajes consecutivos, pronombres como "su" o "él/ella" se refieren a la persona recién mencionada cuando el contexto inmediato es claro; busca esa persona y actualízala sin volver a preguntar. Para una tarea con personas, busca primero cada persona por nombre y pasa sus identificadores en personIds; relaciona todas las personas mencionadas. Para consultar tareas de una persona, busca primero la persona y luego usa buscar_tareas con personaId. Nunca cargues ni solicites la lista completa de personas: consulta solo lo relevante. Para una cita médica o dentista prioriza hora o lugar; para una entrega escolar prioriza materia o recordatorio; para llamar a alguien prioriza el teléfono si no está registrado; para una reunión prioriza hora o lugar; para un pago prioriza importe o fecha límite; para una compra prioriza lugar o lista relacionada; para un evento prioriza hora o ubicación. Si ya conoces un dato mediante etiquetas, personas, proyectos, memoria o la tarea existente, no lo vuelvas a pedir ni recomendar. Antes de recomendar información adicional, consulta las herramientas disponibles cuando sea razonable. Nunca muestres nombres ni valores internos de campos como appointment, medium, none, priority, tags, type, personId o personIds salvo que el usuario pida detalles técnicos; tampoco describas los valores predeterminados. Mantén las respuestas cortas, naturales y enfocadas en la acción realizada. Interpreta solicitudes como "agenda", "crea" o "recuérdame" como una petición de crear la tarea cuando el título o acción sea identificable. Convierte expresiones relativas como "mañana", "pasado mañana" o "el viernes" a una fecha absoluta YYYY-MM-DD usando la fecha actual. Nunca afirmes que una acción ocurrió si la herramienta devolvió un error o no se ejecutó.';
const TAGGING_PROMPT = 'Al crear o editar una tarea, infiere automáticamente pocas etiquetas útiles a partir del título, descripción y contexto: normalmente entre 3 y 6, nunca una por cada palabra. Antes de inventar una etiqueta, usa buscar_etiquetas con el concepto cuando sea razonable y reutiliza una etiqueta existente si tiene el mismo significado; no crees variantes como #materia-contabilidad si ya existe #contabilidad. Prefiere minúsculas, sin acentos, sin espacios y con guiones, por ejemplo #contabilidad, #entrega, #reporte-costos. No etiquetes fechas, horas, estado, valores predeterminados ni palabras genéricas como tarea o crear. Para personas usa además la relación estructurada personIds y, solo si la persona está relacionada, una etiqueta #persona:nombre-corto; para proyectos conserva projectId y puede añadir #proyecto:nombre. No preguntes por etiquetas salvo que el usuario quiera controlarlas. Las etiquetas que el usuario indique explícitamente deben conservarse; al editar, añade etiquetas nuevas sin borrar las anteriores salvo petición clara. Para consultas por área, contexto o acción, usa buscar_tareas con etiqueta cuando sea apropiado y no inventes resultados.';
const ALERT_PROMPT = 'Puedes consultar_alertas cuando el usuario pregunte qué debe atender, cómo está su semana o pida recomendaciones. Las alertas provienen de datos reales y el motor ya detectó candidatos; explica solo hechos presentes en sus resultados y ofrece recomendaciones sin cambiar, mover, completar ni crear tareas sin permiso. No inventes duración, dificultad, importes ni prioridades.';
const REMINDER_PROMPT = 'Puedes crear_recordatorio_relativo, crear_recordatorio, buscar_recordatorios, editar_recordatorio, eliminar_recordatorio y posponer_recordatorio. Para anticipaciones 15m, 1h o 1d usa siempre crear_recordatorio_relativo: el backend calcula el instante en la zona de la aplicación. No calcules tú la hora final ni envíes dateTime para esos casos. Si la tarea no tiene hora, 15m y 1h deben producir un error solicitando la hora; 1d sí puede funcionar usando la fecha. Usa la continuidad inmediata para expresiones como "Avísame una hora antes" y evita duplicados. Los recordatorios son distintos de las alertas y no debes crear, mover ni posponer tareas al gestionarlos.';

function configurationError() {
  if (!process.env.OPENROUTER_API_KEY) return 'Falta configurar OPENROUTER_API_KEY en el archivo .env';
  if (!process.env.OPENROUTER_MODEL) return 'Falta configurar OPENROUTER_MODEL en el archivo .env';
  return null;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_HISTORY_MESSAGES) throw new Error(`messages debe contener entre 1 y ${MAX_HISTORY_MESSAGES} mensajes`);
  return messages.map(message => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > MAX_MESSAGE_LENGTH) throw new Error('Cada mensaje debe tener role user/assistant y contenido válido de hasta 4000 caracteres');
    return { role: message.role, content: message.content.trim() };
  });
}

async function chat(messages) {
  const error = configurationError();
  if (error) throw new Error(error);
  const localParts = time.getLocalParts();
  const conversation = [{ role: 'system', content: `${SYSTEM_PROMPT} ${TAGGING_PROMPT} ${ALERT_PROMPT} ${REMINDER_PROMPT} Zona horaria del usuario: ${time.APP_TIMEZONE}. Fecha local actual: ${time.getToday()}. Hora local actual: ${localParts.hour}:${localParts.minute}.` }, ...validateMessages(messages)];
  let dataChanged = false;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await requestModel(conversation);
    const message = response.choices?.[0]?.message;
    if (!message) throw new Error('OpenRouter no devolvió un mensaje válido');
    if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
      if (typeof message.content !== 'string' || !message.content.trim()) throw new Error('OpenRouter no devolvió una respuesta de texto');
      return { message: message.content.trim(), dataChanged };
    }

    conversation.push(message);
    for (const toolCall of message.tool_calls) {
      const result = await tools.execute(toolCall.function?.name, toolCall.function?.arguments);
      dataChanged = dataChanged || result.dataChanged === true;
      conversation.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  throw new Error('El modelo no terminó de procesar las herramientas');
}

async function requestModel(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const requestHeaders = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
    ...(process.env.OPENROUTER_SITE_NAME ? { 'X-Title': process.env.OPENROUTER_SITE_NAME } : {})
  };
  const requestBody = { model: process.env.OPENROUTER_MODEL, messages, tools: tools.tools, tool_choice: 'auto' };
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `OpenRouter devolvió HTTP ${response.status}`);
    return data;
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw new Error('La solicitud al modelo tardó demasiado');
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { chat, validateMessages, MAX_MESSAGE_LENGTH, MAX_HISTORY_MESSAGES };