# Historial de versiones

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
