# Contexto mediante IA

En Ajustes → Idiomas y contexto → Explicaciones y traducción se elige el motor. Seleccionar una palabra → En contexto muestra el fragmento editable; solo la acción Consultar/Enviar ejecuta la consulta. La respuesta es generada y puede ser incorrecta. No sustituye al diccionario.

- IA del navegador: comprobación sin crear sesión; descarga solo al consultar expresamente. Admite los idiomas que declare el navegador y el dispositivo. Chrome documenta español, inglés, francés, alemán y japonés; escritorio compatible, RAM/CPU/GPU y espacio libre suficientes. No se promete disponibilidad móvil. Se libera cada sesión; no se conserva el historial del modelo.
- Ollama: servicio propio y modelo instalado, configuración local sin nube. Los modelos cloud de Ollama no equivalen a procesamiento local. El navegador puede exigir permisos de acceso local y CORS autorizado por el propietario del servicio.
- API compatible: dirección HTTPS, modelo y clave de sesión. Puede facturar. No se consume ni se llama automáticamente al abrir el menú.

Las modalidades gratuitas de ChatGPT/Claude web no son APIs para incrustar: no se automatizan ni se reutilizan sesiones del navegador. La aplicación no descarga modelos de terceros por sí sola ni cobra servicios.

Fuentes: https://developer.chrome.com/docs/ai/prompt-api ; https://docs.ollama.com/faq
