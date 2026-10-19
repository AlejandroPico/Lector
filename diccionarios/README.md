# Diccionarios del lector

Los paquetes Wiktionary de esta carpeta se ofrecen para instalación voluntaria. Vite detecta los archivos al iniciar el desarrollo o compilar. No se incluyen los bloques en la carga inicial ni se instalan al abrir un libro.

Desde 2.3, una consulta explícita puede leer un bloque de definiciones del propio proyecto y su bloque de gramática, comprobando tamaño y SHA-256. No instala el paquete ni envía la palabra a un proveedor externo: solicita únicamente archivos estáticos del mismo origen. En Android/escritorio esos archivos forman parte del paquete; en web pueden necesitar conexión. La instalación voluntaria guarda todos los bloques en IndexedDB para futuras consultas sin conexión. Los diccionarios personales y paquetes ya instalados tienen prioridad; las instalaciones antiguas se conservan con su identidad, sin reemplazos automáticos.

La subcarpeta `grammar` de cada idioma contiene pares `[palabra, [categorías]]`. El manifiesto recoge sus huellas, tamaños, cobertura, fuente, fecha y huella de la descarga original. Son las categorías `pos` suministradas por [Wiktextract](https://github.com/tatuylonen/wiktextract), no inferencias sobre el contexto ni sobre terminaciones de palabras. Un lema puede tener varias categorías. Los recursos antiguos/personales sin ese campo muestran «Categoría no indicada». Comparten la atribución y licencia CC BY-SA 4.0 de las definiciones. Se han filtrado a los lemas existentes y conservado los alias chinos de la fuente. Reconstrucción: `node --max-old-space-size=4096 scripts/build-dictionary-grammar.mjs`; idiomas opcionales como argumentos, caché de fuentes opcional en `LECTOR_GRAMMAR_SOURCES`, reconstrucción deliberada con `LECTOR_REBUILD_GRAMMAR=1`.

Cada idioma tiene un manifiesto `wiktionary.dictionary.json` y 64 bloques `00.json.gz`–`63.json.gz`. El manifiesto contiene cobertura, tamaño, idioma de definiciones, procedencia, licencia y SHA-256 de cada bloque. Los bloques contienen pares `[palabra normalizada, definición textual]`. Se agrupan mediante la función de `src/dictionary-core.js`; el gestor verifica las huellas y la distribución antes de activar el paquete.

Son derivados de Wiktionary (contribuidores), extraídos con Wiktextract y publicados por [Kaikki.org](https://kaikki.org/dictionary/rawdata.html). Los textos derivados se distribuyen bajo **CC BY-SA 4.0**: [licencia](https://creativecommons.org/licenses/by-sa/4.0/), [texto legal](https://creativecommons.org/licenses/by-sa/4.0/legalcode.es), [condiciones de Wikimedia](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use). La atribución por entrada se mantiene mediante enlaces a la página correspondiente en Wiktionary, que incluye su historial de autores. No se incluyen citas de ejemplos, audio ni imágenes de las fuentes.

Cambios respecto a las fuentes: normalización Unicode NFC y minúsculas, agrupación de glosas por palabra, eliminación de duplicados, hasta doce glosas y 10.000 caracteres por entrada; se omiten otros campos. En chino se conservan las variantes ortográficas simplificadas y tradicionales indicadas por la fuente. Las filas de origen no válidas se cuentan en el manifiesto. Son diccionarios colaborativos con lemas y formas flexionadas, cobertura variable y posibles errores de extracción; no son una garantía de que exista cualquier palabra ni una sustitución oficial de un diccionario académico. Algunas entradas pueden contener solo una descripción gramatical.

Español, francés, alemán, portugués, italiano, chino y japonés utilizan las respectivas ediciones de Wiktionary, con definiciones en esos idiomas. Inglés usa la edición inglesa. Catalán e hindi usan por ahora la edición inglesa, con definiciones **en inglés**; el gestor y cada consulta lo indican. Se pueden añadir recursos monolingües propios sin cambiar el motor.

Para reconstruir los paquetes: `node --max-old-space-size=4096 scripts/build-dictionaries.mjs`. El script descarga y procesa las fuentes en streaming, sin guardar los grandes archivos originales. Los manifiestos existentes se reutilizan; `LECTOR_REBUILD_DICTIONARIES=1` permite una reconstrucción explícita. Los manifiestos registran las URLs y la fecha de creación; la fuente puede actualizarse entre reconstrucciones.

## Recursos propios

Puedes colocar un JSON de palabras y definiciones en `diccionarios/es/mi-diccionario.json` (o `ca`, `en`, `fr`, `de`, `pt`, `it`, `zh`, `ja`, `hi`). Se ofrecerá en el gestor tras compilar. El archivo se importa solo al pulsar Instalar. También se puede seleccionar desde la interfaz, sin modificar el proyecto.

Formato sencillo:

```json
{"sosiego":"Tranquilidad o serenidad."}
```

Formato con metadatos:

```json
{"name":"Mi diccionario","language":"es","definitionLanguage":"es","license":"Personal","entries":{"sosiego":"Tranquilidad o serenidad."}}
```

La importación individual admite hasta 64 MB y un millón de palabras. Para paquetes mayores se utiliza el formato dividido en bloques del manifiesto. Los paquetes y el vocabulario personal se conservan en IndexedDB, no en la carpeta Descargas. Los paquetes instalados se consultan sin red; el acceso a los recursos del proyecto sin instalar puede cargar los bloques necesarios. Borrar los datos del sitio en el navegador elimina lo instalado; el vocabulario no se elimina al quitar un paquete.
