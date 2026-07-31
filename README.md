# Quiz Rally

MVP de trivia multijugador en tiempo real. Las salas viven en memoria, no requieren cuentas y se comparten por enlace o código. El servidor decide el puntaje combinando acierto y velocidad.

## Iniciar

Requiere Node.js 20 o posterior.

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`. Para simular varios jugadores, usá distintas ventanas o dispositivos en la misma red (reemplazando `localhost` por la IP local del anfitrión).

Para ejecutar sin modo de desarrollo:

```bash
npm start
```

## Verificación

```bash
npm test
npm run build
```

## Configuración y preguntas

- `game/question-provider.js`: adaptador server-side de The Trivia API. Antes de cada partida obtiene preguntas revisadas, descarta las marcadas como nicho y arma 6 fáciles, 3 medias y una final difícil.
- `game/questions.js`: tiempos, valores por ronda y banco semilla local de diez preguntas en inglés.
- Cada pregunta implementa `{ id, category, prompt, options, correctIndex }`.
- El proveedor decodifica entidades HTML y mezcla las opciones. Si la API falla, excede el timeout o no tiene suficientes preguntas de alguna dificultad, la partida usa el banco local completo.
- El anfitrión puede elegir una categoría única o `All categories` en el lobby. Si entra el fallback local, la interfaz lo identifica como un banco mixto.
- Para incorporar otra API o base de datos, conservá la misma interfaz. La respuesta correcta nunca se envía al cliente hasta la fase de revelado.
- Las salas son efímeras y se pierden al reiniciar el servidor, una decisión deliberada para este MVP.
- La identidad anónima del jugador se guarda en el navegador y permite retomar una sala tras recargar o reconectar. Una sala completamente vacía se conserva durante 5 minutos; si el host no vuelve en 15 segundos, el rol pasa a otro jugador conectado.
- Al terminar, el host puede usar `Play again` para volver al lobby con los mismos jugadores, enlace y categoría; los puntajes se reinician.
