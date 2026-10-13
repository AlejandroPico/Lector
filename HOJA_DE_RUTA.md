# Ampliaciones acordadas y versiones propuestas

Base actual: versión 0.4.0. Esta hoja recoge la selección del autor del 13 de octubre de 2026. La selección aprueba el objetivo de las funciones, pero cada versión necesita autorización antes de comenzar. Documentar este plan no cambia la aplicación ni autoriza ejecutar todos los bloques.

## Reglas comunes

- Trabajar en main, sin ramas, PR ni agentes secundarios. Conservar favicon.svg y Acerca de.
- Entregar un bloque por vez: implementación, comprobaciones, publicación y resumen para probarlo. No iniciar automáticamente el siguiente.
- Mantener la lectura limpia en ordenador, móvil, tableta y televisión; conservar los diez idiomas de interfaz.
- Organizar la rueda dentada en Lectura, Apariencia, Voz, Biblioteca, Notas y vocabulario, Datos y Dispositivos. Mostrar controles avanzados solo cuando proceda.
- Las nuevas funciones de presentación, seguimiento y narración tienen controles para activarlas o desactivarlas. Separar resaltado, seguimiento automático y salto al pulsar una palabra.
- Guionado, temporizador, envío a servicios externos y descarga anticipada de portadas desactivados inicialmente. La información de tiempo restante será opcional.
- Guardar datos dentro del almacenamiento del navegador; nada se exporta automáticamente a Descargas. Las exportaciones deliberadas ofrecen destino cuando la plataforma lo permite y una alternativa explícita.
- Los archivos originales de las carpetas permanecen intactos. Leer metadatos, portadas o contenido solo por acción del usuario o por una opción de carga anticipada que haya activado expresamente.
- No prometer precisión por palabra si una voz no proporciona posiciones o tiempos. Detectar la capacidad, indicar la limitación y ofrecer seguimiento por fragmentos como alternativa configurable.
- Las integraciones con cuentas, servicios de pago, dispositivos y tiendas requieren concretar sus credenciales, capacidades y publicación en su propio bloque; no activar costes como parte de este plan.

## Versiones

| Versión | Alcance | Comprobación principal |
| --- | --- | --- |
| 0.3 | Seguimiento de voz por palabra, salto al llegar a otra página, reanudar desde la palabra pulsada, controles independientes; abrir/reproducir/voz centrados arriba y Play circular destacado. | Una frase que cruza página sigue visible y pulsar una palabra empieza exactamente allí. Probar también las opciones apagadas y voces sin eventos por palabra. |
| 0.4 | Ajustes por categorías, editor de temas, temas meteorológicos y emocionales, márgenes interiores/exteriores, guionado opcional y tipografías personales. Carpeta fuentes con detección durante desarrollo/compilación y carga desde la interfaz. | Persistencia de colores y fuentes; lectura correcta en distintas anchuras y columnas. |
| 0.5 | Interruptor discreto título/portadas, biblioteca flotante, cubierta inicial grande y centrada. Preferir cubierta Calibre solicitada por el usuario; recurrir a la incrustada del libro seleccionado. | Cubiertas de distintas proporciones y biblioteca amplia sin leer todos los ebooks. |
| 0.6 | Lectura vertical continua con seguimiento de voz al estilo créditos, modo televisión con teclado/mando compatible, historial de navegación, posiciones estables y tiempo restante de capítulo/libro opcional. | Desplazamiento ligado a la posición narrada y a la velocidad, pausa y reanudación; volver de índice/notas conserva el lugar. |
| 0.7 | Filtros por autor, serie, género, etiquetas, idioma y formato; estados de lectura, colecciones, series Calibre y candidatos a duplicados. | Catálogo de miles de entradas, varias ediciones y formatos; ninguna colección mueve archivos ni la detección borra duplicados. |
| 0.8 | Actualización incremental del catálogo y cola opcional de portadas visibles. | Cambios, altas y bajas sin volver a procesar todos los contenidos; cancelar la cola y evitar descargas no solicitadas. |
| 0.9 | Subrayados de colores, edición de notas, cuaderno de notas/citas, copiar citas con procedencia y exportación deliberada a Markdown/PDF. | Persistencia de anotaciones y posiciones; exportación solo cuando se pide. |
| 0.10 | Diccionarios sin conexión para los diez idiomas, carpeta diccionarios con detección durante compilación, paquetes por idioma y vocabulario personal. | Licencias y cobertura verificadas por idioma, consultas desconectadas y gestión de paquetes grandes. No presentar el glosario básico actual como diccionario completo. |
| 0.11 | Explicar palabras en contexto y vista bilingüe paralela. Primera vía: traducción aportada por el usuario; motor local o externo configurable para explicaciones/traducción adicionales. | Alineación de textos y controles de conexión. No confundir definición de diccionario con explicación generada ni traducir automáticamente libros. |
| 0.12 | OCR de PDF escaneados y mejor orden de lectura en PDF con columnas, encabezados y pies. | Documentos de prueba reales, revisión del texto reconocido, progreso y cancelación; distinguir texto original de reconocido. |
| 0.13 | Temporizador apagado inicialmente, retroceso de audio, pronunciaciones, estimaciones/límites de coste y exportación deliberada de audio por capítulos. | Sin saltos de contenido, detener costes antes del límite; estimaciones basadas en las tarifas configuradas y exportación solo con motores que generen audio. |
| 0.14 | Evaluación y primera integración de voz de IA local; adaptadores para otros servicios de voz. | Calidad real, español y demás idiomas disponibles, hardware, licencia y funcionamiento sin nube. Cada proveedor necesita su adaptador, no basta con una URL genérica. |
| 0.15 | Voces persistentes de personajes, corrección de interlocutores y perfiles de narración. | Consistencia entre capítulos y controles manuales; entonación según las capacidades reales del motor seleccionado. |
| 0.16 | Aplicación web instalable, funcionamiento sin conexión y copias internas de datos con restauración. | Arranque desconectado tras instalación y recuperación de datos; recursos/modelos/diccionarios opcionales con tamaño visible. Una copia interna no protege contra borrar todo el almacenamiento del navegador. |
| 0.17 | Sincronización voluntaria de posiciones, notas y preferencias entre dispositivos. | Resolver conflictos y elegir destino/cuenta; no subir libros por defecto. Concretar servicio, autenticación y posibles costes antes de integrarlos. |
| 0.18 | Primera aplicación de escritorio, inicialmente Windows, integración con carpetas Calibre y proveedores de nube por sus capacidades reales. Preparar entregas para las otras plataformas de forma sucesiva. | Selección de carpetas y almacenamiento local; comprobar estados reales de archivos y acceso. Firma, tiendas y credenciales se concretan por plataforma. |
| 0.19 | Emisión de contenido con receptor propio, primero Google Cast/Google Home compatible; después evaluar AirPlay y Alexa separadamente. | Televisión con interfaz propia y altavoz con audio real, sin espejo de pestaña. El receptor debe poder acceder al contenido: la voz del navegador no proporciona automáticamente un archivo de audio transmisible. Registro y prueba en dispositivos reales antes de prometer compatibilidad. |

