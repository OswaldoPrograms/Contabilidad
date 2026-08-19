const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

function extensionForMime(mime) { return mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : mime.includes('wav') ? 'wav' : 'webm'; }
async function transcribe({ buffer, mimeType, originalName = '' }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('El audio está vacío');
  if (buffer.length > MAX_AUDIO_BYTES) throw new Error('El audio supera el límite permitido de 20 MB');
  if (!process.env.OPENROUTER_API_KEY) throw new Error('Falta configurar OPENROUTER_API_KEY');
  const model = process.env.TRANSCRIPTION_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: [{ type: 'text', text: 'Transcribe el audio exactamente en español. Devuelve únicamente el texto transcrito, sin explicación.' }, { type: 'input_audio', input_audio: { data: buffer.toString('base64'), format: extensionForMime(mimeType || originalName) } }] }] })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `El proveedor de transcripción devolvió HTTP ${response.status}`);
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) return { text: '' };
  return { text: text.trim() };
}
module.exports = { transcribe, MAX_AUDIO_BYTES };
