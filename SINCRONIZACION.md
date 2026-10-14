# Sincronización voluntaria (1.7)

**Ajustes → Datos → Sincronizar dispositivos**. Viene desactivada. Elige servicio y datos: posiciones, notas/subrayados/marcadores y, opcionalmente, preferencias de lectura. Pulsa «Revisar sincronización» y después «Confirmar sincronización». Abrir ajustes, arrancar Lector o leer no inicia peticiones de sincronización. Se usa tu cuenta y su almacenamiento o tu servidor, sin un servicio central de Lector.

## Datos y conflictos

Las posiciones y notas se vinculan por SHA-256 de los bytes del ebook: abre **el mismo archivo** en ambos dispositivos. Una edición distinta o un EPUB modificado por Calibre tiene otro identificador; no se aplican sus anclas a otra edición. Se comparten identificador, título/autor, ubicación y las notas seleccionadas, incluidas sus citas y colores. Las notas se reúnen por identificador, conservando la edición más reciente. Las eliminaciones llevan una marca para que una copia antigua no vuelva a introducir la nota. Los relojes de los equipos deben tener fechas correctas.

Las preferencias incluyen idioma, temas/colores, tipografía, columnas, márgenes y seguimiento. Puedes conservar las de este dispositivo o las recibidas. No se transfieren fuentes personales; si no están disponibles se utiliza una alternativa. Elegir solo preferencias no envía títulos ni catálogo.

No se suben ebooks, PDF originales, audio, cubiertas, fuentes, diccionarios, traducciones, rutas, referencias del sistema de archivos, claves, contraseñas, enlaces de emisión ni configuración de proveedores de voz. Desmarcar una categoría impide compartir sus cambios locales y aplicarle cambios recibidos; conserva los datos ya compartidos en el destino, sin borrarlos.

Las posiciones en conflicto aparecen por título y porcentaje. La elegida se comparte como una nueva decisión. Una posición recibida se restaura al abrir de nuevo el archivo; no mueve de golpe una lectura en curso ni corta la voz. Si después sigues leyendo localmente, tu nuevo avance prevalece en la siguiente apertura. Las notas recibidas aparecen de inmediato. Puedes sincronizar antes de abrir el ebook: se guarda la información pendiente dentro del navegador y se vincula al abrir el mismo archivo; no crea libros ficticios ni descarga ebooks.

## OneDrive

Necesita **una aplicación registrada del proyecto**, no una clave de ChatGPT ni una contraseña Microsoft pegada en Lector. Inicia sesión en la ventana oficial de Microsoft en cada dispositivo, con la misma cuenta y el mismo identificador de aplicación.

Preparación del autor:

1. Registra Lector en Microsoft Entra. La conexión usa `common`; para admitir cuentas personales y de trabajo selecciona ambos tipos en el registro.
2. Añade plataforma **Single-page application (SPA)** y redirección exacta `https://alejandropico.github.io/Lector/sincronizacion.html`. Para desarrollo puedes añadir `http://127.0.0.1:5177/sincronizacion.html`.
3. Configura el permiso delegado **Files.ReadWrite.AppFolder** de Microsoft Graph. No se solicita acceso general a tu biblioteca. No publiques un secreto de cliente: la web utiliza Authorization Code con PKCE.
4. Introduce el ID público en la variable de repositorio **VITE_MICROSOFT_CLIENT_ID** de GitHub Actions y vuelve a publicar; será el valor inicial para todos. En desarrollo usa `.env` a partir de `.env.example`. También puede introducirse en el diálogo para probar un registro propio.

Sin ese registro, OneDrive está preparado pero **no puede iniciar una sesión real**. No se reutiliza el ID de otra aplicación. Una organización puede exigir consentimiento; si deniega el permiso se conserva el error, sin ampliar automáticamente el acceso.

Solo utiliza `Apps/<nombre de la aplicación>`, independiente de tus carpetas de Calibre. Cada dispositivo escribe una instantánea propia, evitando sustituir el archivo de otro dispositivo. Tras escribir correctamente conserva la nueva y las dos anteriores del mismo dispositivo; no limpia copias de otros dispositivos. Lee la más reciente de cada uno y las combina. No es un historial de copias de seguridad ilimitado.

El token permanece en memoria durante esta sesión, sin localStorage ni IndexedDB y sin renovación permanente. Al caducar debes iniciar sesión otra vez. «Desconectar» borra la credencial de Lector, conservando los datos. Los enlaces de descarga de Microsoft se usan inmediatamente sin reenviarles el token de Graph ni guardarlos.

## WebDAV / servidor personal

Indica la **URL HTTPS completa de un archivo JSON privado**, por ejemplo `https://tu-servidor/carpeta-privada/lector.json`, y una contraseña de aplicación limitada a esa carpeta. Crea previamente la carpeta. Para pruebas locales solo se admite HTTP en localhost/127.0.0.1; una dirección de red requiere HTTPS.

El servidor debe admitir GET/PUT, ETag fuerte entre comillas y escrituras condicionales **If-Match**; para archivo nuevo, **If-None-Match: \***. También OPTIONS y CORS para `https://alejandropico.github.io`: autorizar GET/PUT y cabeceras Authorization, Content-Type, If-Match e If-None-Match; exponer ETag al navegador. En desarrollo autoriza el origen utilizado. La autenticación es Basic mediante usuario y contraseña de aplicación sobre HTTPS, o acceso autorizado por el propio servidor.

Lector no configura tu servidor, no crea carpetas y rechaza redirecciones para no reenviar credenciales. Si alguien cambia el archivo después de la revisión, la confirmación se rechaza: vuelve a revisar. No sustituye silenciosamente la versión remota. La contraseña se mantiene solo en memoria y en el campo durante la sesión, y se limpia al desconectar o cambiar de dirección/destino.

## Límites y comprobaciones

Máximo 10 MB por documento, 10.000 identificadores de libro y 50 dispositivos OneDrive. Se comprueba el tamaño durante la recepción, incluso sin Content-Length, y se validan formato y campos. Una revisión bloquea otra sincronización en pestañas del mismo navegador cuando Web Locks está disponible; cerrar o cancelar libera el bloqueo. Cancelar interrumpe la operación pendiente, pero no revierte una escritura que el servidor ya haya aceptado.

Probado con **servidor HTTP real con ETag y dos contextos independientes de navegador**: notas, eliminaciones, conflictos, posiciones y vínculo posterior al mismo ebook. Microsoft y Graph se comprueban con respuestas controladas, incluyendo PKCE y aislamiento COOP. **No se ha accedido a una cuenta OneDrive real ni registrado una aplicación Microsoft en tu nombre.** Queda activar el registro y probar el consentimiento con tu cuenta.

Referencias: [carpeta de aplicación](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder), [PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [descarga desde JavaScript](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0), [acceso con COOP](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/redirect-bridge.md), [escrituras condicionales HTTP](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1).
