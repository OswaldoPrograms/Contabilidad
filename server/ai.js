const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 20;
const SYSTEM_PROMPT = 'Eres el asistente de la aplicación "Mi Asistente". En esta etapa solo puedes conversar y responder preguntas. No afirmes que puedes crear tareas, modificar datos, consultar la base de datos ni ejecutar acciones, porque todavía no tienes herramientas para hacerlo.';

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
        ...(process.env.OPENROUTER_SITE_NAME ? { 'X-Title': process.env.OPENROUTER_SITE_NAME } : {})
      },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...validateMessages(messages)] })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `OpenRouter devolvió HTTP ${response.status}`);
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter no devolvió una respuesta de texto');
    return content.trim();
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw new Error('La solicitud al modelo tardó demasiado');
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { chat, validateMessages, MAX_MESSAGE_LENGTH, MAX_HISTORY_MESSAGES };