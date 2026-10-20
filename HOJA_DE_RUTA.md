## 2.3 — Diccionario y consulta breve

Autorizada tras verificar la publicación de 2.2. Burbuja anclada, tipo de palabra y definición breve, ampliación al diccionario completo. Acceso a los recursos del proyecto mediante bloques verificados al consultar expresamente una palabra; instalación completa voluntaria para uso sin conexión. Gramática de las fuentes, cobertura e idioma de las definiciones visibles, conservación de paquetes/vocabulario y sin IA ni consultas externas automáticas. Las versiones posteriores continúan pendientes.

## 2.2 — Visor de imágenes y cubierta móvil

Completada en main y v2.2.0 (0463859): web publicada y 14 descargas verificadas, 97 pruebas unitarias, 157 de navegador y emuladores Android 10/15. APK público y suma de comprobación confirmados antes de empezar 2.3.

Incluye la ampliación solicitada: lateral completo con favicon y Lector, deslizamiento de medio segundo y cierre desde marca/X; ocultar barras de lateral y Ajustes conservando desplazamiento con teclado, rueda y gestos.

Autorizada junto con 2.3, en entregas independientes. Visor ajustado a las proporciones de la imagen, sin marco ni barra, cierre superpuesto y gestos/teclado. Máscara del visor y las hojas con la cubierta cerrada también en móvil, incluida la vista de libro abierto. Publicar y verificar antes de implementar 2.3 (diccionario y consulta rápida). Las versiones posteriores siguen pendientes.

## 2.1 — Narración Android en segundo plano

Autorizada el 19 de octubre de 2026: servicio autónomo para las voces del sistema del APK, cola de frases y capítulos independiente del WebView, controles de pausa/reanudación y retroceso acumulable aproximado de diez segundos, título/capítulo/autor/cubierta en la sesión multimedia. Temporizador nativo, pausa ante pérdida de audio o auriculares y recuperación de posición al volver. No implica Cast ni la incorporación de las voces de Edge a Android.

La verificación distingue las pruebas del servicio Android con motor controlado y pantalla apagada de la validación auditiva en el móvil del autor. Véase LECTURA_SEGUNDO_PLANO.md.

Autorizadas posteriormente: 2.2 imágenes y cubierta móvil y 2.3 diccionario y burbuja de consulta, en ese orden. Autorizadas ahora, en orden: 2.4 contexto mediante IA; 2.5 diagnóstico de voces. Autorizadas ahora, en orden: 2.6 escenarios personales; 2.7 iluminación del papel. Autorizada posteriormente: 2.8 encuadernaciones. Autorizada posteriormente: 2.9 cámara móvil. Autorizada posteriormente: 2.10 página arrastrable. Pendientes de autorización: 2.11 previsualización de capítulos; 2.12 organización por lotes; 2.13 emisión real, al final.

# Ampliaciones acordadas y versiones propuestas

## Versión 2.0

Cubierta cerrada sin superposición de hojas o texto. Interfaz nocturna de texto claro con superficies coherentes y colores del papel independientes. Doce opciones de entorno con Terraza de olivo, icono de oficina diferenciado y selector más compacto. Fondos expandidos completos, sin recorte, también en pantallas panorámicas. Mantiene datos, voz, diez idiomas y distribución multiplataforma. Las [propuestas futuras](IDEAS_2_0.md) quedan pendientes de selección.

## Ampliación 1.11

Biblioteca sin doble ficha para el mismo archivo leído y catalogado; listas compactas, sin papelera, y campo de colecciones que filtra y crea con Intro. Tema incorpora el cambio de apariencia y miniaturas de todos los entornos, con cuatro nuevas maderas. Libro proporcional y redimensionable, barras transparentes y navegación por los cantos; página individual en móvil con selección del lado contiguo y alternativa de libro abierto. Se mantienen notas, progreso, voz y diez idiomas.

## Ampliación 1.10

Autorizada: pulido de biblioteca, portadas visibles automáticas, colecciones completas, referencias de carpetas, notas coincidentes independientes, 24 colores, cuatro temas nuevos, ajustes replegados por sesión y apariencia opcional de libro con escenarios fotográficos y hojas animadas. El supuesto fallo de escaneo se cancela: procedía de otra carpeta recordada. Emisión aplazada sin cambios.

Esta petición sustituye el valor inicial anterior de portadas desactivadas. Solo se cargan las visibles, con permisos ya concedidos y con opciones de pausa y desactivación. Las incrustadas pueden descargar el EPUB correspondiente de la nube. No se solicitan permisos automáticamente.

## Corrección de voces 1.9.1

