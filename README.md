# Lector

Un lector de libros a toda pantalla, sin cabeceras decorativas ni tarjetas alrededor del texto. Dos columnas por defecto, controles discretos en la esquina superior derecha y un índice lateral que se puede ocultar.

## Primera versión

- EPUB 2/3, MOBI, AZW3, Word `.docx`, PDF con texto seleccionable y TXT.
- Índice jerárquico, búsqueda, portada e imágenes ampliables. Notas originales del EPUB en ventana flotante.
- Una, dos o tres columnas; fuente, tamaño, anchura, interlineado, espacio entre párrafos y separación de columnas. En pantallas pequeñas se usa una sola columna.
- Temas mañana, tarde, noche y confort. Tema automático por la hora del dispositivo: mañana de 07:00 a 18:00, tarde de 18:00 a 22:00, noche en el resto del día.
- Modo zen, pantalla completa y transición suave opcional. Respeta la preferencia de movimiento reducido.
- Voz del navegador con selector de voz, velocidad, tono, pausa y resaltado. Continúa entre capítulos y puede comenzar desde una selección.
- Notas sobre selecciones, marcadores, exportación de notas y biblioteca local. Recupera el punto de lectura al reabrir un archivo idéntico, incluso si cambia su nombre.
- Glosario local básico; importación de diccionarios propios en JSON y enlace para consultar una palabra en Wikcionario.
- Conexión opcional con OpenAI o un servicio compatible con su endpoint de generación de voz.

## Abrir en el equipo

Requiere Node.js 24 o superior.

```sh
npm install
npm run dev
```

Abre la dirección que aparece en la terminal. El selector de documento aparece al iniciar; también puedes arrastrar un archivo sobre el lector. El navegador requiere una interacción del usuario para abrir su selector nativo, de modo que el botón «Abrir un libro» inicia la elección del archivo.

```sh
npm test
npm run test:browser
npm run build
npm run preview
```

En Windows las pruebas usan Chrome instalado. En Linux y en GitHub Actions usan Chromium de Playwright; instala el navegador de pruebas con `npx playwright install chromium` si hace falta. `dist/` contiene la aplicación estática compilada; debe servirse por HTTP/HTTPS, no abrirse como `file://`.

## GitHub Actions y publicación

`checks.yml` comprueba lógica, importación, navegación, persistencia, tipografía, imágenes, notas y voz mediante pruebas automatizadas. Las llamadas de API de las pruebas están simuladas y no generan cargos.

`pages.yml` compila y publica `dist/` al actualizar `main`. Para utilizarlo, el repositorio debe tener **Settings → Pages → Source → GitHub Actions**. La URL la devuelve el paso de publicación de GitHub; añadir el flujo no confirma por sí solo que Pages esté activado ni que el despliegue haya terminado.

## Datos y privacidad

Los archivos se procesan en el navegador. La opción de guardar el archivo está activada por defecto y utiliza IndexedDB. Puedes desmarcarla: se seguirán guardando sus notas y posición, pero tendrás que volver a elegir el archivo al reabrir la aplicación. La identidad del documento se calcula por su contenido, no solo por el nombre.

Los ajustes se guardan en localStorage y los libros/notas en IndexedDB, separados por origen. La biblioteca de la vista previa local y la de un sitio publicado son distintas. No hay cuenta, sincronización ni subida de libros a un servidor. El almacenamiento del navegador puede borrarse o agotarse; exporta las notas que quieras conservar y mantén tus archivos originales.

El texto importado se limpia con DOMPurify y se bloquean scripts, formularios, recursos remotos de las páginas e imágenes de seguimiento. Una política CSP añade otra capa de protección. Las fuentes son del sistema y no se descargan de servicios externos.

## Voz

La opción predeterminada utiliza `speechSynthesis`: no hay cargos de API de esta aplicación. Las voces y su calidad dependen del navegador, el sistema y sus servicios; algunas necesitan conexión. Los eventos de límite de palabra también dependen de la voz: si no se emiten, el resaltado permanece en la frase.

En los ajustes de voz puedes elegir **OpenAI / API compatible**, indicar la URL, modelo, voz, instrucciones y tu clave. La clave se mantiene solo en memoria durante la sesión y se envía en el encabezado de autorización al servicio que hayas indicado. Nunca se guarda en el repositorio, la biblioteca ni localStorage. Esta aplicación personal hace la petición desde el navegador; un servicio distinto debe permitir CORS. También admite un proxy propio en localhost.

La API se factura por uso aparte de la suscripción de ChatGPT. Solo se solicita audio al pulsar leer o probar voz tras seleccionar ese servicio. Cada petición contiene un fragmento de hasta 1.600 caracteres. La generación es secuencial y mantiene una caché limitada de los últimos 80 fragmentos durante la sesión; después de cerrar o recargar, generar de nuevo puede volver a tener coste. El resaltado de API es por frase, ya que este endpoint no devuelve tiempos por palabra. Se bloquean redirecciones de las peticiones para no reenviar la clave a otro destino.

Esta versión permite una voz por lectura, instrucciones de interpretación y selección de proveedor. **El análisis de personajes, el reparto automático de voces y la exportación de un audiolibro completo todavía no están implementados.** Tampoco se ha validado la calidad de una voz externa con una clave real; las comprobaciones de integración usan respuestas simuladas.

Referencia: [generación de voz de OpenAI](https://developers.openai.com/api/docs/guides/text-to-speech).

## Límites de importación

- Archivos de hasta 100 MB. EPUB y MOBI/AZW3 deben estar sin DRM; no se elimina la protección.
- Word antiguo `.doc` debe guardarse como `.docx` antes de importarlo.
- En PDF se extrae el texto para remaquetarlo. «Ver página original» muestra la maquetación y las ilustraciones con zoom. El orden del texto puede necesitar ajustes en PDF con columnas o diseños complejos.
- Un PDF escaneado se puede visualizar, pero no narrar sin OCR; esta versión no incorpora OCR.
- Los EPUB de maquetación fija conservan su presentación y pueden no responder a todos los ajustes de tipografía/columnas.
- El glosario incluido es pequeño. Los diccionarios propios usan el formato `{"palabra": "definición"}`, con un límite de 4 MB y 50.000 entradas.
- Las animaciones de libro físico y los diseños adicionales quedan para próximas iteraciones.

## Atajos

| Acción | Tecla |
| --- | --- |
| Pasar página | ← / → o RePág / AvPág |
| Leer, pausar o continuar | Espacio |
| Modo zen | Z |
| Pantalla completa | F |
| Abrir archivo | Ctrl+O / Cmd+O |
| Cerrar ventana o salir del modo zen | Esc |

## Dependencias

Motor EPUB/MOBI y paginación: [Foliate JS](https://github.com/johnfactotum/foliate-js) (MIT). Word: [Mammoth](https://github.com/mwilliamson/mammoth.js) (BSD-2-Clause). PDF: [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0). Limpieza de HTML: [DOMPurify](https://github.com/cure53/DOMPurify) (Apache-2.0/MPL-2.0).

Se conserva el archivo de versiones `package-lock.json`. La dependencia CLI opcional de Mammoth usa una sustitución de `argparse` para evitar una cadena vulnerable de `sprintf-js`; la aplicación importa únicamente el conversor de navegador, y sus conversiones se comprueban con archivos Word reales de prueba.
