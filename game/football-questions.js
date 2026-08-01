import { shuffle } from "./question-provider.js";
import { footballQuestionExpansion } from "./football-question-expansion.js";

// Football Night ships a deliberately curated bilingual bank. Each answer is
// keyed before localization, so changing language can never change which
// option is correct. Keep future additions as stable facts and review both
// language variants together before publishing them. IDs are derived from the
// English prompt so reordering the editorial file never invalidates history.
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
  q("easy", "Clubs", "Clubes", "Real Madrid is based in which country?", "¿En qué país se encuentra el Real Madrid?", ["Spain", "Italy", "France", "Portugal"], ["España", "Italia", "Francia", "Portugal"], 0),
  q("easy", "Clubs", "Clubes", "Juventus is based in which country?", "¿En qué país se encuentra la Juventus?", ["Germany", "Italy", "England", "Spain"], ["Alemania", "Italia", "Inglaterra", "España"], 1),
  q("easy", "Clubs", "Clubes", "Bayern Munich is based in which country?", "¿En qué país se encuentra el Bayern Múnich?", ["Austria", "Switzerland", "Germany", "Belgium"], ["Austria", "Suiza", "Alemania", "Bélgica"], 2),
  q("easy", "Clubs", "Clubes", "Paris Saint-Germain is based in which country?", "¿En qué país se encuentra el Paris Saint-Germain?", ["France", "Spain", "Italy", "Netherlands"], ["Francia", "España", "Italia", "Países Bajos"], 0),
  q("easy", "National teams", "Selecciones", "Which two colors are most associated with Argentina's home shirt?", "¿Qué dos colores se asocian principalmente con la camiseta titular de Argentina?", ["Red and black", "Sky blue and white", "Green and yellow", "Blue and red"], ["Rojo y negro", "Celeste y blanco", "Verde y amarillo", "Azul y rojo"], 1),
  q("easy", "Organizations", "Organizaciones", "Which organization governs football worldwide?", "¿Qué organización gobierna el fútbol a nivel mundial?", ["FIFA", "UEFA", "IOC", "CONMEBOL"], ["FIFA", "UEFA", "COI", "CONMEBOL"], 0),
  q("easy", "Rules", "Reglas", "If a defender last touches the ball before it crosses their own goal line without a goal, what is normally awarded?", "Si un defensor toca último la pelota antes de que cruce su propia línea de meta sin que haya gol, ¿qué se cobra normalmente?", ["A throw-in", "A corner kick", "A penalty kick", "A dropped ball"], ["Un saque lateral", "Un tiro de esquina", "Un penal", "Un bote a tierra"], 1),
  q("easy", "Rules", "Reglas", "What does a yellow card communicate to a player?", "¿Qué le comunica una tarjeta amarilla a un jugador?", ["A caution", "A goal", "A substitution", "The end of the match"], ["Una amonestación", "Un gol", "Una sustitución", "El final del partido"], 0),
  q("easy", "Rules", "Reglas", "From which spot is the ball kicked to start each half?", "¿Desde qué punto se patea la pelota para iniciar cada tiempo?", ["The penalty spot", "The corner arc", "The centre mark", "The goal area"], ["El punto penal", "El arco de esquina", "El punto central", "El área de meta"], 2),
  q("easy", "Competitions", "Competiciones", "Clubs from which continent compete in the UEFA Champions League?", "¿De qué continente son los clubes que compiten en la UEFA Champions League?", ["Europe", "Asia", "Africa", "South America"], ["Europa", "Asia", "África", "Sudamérica"], 0),
  q("easy", "Competitions", "Competiciones", "The Copa América is primarily contested by national teams from which continent?", "¿Selecciones de qué continente disputan principalmente la Copa América?", ["Europe", "North America", "South America", "Asia"], ["Europa", "Norteamérica", "Sudamérica", "Asia"], 2),
  q("easy", "Players", "Jugadores", "Which national team does Cristiano Ronaldo represent?", "¿A qué selección representa Cristiano Ronaldo?", ["Spain", "Portugal", "Brazil", "Italy"], ["España", "Portugal", "Brasil", "Italia"], 1),
  q("easy", "Players", "Jugadores", "Which country did Pelé represent?", "¿A qué país representó Pelé?", ["Brazil", "Argentina", "Portugal", "Mexico"], ["Brasil", "Argentina", "Portugal", "México"], 0),
  q("easy", "Women's football", "Fútbol femenino", "Which country does Marta represent in international football?", "¿A qué país representa Marta en el fútbol internacional?", ["Spain", "Brazil", "Colombia", "USA"], ["España", "Brasil", "Colombia", "Estados Unidos"], 1),
  q("easy", "World Cup", "Copa Mundial", "Which country won the men's 2014 FIFA World Cup?", "¿Qué país ganó la Copa Mundial masculina de la FIFA 2014?", ["Argentina", "Brazil", "Germany", "Netherlands"], ["Argentina", "Brasil", "Alemania", "Países Bajos"], 2),

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
  q("medium", "World Cup", "Copa Mundial", "Which country hosted the men's 2014 FIFA World Cup?", "¿Qué país organizó la Copa Mundial masculina de la FIFA 2014?", ["South Africa", "Brazil", "Russia", "Germany"], ["Sudáfrica", "Brasil", "Rusia", "Alemania"], 1),
  q("medium", "World Cup", "Copa Mundial", "Which country won the men's 2006 FIFA World Cup?", "¿Qué país ganó la Copa Mundial masculina de la FIFA 2006?", ["France", "Brazil", "Italy", "Germany"], ["Francia", "Brasil", "Italia", "Alemania"], 2),
  q("medium", "World Cup", "Copa Mundial", "Which country won the men's 2018 FIFA World Cup?", "¿Qué país ganó la Copa Mundial masculina de la FIFA 2018?", ["Croatia", "France", "Belgium", "Argentina"], ["Croacia", "Francia", "Bélgica", "Argentina"], 1),
  q("medium", "World Cup", "Copa Mundial", "Argentina defeated which team in the men's 2022 World Cup final?", "¿A qué selección derrotó Argentina en la final del Mundial masculino de 2022?", ["Croatia", "France", "Netherlands", "Brazil"], ["Croacia", "Francia", "Países Bajos", "Brasil"], 1),
  q("medium", "Players", "Jugadores", "Zinedine Zidane represented which national team?", "¿A qué selección representó Zinedine Zidane?", ["Belgium", "France", "Algeria", "Switzerland"], ["Bélgica", "Francia", "Argelia", "Suiza"], 1),
  q("medium", "Players", "Jugadores", "Franz Beckenbauer represented which national team?", "¿A qué selección representó Franz Beckenbauer?", ["Austria", "West Germany", "Switzerland", "Netherlands"], ["Austria", "Alemania Occidental", "Suiza", "Países Bajos"], 1),
  q("medium", "Stadiums", "Estadios", "Which club plays its home matches at Old Trafford?", "¿Qué club juega sus partidos como local en Old Trafford?", ["Liverpool", "Manchester City", "Manchester United", "Arsenal"], ["Liverpool", "Manchester City", "Manchester United", "Arsenal"], 2),
  q("medium", "Stadiums", "Estadios", "Which club plays its home matches at Anfield?", "¿Qué club juega sus partidos como local en Anfield?", ["Everton", "Liverpool", "Chelsea", "Tottenham Hotspur"], ["Everton", "Liverpool", "Chelsea", "Tottenham Hotspur"], 1),
  q("medium", "Stadiums", "Estadios", "Which two clubs traditionally share the San Siro stadium?", "¿Qué dos clubes comparten tradicionalmente el estadio San Siro?", ["Roma and Lazio", "Juventus and Torino", "AC Milan and Inter Milan", "Napoli and Salernitana"], ["Roma y Lazio", "Juventus y Torino", "AC Milan e Inter de Milán", "Napoli y Salernitana"], 2),
  q("medium", "Competitions", "Competiciones", "Serie A is the top domestic league in which country?", "¿En qué país se disputa la Serie A?", ["Spain", "Italy", "Portugal", "France"], ["España", "Italia", "Portugal", "Francia"], 1),
  q("medium", "Competitions", "Competiciones", "La Liga is the top domestic league in which country?", "¿En qué país se disputa La Liga?", ["Spain", "Italy", "France", "Argentina"], ["España", "Italia", "Francia", "Argentina"], 0),
  q("medium", "Competitions", "Competiciones", "Ligue 1 is the top domestic league in which country?", "¿En qué país se disputa la Ligue 1?", ["Belgium", "France", "Switzerland", "Portugal"], ["Bélgica", "Francia", "Suiza", "Portugal"], 1),
  q("medium", "Organizations", "Organizaciones", "UEFA governs football on which continent?", "¿En qué continente gobierna el fútbol la UEFA?", ["Europe", "Africa", "Asia", "South America"], ["Europa", "África", "Asia", "Sudamérica"], 0),
  q("medium", "Organizations", "Organizaciones", "CONMEBOL governs football in which region?", "¿En qué región gobierna el fútbol la CONMEBOL?", ["Central America", "South America", "Europe", "Oceania"], ["Centroamérica", "Sudamérica", "Europa", "Oceanía"], 1),
  q("medium", "Women's football", "Fútbol femenino", "Which country won the inaugural FIFA Women's World Cup in 1991?", "¿Qué país ganó la primera Copa Mundial Femenina de la FIFA en 1991?", ["Norway", "Germany", "USA", "China"], ["Noruega", "Alemania", "Estados Unidos", "China"], 2),

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
  q("hard", "World Cup", "Copa Mundial", "Which country won the men's 1982 FIFA World Cup?", "¿Qué país ganó la Copa Mundial masculina de la FIFA 1982?", ["West Germany", "Italy", "Brazil", "Argentina"], ["Alemania Occidental", "Italia", "Brasil", "Argentina"], 1),
  q("hard", "World Cup", "Copa Mundial", "Which country won the men's 1974 FIFA World Cup?", "¿Qué país ganó la Copa Mundial masculina de la FIFA 1974?", ["Netherlands", "Brazil", "West Germany", "Poland"], ["Países Bajos", "Brasil", "Alemania Occidental", "Polonia"], 2),
  q("hard", "World Cup", "Copa Mundial", "Brazil defeated which team in the 1970 World Cup final?", "¿A qué selección derrotó Brasil en la final del Mundial de 1970?", ["West Germany", "Italy", "Uruguay", "England"], ["Alemania Occidental", "Italia", "Uruguay", "Inglaterra"], 1),
  q("hard", "World Cup", "Copa Mundial", "Brazil defeated which team in the 1958 World Cup final?", "¿A qué selección derrotó Brasil en la final del Mundial de 1958?", ["Sweden", "France", "West Germany", "Austria"], ["Suecia", "Francia", "Alemania Occidental", "Austria"], 0),
  q("hard", "World Cup", "Copa Mundial", "Which country did Brazil face in the 1994 World Cup final?", "¿A qué país enfrentó Brasil en la final del Mundial de 1994?", ["Argentina", "Germany", "Italy", "Netherlands"], ["Argentina", "Alemania", "Italia", "Países Bajos"], 2),
  q("hard", "World Cup", "Copa Mundial", "Which country did Italy face in the 2006 World Cup final?", "¿A qué país enfrentó Italia en la final del Mundial de 2006?", ["France", "Germany", "Portugal", "Brazil"], ["Francia", "Alemania", "Portugal", "Brasil"], 0),
  q("hard", "World Cup", "Copa Mundial", "Which country did Germany face in the 2014 World Cup final?", "¿A qué país enfrentó Alemania en la final del Mundial de 2014?", ["Brazil", "Argentina", "Netherlands", "Spain"], ["Brasil", "Argentina", "Países Bajos", "España"], 1),
  q("hard", "World Cup", "Copa Mundial", "Which country did Spain defeat in the 2010 World Cup final?", "¿A qué país derrotó España en la final del Mundial de 2010?", ["Germany", "Netherlands", "Uruguay", "Italy"], ["Alemania", "Países Bajos", "Uruguay", "Italia"], 1),
  q("hard", "World Cup", "Copa Mundial", "Which Asian team became the first to reach a men's World Cup semi-final?", "¿Qué selección asiática fue la primera en llegar a una semifinal de un Mundial masculino?", ["Japan", "Saudi Arabia", "South Korea", "Australia"], ["Japón", "Arabia Saudita", "Corea del Sur", "Australia"], 2),
  q("hard", "World Cup", "Copa Mundial", "Which African team became the first to reach a men's World Cup semi-final?", "¿Qué selección africana fue la primera en llegar a una semifinal de un Mundial masculino?", ["Cameroon", "Morocco", "Senegal", "Ghana"], ["Camerún", "Marruecos", "Senegal", "Ghana"], 1),
  q("hard", "European Championship", "Eurocopa", "Which country won UEFA Euro 1988?", "¿Qué país ganó la Eurocopa 1988?", ["Soviet Union", "West Germany", "Netherlands", "Italy"], ["Unión Soviética", "Alemania Occidental", "Países Bajos", "Italia"], 2),
  q("hard", "European Championship", "Eurocopa", "Which country won UEFA Euro 1996?", "¿Qué país ganó la Eurocopa 1996?", ["Czech Republic", "Germany", "France", "England"], ["República Checa", "Alemania", "Francia", "Inglaterra"], 1),
  q("hard", "European Championship", "Eurocopa", "Which country won UEFA Euro 2000?", "¿Qué país ganó la Eurocopa 2000?", ["Italy", "Netherlands", "France", "Portugal"], ["Italia", "Países Bajos", "Francia", "Portugal"], 2),
  q("hard", "Women's football", "Fútbol femenino", "Which country hosted the inaugural FIFA Women's World Cup in 1991?", "¿Qué país organizó la primera Copa Mundial Femenina de la FIFA en 1991?", ["USA", "Sweden", "China", "Norway"], ["Estados Unidos", "Suecia", "China", "Noruega"], 2),
  q("hard", "Women's football", "Fútbol femenino", "Which country won the 2011 FIFA Women's World Cup?", "¿Qué país ganó la Copa Mundial Femenina de la FIFA 2011?", ["USA", "Japan", "Germany", "Brazil"], ["Estados Unidos", "Japón", "Alemania", "Brasil"], 1),
  q("hard", "South American football", "Fútbol sudamericano", "Which club won the first Copa Libertadores in 1960?", "¿Qué club ganó la primera Copa Libertadores en 1960?", ["Santos", "Peñarol", "Boca Juniors", "Nacional"], ["Santos", "Peñarol", "Boca Juniors", "Nacional"], 1),

  q("hard", "European Cup", "Copa de Europa", "Which club won each of the first five European Cups?", "¿Qué club ganó las primeras cinco ediciones de la Copa de Europa?", ["Benfica", "AC Milan", "Real Madrid", "Inter Milan"], ["Benfica", "AC Milan", "Real Madrid", "Inter de Milán"], 2, true),
  q("hard", "World Cup", "Copa Mundial", "Which team did Brazil defeat in the 1962 World Cup final?", "¿A qué selección derrotó Brasil en la final del Mundial de 1962?", ["Hungary", "Czechoslovakia", "Yugoslavia", "Soviet Union"], ["Hungría", "Checoslovaquia", "Yugoslavia", "Unión Soviética"], 1, true),
  q("hard", "World Cup", "Copa Mundial", "Who was the top scorer at the 1978 men's World Cup?", "¿Quién fue el máximo goleador del Mundial masculino de 1978?", ["Rob Rensenbrink", "Paolo Rossi", "Mario Kempes", "Teófilo Cubillas"], ["Rob Rensenbrink", "Paolo Rossi", "Mario Kempes", "Teófilo Cubillas"], 2, true),
  q("hard", "World Cup", "Copa Mundial", "Who was the first player sent off in a men's World Cup match?", "¿Quién fue el primer jugador expulsado en un partido de la Copa Mundial masculina?", ["Plácido Galindo", "José Batista", "Antonio Rattín", "Ernst Happel"], ["Plácido Galindo", "José Batista", "Antonio Rattín", "Ernst Happel"], 0, true),
  q("hard", "World Cup", "Copa Mundial", "Which African country was the first to play at a men's World Cup?", "¿Qué país africano fue el primero en disputar una Copa Mundial masculina?", ["Morocco", "Egypt", "Cameroon", "Tunisia"], ["Marruecos", "Egipto", "Camerún", "Túnez"], 1, true),
  q("hard", "World Cup", "Copa Mundial", "The 1954 'Miracle of Bern' final saw West Germany defeat which team?", "¿A qué selección derrotó Alemania Occidental en la final de 1954 conocida como el «Milagro de Berna»?", ["Austria", "Brazil", "Hungary", "Uruguay"], ["Austria", "Brasil", "Hungría", "Uruguay"], 2, true),
  q("hard", "World Cup", "Copa Mundial", "Who scored Uruguay's winning goal in the decisive match of the 1950 World Cup?", "¿Quién marcó el gol del triunfo de Uruguay en el partido decisivo del Mundial de 1950?", ["Juan Alberto Schiaffino", "Alcides Ghiggia", "Obdulio Varela", "Óscar Míguez"], ["Juan Alberto Schiaffino", "Alcides Ghiggia", "Obdulio Varela", "Óscar Míguez"], 1, true),
  q("hard", "World Cup", "Copa Mundial", "Who scored a hat-trick in the 1966 World Cup final?", "¿Quién marcó un hat-trick en la final del Mundial de 1966?", ["Bobby Charlton", "Geoff Hurst", "Helmut Haller", "Wolfgang Weber"], ["Bobby Charlton", "Geoff Hurst", "Helmut Haller", "Wolfgang Weber"], 1, true),
  q("hard", "World Cup", "Copa Mundial", "Who won the Golden Boot at the 1982 men's World Cup?", "¿Quién ganó la Bota de Oro en el Mundial masculino de 1982?", ["Karl-Heinz Rummenigge", "Zico", "Paolo Rossi", "Alain Giresse"], ["Karl-Heinz Rummenigge", "Zico", "Paolo Rossi", "Alain Giresse"], 2, true),
  q("hard", "World Cup", "Copa Mundial", "Which coach is the only one to have won two men's World Cups?", "¿Qué entrenador es el único que ganó dos Copas Mundiales masculinas?", ["Vittorio Pozzo", "Mário Zagallo", "Franz Beckenbauer", "Didier Deschamps"], ["Vittorio Pozzo", "Mário Zagallo", "Franz Beckenbauer", "Didier Deschamps"], 0, true),
  q("hard", "World Cup", "Copa Mundial", "Who scored the first golden goal in men's World Cup history?", "¿Quién marcó el primer gol de oro en la historia de los Mundiales masculinos?", ["David Trezeguet", "Laurent Blanc", "Dennis Bergkamp", "Zinedine Zidane"], ["David Trezeguet", "Laurent Blanc", "Dennis Bergkamp", "Zinedine Zidane"], 1, true),
  q("hard", "World Cup", "Copa Mundial", "Who received the fastest red card in men's World Cup history?", "¿Quién recibió la tarjeta roja más rápida en la historia de los Mundiales masculinos?", ["José Batista", "Rigobert Song", "Zinedine Zidane", "Wayne Rooney"], ["José Batista", "Rigobert Song", "Zinedine Zidane", "Wayne Rooney"], 0, true),
  ...footballQuestionExpansion.map(args => q(...args)),
];

