# Activar Google Cast en Lector 2.13

La integración incorpora el receptor **92B106F9** registrado por el titular, para **Chrome de escritorio y el APK Android**. Su estado actual es **Unpublished**: solo puede abrirse en los dispositivos de prueba que autorice el titular. El 21 de octubre de 2026 el titular confirmó reproducción desde el PC con Piper en su altavoz Google Home registrado, e informó de errores intermitentes al conectar. Quedan pendientes su diagnóstico, la escucha prolongada y las pruebas en otros dispositivos. No utiliza puente Cast local, direcciones IP, subida pública de libros ni un receptor ajeno. Requiere audio generado por **Piper o una API**; las voces de `speechSynthesis`, incluidas las de Edge, no entregan un archivo de audio transmisible.

El registro de Cast no compra voces ni incluye uso de APIs de inteligencia artificial. Las tarifas del proveedor de voz son independientes; Piper es una alternativa local cuando se dispone de un equipo que lo ejecute.

## Registro del proyecto (ya realizado) y dispositivos de prueba

1. Abre la [consola Google Cast](https://cast.google.com/publish/) con la cuenta que será titular del proyecto. El registro es independiente de Google Play. Google indica un pago único de **5 USD**, no reembolsable, y hasta 48 horas de tramitación. Revisa el importe que te muestre Google antes de pagar. No compartas aquí contraseña, tarjeta ni códigos de acceso. [Registro oficial](https://support.google.com/cast-developer/answer/4512496?hl=es).
2. Una vez habilitada la cuenta, elige **Add New Application → Custom Receiver**.
3. Pon **Lector** como nombre y esta dirección como URL del receptor: **https://alejandropico.github.io/Lector/receptor.html**. Es una página pública vacía de contenido personal: la lectura llega después desde el emisor.
4. Marca **Supports casting to audio-only devices** para incluir altavoces Google Home. Deja **Supports relay casting** desmarcado en esta primera prueba.
5. Guarda. Copia el **Application ID** que aparezca y pásaselo a Codex. Es un identificador público del proyecto, no una clave de cuenta. No uses el ID del receptor estándar ni el de una aplicación de ejemplo.
6. Para probar antes de publicar, añade un dispositivo en **Devices → Add New Device**, usando su número de serie de Cast. En Chromecast con Google TV se necesita el número de software de Cast. La consola permite obtenerlo enviando su propia página al dispositivo; un altavoz lo lee en voz alta. Espera a **Ready for Testing** y reinicia ese dispositivo. [Aplicaciones y dispositivos: guía oficial](https://developers.google.com/cast/docs/registration).

No hace falta publicar el receptor para esta primera prueba en el dispositivo registrado. La publicación para el resto de usuarios se realiza después de verificar la reproducción física, completar los datos que pida Google y decidirlo expresamente. [Dispositivos de audio](https://developers.google.com/cast/docs/audio).

En el formulario mostrado por el titular, dejar **Android TV Application Details → Package Name** vacío: esta versión usa el receptor web y no incorpora un receptor nativo Cast Connect. El APK compatible con TV no equivale a implementar Cast Connect. **Guest Mode** queda desmarcado para la primera prueba en la red doméstica. [Receptor nativo Android TV](https://developers.google.com/cast/docs/android_tv_receiver/core_features).

## Integración del identificador

- El identificador ya está incorporado en `config/cast.json`; se genera la misma configuración para Android al compilar. El lector no tendrá un campo técnico para que cada usuario lo configure.
- Comprobar que el receptor público se descarga correctamente. El SDK oficial descubre dispositivos; el botón Cast aparece únicamente con una plataforma y configuración válidas. No se sustituye por una lista propia.
- Probar contigo un fragmento con Piper o una API, pausa/reanudación, desconexión, portada y capítulo. Los SDK simulados de las pruebas no acreditan descubrimiento o reproducción en un Google Home real.

## Cómo se utilizará

En Chrome de escritorio o en el APK Android, elige Piper o una API en Voz. Pulsa el icono Cast, selecciona el dispositivo oficial y comienza a leer. Si ya estaba leyendo, se cambia de salida desde el siguiente fragmento completo. Cancelar el selector conserva la salida local. Pausa y reanuda desde el botón habitual. Pulsa Cast otra vez para desconectar; la narración remota se detiene y no pasa por sorpresa al altavoz local.

Para comprobar esta integración usa el icono Cast **dentro de Lector**. El panel multimedia general de Chrome tiene sus propias opciones y no sustituye esta prueba.

Seleccionar Piper no instala ni inicia su motor. Antes de emitir, sigue la [preparación de voz local](voz-local/README.md), mantén el motor iniciado, pulsa **Buscar voces locales** y comprueba que lee por el PC sin emitir. Chrome puede pedir permiso de acceso a la red local. Un error «Failed to fetch» al buscar voces o generar audio puede indicar que el motor no está iniciado o que el navegador bloquea el acceso; por sí solo no identifica un fallo de Cast. La voz Piper instalada es distinta de las voces del navegador y su calidad debe valorarse escuchándola.

El emisor debe seguir abierto para generar y enviar los fragmentos siguientes. Esta primera integración **no garantiza continuidad con el teléfono bloqueado**, ni reproducción remota autónoma del libro completo. No es duplicación de pantalla. El receptor de TV muestra título, autor, capítulo, cubierta pequeña y el fragmento actual. Los altavoces reproducen audio. Un televisor sin Google Cast necesita un Chromecast compatible; Matter, Alexa, AirPlay, iOS Cast y emisión desde Electron no se implementan en esta entrega.

## Diseño y límites verificables

Canal propio `urn:x-cast:io.github.alejandropico.lector.audio`, versión 1. Fragmentos de hasta 8 MiB, partes de 12 KiB con confirmación y SHA-256 del audio completo antes de reproducir. Solo se envían metadatos permitidos; nunca claves, URL del proveedor, credenciales, notas ni el EPUB. La cubierta JPEG se limita a 16.000 caracteres; no se cargan imágenes remotas del libro. El receptor usa texto inerte, una única transferencia y un propietario por sesión; rechaza órdenes ajenas, partes fuera de orden, integridad incorrecta, exceso de tamaño y transferencias vencidas. Cada fragmento se reproduce con el reproductor multimedia del receptor Cast. Los archivos de audio se mantienen en memoria y las URL se revocan al detener o sustituir el fragmento.

El límite de los mensajes oficiales de Cast es 64 KiB; se usan mensajes menores y confirmaciones para no saturar el canal. Esta transferencia por mensajes necesita validación de latencia y memoria en los modelos físicos antiguos antes de declararla apta para una escucha prolongada. [Mensajes personalizados](https://developers.google.com/cast/docs/web_receiver/core_features), [SDK web](https://developers.google.com/cast/docs/web_sender/integrate), [SDK Android](https://developers.google.com/cast/docs/android_sender/integrate).
