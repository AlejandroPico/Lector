# Lector

Un lector de libros a toda pantalla, sin cabeceras decorativas ni tarjetas alrededor del texto. Dos columnas por defecto, controles discretos en la esquina superior derecha y un índice lateral que se puede ocultar.

## Versión 0.5

La biblioteca tiene un interruptor discreto para alternar títulos y portadas y una ventana ampliada accesible desde el panel lateral o los ajustes. La ventana comienza por portadas y recuerda su vista de forma independiente del lateral; ambas comparten colección y búsqueda. Los libros abiertos guardan su cubierta para el catálogo. Para carpetas de Calibre se prefiere su cubierta externa al abrir el libro elegido, y las portadas de otros libros solo se leen al pulsarlas. Si no hay cubierta externa, se obtiene del ebook seleccionado.

La primera apertura de un libro con cubierta la presenta grande y centrada, independiente de las columnas y sin alterar las posiciones del ebook. «Empezar a leer», siguiente página o Play llevan al texto. La cubierta se puede ampliar, desactivar desde Ajustes → Apariencia, y los libros ya leídos reanudan su posición.

La rueda dentada organiza las opciones por categorías. Hay 20 opciones de tema y un editor de paletas personales con vista previa, guardado, copia e importación mediante JSON. Se pueden ajustar los márgenes exteriores y los espacios superiores e inferiores de página, activar el guionado por idioma (apagado inicialmente) y añadir fuentes personales guardadas en el navegador. Los archivos de la carpeta `fuentes` también se detectan durante desarrollo/compilación; consulta su README.

Los controles de abrir y narrar están centrados arriba, con Play circular. La lectura sigue las palabras cuando la voz emite posiciones y divide las frases por páginas para las voces que no lo hacen. Pulsar una palabra durante la narración permite continuar desde ella. Resaltado, seguimiento y lectura al pulsar tienen controles independientes en voz. El resaltado exacto por palabra requiere eventos del motor; el audio externo se sigue por fragmentos.

- EPUB 2/3, MOBI, AZW3, Word `.docx`, PDF con texto seleccionable y TXT.
- Índice jerárquico, búsqueda, portada e imágenes ampliables. Notas originales del EPUB en ventana flotante.
- Una, dos o tres columnas; veinte tipografías, tamaño, anchura hasta 3.840 px o todo el ancho disponible, interlineado, espacio entre párrafos y separación de columnas. En pantallas pequeñas se usa una sola columna.
- Veinte opciones de tema: automático, mañana, tarde, noche, confort, natural, contraste negro absoluto, primavera, verano, otoño, invierno, lluvia, soleado, nevado, ventoso, energía, calma, melancolía, alegría y amor. Cada tema tiene su icono. El automático sigue la hora del dispositivo: mañana de 07:00 a 18:00, tarde de 18:00 a 22:00 y noche en el resto del día. Se pueden guardar hasta treinta paletas personales adicionales.
- Modo zen con ayuda para salir en la primera activación, pantalla completa y transición suave activada por defecto. Se puede desactivar y respeta la preferencia de movimiento reducido.
- Zoom de imágenes con botones, rueda, gesto de pinza y doble clic; arrastre para desplazarse. Las portadas se centran y ajustan al espacio del visor.
- Interfaz en español, catalán, inglés, francés, alemán, portugués, italiano, chino, japonés e hindi. Detecta el idioma del navegador/sistema; la rueda dentada permite elegirlo y guarda la elección. No traduce el contenido de los libros.
- Biblioteca por carpetas con agrupación de Calibre, elección de formato, filtro por título o autor y vista de títulos o portadas. Las portadas y los metadatos se cargan solo bajo demanda.
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

El texto importado se limpia con DOMPurify y se bloquean scripts, formularios, recursos remotos de las páginas e imágenes de seguimiento. Una política CSP añade otra capa de protección. Las fuentes se obtienen del equipo o de archivos incluidos en la aplicación.

Atkinson Hyperlegible y Lexend se incluyen en la aplicación y se cargan desde su propio servidor; las demás tipografías usan las instaladas en el equipo o una alternativa. No se consulta ningún proveedor externo de fuentes.

Las siguientes propuestas están en [IDEAS.md](IDEAS.md), pendientes de selección por el autor.

## Carpetas de Calibre y OneDrive

En **Libros → Añadir carpeta**, o en el selector inicial, elige la carpeta raíz de tu biblioteca. El navegador solicita permiso de **lectura**, sin modificar tus archivos. Este acceso requiere un navegador compatible con File System Access, como Chrome o Edge, en HTTPS o localhost. No se puede acceder a una ruta de Windows escrita libremente sin autorización del selector.

El escaneo recorre únicamente nombres y referencias a archivos: no llama a `getFile()`, no lee el contenido de EPUB/MOBI, no analiza `metadata.opf` y no carga portadas. Los títulos y autores iniciales se obtienen de la estructura de carpetas. Cuando hay `metadata.opf`, se agrupan los formatos de esa carpeta en una ficha y se prefiere EPUB. En carpetas genéricas se agrupan los formatos con el mismo nombre de archivo.

**Leer metadatos** abre solo el OPF elegido y actualiza su título/autor. En la vista de portadas, cada cubierta se carga al pulsarla, no al mostrar la cuadrícula. Al abrir un libro se lee únicamente el formato seleccionado; Windows/OneDrive puede descargar ese archivo si solo estaba disponible en la nube. No es posible leer su contenido sin que esté accesible localmente. El navegador no expone un estado fiable de hidratación de OneDrive, por lo que no se presentan indicadores ficticios de «descargado» o «en la nube».

El catálogo y las referencias de carpeta se conservan en IndexedDB. Al reabrir la aplicación se muestra el catálogo guardado, sin escanear otra vez. **Actualizar carpetas** actualiza el índice de nombres y puede cancelarse. El navegador puede volver a pedir permiso de lectura. Los libros abiertos desde una carpeta se guardan como referencias, sin duplicar el archivo completo en la biblioteca del navegador; las notas y posiciones sí se conservan.

En navegadores que no ofrecen este acceso se explica la limitación y se mantiene la apertura individual. No se usa un selector masivo que pudiera provocar la lectura de toda la biblioteca. Las pruebas comprueban el escaneo y la persistencia mediante una carpeta de prueba; no se ha accedido ni probado una biblioteca real de OneDrive.

## Voz

La opción predeterminada utiliza `speechSynthesis`: no hay cargos de API de esta aplicación. Las voces y su calidad dependen del navegador, el sistema y sus servicios; algunas necesitan conexión. Los eventos de límite de palabra también dependen de la voz: si no se emiten, el resaltado permanece en la frase.

La selección automática prefiere voces naturales o de Google que coincidan con el idioma del libro, cuando están disponibles. Puedes elegir una voz y un idioma de lectura manualmente. El idioma de los menús es independiente del idioma de narración.

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
- La rueda dentada contiene el idioma y la elección de apariencia. La apariencia disponible es la lectura minimalista; el libro realista animado y el cuaderno escolar son propuestas futuras, no modos activos.

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

Las fuentes Atkinson Hyperlegible y Lexend se distribuyen con sus avisos y licencias en `public/font-licenses.txt`, que también se incorpora a la aplicación compilada.

Se conserva el archivo de versiones `package-lock.json`. La dependencia CLI opcional de Mammoth usa una sustitución de `argparse` para evitar una cadena vulnerable de `sprintf-js`; la aplicación importa únicamente el conversor de navegador, y sus conversiones se comprueban con archivos Word reales de prueba.
