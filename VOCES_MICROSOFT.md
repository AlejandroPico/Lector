# Voces de Microsoft y comprobación de Edge

## Corrección 1.9.1

- «Probar voz» usa la voz seleccionada en el menú; el reparto guardado del libro no sustituye esa prueba. La lectura del libro conserva las asignaciones de personajes activadas expresamente.
- La voz recibe su propio idioma completo, por ejemplo `es-ES`, aunque el EPUB indique solamente `es` u otro idioma.
- La selección automática prioriza la región solicitada o la región del idioma del sistema; una elección manual siempre tiene prioridad.
- Si una voz guardada ya no existe en el navegador actual, se identifica como no disponible y se pide elegir otra. No se reproduce una voz diferente sin avisar.
- El error identifica la voz y el código comunicado por el navegador. `synthesis-failed` no identifica por sí solo una causa específica.

El 15 de octubre de 2026 se comprobaron las voces Microsoft Elvira, Álvaro y Ximena Online (Natural), español de España, con Edge 155.0.4283.45 y un perfil de prueba independiente. Terminaron la síntesis real de la muestra de Lector; se comprobaron además fragmentos de un EPUB. Esto no acredita que funcione cualquier perfil, archivo, conexión o motor anunciado en la lista. No se modificó ni borró el perfil habitual del usuario.

## Si una voz continúa fallando

1. Recargar Lector y elegir explícitamente Elvira o Ximena, sin selección automática. En «Personajes y narración», revisar si el narrador tiene una voz distinta asignada; «Probar voz» ya no usa esa asignación.
2. Comparar con «Leer en voz alta» del propio Edge utilizando esa misma voz. Si también falla allí, el problema no está limitado a Lector.
3. Probar Lector y ese archivo en una ventana InPrivate de Edge. Es una comprobación con almacenamiento separado; no borra las notas ni los libros del perfil habitual. La biblioteca habitual no aparece en esa ventana y su progreso de prueba no se guarda en el perfil principal.
4. Consultar «Acerca de Microsoft Edge» para comprobar actualizaciones. La disponibilidad de las voces online depende de Edge y de la conexión con Microsoft. No es necesario borrar perfiles, cookies o claves ni reinstalar Windows para esta comprobación.

Si persiste, hacen falta el nombre completo de una voz que falle, su código de error, la versión de Edge y el resultado en su lector nativo/InPrivate. No hacen falta claves API, perfiles del navegador ni enviar un libro privado.

## Chrome, Android, Apple y voces incorporadas

`speechSynthesis` ofrece las voces que expone ese navegador o sistema. Las voces online de Edge no son fuentes o archivos de voz que Lector pueda descargar e instalar en Chrome o distribuir dentro del APK. Microsoft documenta su acceso mediante Web Speech en Edge de Windows/macOS; no lo extiende a Android/iOS con esa política.

La vía oficial para usar voces de Microsoft independientemente del navegador es **Azure Speech**. Su catálogo incluye `es-ES-AlvaroNeural` y `es-ES-ElviraNeural`, entre otras. Requiere una cuenta y recurso Speech del titular; puede integrarse en web, escritorio y móviles usando su SDK/API. En la tarifa F0, Microsoft publica una cuota de **500.000 caracteres de voces neuronales al mes**: no es lectura ilimitada y hay que comprobar la voz, región y tarifa elegidas. No se ha creado una cuenta, contratado un plan ni añadido Azure como proveedor de Lector en esta corrección. Los campos OpenAI/ElevenLabs no son adaptadores de Azure.

Los modelos de esas voces online no están incorporados al programa. Para audio local sin facturación de nube, Lector conserva su integración opcional con Piper; requiere instalar e iniciar el motor y no reproduce las voces de Microsoft.

## Referencias oficiales

- [Política de voces online de Microsoft Edge](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/configureonlinetexttospeech).
- [Voces disponibles en el navegador](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices) y [códigos de error](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisErrorEvent/error).
- [Catálogo de Azure Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support), [SDK y plataformas](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-sdk), [requisitos de su API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech) y [tarifa F0](https://azure.microsoft.com/en-us/pricing/details/speech/).

## Diagnóstico 2.5

Ajustes de voz → Voces del navegador/sistema → Diagnóstico de voces permite probar un grupo seleccionado, por idioma y región. No cambia la voz de lectura ni sustituye una que falle. Debes detener una narración activa o pausada antes de iniciar el diagnóstico. Puedes editar la muestra, cancelar o cerrar; los resultados solo duran la sesión. Un final sin error comunicado no comprueba por sí solo lo que se oye. Si funciona en un perfil nuevo y falla en el habitual, el diagnóstico no repara el perfil: compara sus extensiones y configuración mediante los pasos de este documento. No se transfieren voces online de Edge a otros motores. Las pruebas automatizadas usan motores controlados y no reproducen síntesis real en el equipo del autor.