function q(difficulty, categoryEn, categoryEs, promptEn, promptEs, optionsEn, optionsEs, correctIndex, isNiche = false) {
  const id = `football-${difficulty}-${stableHash(promptEn)}`;
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

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value.normalize("NFKC")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizedText(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function trigrams(value) {
  const words = normalizedText(value).split(" ").filter(Boolean);
  if (words.length < 3) return new Set([words.join(" ")]);
  return new Set(words.slice(0, -2).map((word, index) => `${word} ${words[index + 1]} ${words[index + 2]}`));
}

function nearDuplicate(left, right) {
  const a = trigrams(left);
  const b = trigrams(right);
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const phrase of a) if (b.has(phrase)) shared += 1;
  return shared / Math.max(a.size, b.size) >= 0.9;
}

export function validateFootballQuestionBank() {
  const errors = [];
  const ids = new Set();
  const prompts = { en: new Map(), es: new Map() };
  const allowedDifficulties = new Set(["easy", "medium", "hard"]);

  for (const question of footballQuestions) {
    const label = question.id || "question-without-id";
    if (!allowedDifficulties.has(question.difficulty)) errors.push(`${label}: invalid difficulty`);
    if (question.isNiche && question.difficulty !== "hard") errors.push(`${label}: niche questions must be hard`);
    if (ids.has(question.id)) errors.push(`${label}: duplicate id`);
    ids.add(question.id);
    if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) {
      errors.push(`${label}: correctIndex must be between 0 and 3`);
    }

    for (const locale of ["en", "es"]) {
      if (!question.category[locale]?.trim()) errors.push(`${label}: missing ${locale} category`);
      if (!question.prompt[locale]?.trim()) errors.push(`${label}: missing ${locale} prompt`);
      const localizedOptions = question.options.map(option => option[locale]?.trim());
      if (localizedOptions.length !== 4 || localizedOptions.some(option => !option)) {
        errors.push(`${label}: ${locale} must have four non-empty options`);
      }
      if (new Set(localizedOptions.map(normalizedText)).size !== 4) {
        errors.push(`${label}: ${locale} options must be unique`);
      }
      const fingerprint = normalizedText(question.prompt[locale]);
      if (prompts[locale].has(fingerprint)) {
        errors.push(`${label}: duplicate ${locale} prompt with ${prompts[locale].get(fingerprint)}`);
      }
      prompts[locale].set(fingerprint, label);
    }
  }

  for (const locale of ["en", "es"]) {
    const entries = footballQuestions.map(question => ({
      id: question.id,
      prompt: question.prompt[locale],
      answer: question.options[question.correctIndex][locale],
    }));
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        if (
          normalizedText(entries[left].answer) === normalizedText(entries[right].answer)
          && nearDuplicate(entries[left].prompt, entries[right].prompt)
        ) {
          errors.push(`${entries[right].id}: near-duplicate ${locale} prompt with ${entries[left].id}`);
        }
      }
    }
  }

  const requiredPools = [
    ["easy", false, 3],
    ["medium", false, 3],
    ["hard", false, 3],
    ["hard", true, 1],
  ];
  for (const [difficulty, niche, minimum] of requiredPools) {
    const amount = footballQuestions.filter(question => question.difficulty === difficulty && question.isNiche === niche).length;
    if (amount < minimum) errors.push(`${difficulty}/${niche ? "niche" : "general"}: needs at least ${minimum} questions`);
  }
  return errors;
}

export const footballQuestionStats = Object.freeze({
  easy: footballQuestions.filter(question => question.difficulty === "easy" && !question.isNiche).length,
  medium: footballQuestions.filter(question => question.difficulty === "medium" && !question.isNiche).length,
  hard: footballQuestions.filter(question => question.difficulty === "hard" && !question.isNiche).length,
  nicheFinal: footballQuestions.filter(question => question.difficulty === "hard" && question.isNiche).length,
});

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
    const unusedIds = pool.filter(question => !history?.hasId?.(question.id));
    const freshWording = unusedIds.filter(question => !history?.has({ id: question.id, question: { text: question.prompt.en } }));
    // Prefer both a fresh ID and fresh wording. If template similarity (for
    // example different World Cup years) makes that pool too small, preserve
    // ID freshness before reopening the full bucket.
    const candidates = freshWording.length >= amount
      ? freshWording
      : unusedIds.length >= amount ? unusedIds : pool;
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
