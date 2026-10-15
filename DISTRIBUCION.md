# Distribución de Lector 1.9

[Descargas verificadas](https://github.com/AlejandroPico/Lector/releases/latest) · [Aplicación web](https://alejandropico.github.io/Lector/) · [Privacidad](https://alejandropico.github.io/Lector/privacidad.html)

## Instalación

| Plataforma | Archivo / método | Requisitos |
| --- | --- | --- |
| Web instalable | Instalar Lector desde el menú del navegador; en iPhone, Safari → Compartir → Añadir a inicio | Navegador moderno; requiere conexión para cargar la web. No incorpora caché sin conexión ni copias automáticas. |
| Windows | `Windows-x64-Setup.exe`; ZIP como alternativa portátil | Windows 10/11 de 64 bits. Instalador sin certificado comercial: el sistema puede mostrar el aviso de editor desconocido. |
| macOS | DMG/ZIP `arm64` para Apple Silicon, `x64` para Intel | macOS 12 o posterior. Sin firma/notarización de Apple; el sistema puede bloquear su apertura. |
| Linux | AppImage o DEB `x64` | Distribución de 64 bits compatible con Electron/GTK3. Voces según el servicio instalado en el sistema. |
| Android / Android TV | `Android-TV.apk`, firmado con una clave estable del proyecto | Android 8 o posterior. Habilitar la instalación de esta aplicación desde el gestor de archivos elegido. |
| Google Play | `Google-Play.aab` | Bundle firmado para preparar la ficha de móvil/tableta/TV y su revisión; no es un archivo de instalación directa. |
| iPhone / iPad | Archivo Xcode sin firma y aplicación de simulador | iOS/iPadOS 17.4 o posterior. La instalación real/TestFlight/App Store requiere cuenta, certificados y perfiles propios de Apple. El ZIP no es un IPA instalable. |

El APK incluye entrada Android TV, banner e interfaz adaptada al mando. Sirve para **Chromecast con Google TV** (el que tiene mando), televisores con Android TV y móviles/tabletas Android. Los Chromecast clásicos, LG webOS y Samsung Tizen no instalan APK. No incluye envío de audio a Chromecast, Google Home o Alexa: esa tarea está aplazada.

Los archivos y `SHA256SUMS.txt` se publican después de aprobar las comprobaciones y las compilaciones de todas las plataformas. En GitHub Actions queda el registro de cada compilación. La verificación de compilación no sustituye la revisión en dispositivos físicos y las tiendas.

## Libros, voz y datos

- El instalable incorpora el lector. EPUB, MOBI, AZW3, PDF, DOCX y TXT se abren por selección; los originales no se modifican. También acepta archivos enviados por el sistema.
- Escritorio y móviles ofrecen selectores nativos de carpetas y destinos de exportación. El catálogo enumera nombres y referencias: lee el libro o la portada solo cuando lo solicitas. El proveedor de nube puede descargar el archivo elegido; Lector no descarga toda la biblioteca.
- Cada instalación tiene almacenamiento propio. La versión web y el instalable no comparten automáticamente los datos. La sincronización existente sigue siendo voluntaria, revisada y por categorías; no sube ebooks ni audio. OneDrive con registro Microsoft permanece disponible en la web; las aplicaciones muestran esa indicación y permiten WebDAV cuando el servidor admite su origen.
- Windows usa las voces disponibles en Chromium/sistema; Android e iOS tienen adaptadores de voz del sistema con marcas reales de posición y controles multimedia. Calidad, idiomas y resaltado dependen del motor instalado. Android mantiene un servicio de reproducción con notificación; Apple habilita audio en segundo plano. No se solicita micrófono.
- Se conservan las opciones de voz por API y motor local. Un servicio local de otro ordenador no se encuentra en `localhost` del teléfono: requiere una dirección accesible y los permisos del proveedor. No se instalan motores ni se activan facturaciones.
- Las claves API siguen siendo de sesión. Los guardados requieren selección explícita de destino. En TV sin servicio de impresión no se muestra exportación PDF por impresión.

## Preparación de tiendas

Identificador: `io.github.alejandropico.lector`. Versión: `2.0.0`. Android versionCode: `2000000`. Categoría: libros/educación. Diez idiomas de interfaz. Iconos y banner TV proceden del `favicon.svg` del proyecto; Apple incorpora manifiesto de privacidad.

`distribution/store-metadata.json` contiene textos y enlaces iniciales; `distribution/apple` contiene permisos y plantilla de exportación. Los campos de identidad del titular quedan pendientes de su cuenta real. Antes de enviar:

1. Crear las cuentas del titular y completar identidad, contacto público, fiscalidad y clasificación de edad. Revisar derechos y licencia comercial del proyecto y sus recursos.
2. Google Play: elegir Play App Signing conservando esta clave como clave de subida, completar Data Safety y declaración del servicio foreground `mediaPlayback`; revisar compatibilidad TV, capturas y política vigente. No cambiar el identificador/clave después de instalar sin plan de migración.
3. Apple: seleccionar el equipo en Xcode, crear perfiles, firmar el archivo para TestFlight/App Store y comprobarlo en iPhone/iPad reales. Completar privacidad según los servicios configurados y sus proveedores. macOS requiere Developer ID/notarización para distribución directa; Mac App Store exige un paquete y permisos sandbox específicos, no este DMG.
4. Microsoft Store: reservar identidad real y generar MSIX con el Publisher asignado. El instalador NSIS descargable no se presenta como un MSIX firmado. Revisar la ficha, capturas y requisitos de accesibilidad.
5. Capturar móvil, tableta y TV reales; comprobar mando, importación de libros, voz, bloqueo de pantalla y pausa. Las cuentas, tarifas y decisiones de publicación pertenecen al titular; no se ha enviado nada a tiendas.

Privacidad: no anuncios, seguimiento ni servidor propio que reciba bibliotecas. Los servicios opcionales sí pueden recibir los fragmentos o categorías confirmados; las declaraciones de tienda deben reflejar su uso efectivo, no afirmar que nunca hay transferencias externas.

## Compilar y mantener firmas

Node 24: `npm ci`, `npm run icons`, `npm run build`. Escritorio: `npm run desktop` / `npm run desktop:pack`. Móviles: `npm run native:sync`; Android requiere JDK 21 y SDK 36; iOS requiere Xcode 26 o posterior en macOS. El flujo `Compilar instaladores` reproduce y publica los paquetes.

Android se firma mediante los secretos cifrados del repositorio `LECTOR_ANDROID_KEYSTORE` y `LECTOR_ANDROID_PASSWORD`. La copia privada original se guarda fuera de Git y OneDrive, en `%LOCALAPPDATA%/Lector/signing`, con contraseña protegida por Windows. No se incluye en el código, paquetes ni registros. El titular debe custodiar una copia segura de esta clave para futuras actualizaciones. Apple y Microsoft no tienen certificados de cuenta configurados; no se inventan identidades de firma.
