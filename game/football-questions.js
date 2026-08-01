import { shuffle } from "./question-provider.js";

// Football Night ships a deliberately curated bilingual bank. Each answer is
// keyed before localization, so changing language can never change which
// option is correct. Keep future additions as stable facts and review both
// language variants together before publishing them.
let footballQuestionSequence = 0;
const footballQuestions = [
  q("easy", "Basics", "Reglas", "How many players does each team normally start with on the pitch?", "¿Con cuántos jugadores comienza normalmente cada equipo en la cancha?", ["9", "10", "11", "12"], ["9", "10", "11", "12"], 2),
  q("easy", "World Cup", "Copa Mundial", "How often is the men's FIFA World Cup normally played?", "¿Cada cuánto se juega normalmente la Copa Mundial masculina de la FIFA?", ["Every 2 years", "Every 3 years", "Every 4 years", "Every 5 years"], ["Cada 2 años", "Cada 3 años", "Cada 4 años", "Cada 5 años"], 2),
  q("easy", "Players", "Jugadores", "Which national team does Lionel Messi represent?", "¿A qué selección representa Lionel Messi?", ["Argentina", "Spain", "Uruguay", "Portugal"], ["Argentina", "España", "Uruguay", "Portugal"], 0),
  q("easy", "National teams", "Selecciones", "Which color is most associated with Brazil's home shirt?", "¿Qué color se asocia principalmente con la camiseta titular de Brasil?", ["Red", "Yellow", "Black", "Purple"], ["Rojo", "Amarillo", "Negro", "Violeta"], 1),
  q("easy", "Rules", "Reglas", "Which player may use their hands inside their own penalty area?", "¿Qué jugador puede usar las manos dentro de su propia área penal?", ["The captain", "The striker", "The goalkeeper", "Any defender"], ["El capitán", "El delantero", "El arquero", "Cualquier defensor"], 2),
  q("easy", "Rules", "Reglas", "What normally happens to a player shown a red card?", "¿Qué ocurre normalmente cuando un jugador recibe una tarjeta roja?", ["They take a penalty", "They leave the match", "They change teams", "They become captain"], ["Patea un penal", "Debe abandonar el partido", "Cambia de equipo", "Se convierte en capitán"], 1),
  q("easy", "World Cup", "Copa Mundial", "Which country won the men's 2022 FIFA World Cup?", "¿Qué país ganó la Copa Mundial masculina de la FIFA 2022?", ["France", "Argentina", "Brazil", "Croatia"], ["Francia", "Argentina", "Brasil", "Croacia"], 1),
  q("easy", "Clubs", "Clubes", "FC Barcelona is based in which country?", "¿En qué país se encuentra el FC Barcelona?", ["Italy", "France", "Spain", "Portugal"], ["Italia", "Francia", "España", "Portugal"], 2),
  q("easy", "Basics", "Conceptos básicos", "What is the main object players try to put into the opposing goal?", "¿Cuál es el objeto que los jugadores intentan meter en el arco rival?", ["A puck", "A ball", "A shuttlecock", "A disc"], ["Un disco de hockey", "Una pelota", "Un volante", "Un frisbee"], 1),
  q("easy", "Rules", "Reglas", "A penalty kick is taken from approximately how far from goal?", "¿A qué distancia aproximada del arco se ejecuta un penal?", ["5.5 metres", "9 metres", "11 metres", "18 metres"], ["5,5 metros", "9 metros", "11 metros", "18 metros"], 2),
  q("easy", "Women's football", "Fútbol femenino", "Which country won the 2023 FIFA Women's World Cup?", "¿Qué país ganó la Copa Mundial Femenina de la FIFA 2023?", ["England", "Spain", "USA", "Germany"], ["Inglaterra", "España", "Estados Unidos", "Alemania"], 1),
  q("easy", "Competitions", "Competiciones", "The Premier League is the top league of which country?", "¿La Premier League es la máxima liga de qué país?", ["England", "Germany", "Italy", "France"], ["Inglaterra", "Alemania", "Italia", "Francia"], 0),
  q("easy", "Players", "Jugadores", "Diego Maradona's famous 'Hand of God' goal was scored for which country?", "¿Para qué país marcó Diego Maradona su famoso gol de la «Mano de Dios»?", ["Mexico", "Argentina", "Italy", "Spain"], ["México", "Argentina", "Italia", "España"], 1),
  q("easy", "Rules", "Reglas", "How long is one half of a standard football match, before added time?", "¿Cuánto dura un tiempo de un partido estándar, sin contar el tiempo agregado?", ["30 minutes", "40 minutes", "45 minutes", "60 minutes"], ["30 minutos", "40 minutos", "45 minutos", "60 minutos"], 2),
  q("easy", "World Cup", "Copa Mundial", "Which country has won the most men's FIFA World Cups?", "¿Qué país ganó más Copas Mundiales masculinas de la FIFA?", ["Germany", "Argentina", "Italy", "Brazil"], ["Alemania", "Argentina", "Italia", "Brasil"], 3),

  q("medium", "World Cup", "Copa Mundial", "Which country hosted and won the first men's World Cup in 1930?", "¿Qué país organizó y ganó la primera Copa Mundial masculina en 1930?", ["Brazil", "Uruguay", "Italy", "Argentina"], ["Brasil", "Uruguay", "Italia", "Argentina"], 1),
  q("medium", "Stadiums", "Estadios", "Which club traditionally plays its home matches at Camp Nou?", "¿Qué club juega tradicionalmente sus partidos como local en el Camp Nou?", ["Real Madrid", "FC Barcelona", "Atlético Madrid", "Valencia"], ["Real Madrid", "FC Barcelona", "Atlético de Madrid", "Valencia"], 1),
  q("medium", "Competitions", "Competiciones", "The Copa Libertadores is contested by clubs primarily from which continent?", "¿Clubes de qué continente disputan principalmente la Copa Libertadores?", ["Europe", "Africa", "South America", "Asia"], ["Europa", "África", "Sudamérica", "Asia"], 2),
  q("medium", "European Championship", "Eurocopa", "Which country won UEFA Euro 2016?", "¿Qué país ganó la Eurocopa 2016?", ["France", "Portugal", "Germany", "Spain"], ["Francia", "Portugal", "Alemania", "España"], 1),
  q("medium", "World Cup", "Copa Mundial", "Which country won its first men's World Cup title in 2010?", "¿Qué país ganó su primera Copa Mundial masculina en 2010?", ["Netherlands", "Spain", "Croatia", "Portugal"], ["Países Bajos", "España", "Croacia", "Portugal"], 1),
  q("medium", "Competitions", "Competiciones", "The Bundesliga is the top domestic league in which country?", "¿En qué país se disputa la Bundesliga?", ["Austria", "Belgium", "Germany", "Switzerland"], ["Austria", "Bélgica", "Alemania", "Suiza"], 2),
  q("medium", "Players", "Jugadores", "Johan Cruyff represented which national team?", "¿A qué selección representó Johan Cruyff?", ["Belgium", "Denmark", "Netherlands", "Sweden"], ["Bélgica", "Dinamarca", "Países Bajos", "Suecia"], 2),
  q("medium", "English football", "Fútbol inglés", "Which club completed the 2003–04 Premier League season unbeaten?", "¿Qué club terminó invicto la temporada 2003–04 de la Premier League?", ["Chelsea", "Arsenal", "Liverpool", "Manchester United"], ["Chelsea", "Arsenal", "Liverpool", "Manchester United"], 1),
  q("medium", "Awards", "Premios", "Which publication presents the Ballon d'Or?", "¿Qué publicación entrega el Balón de Oro?", ["L'Équipe", "France Football", "Marca", "World Soccer"], ["L'Équipe", "France Football", "Marca", "World Soccer"], 1),
  q("medium", "Argentine football", "Fútbol argentino", "Which Buenos Aires club plays at the stadium known as La Bombonera?", "¿Qué club de Buenos Aires juega en el estadio conocido como La Bombonera?", ["River Plate", "Racing Club", "Boca Juniors", "San Lorenzo"], ["River Plate", "Racing Club", "Boca Juniors", "San Lorenzo"], 2),
  q("medium", "Argentine football", "Fútbol argentino", "Which club plays at the stadium commonly called El Monumental?", "¿Qué club juega en el estadio conocido como El Monumental?", ["River Plate", "Independiente", "Vélez Sarsfield", "Estudiantes"], ["River Plate", "Independiente", "Vélez Sarsfield", "Estudiantes"], 0),
  q("medium", "Terminology", "Terminología", "How many goals by one player in a match make a hat-trick?", "¿Cuántos goles de un jugador en un partido forman un hat-trick?", ["Two", "Three", "Four", "Five"], ["Dos", "Tres", "Cuatro", "Cinco"], 1),
  q("medium", "Rules", "Reglas", "A player cannot be penalized for offside directly from which restart?", "¿En cuál de estas reanudaciones no puede cobrarse offside directamente?", ["A free kick", "A throw-in", "A dropped ball", "A penalty kick"], ["Un tiro libre", "Un saque lateral", "Un bote a tierra", "Un penal"], 1),
  q("medium", "World Cup", "Copa Mundial", "Which country won the men's 1998 World Cup on home soil?", "¿Qué país ganó la Copa Mundial masculina de 1998 como local?", ["Brazil", "Italy", "France", "Germany"], ["Brasil", "Italia", "Francia", "Alemania"], 2),
  q("medium", "South American football", "Fútbol sudamericano", "Which two national teams contest the Río de la Plata derby?", "¿Qué dos selecciones disputan el clásico del Río de la Plata?", ["Brazil and Chile", "Argentina and Uruguay", "Colombia and Ecuador", "Peru and Bolivia"], ["Brasil y Chile", "Argentina y Uruguay", "Colombia y Ecuador", "Perú y Bolivia"], 1),

  q("hard", "Awards", "Premios", "Who won the first Ballon d'Or in 1956?", "¿Quién ganó el primer Balón de Oro en 1956?", ["Alfredo Di Stéfano", "Stanley Matthews", "Raymond Kopa", "Ferenc Puskás"], ["Alfredo Di Stéfano", "Stanley Matthews", "Raymond Kopa", "Ferenc Puskás"], 1),
  q("hard", "World Cup", "Copa Mundial", "Which African team first reached a men's World Cup quarter-final?", "¿Qué selección africana fue la primera en llegar a cuartos de final de un Mundial masculino?", ["Senegal", "Ghana", "Cameroon", "Morocco"], ["Senegal", "Ghana", "Camerún", "Marruecos"], 2),
  q("hard", "World Cup", "Copa Mundial", "England defeated which team in the 1966 World Cup final?", "¿A qué selección derrotó Inglaterra en la final del Mundial de 1966?", ["Brazil", "West Germany", "Portugal", "Soviet Union"], ["Brasil", "Alemania Occidental", "Portugal", "Unión Soviética"], 1),
  q("hard", "World Cup", "Copa Mundial", "Which country defeated Brazil in the decisive match of the 1950 World Cup?", "¿Qué país derrotó a Brasil en el partido decisivo del Mundial de 1950?", ["Uruguay", "Argentina", "Italy", "Sweden"], ["Uruguay", "Argentina", "Italia", "Suecia"], 0),
  q("hard", "World Cup", "Copa Mundial", "Who won the Golden Boot at the 1986 men's World Cup?", "¿Quién ganó la Bota de Oro en el Mundial masculino de 1986?", ["Diego Maradona", "Gary Lineker", "Careca", "Emilio Butragueño"], ["Diego Maradona", "Gary Lineker", "Careca", "Emilio Butragueño"], 1),
  q("hard", "European Championship", "Eurocopa", "Who coached Greece to the UEFA Euro 2004 title?", "¿Quién dirigió a Grecia en la conquista de la Eurocopa 2004?", ["Guus Hiddink", "Otto Rehhagel", "Sven-Göran Eriksson", "Luiz Felipe Scolari"], ["Guus Hiddink", "Otto Rehhagel", "Sven-Göran Eriksson", "Luiz Felipe Scolari"], 1),
  q("hard", "World Cup", "Copa Mundial", "Uruguay defeated which country in the first men's World Cup final?", "¿A qué país derrotó Uruguay en la primera final de la Copa Mundial masculina?", ["Brazil", "Argentina", "Chile", "USA"], ["Brasil", "Argentina", "Chile", "Estados Unidos"], 1),
  q("hard", "Women's football", "Fútbol femenino", "Which country won the 1999 FIFA Women's World Cup?", "¿Qué país ganó la Copa Mundial Femenina de la FIFA 1999?", ["China", "Norway", "USA", "Germany"], ["China", "Noruega", "Estados Unidos", "Alemania"], 2),
  q("hard", "Copa América", "Copa América", "Argentina defeated which country in the 2021 Copa América final?", "¿A qué país derrotó Argentina en la final de la Copa América 2021?", ["Colombia", "Chile", "Uruguay", "Brazil"], ["Colombia", "Chile", "Uruguay", "Brasil"], 3),
  q("hard", "European Championship", "Eurocopa", "Which country was invited late and went on to win UEFA Euro 1992?", "¿Qué país ingresó a último momento y terminó ganando la Eurocopa 1992?", ["Denmark", "Sweden", "Netherlands", "Czechoslovakia"], ["Dinamarca", "Suecia", "Países Bajos", "Checoslovaquia"], 0),
  q("hard", "European football", "Fútbol europeo", "In which season was the European Cup renamed the UEFA Champions League?", "¿En qué temporada la Copa de Europa pasó a llamarse UEFA Champions League?", ["1988–89", "1990–91", "1992–93", "1994–95"], ["1988–89", "1990–91", "1992–93", "1994–95"], 2),
  q("hard", "Awards", "Premios", "Who is the only goalkeeper to have won the Ballon d'Or?", "¿Quién es el único arquero que ganó el Balón de Oro?", ["Dino Zoff", "Gianluigi Buffon", "Lev Yashin", "Manuel Neuer"], ["Dino Zoff", "Gianluigi Buffon", "Lev Yashin", "Manuel Neuer"], 2),

  q("hard", "European Cup", "Copa de Europa", "Which club won each of the first five European Cups?", "¿Qué club ganó las primeras cinco ediciones de la Copa de Europa?", ["Benfica", "AC Milan", "Real Madrid", "Inter Milan"], ["Benfica", "AC Milan", "Real Madrid", "Inter de Milán"], 2, true),
  q("hard", "World Cup", "Copa Mundial", "Which team did Brazil defeat in the 1962 World Cup final?", "¿A qué selección derrotó Brasil en la final del Mundial de 1962?", ["Hungary", "Czechoslovakia", "Yugoslavia", "Soviet Union"], ["Hungría", "Checoslovaquia", "Yugoslavia", "Unión Soviética"], 1, true),
  q("hard", "World Cup", "Copa Mundial", "Who was the top scorer at the 1978 men's World Cup?", "¿Quién fue el máximo goleador del Mundial masculino de 1978?", ["Rob Rensenbrink", "Paolo Rossi", "Mario Kempes", "Teófilo Cubillas"], ["Rob Rensenbrink", "Paolo Rossi", "Mario Kempes", "Teófilo Cubillas"], 2, true),
  q("hard", "World Cup", "Copa Mundial", "Who was the first player sent off in a men's World Cup match?", "¿Quién fue el primer jugador expulsado en un partido de la Copa Mundial masculina?", ["Plácido Galindo", "José Batista", "Antonio Rattín", "Ernst Happel"], ["Plácido Galindo", "José Batista", "Antonio Rattín", "Ernst Happel"], 0, true),
  q("hard", "World Cup", "Copa Mundial", "Which African country was the first to play at a men's World Cup?", "¿Qué país africano fue el primero en disputar una Copa Mundial masculina?", ["Morocco", "Egypt", "Cameroon", "Tunisia"], ["Marruecos", "Egipto", "Camerún", "Túnez"], 1, true),
  q("hard", "World Cup", "Copa Mundial", "The 1954 'Miracle of Bern' final saw West Germany defeat which team?", "¿A qué selección derrotó Alemania Occidental en la final de 1954 conocida como el «Milagro de Berna»?", ["Austria", "Brazil", "Hungary", "Uruguay"], ["Austria", "Brasil", "Hungría", "Uruguay"], 2, true),
];

