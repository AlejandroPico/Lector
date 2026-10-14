# Emisión de Lector (1.6)

**Ajustes → Dispositivos → Emitir lectura**. Elige un capítulo WAV guardado en Lector o un archivo WAV, MP3, Ogg, FLAC o M4A. Para obtener capítulos con Piper u otra API usa «Audio por capítulos»: esa generación es una acción separada y conserva sus límites de coste. Las voces del navegador no proporcionan archivos de audio para emitir.

## Puente local

Python 3.10 o posterior, sin dependencias adicionales. Compila el proyecto con `npm ci` y `npm run build`. Inicia desde la raíz:

```powershell
python emision-local/servidor.py --red --direccion 192.168.1.20
```

Sustituye la dirección por la IPv4 del ordenador en tu red. `--red` permite recibir conexiones de otros dispositivos; sin esa opción solo escucha en el ordenador. Si Windows solicita permiso de red, permite únicamente tu red privada. No abras puertos del router. En el lector deja el servicio `http://127.0.0.1:5056`; Chrome puede solicitar permiso para acceder a la red local.

El servicio guarda únicamente el audio elegido en una carpeta temporal del sistema, nunca en Descargas. Máximo 128 MB por sesión y ocho sesiones; caducidad configurable de 5 a 360 minutos. Detener emisión revoca el enlace y elimina el audio temporal. Las sesiones caducadas se eliminan al recibir otra petición; cerrar el servicio limpia su carpeta temporal. No modifica ebooks ni recorre carpetas.

Los enlaces contienen una clave temporal: quien tenga el enlace y acceso a la red podrá reproducirlo. No se guardan en las preferencias ni se envían a terceros. La red local utiliza HTTP; úsalo en una red de confianza. Solo el lector en el ordenador puede crear, cargar, controlar y revocar sesiones. Si desarrollas en otro origen, autorízalo deliberadamente con `--origen http://localhost:PUERTO`. La configuración inicial permite la web publicada y el desarrollo en 5177.

## Tres destinos

- **Receptor en navegador:** inicia emisión y copia el enlace al navegador de otra pantalla o televisor. Muestra título, capítulo, audio y texto sincronizado opcional. Pulsa Play en el receptor si el navegador bloquea la reproducción automática. Puedes pausar, reanudar y desplazarte desde Lector. El enlace funciona mientras el ordenador y el servicio sigan encendidos. La compatibilidad de audio depende del navegador del televisor.
- **Google Cast · solo audio:** Chrome abre el selector de dispositivos. Usa el receptor estándar de Google, sin registrar una aplicación. Google Home y Chromecast deben estar en la misma red y poder acceder al ordenador. Su interfaz es la del receptor estándar.
- **Google Cast · interfaz Lector:** utiliza nuestro `receptor.html`, con presentación mínima a pantalla completa. Requiere registrar un receptor personalizado en la [consola de Google Cast](https://developers.google.com/cast/docs/registration). Configura como URL `https://alejandropico.github.io/Lector/receptor.html`, habilita dispositivos de audio si los necesitas y pega el identificador de ocho caracteres en Lector. Durante desarrollo registra también el dispositivo de prueba. No se incluye un identificador ajeno ni se simula el registro.

«Compartir texto sincronizado» viene apagado. Los nuevos capítulos generados guardan los tiempos reales de cada fragmento de audio; al activarlo se comparten esos fragmentos. No es alineación por palabra. Audios antiguos y archivos externos sin tiempos muestran título y controles. No se envía automáticamente el libro completo, sus notas, claves de API ni biblioteca. Cerrar el menú de emisión no detiene la sesión ni interrumpe la narración local; usa sus botones de pausa explícitos si quieres evitar dos reproducciones.

## Dispositivos y Matter

La primera vía es Google Cast para Google Home y Chromecast. Un Chromecast con mando suele ser un modelo con Google TV, pero es necesario comprobar el modelo exacto. LG/Samsung pueden usar un Chromecast externo; su recepción integrada y su navegador dependen del modelo y año. No se promete compatibilidad de todos los televisores.

[Matter](https://csa-iot.org/all-solutions/matter/) y [Matter Casting](https://developer.amazon.com/docs/fire-tv/overview-of-matter-casting.html) tienen funciones distintas. Ser controlador Matter no implica recibir audiolibros. No se incorpora una opción Matter inoperante: sus clientes nativos, receptores y requisitos de registro se evaluarán al distribuir aplicaciones nativas. La presentación y el audio de este receptor son independientes del transporte.

Referencias oficiales: [formatos de Google Cast](https://developers.google.com/cast/docs/media), [emisor web](https://developers.google.com/cast/docs/web_sender/integrate), [receptor propio](https://developers.google.com/cast/docs/web_receiver/basic). Las pruebas automáticas usan el servicio real y dos navegadores, además de un SDK simulado; no sustituyen una prueba en tus Google Home, Chromecast o televisores.