Si un bloque excede una entrega razonable, se subdividirá antes de comenzar y se presentará el alcance de su primera parte al autor.

## Selecciones y aclaraciones

- Incluidos los objetivos de la lista original 7, 10–15 y 19–50, con los límites y dependencias indicados arriba.
- Libro físico realista, página doblada, tapa realista, cuaderno escolar y estantería (1–5) reservados para una etapa posterior. La cubierta y las portadas de 0.5 pertenecen al lector actual, no implementan todavía un libro físico.
- Apariencias combinables con temas (6) se conservará como principio para esa etapa posterior, sin añadir ahora apariencias sin implementar.
- Perfiles guardados (8): no seleccionados expresamente; quedan pendientes.
- Ajustes distintos por libro (9), sesiones y objetivos (16), lupa (17) y regla de lectura (18): excluidos por ahora.
- Colecciones significa agrupar libros virtualmente, por ejemplo «Historia» o «Para leer», sin reorganizar las carpetas de Calibre.
- Posición estable significa conservar el punto mediante un ancla del ebook, aunque cambien fuente o pantalla. El número de página calculado puede variar con la maquetación; una página editorial original solo se mostrará cuando el archivo la incluya.
- El tiempo restante distinguirá estimación de lectura visual y de narración, capítulo y libro. Se recalculará con la velocidad y no se mostrará por defecto como información permanente.
- La interfaz podrá usar los diez idiomas aunque un motor concreto de voz, OCR o diccionario tenga menos cobertura; se indicará la disponibilidad efectiva de cada recurso.
- Las carpetas fuentes y diccionarios permiten añadir recursos al proyecto y detectarlos al compilar. Una web ya publicada no puede inspeccionar libremente una carpeta del ordenador; para recursos personales ofrecerá selección/importación explícita.
- El almacenamiento deseado es local y automático. Para notas, catálogos y paquetes se utilizarán IndexedDB y otras APIs de almacenamiento del navegador, dado que las cookies son demasiado pequeñas para estos datos.

## Referencias de viabilidad

- Seguimiento por palabra: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event
- Almacenamiento local: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies
- Receptor Cast propio: https://developers.google.com/cast/docs/web_receiver/basic

## Estado

- Hoja de ruta documentada.
- 0.3 completada: seguimiento de voz y controles superiores.
- 0.4 completada: personalización, categorías, márgenes y fuentes propias.
- 0.5 autorizada para implementar a continuación.
- Las demás versiones siguen pendientes de autorización.
