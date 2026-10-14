# Lector

Un lector de libros a toda pantalla, sin cabeceras decorativas ni tarjetas alrededor del texto. Dos columnas por defecto, controles discretos en la esquina superior derecha y un índice lateral que se puede ocultar.

## Versión 1.1

En **Ajustes → Idiomas y contexto → Lectura bilingüe**, abre una traducción del mismo libro en EPUB, MOBI, AZW3, DOCX, PDF con texto o TXT. Original y traducción se muestran juntos, con la tipografía elegida. La correspondencia inicial se basa en la posición: «Ajustar correspondencia» permite elegir capítulos, desplazar párrafos, vincular un párrafo concreto o dejarlo sin traducción. Los párrafos sin correspondencia siguen disponibles. «Continuar aquí» vuelve al pasaje en el lector; la voz narra el original y puede seguir y resaltar su texto en la vista paralela.

La traducción y sus vinculaciones se guardan en IndexedDB, separadas del libro original, sus notas y sus posiciones. Puedes desactivar el guardado del archivo (seguirá disponible durante la sesión) o quitar únicamente la traducción. No se exportan ni descargan archivos automáticamente. El OCR de PDF está disponible desde 1.2 en el apartado específico de ajustes del documento original.

Al seleccionar texto, **«En contexto»** muestra la palabra y la frase que la rodea. Puedes corregir el fragmento, elegir idioma de respuesta y solicitar una explicación contextual o una traducción del fragmento. La definición local de diccionario se identifica aparte, con su procedencia y licencia; la explicación generada aparece solamente tras una petición al motor configurado. Seleccionar una palabra o abrir ajustes no envía el contenido a un servicio.

El motor viene desactivado. En el mismo apartado de ajustes hay dos adaptadores:

