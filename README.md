# Mi Asistente v0.9.0-beta

PWA de gestión de tareas con SQLite y Luna, un asistente conversacional conectado mediante OpenRouter.

## Características

- Tareas, citas y eventos.
- Agenda cronológica.
- Personas relacionadas con tareas mediante `task_people`.
- Etiquetas automáticas y búsqueda.
- Alertas y contexto.
- Recordatorios reales, relativos y posposición.
- Zona horaria IANA configurable.
- Entrada por voz y transcripción desde la PWA.
- Tool calling para acciones sobre SQLite.
- Aplicación instalable como PWA.

## Requisitos

- Node.js 18 o superior.
- npm.
- Un navegador moderno.
- Clave y modelo disponibles para OpenRouter.

## Instalación

```bash
npm install
cp .env.example .env
```

Edita `.env` y completa las variables necesarias:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
TRANSCRIPTION_MODEL=
APP_TIMEZONE=America/Mexico_City
PORT=3000
```

`TRANSCRIPTION_MODEL` es opcional; si se deja vacío, se usa el modelo configurado como fallback técnico para la transcripción.

## Ejecución

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000).

La base `server/database.sqlite` se crea y migra automáticamente en el primer arranque. No debe versionarse.

## PWA y micrófono

Desde `localhost` el navegador permite solicitar acceso al micrófono. En otros entornos se requiere HTTPS. El usuario debe conceder permiso explícito; la aplicación no escucha en segundo plano.

Para instalarla, usa la opción de instalación del navegador cuando esté disponible.

## Validación

```bash
npm run check
node --check sw.js
git diff --check
```

## Limitaciones beta

- La transcripción depende de que el proveedor/modelo configurado soporte entrada de audio.
- No hay notificaciones push, audio de respuesta, WhatsApp ni Google Calendar.
- La zona horaria es global mediante `APP_TIMEZONE`, no por usuario.
- Personas, agenda y recordatorios están preparados para uso beta, no para sincronización externa.

Esta versión es una beta (`0.9.0-beta`) y puede contener limitaciones de compatibilidad entre navegadores.
