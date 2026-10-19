# Probar la lectura con pantalla apagada — 2.1

## En Android

1. Descargar `Lector-2.1.0-Android-TV.apk` desde [la versión 2.1](https://github.com/AlejandroPico/Lector/releases/tag/v2.1.0) e instalarlo como actualización. No desinstalar la versión anterior si se quieren conservar sus libros y notas locales.
2. Abrir un libro en la **aplicación instalada**, ir a Voz y elegir **Voces del sistema (sin coste)**. Escoger una voz disponible del dispositivo.
3. Pulsar reproducir y esperar a oír la lectura. Bloquear el móvil y dejar que avance varias frases y, si es posible, un cambio de capítulo.
4. Abrir la persiana de notificaciones o los controles multimedia del bloqueo. Deben mostrar el libro, capítulo y la cubierta incluida en el archivo, con pausa/reanudación y retroceso. El diseño exacto de la tarjeta y los controles visibles varía entre versiones de Android; expandirla si no aparecen todos. El retroceso puede figurar como acción adicional de la sesión multimedia.
5. Probar pausa durante unos segundos y reanudar sin abrir Lector. Pulsar retroceso varias veces: cada toque debe acumular aproximadamente diez segundos. Volver a la aplicación y comprobar el estado del botón y el punto de lectura. Si se estaba consultando otra página, se conserva y «Volver al punto de lectura» sigue disponible.

También conviene probar auriculares: desconectarlos debe pausar la narración. Una llamada u otra aplicación que reclame el audio también puede pausarla. Se libera el bloqueo de CPU al pausar o detener; no se mantiene la pantalla encendida.

El avance se conserva en el almacenamiento privado de Android aunque el WebView esté suspendido. Si el sistema finaliza el proceso, no se reproduce de nuevo sin intervención: al reabrir ese libro se recupera el último punto guardado, si es posterior al guardado por la interfaz. No se envía el libro a un servidor nuevo ni se crean descargas.

## Qué cubre esta entrega

| Modalidad | Alcance |
| --- | --- |
| APK Android / voces del sistema | Cola nativa completa, controles de sistema y reproducción entre capítulos independiente de JavaScript. |
| Chrome, Edge, PWA | Conservan Web Speech y las limitaciones de suspensión del navegador; instalar la web desde Chrome no instala este servicio nativo. |
| Voces API / Piper | Conservan el reproductor existente. La generación y el encadenamiento dependen de JavaScript; esta versión no garantiza continuidad tras bloquear el móvil. No genera por adelantado un libro de pago. |
| iPhone/iPad | No se modifica el servicio de audio de iOS en esta entrega. |

La calidad de voz depende del motor instalado. Esta entrega no incorpora las voces en línea exclusivas de Edge ni inicia suscripciones. El retroceso de TTS es **aproximado**: usa longitud del texto, palabras y velocidad configurada; puede cruzar frases y capítulos, pero no equivale a buscar exactamente diez segundos en un MP3.

Los cambios de voz, velocidad y tono se aplican a los fragmentos posteriores sin cortar la frase actual. La cola preparada conserva las pronunciaciones y divisiones de personajes con las que comenzó; tras editar el texto de esas reglas o sus asignaciones, detener e iniciar para preparar una cola actualizada. Los cambios de maquetación y navegación no reemplazan la cola ni detienen la voz.

## Comprobación reproducible

- Pruebas Java del cursor: cambio de fragmentos, límites, retroceso repetido entre capítulos, velocidad y respeto de palabras.
- Pruebas JavaScript del puente: entrega completa, sincronización tras suspensión, errores, cancelación y callbacks antiguos.
- Pruebas de navegador con un servicio controlado: todas las frases/capítulos preparados, subcapítulos correctos, cambios de vista sin reinicio, controles sincronizados y navegación manual independiente.
- Prueba instrumentada Android: servicio, MediaSession, notificación y pantalla apagada reales, con **motor de síntesis controlado**. Se desacopla el cliente y se simulan las finalizaciones del motor para verificar que el servicio avanza solo; se prueban los botones de la notificación y de MediaController, metadatos, portada y liberación de recursos. Esta prueba no acredita la calidad audible de las voces de un teléfono físico.

La publicación espera a las comprobaciones de navegador, compilados y emuladores. La prueba final de escucha y comportamiento del fabricante corresponde al móvil en el que se va a utilizar; si falla, anotar modelo, versión de Android, motor/voz y si fue en APK o navegador.

Referencias de implementación: [audio de fondo Android](https://developer.android.com/media/platform/mediaplayer/background), [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech) y [foco de audio en Android 15](https://developer.android.com/about/versions/15/behavior-changes-15#fgs-audio-focus).
