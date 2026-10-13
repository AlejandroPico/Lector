# Historial de versiones

## 1.1.0

- Apartado Idiomas y contexto dentro de los ajustes y su buscador, con interfaz en los diez idiomas.
- Lectura bilingüe con traducción aportada por el usuario, capítulos emparejables, desplazamiento y vinculaciones de párrafos; archivo y alineación guardados opcionalmente en el navegador.
- Narración del original, resaltado en la vista paralela y retorno mediante las ubicaciones del ebook. Conservación de saltos de línea y texto de listas/citas.
- Consulta contextual y traducción de fragmentos con vista previa y envío explícito; adaptadores Ollama y Chat Completions, desactivados inicialmente, claves de sesión y cancelación.
- Definición de diccionario separada de las respuestas generadas, con atribución y licencia.
- Actualización del almacenamiento a versión 6 conservando libros, notas y diccionarios anteriores.

## 1.0.0

- Evitar recalcular páginas mientras el documento de un capítulo todavía está cargándose; comprobado con navegación y reanudación repetidas.
- Lateral con biblioteca completa y libros recientes, sin filtros ni herramientas de catálogo.
- Biblioteca con barra compacta, filtros en ventana propia y gestión de carpetas y colecciones aparte.
- Ajustes centrales compartidos con accesos directos, buscador y lectura continua junto a columnas.
- Numeración estable 1.0; el antiguo bloque 0.11 pasa a 1.1.

## 0.10.0

- Diez paquetes Wiktionary opcionales, con 6.449.866 entradas normalizadas y licencias/procedencia documentadas.
- Consulta sin conexión con idioma automático del libro o selección manual; catalán e hindi indican definiciones en inglés.
- Instalación por bloques, verificaciones SHA-256 de datos comprimidos o descomprimidos, progreso y cancelación con limpieza de datos parciales.
- Carpeta diccionarios con detección al compilar; importación de JSON propios a IndexedDB, conservando importaciones antiguas.
- Vocabulario personal con definiciones, procedencia, notas y estado aprendido; permanece al retirar un paquete.
- Normalización Unicode para conservar tildes y marcas del hindi, y variantes ortográficas simplificadas/tradicionales del chino.
- Pruebas de cobertura e integridad, instalación real, consulta offline, cancelación, datos inválidos, persistencia y móvil.

## 0.9.0

- Subrayados y fondos resaltados en cinco colores, con visibilidad configurable.
- Edición de notas y marcas existentes conservando identificador y ancla del ebook.
- Cuaderno común a los libros guardados, con búsqueda, filtros y navegación a citas.
- Copia de citas con autor, título y ubicación estable.
- Vista previa de exportación Markdown/JSON, elección explícita de destino y vista de impresión para guardar PDF.
- Ninguna descarga al abrir el cuaderno o la exportación; alternativa de descarga solo mediante su botón explícito.
- Comprobaciones de colores, persistencia, edición entre libros, procedencia y exportación segura de texto.

## 0.8.0

- Reconciliación del catálogo por identidad y estructura, con recuento de altas, cambios, bajas y entradas conservadas.
- Reutilización de metadatos y cubiertas sin leer archivos; invalidación de cachés cuando cambia una referencia de archivo.
- Cola secuencial de portadas visibles, apagada inicialmente, con parada y reanudación.
- Obtención anticipada de cubiertas incrustadas como opción independiente, también apagada.
- Pruebas de actualización sin lecturas de contenido, conservación de la organización y cancelación de portadas.

## 0.7.0

- Filtros combinables por autor, serie, género, etiquetas, idioma, formato, estado y colección.
- Estados pendiente, leyendo, terminado y abandonado; colecciones virtuales sin mover archivos.
- Organización por libro con correcciones locales del catálogo, independientes de notas y posiciones.
- Series Calibre y EPUB3 con orden numérico; géneros de columnas personalizadas y etiquetas OPF.
- Carga explícita y cancelable de metadatos de las filas mostradas, sin leer ebooks ni cubiertas.
- Revisión de posibles duplicados por metadatos o huellas ya conocidas, sin eliminación ni fusión.
- Conservación de la organización al actualizar carpetas Calibre y añadir formatos.
- Detalles opcionales de biblioteca y controles traducidos a los diez idiomas.
- Pruebas de catálogos de 5.000 entradas, persistencia, ediciones, formatos, móvil y cancelación.

## 0.6.0

- Flujo vertical con narración suavizada, seguimiento por palabras y pausa real del desplazamiento.
- Alternativa estimada cuando la voz no informa de las palabras y seguimiento por progreso del audio externo.
- Continuación entre capítulos mediante rueda, flechas y narración.
- Modo televisión con escala ajustable, navegación de foco y gamepads compatibles con el navegador.
- Historial de retorno por libro para índice, búsquedas, notas y enlaces.
- Anclas de texto persistentes que evitan reabrir la página anterior en espacios partidos entre páginas.
- Ubicaciones y tiempos estimados de capítulo/libro opcionales, apagados inicialmente.

## 0.5.0

- Interruptor mínimo entre títulos y portadas, con vistas guardadas.
- Biblioteca flotante ampliada: misma colección, búsqueda y formatos; vista independiente del panel lateral.
- Cubierta inicial grande, centrada y ajustada a la pantalla; zoom, acceso al texto y opción de desactivarla.
- Conservación de la posición de lectura y salto de la cubierta nativa al empezar, sin modificar los índices internos del ebook.
- Portadas en caché para los libros abiertos y carga bajo demanda para carpetas; prioridad a cubierta externa de Calibre del libro elegido.
- Pruebas de apertura, reanudación, audio desde cubierta, biblioteca y ausencia de lecturas masivas.

## 0.4.0

- Ajustes por categorías y acceso a controles secundarios desde la rueda dentada en móvil.
- Ocho temas meteorológicos y emocionales nuevos, hasta 20 opciones en total.
- Editor de temas personales con vista previa, guardado, edición, eliminación, copia e importación.
- Márgenes exteriores y de página ajustables; guionado por idioma opcional, apagado inicialmente.
- Carpeta fuentes con detección automática al compilar e importación de fuentes personales con persistencia en el navegador.
- Traducciones de los controles nuevos a los diez idiomas y pruebas de restauración de temas/fuentes.

## 0.3.0

- Controles de documento y narración centrados; Play circular.
- Seguimiento de palabras y avance inmediato al alcanzar una nueva página.
- Fragmentos por página para voces sin eventos de palabra y audio de API.
- Pulsar una palabra durante la narración continúa exactamente desde ella.
- Resaltado de palabra/frase, seguimiento y lectura al pulsar configurables por separado.
- Comprobaciones de posición, paso de página y persistencia de opciones.

## 0.2.0

- Temas, tipografías, diez idiomas, biblioteca de carpetas Calibre y gestos de imagen.