Solicitada el 15 de octubre de 2026: prueba de voz sin asignaciones del narrador del libro, idioma exacto y prioridad regional, voz guardada no disponible identificada sin sustitución silenciosa, errores por nombre/código y diez idiomas. Se conservan las voces de personajes durante la narración real y la independencia entre visor y audio.

Verificación local: 88 casos unitarios distintos aprobados (la lectura de sumas de diccionarios se repitió aislada tras agotar tiempo con compilación simultánea), 23 casos de navegador relacionados y compilación. Cinco casos nuevos comprueban idioma, prueba global frente al narrador, errores sin sustitución, URI guardada ausente y prueba de API. En Edge 155.0.4283.45, perfil de prueba independiente, Elvira/Álvaro/Ximena terminaron muestras reales y dos fragmentos de EPUB por voz; los eventos de interrupción corresponden a la detención deliberada de la prueba. No se ha reproducido ni resuelto de forma acreditada el fallo del perfil habitual del autor. La guía de Microsoft explica esa distinción, comprobación InPrivate y la vía Azure, sin activar cuentas ni añadir un proveedor no comprobado.

Base actual: versión 1.8.0. Esta hoja recoge la selección del autor del 13 de octubre de 2026. El autor autorizó 1.2 y 1.3 en orden, con publicación y comprobación independiente. 1.6 y 1.7 autorizadas en orden, con comprobaciones y publicaciones independientes.

## Reglas comunes

- Trabajar en main, sin ramas, PR ni agentes secundarios. Conservar favicon.svg y Acerca de.
- Entregar un bloque por vez: implementación, comprobaciones y publicación. El autor autoriza 1.8 y 1.9 en orden; verificar 1.8 antes de iniciar 1.9.
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
| 1.0 | Rediseño del lateral y biblioteca ampliada; filtros flotantes; ajustes compartidos, buscador y acceso visible a créditos. | Catálogo de 5.000 libros, filtros independientes del lateral y controles compartidos en móvil y ordenador. |
| 1.1 | Explicar palabras en contexto y vista bilingüe paralela. Primera vía: traducción aportada por el usuario; motor local o externo configurable para explicaciones/traducción adicionales. | Alineación de textos y controles de conexión. No confundir definición de diccionario con explicación generada ni traducir automáticamente libros. |
| 1.2 | OCR de PDF escaneados y mejor orden de lectura en PDF con columnas, encabezados y pies. | Documentos de prueba reales, revisión del texto reconocido, progreso y cancelación; distinguir texto original de reconocido. |
| 1.3 | Temporizador apagado inicialmente, retroceso de audio, pronunciaciones, estimaciones/límites de coste y exportación deliberada de audio por capítulos. | Sin saltos de contenido, detener costes antes del límite; estimaciones basadas en las tarifas configuradas y exportación solo con motores que generen audio. |
| 1.4 | Evaluación y primera integración de voz de IA local; adaptadores para otros servicios de voz. | Calidad real, español y demás idiomas disponibles, hardware, licencia y funcionamiento sin nube. Cada proveedor necesita su adaptador, no basta con una URL genérica. |
| 1.5 | Voces persistentes de personajes, corrección de interlocutores y perfiles de narración. | Consistencia entre capítulos y controles manuales; entonación según las capacidades reales del motor seleccionado. |
| 1.6 | Emisión: solución inicial retirada en 1.7.1; integración nativa pendiente. | Audio real accesible al receptor, interfaz propia y prueba en dispositivos. No espejo de pestaña ni promesa de compatibilidad universal. |
| 1.7 | Sincronización voluntaria de posiciones, notas y preferencias entre dispositivos. | Resolver conflictos y elegir destino/cuenta; no subir libros por defecto. Concretar servicio, autenticación y posibles costes antes de integrarlos. |
| 1.8 | Corrección de navegación durante narración; se cancela el anterior bloque de copias y preparación sin conexión. | Explorar sin salto automático ni corte de voz; volver al punto narrado con un botón temporal, sin cambiar dimensiones. |
| 1.9 | Distribución final: web instalable, Windows, macOS, Linux, Android y iPhone/iPad; integración de carpetas y proveedores según sus capacidades. | Producto validado antes de empaquetar. Firmas, tiendas, arquitectura, cuentas y credenciales se concretan por plataforma. |

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
- 0.5 completada: biblioteca ampliada, vistas de portadas y cubierta de apertura.
- 0.6 completada: lectura continua, televisión, retorno, posiciones y tiempos opcionales.
- 0.7 completada tras verificar la publicación de 0.6: filtros, estados, colecciones, series y candidatos a duplicados.
- 0.8 completada: actualización del catálogo y cola opcional de portadas visibles.
- 0.9 completada: subrayados, edición, cuaderno, citas y exportación deliberada.
- 0.10 completada: diez paquetes de diccionarios, instalación local, importación de recursos y vocabulario personal. Catalán e hindi contienen definiciones en inglés; cobertura y licencias documentadas.
- 1.0 completada: rediseño, 35 comprobaciones unitarias y 64 de navegador, compilación y revisión visual en ordenador y móvil.
- 1.1 completada: lectura bilingüe con alineación manual, traducciones opcionales por libro, contexto con envío explícito y adaptadores de servicios; 46 comprobaciones unitarias y 74 de navegador. Las versiones posteriores siguen pendientes de autorización.
- 1.2 completada: OCR local real, diez modelos bajo demanda, revisión de texto y orden de PDF; 49 comprobaciones unitarias y 78 de navegador. Publicación, OCR real en producción y comprobaciones de GitHub confirmadas antes de finalizar 1.3.
- 1.3: temporizador, retroceso, pronunciaciones, presupuestos estimados y generación deliberada de capítulos WAV; 54 comprobaciones unitarias y 86 de navegador. Las versiones posteriores siguen pendientes de autorización.

