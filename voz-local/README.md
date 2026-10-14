# Voz local en Lector 1.4

Piper produce WAV en el equipo, sin cuenta, clave ni facturación por uso. Tras preparar el motor y descargar una voz, la síntesis funciona sin Internet. La web aún necesita estar abierta: el arranque sin conexión se incorporará en su propia entrega.

Esta primera integración utiliza un pequeño servidor opcional; no es todavía el instalador de Lector. Requiere Python 3.10–3.12 de 64 bits y memoria disponible para ONNX. Windows, Linux y macOS dependen de la disponibilidad del paquete de Piper para su arquitectura. La evaluación real de esta entrega se hizo en Windows x64, CPU, español de España.

Desde la carpeta del proyecto, preparación explícita en Windows:

```powershell
py -3.12 -m venv .voice-env
.\.voice-env\Scripts\python.exe -m pip install -r voz-local/requirements.txt
.\.voice-env\Scripts\python.exe -m piper.download_voices --data-dir voz-local/modelos es_ES-sharvard-medium
.\.voice-env\Scripts\python.exe voz-local/servidor.py
```

En Linux/macOS, utiliza `python3 -m venv .voice-env` y `.voice-env/bin/python` en las otras instrucciones. Cierra el servidor con Ctrl+C. En Lector, abre **Voz → Servicio → Piper**, pulsa **Buscar voces locales**, elige el modelo y su interlocutor (0 o 1 para Sharvard), y prueba la voz. Chrome puede pedir permiso para acceder a la red local. Si lo deniegas, la conexión no funcionará. El servidor escucha exclusivamente en 127.0.0.1 y solo acepta la web publicada y los orígenes locales documentados; no se expone a otros equipos.

La descarga Sharvard ocupa aproximadamente 77 MB; Python, Piper y sus dependencias ocupan espacio adicional. Modelos y entorno se excluyen de Git. Para otras voces usa el catálogo oficial de Piper y conserva su ficha `MODEL_CARD` en `voz-local/modelos`. La lista ofrece los modelos realmente instalados, su idioma y número de interlocutores. No se afirma cobertura de los diez idiomas de la interfaz.

Piper permite interlocutor, velocidad y variación sonora/fonética; **no entiende instrucciones libres de emoción**. No equivale a la voz de ChatGPT y la naturalidad depende del modelo. No clona voces ni infiere sexo o identidad de personajes.

## Licencias y atribución

- Motor [OHF-Voice/Piper](https://github.com/OHF-Voice/piper1-gpl): GPL-3.0-or-later. `servidor.py`, que usa su API, se distribuye con la misma licencia; el resto de la web se comunica por HTTP. [Texto de GPL 3](https://www.gnu.org/licenses/gpl-3.0.html).
- [Ficha Sharvard](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/sharvard/medium/MODEL_CARD): español de España, dos hablantes, 22.050 Hz. Datos Spanish Harvard de la Universidad de Edimburgo bajo CC BY 3.0; [fuente y autores](https://datashare.ed.ac.uk/handle/10283/574). Ajustado a partir de Lessac; revisar también [su ficha](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/medium/MODEL_CARD). Las fichas documentan las licencias de datos y procedencia, no conceden derechos universales sobre cualquier voz. La exportación conserva el texto aportado por el usuario y su modelo seleccionado.
- No se redistribuyen pesos ni se descargan automáticamente al abrir Lector.

## Otros servicios

OpenAI y servicios compatibles mantienen su formato de audio. ElevenLabs dispone de adaptador propio: dirección base `/v1/text-to-speech`, identificador de voz, modelo y estabilidad, autenticación `xi-api-key`. Cada servicio exige CORS y puede cobrar. Las claves viven solo en memoria y se borran al cambiar de servicio o dirección. Configura su tarifa y límites antes de generar. [API de ElevenLabs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).

## Evaluación 1.4

Modelo de 76.733.615 bytes, CPU Windows x64. Primera síntesis medida: 6,52 s de cálculo para 5,89 s de audio mono a 22.050 Hz. Estas cifras dependen del equipo y del calentamiento del modelo; no garantizan lectura en tiempo real ni calidad emocional. Se verificaron generación, decodificación, dos interlocutores y ausencia de llamadas de síntesis a la nube. La valoración de naturalidad debe hacerse escuchando la voz.