function q(difficulty, categoryEn, categoryEs, promptEn, promptEs, optionsEn, optionsEs, correctIndex, isNiche = false) {
  const id = `football-${++footballQuestionSequence}`;
  return {
    id,
    difficulty,
    isNiche,
    category: { en: categoryEn, es: categoryEs },
    prompt: { en: promptEn, es: promptEs },
    options: optionsEn.map((en, index) => ({ en, es: optionsEs[index] })),
    correctIndex,
  };
}

function localize(question, language) {
  const locale = language === "es" ? "es" : "en";
  return {
    id: question.id,
    difficulty: question.difficulty,
    isNiche: question.isNiche,
    category: question.category[locale],
    prompt: question.prompt[locale],
    options: question.options.map(option => option[locale]),
    correctIndex: question.correctIndex,
  };
}

export function loadFootballQuestions({ language = "en", history = null, rng = Math.random } = {}) {
  const select = (difficulty, amount, niche) => {
    const pool = footballQuestions.filter(question => question.difficulty === difficulty && question.isNiche === niche);
    const fresh = pool.filter(question => !history?.has({ id: question.id, question: { text: question.prompt.en } }));
    const candidates = fresh.length >= amount ? fresh : pool;
    return shuffle(candidates, rng).slice(0, amount);
  };
  const staged = [
    ...select("easy", 3, false),
    ...select("medium", 3, false),
    ...select("hard", 3, false),
    ...select("hard", 1, true),
  ];
  history?.remember(staged.map(question => ({ id: question.id, question: { text: question.prompt.en } })));
  return {
    questions: staged.map(question => localize(question, language)),
    source: "football-curated",
    sessionId: null,
  };
}

export const footballQuestionCount = footballQuestions.length;