- Orden acordado para próximas entregas: emisión con receptor propio antes de los instalables; sincronización voluntaria, preparación sin conexión y distribución final para escritorio y móviles se mantienen pendientes. No se ha implementado emisión ni sincronización en 1.4.

- 1.4 completada y comprobada en main antes de iniciar 1.5: Piper local, adaptador ElevenLabs, voz independiente del visor y menú de selección con cierre. 57 unitarias, 93 pruebas de navegador y generación real Piper en la web publicada.
- 1.5 completada: reparto persistente, correcciones precisas, seis perfiles, propuestas locales y análisis de fragmentos confirmado con revisión; 64 pruebas unitarias y 100 casos de navegador. La exportación utiliza las voces asignadas. No implementa clonación ni identificación automática garantizada de personajes.

- 1.6: emisión explícita de audio con servicio local, receptor propio web y adaptador Google Cast estándar/personalizado. Texto opcional por fragmentos temporizados. Registro del receptor propio y prueba física en dispositivos pendientes de sus requisitos externos; Matter Casting no integrado.
- Verificación local de 1.6: 69 pruebas unitarias y 104 de navegador, compilación de ambas páginas y favicon raíz. Receptor LAN probado con WAV real, pausa, búsqueda temporal y revocación; adaptador Cast comprobado con SDK simulado.

- 1.6 publicada y verificada en main: comprobación GitHub 38506125938, Pages 38506126075, reproducción real desde producción con pausa, búsqueda temporal, revocación y cero errores de aplicación.
- 1.7: sincronización manual de posiciones, notas y preferencias; OneDrive con carpeta de aplicación/PKCE y credenciales de sesión, WebDAV con ETag, revisión de posiciones y marcas de eliminación. Requiere registro Microsoft propio para activar una cuenta real.

- Comprobaciones locales de 1.7: 81 unitarias; 113 casos de navegador completos y, tras reforzar configuración/cancelación, los 11 de sincronización (incluidos 2 nuevos) aprobados: 115 casos distintos. Compilación de lector, receptor y callback, con favicon raíz. Microsoft/Google SDK comprobados con respuestas controladas; no se usaron cuentas de pago.

## Corrección 1.7.1

La emisión de 1.6 se retira a petición del autor: eliminados puente local, receptor, SDK Cast, menús y configuración persistida. Los puntos históricos anteriores no acreditan emisión nativa ni prueba en dispositivos físicos. La emisión sencilla con selector del navegador sigue pendiente de una arquitectura de transporte adecuada, sin configuración de red para el usuario.

Media Session integra únicamente audio real de API/Piper y capítulos guardados: título, autor, cubierta y controles. No transmite audio ni configura dispositivos. La voz del navegador no entrega un flujo utilizable a la aplicación.

Verificación local de 1.7.1: 81 pruebas unitarias y 114 casos de navegador aprobados. Compilación de lector y callback, favicon raíz y ausencia del receptor anterior. Integración comprobada con audio WAV real y API simulada, sin facturación ni pruebas físicas de emisión.

## Orden autorizado el 14 de octubre de 2026

1.8: navegación independiente de la voz y retorno al punto narrado. 1.9: distribución PWA, Windows, macOS, Linux, Android (incluido Android TV/Chromecast con Google TV), iOS/iPadOS y preparación de tiendas. Publicar y verificar cada entrega en main por separado. La retransmisión queda para el futuro; no se registra ni publica en tiendas sin cuentas y firmas propias.

