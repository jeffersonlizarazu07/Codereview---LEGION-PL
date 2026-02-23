# Documento de Decisiones Técnicas
## Code Review Agent — Legion PL

---

## 1. Arquitectura elegida y por qué

### LangGraph como framework agéntico
Elegí LangGraph porque permite definir el flujo del agente como un grafo
explícito con estado compartido. A diferencia de cadenas lineales, puedo
controlar exactamente qué nodo se ejecuta en qué condición.

El grafo tiene 5 nodos:
```
router → fetch_diff → qa_node    → END
                   → review_node → END
```

### Router como nodo independiente
En vez de pedir al usuario que seleccione el modo manualmente, usé un nodo
router que clasifica el intent con el LLM. El usuario simplemente escribe
y el agente decide si es Q&A o code review automáticamente.

### FastAPI sobre Flask
FastAPI tiene soporte nativo para async/await, crítico para:
- Llamadas concurrentes a GitHub API
- Streaming SSE sin bloquear el event loop
- Ejecutar LangGraph con ainvoke/astream_events

### Google Gemini Flash 2.0 via OpenRouter
- Costo: ~$0.075/1M tokens — el budget de $15 aguanta cientos de requests
- Velocidad: latencia baja, ideal para streaming
- Contexto: 1M tokens, suficiente para múltiples archivos

### Streaming con Server-Sent Events
Para code reviews de archivos grandes el LLM puede tardar 15-30 segundos.
Sin streaming la UX sería inaceptable. Con SSE el usuario ve los tokens
aparecer en tiempo real y recibe feedback del estado del agente.

### React + TypeScript para el frontend
Era el stack que ya dominaba, lo que permitió concentrar el esfuerzo en
aprender Python/LangGraph en el backend sin fricciones en el frontend.

---

## 2. Trade-offs considerados

### Fetch completo de archivos vs. solo el diff
**Decisión**: Fetch tanto el diff como el contenido completo del archivo.

**Por qué**: El diff muestra qué cambió, pero el LLM necesita contexto
completo para detectar bugs como race conditions o violaciones de interfaces.
Solo con el patch hay demasiados falsos negativos.

**Trade-off**: Más tokens = más costo y latencia. Mitigado truncando archivos
a 4000 chars y limitando a 5 archivos en contexto simultáneo.

### Un solo nodo de review vs. review por archivo
**Decisión**: Un solo nodo analiza todos los archivos en un prompt.

**Por qué**: Simplicidad. Un nodo por archivo requeriría paralelismo en el
grafo y manejo de estado más complejo.

**Trade-off**: Para PRs con 20+ archivos el contexto se vuelve muy largo.
Solución futura: dividir en batches y agregar resultados.

### Historial conversacional en Q&A
**Decisión**: El agente mantiene historia de mensajes en el estado.

**Por qué**: Preguntas de seguimiento como "¿cómo se puede arreglar eso?"
necesitan contexto previo para ser útiles.

**Trade-off**: Cada mensaje envía toda la historia al LLM, incrementando
costos con conversaciones largas.

---

## 3. Qué haría diferente con más tiempo

### Embeddings y búsqueda semántica (RAG)
Para Q&A sobre el repositorio completo implementaría un pipeline RAG:
1. Indexar el repo con embeddings (ChromaDB o Pinecone)
2. Buscar fragmentos relevantes por similitud semántica
3. Inyectarlos en el contexto del LLM

Esto habilitaría preguntas sobre cualquier parte del repo, no solo
los archivos del PR.

### Cache de diffs y archivos
Actualmente cada request re-fetcha el diff de GitHub. Con Redis o un
dict en memoria, los fetches subsecuentes de la misma rama serían
instantáneos.

### Output estructurado con Pydantic
Actualmente el review se parsea con formato de texto (---FINDING---).
Usaría structured_output de LangChain para que el LLM retorne
directamente List[Finding] con Pydantic, eliminando el parsing frágil.

### Tests automatizados
- Unit tests para cada nodo con mocks de GitHub API
- Integration tests del grafo completo con fixtures de diffs reales
- E2E tests del API con httpx

### Streaming paralelo de nodos
Para PRs grandes, analizar cada archivo en paralelo y agregar
resultados reduciría significativamente la latencia.

---

## 4. Problemas encontrados y cómo los resolví

### Nombres de ramas incorrectos
Las ramas del repo minidyn no tenían el prefijo feature/ como asumí
inicialmente. Las ramas reales son feat/partiql-support,
feat/support-streaming y feat/support-batch-read-ops.

**Solución**: Consultar directamente la GitHub API en
/repos/{owner}/{repo}/branches para obtener los nombres reales.

### El router respondía como mensaje final
El nodo router generaba "qa" o "review" como texto y ese token
llegaba al frontend como respuesta del agente.

**Solución**: Filtrar eventos de streaming por metadata.langgraph_node
para capturar solo tokens de qa_node y review_node, ignorando
los del router.

### Context window overflow
Archivos Go grandes de 2000+ líneas agotaban el contexto del LLM
o encarecían demasiado cada request.

**Solución**: Truncar archivos a 4000 chars y limitar a 5 archivos
simultáneos en contexto. Para archivos ignorados incluir solo el patch.

### node_modules y venv en git
Al inicializar git en subcarpetas y luego moverlo a la raíz,
los .gitignore no aplicaban correctamente.

**Solución**: Usar git rm -r --cached . para limpiar el índice
y re-agregar todos los archivos con el .gitignore correcto en la raíz.

### Return dentro de async generator
FastAPI no permite return con valor dentro de una función que usa yield.

**Solución**: Mantener generate() como función interna y el
return StreamingResponse() fuera de ella al mismo nivel.