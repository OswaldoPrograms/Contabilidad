# Mi Asistente v0.9.0-beta

## Incluye

- Gestión de tareas, citas y eventos.
- Agenda visual interna.
- Personas y relaciones con tareas.
- Integración conversacional con Luna mediante OpenRouter.
- Tool calling para operaciones sobre SQLite.
- Etiquetas automáticas y filtrado.
- Alertas basadas en tareas y contexto.
- Zona horaria IANA configurable.
- Recordatorios reales, relativos, due y posposición.
- Entrada por voz y transcripción desde la PWA.
- Navegación independiente entre Tareas, Agenda y Personas.
- Service Worker con recursos dinámicos network-first y API fuera de caché.

## Limitaciones conocidas

- La transcripción requiere un proveedor/modelo compatible con entrada de audio.
- El micrófono requiere `localhost` o HTTPS y permiso explícito del navegador.
- No hay notificaciones push del sistema ni audio de respuesta.
- La zona horaria es global mediante `APP_TIMEZONE`.
- No hay sincronización con Google Calendar, WhatsApp ni calendarios externos.
- La aplicación conserva comportamiento beta y requiere validación manual en Android y navegadores específicos.