Verificación local de 1.8: 81 pruebas unitarias y 118 casos de navegador aprobados, compilación y favicon raíz. Incluye navegación durante voz del navegador y audio WAV real de API simulada, retorno explícito con voz pausada, lectura continua, móvil e inglés, modo zen y ausencia de cambios de dimensiones. No se realizaron llamadas de pago.

1.8 publicada en main en 59b7c74, comprobación 38517156950 y Pages 38517156986 aprobadas; regresión comprobada con audio WAV real en producción antes de iniciar 1.9.

1.9 completada: PWA y paquetes Windows x64, Linux x64, macOS Intel/Apple Silicon; APK Android/Android TV firmado y AAB; iPhone/iPad compilados para simulador y archivo Xcode sin firma. Descargas públicas en v1.9.0, sumas SHA-256 y guía DISTRIBUCION.md. Las firmas Apple/Microsoft, cuentas, capturas y revisiones físicas de tiendas corresponden al titular y siguen pendientes; no se ha publicado en tiendas ni se implementa Cast.

Comprobación GitHub 38569439089 y distribución 38569438947 aprobadas: 87 unitarias, 118 de navegador y todas las compilaciones. Pages 38569438976 publicada. Windows abre EPUB y detecta voces reales con Node aislado; APK local con firma RSA 4096 verificada, versión 1.9.0, minSDK 26 y entrada Leanback. Producción conserva la navegación manual y el retorno explícito durante WAV real, sin reiniciar audio, modificar dimensiones ni errores. Los adaptadores API se verifican con respuestas controladas, sin facturación. No se afirma prueba en televisores, iPhone o iPad físicos.

## 2.4 y 2.5

2.4 publicada y verificada (main/tag bd4c20d, 102 unitarias, 167 de navegador, Android 10/15, catorce archivos y huellas comprobados) antes de implementar 2.5.

2.5 incorpora pruebas explícitas de voces por idioma/región, selección exacta sin sustitución, muestra editable, cancelación y tiempos de espera, resultados de sesión y protección de la narración activa/pausada. No instala voces de otros navegadores ni diagnostica la calidad audible automáticamente.

## 2.6 — Escenarios personales

Fotografías propias guardadas en IndexedDB, con preparación local, miniaturas, nombre, contraste de controles y eliminación. Sin subir ni sincronizar imágenes. La selección ausente vuelve a Automático; conservar biblioteca, notas, narración y diez idiomas. Publicar y verificar antes de iniciar 2.7.

## 2.7 — Luz del papel

Autorizada tras publicar y verificar 2.6. Intensidad, calidez, inversión y colores personales para las hojas y el texto, con desactivación/restablecimiento, contraste visible y conservación de menús, escenarios, ilustraciones, voz y posiciones. Aplicable a todos los escenarios físicos y ajena al modo minimalista. No iniciar 2.8 ni posteriores.


## 2.8 — Encuadernaciones y tapas

Autorizada el 20 de octubre de 2026, tras completar 2.7. Tapa dura, bolsillo y cuaderno en Tema → Libro sobre la mesa → Encuadernación. Movimiento completo de las tapas con exterior, guarda y lomo, independiente de las hojas. Conservar contenido, ubicación, narración, luz y datos; respetar movimiento reducido. Las versiones 2.9–2.13 siguen pendientes de autorización.


## 2.9 — Cámara móvil

Autorizada tras verificar 2.8: zoom de 100 a 200 %, encuadre horizontal y vertical limitado al libro, páginas izquierda/derecha en libro abierto, gestos opcionales con salida explícita y restablecimiento. Separar medidas visuales y lógicas para conservar paginación, ubicación y voz. Preferencias locales y sincronización solo voluntaria; edición por gestos desactivada en cada arranque. Diez idiomas, vista de una página/libro abierto, temas y encuadernaciones conservados. Las versiones 2.10–2.13 siguen pendientes.


## 2.10 — Arrastre de esquinas

Autorizada tras verificar 2.9. Las esquinas superiores e inferiores permiten pasar hojas con ratón o dedo, avanzando o retrocediendo. El movimiento sigue el arrastre; al soltar confirma si supera el umbral o vuelve al origen. Cancelar no navega, guarda otra posición ni suspende el seguimiento de voz. Escape, pérdida de captura, cambio de libro, navegación externa o cambio de tamaño cancelan el gesto pendiente. Opción en Tema → Libro sobre la mesa; la lectura continua y el modo minimalista conservan sus gestos. Se respeta movimiento reducido y transición desactivada. Las versiones 2.11–2.13 siguen pendientes.