- **Ollama local**: dirección completa `http://127.0.0.1:11434/api/chat` y nombre de un modelo que tengas instalado. Lector no instala motores ni descarga modelos. Configura Ollama sin funciones de nube si necesitas funcionamiento exclusivamente local; permite el origen de Lector en `OLLAMA_ORIGINS` y los permisos de conexión local que solicite el navegador. Consulta la [API de Ollama](https://docs.ollama.com/api/chat) y su [configuración de conexión y nube](https://docs.ollama.com/faq).
- **API compatible con Chat Completions**: dirección HTTPS completa, modelo y clave de sesión cuando el servicio la requiera. Por ejemplo, el formato documentado en [OpenAI Docs](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). El servicio debe admitir conexiones desde el navegador; si necesita una pasarela, utiliza una propia con permisos de origen configurados. Una URL de otro protocolo requiere su adaptador.

«Enviar fragmento» confirma cada consulta. Solo se envían la palabra/expresión, el fragmento visible y sus idiomas, junto con la instrucción de la tarea; no el libro entero ni sus notas. La clave no se guarda ni se incluye en las exportaciones y se borra al cambiar de dirección o cerrar la sesión. Se rechazan redirecciones y direcciones con credenciales o parámetros. Cada fragmento admite 3.000 caracteres y la generación se limita a 700 tokens. Cancelar interrumpe la espera del navegador; el proveedor puede haber iniciado su procesamiento. Los servicios externos pueden cobrar por uso. La calidad y disponibilidad dependen del motor y modelo configurados; las comprobaciones automáticas de los adaptadores utilizan respuestas simuladas, sin activar una cuenta de pago.

## Notas de la versión 1.0

El lateral Libros muestra «Abrir biblioteca completa» y la lista ordenada por última lectura; los libros sin abrir van después, por título. La biblioteca ampliada reserva el espacio a los libros: búsqueda, orden y botones de filtros, carpetas/catálogo y colecciones en una barra compacta. El embudo indica filtros activos y los abre en una ventana independiente. El selector de títulos/portadas del lateral conserva su propia vista y no aplica los filtros de la ventana.

La rueda dentada contiene los mismos controles que los accesos de tipografía, temas y voz. Puedes buscarlos por su nombre. En Lectura, junto a Columnas, está Formato de lectura → «Lectura continua · créditos»; el desplazamiento sigue la narración cuando se reproduce. Espaciado, márgenes y fuentes, así como ubicación y tiempos, quedan en grupos avanzados. La interfaz mantiene sus diez idiomas y adapta la biblioteca al móvil.

## Diccionarios (incorporados en 0.10)

En Ajustes → Notas y vocabulario están «Diccionarios sin conexión», «Buscar palabra» y «Vocabulario personal». Al consultar un fragmento se usa el idioma del libro, con selección manual independiente de la voz y de los menús. La búsqueda es local: no envía la palabra a un servicio. Cada resultado identifica su paquete, idioma de definiciones y licencia; el enlace a Wiktionary solo se abre al pulsarlo.

Hay diez paquetes voluntarios derivados de Wiktionary/Kaikki, con **6.449.866 entradas normalizadas entre lemas y formas**, repartidos en bloques comprimidos. Los manifiestos y direcciones se cargan al abrir el gestor; no se descargan ni instalan los bloques al arrancar. El gestor muestra cobertura y tamaño antes de instalar, permite cancelar y quitar paquetes. La activación ocurre tras verificar los bloques completos; si se cancela o falla una verificación, se eliminan los datos parciales. Las consultas posteriores usan solo IndexedDB y mantienen en memoria unos pocos bloques, evitando cargar todo el diccionario.

| Idioma | Entradas | Descarga aproximada | Idioma de definiciones |
| --- | ---: | ---: | --- |
| Español | 832.842 | 12,4 MiB | Español |
| Catalán | 189.072 | 2,1 MiB | Inglés |
| Inglés | 1.350.780 | 34,8 MiB | Inglés |
| Francés | 1.933.854 | 35,0 MiB | Francés |
| Alemán | 945.785 | 27,4 MiB | Alemán |
| Portugués | 379.834 | 6,5 MiB | Portugués |
| Italiano | 539.392 | 7,4 MiB | Italiano |
| Chino | 116.818 | 3,9 MiB | Chino |
| Japonés | 125.713 | 4,8 MiB | Japonés |
| Hindi | 35.776 | 0,9 MiB | Inglés |

La fuente es colaborativa, de cobertura variable y con posibles errores de extracción; algunas formas tienen descripciones gramaticales. Se conservan hasta doce glosas por entrada. **Catalán e hindi tienen definiciones en inglés en estos paquetes**, señalado tanto en el gestor como al consultar; no se presentan como diccionarios monolingües ni como cobertura universal. El glosario español anterior permanece como alternativa básica cuando no hay un paquete instalado para una palabra.

La carpeta raíz [diccionarios](diccionarios/README.md) documenta las fuentes, transformaciones y licencia CC BY-SA 4.0. Detecta paquetes y JSON propios al desarrollar/compilar; los archivos personales también se pueden importar desde la interfaz, hasta 64 MB y un millón de palabras. Se admite un objeto simple palabra→definición o una cabecera con idioma, nombre y `entries`. Los JSON antiguos guardados en localStorage siguen disponibles, mientras que las nuevas importaciones se guardan por bloques en IndexedDB.

«Guardar palabra» añade la definición consultada al vocabulario personal, junto con procedencia y ubicación del libro cuando corresponde. Allí puedes buscar, añadir una nota y marcar «Aprendida». Quitar un diccionario conserva las palabras guardadas. Nada se descarga en la carpeta Descargas para instalar o guardar vocabulario. Las consultas funcionan sin red con la aplicación abierta y el paquete instalado; el arranque completamente desconectado de la aplicación queda para 1.6.

## Notas de la versión 0.9

Al seleccionar texto puedes anotar, subrayar o copiar una cita. El editor ofrece cinco colores y dos marcas: línea inferior o fondo resaltado. Una anotación existente se puede editar desde Notas, el cuaderno o pulsando la marca, sin duplicar su ancla. «Mostrar subrayados» en Ajustes → Notas y vocabulario permite ocultar las marcas conservándolas guardadas. Los marcadores de página siguen siendo independientes.

El «Cuaderno de notas» reúne notas, subrayados y marcadores de los libros guardados. Permite buscar y filtrar por libro o tipo, editar y eliminar notas de otro libro sin cambiar la lectura abierta y volver al fragmento citado. Las citas copiadas incluyen texto, autor disponible, título y ubicación original o estable. Las notas antiguas que no tienen una referencia legible conservan su ancla CFI como procedencia.

«Exportar notas» y «Exportar selección» abren una vista previa Markdown/JSON: no crean archivos automáticamente. «Guardar archivo» ofrece elegir destino donde el navegador lo permite. La alternativa permite copiar y, mediante un botón adicional explícito, descargar. «Imprimir / guardar PDF» abre una página de impresión limpia para el diálogo del navegador, donde se puede seleccionar Guardar como PDF; no genera una descarga automática ni una captura de la interfaz. Las exportaciones escapan el texto del usuario y conservan Unicode.

## Catálogo de la versión 0.8

«Actualizar carpetas» enumera nombres y referencias y compara el resultado con el catálogo guardado. Conserva las entradas sin cambios, sus cubiertas y sus metadatos; muestra altas, modificaciones detectadas y bajas. Cambiar formatos de un libro Calibre mantiene su identidad y organización. Si desaparece un libro de una carpeta vinculada deja de mostrarse allí, conservando sus notas guardadas. Una actualización cancelada no sustituye el catálogo.

El navegador no proporciona fechas de modificación sin obtener el archivo: para evitar hidratar toda una biblioteca en OneDrive se detectan nombres, formatos e identidad de referencias. Una modificación del contenido que conserve la misma referencia puede requerir reabrir el ebook o pulsar «Leer metadatos». La enumeración de nombres sigue recorriendo la carpeta; se reutilizan los contenidos conocidos, no se promete un monitor nativo del sistema de archivos.

En Ajustes → Biblioteca, «Cargar portadas visibles» activa una cola secuencial, apagada inicialmente. Solo carga imágenes de cubierta de filas que intersectan la pantalla, conserva la caché y ofrece detener/continuar. «Obtener portadas incrustadas automáticamente» permite además abrir el ebook visible para obtener su cubierta; también viene apagado. La interfaz explica que ambas opciones pueden hidratar archivos de nube. Detener la cola impide guardar el resultado pendiente y comenzar nuevas lecturas, aunque el navegador no permita abortar una lectura de archivo ya iniciada.

## Biblioteca de la versión 0.7

La biblioteca ofrece «Filtros y colecciones», plegado inicialmente, en el panel lateral y en la ventana ampliada. Combina autor, serie, género, etiquetas, idioma, formato, estado y colección. El buscador también encuentra series, géneros y etiquetas; la ordenación por serie usa posiciones numéricas, incluidos decimales de Calibre. Los formatos de un mismo libro Calibre permanecen agrupados.

El botón discreto de organización de cada libro permite marcar pendiente, leyendo, terminado o abandonado; asignar colecciones virtuales; y completar autor, género, etiquetas, serie e idioma. Estas correcciones se guardan en el navegador, sin modificar ebooks ni OPF. Empezar un libro pendiente lo marca como leyendo; terminado y abandonado se conservan hasta cambiarlos. La actualización de carpeta mantiene la identidad de sus libros Calibre aunque cambie su formato preferido. «Mostrar detalles de biblioteca», apagado inicialmente en Ajustes → Biblioteca, añade estado, serie y etiquetas a las filas.

Los filtros utilizan los datos ya disponibles. Abrir un ebook carga su metadata propia; «Leer metadatos» carga el OPF de ese libro; «Leer metadatos mostrados» carga únicamente los OPF de las filas mostradas (60 inicialmente), con cancelación. Esta acción explícita puede hidratar esos pequeños archivos en OneDrive; no abre los ebooks ni las cubiertas. Género y etiquetas son campos distintos: las etiquetas proceden de `dc:subject`; los géneros se reconocen en columnas Calibre `#genre`, `#genres`, `#genero`, `#generos`, `#gènere` o `#gèneres`. Si faltan, se pueden completar en el lector. Las series aceptan metadatos Calibre y refinamientos EPUB3.

«Revisar duplicados» muestra candidatos por título y autor, identificadores o huellas de archivos que ya se abrieron. Permite ver cada grupo en la biblioteca; nunca borra ni fusiona libros. Dos ediciones con el mismo título pueden aparecer como candidatas. La detección no descarga archivos para calcular huellas.

Se comprueban catálogos de 5.000 entradas, filtros combinados, varias ediciones y formatos, persistencia y cancelación. Las colecciones, estados y correcciones se guardan separados de la posición y las notas para evitar que el guardado durante la narración los sobrescriba.

## Lectura de la versión 0.6

En Ajustes → Lectura se puede alternar entre páginas y desplazamiento vertical. Durante la narración, el texto sigue las palabras con un movimiento suavizado y se detiene al pausar. Las voces sin marcas usan una aproximación dentro del fragmento; el audio externo utiliza su progreso de reproducción. La rueda y las flechas permiten continuar al siguiente capítulo.

El retorno de índice, búsquedas, enlaces y notas mantiene un historial por libro, con botones discretos y Alt+←/→. Las anclas guardadas identifican texto estable, también al cambiar tipografía, tamaño de pantalla o flujo. En PDF se muestra la página original; en EPUB solo si incluye una lista de páginas. El resto utiliza una referencia de sección, bloque y carácter, distinta de una página editorial.

Los tiempos restantes de capítulo y libro y la referencia visible están apagados por defecto. Se estiman con palabras conocidas, tamaño de capítulos aún no abiertos y ritmo configurable de lectura o voz. No se abren todos los capítulos para calcularlos. El modo televisión amplía texto y controles y admite teclas de mando y gamepads expuestos por el navegador. Las pruebas verifican teclado y el mapeo de entradas; la compatibilidad de un mando físico depende del dispositivo y su navegador. La emisión a otros dispositivos queda para la versión 1.9.

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
- Diez paquetes de diccionarios para consultas sin conexión, importación de recursos propios y vocabulario personal; glosario básico como alternativa.
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
- Los diccionarios son colaborativos y su cobertura varía. Las importaciones individuales JSON admiten hasta 64 MB y un millón de palabras; los paquetes grandes usan bloques. Catalán e hindi tienen aquí definiciones en inglés.
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
## PDF y OCR (1.2)

Con un PDF abierto, entra en **Ajustes → PDF y reconocimiento de texto**. Revisa el orden automático, fuerza una, dos o tres columnas o recupera el orden del archivo. Ocultar encabezados y pies repetidos es opcional y está apagado; compara siempre con la página original, especialmente en tablas, notas y diseños complejos. La detección por coordenadas es una aproximación.

Para un escaneo, despliega **Reconocer páginas escaneadas**, escoge idioma e intervalo e inicia el OCR. Se procesa en un trabajador local; las páginas no se envían a terceros. El motor y el modelo se cargan bajo demanda desde este sitio. Hay modelos de español, catalán, inglés, francés, alemán, portugués, italiano, chino simplificado, japonés e hindi; se pueden almacenar en la caché interna del motor. La primera carga necesita conexión al sitio y varios MB. La calidad depende del escaneo, idioma y orientación: no hay garantía de exactitud ni detección automática de idiomas mezclados.

Cada tanda admite hasta 50 páginas, con progreso y cancelación. Los resultados quedan como borrador: corrige el texto y pulsa **Aplicar a la lectura** para guardarlo en este navegador y narrarlo. Cerrar sin aplicar descarta el borrador. Restaurar una página recupera su texto extraído. El archivo PDF se conserva intacto; las posiciones de anotaciones sobre texto modificado pueden requerir reubicación.

Motor: [Tesseract.js](https://github.com/naptha/tesseract.js), Apache-2.0; núcleo Tesseract.js-core, Apache-2.0. Modelos `4.0.0_best_int`: [Tessdata](https://github.com/naptha/tessdata), Apache-2.0; empaquetado npm `@tesseract.js-data`, MIT. Las licencias y atribuciones acompañan los recursos compilados en `ocr/`. Los modelos son recursos de reconocimiento, no voces.

## Controles y archivos de audio (1.3)

En **Ajustes de voz**, o **Ajustes → Voz**, encontrarás **Temporizador y retroceso**, **Pronunciaciones personales**, **Coste y límites de audio** y **Audio por capítulos**. Todo está integrado en los controles compartidos y en el buscador. El temporizador está apagado inicialmente; cuando se activa cuenta desde el inicio de la narración, también durante las pausas, y se cancela al detenerla manualmente. El retroceso utiliza frases y posiciones estables del libro, incluidas las de capítulos anteriores. Con audio generado puede retroceder segundos dentro del archivo en reproducción; con las voces del navegador los segundos son una aproximación por frases.

Las pronunciaciones se aplican solo cuando activas su interruptor. Son sustituciones literales, sensibles a mayúsculas y, opcionalmente, a palabras completas. Se guardan hasta 100 reglas y no modifican el libro. Por ejemplo, `Sr.` → `señor` mantiene la posición escrita al resaltar y evita separar esa abreviatura del resto de su frase. Sustituciones que desborden el límite de entrada del servicio se rechazan, sin recortar ni omitir texto.

La tarifa no viene precargada: introduce el precio de tu servicio por 1000 caracteres o por minuto de audio estimado y su moneda (EUR, USD o GBP). El cálculo por duración usa el ritmo base de narración, no la velocidad de reproducción. El factor de reserva permite un margen. Las estimaciones no son una factura: pueden diferir de tarifas por tokens, impuestos, instrucciones, duración real o precios que cambien. Configura también las restricciones de gasto del proveedor. Las peticiones anteriores sin tarifa quedan identificadas; no se calcula retroactivamente una cifra ficticia.

Los límites de gasto estimado y caracteres se comprueban **antes de enviar el siguiente fragmento**, para narración, prueba de voz y generación de capítulos. El contador persiste en este navegador y se comparte entre pestañas; en navegadores con Web Locks las reservas se serializan. El gasto se separa por moneda y los caracteres se suman entre ellas. Incluye intentos fallidos o cancelados por prudencia: una petición ya enviada podría cobrarse. Reiniciar el contador es una acción explícita. La caché de sesión reutiliza hasta 80 fragmentos y 32 MB sin nuevas peticiones; no mantiene claves ni promete eliminar cargos fuera de esta aplicación.

**Audio por capítulos** muestra capítulos agrupados por el índice principal (secciones si no hay índice), una vista previa de hasta 3000 caracteres y la estimación de todo el bloque. No se genera audio al abrir la ventana. Pulsar **Generar capítulo** envía únicamente ese capítulo elegido al servicio configurado, por fragmentos, y requiere su clave de sesión. Se comprueba cada respuesta y se decodifica a WAV mono de 24 kHz, sin concatenar archivos comprimidos inválidos. El tamaño máximo por respuesta y por capítulo es ajustable; si se alcanza un límite, no se conserva una grabación parcial como si estuviese completa. Los límites de recursos pueden exigir trabajar con capítulos o secciones más pequeños.

El resultado se guarda en IndexedDB si marcas la opción, o permanece durante la sesión. Si el navegador no tiene espacio, el archivo completo sigue disponible en memoria para guardarlo. Puedes reproducir, borrar o **Guardar archivo de audio**; se ofrece destino si existe File System Access y una descarga explícita en los demás navegadores. Nunca se descarga al generar. Las voces del navegador carecen de un archivo de audio y no se simula su exportación. La clave no se guarda y se borra al cambiar de dirección de servicio.

Referencia de API: [Create speech](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create). La generación externa se ha comprobado con respuestas de audio válidas simuladas; no se han consumido servicios de pago como parte de las pruebas. La calidad y facturación reales dependen del modelo y proveedor que configure el usuario. La integración de voces de IA locales queda para 1.4.

## Voz local y continuidad (1.4)

La narración conserva su propio documento y anclas: ajustar fuente, columnas, márgenes, tema, modo continuo o navegar no cancela la voz. Con seguimiento activado, el visor vuelve al texto narrado al siguiente avance; desactívalo para consultar otra página mientras escuchas. Pausa, Detener, Leer desde aquí, retroceso y abrir otro libro son acciones explícitas sobre el audio. El fin del libro, temporizador y errores reales también pueden detenerlo; un navegador o sistema suspendido no puede garantizar audio continuo. Los cambios de voz se aplican al siguiente fragmento; probar una voz queda disponible al detener la lectura para evitar solapar dos narraciones.

El menú de selección dispone de seis acciones en dos filas y Cerrar debajo. Cerrar, Escape o pulsar fuera para descartarlo no cambia el punto narrado.

Piper local produce audio sin clave ni factura de API. Preparación, modelos, recursos, resultados medidos y licencias en [voz-local](voz-local/README.md). ElevenLabs cuenta con su adaptador propio además de OpenAI/compatibles; las APIs externas requieren sus credenciales y soporte CORS. Las pruebas externas usan respuestas simuladas, sin gasto real. La síntesis Piper en CPU español se ha probado con audio real.
