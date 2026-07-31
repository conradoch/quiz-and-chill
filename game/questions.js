export const gameConfig = {
  rounds: [
    { label: "Round 1", value: 1000 },
    { label: "Round 2", value: 1500 },
    { label: "Round 3", value: 2000 },
  ],
  finalValue: 2500,
  questionTimeMs: 15000,
  revealTimeMs: 7000,
  transitionTimeMs: 10000,
};

// Reemplazá este export por un adaptador de API o base de datos.
// La interfaz esperada es: { id, category, prompt, options[4], correctIndex }.
export const questions = [
  { id: "q1", category: "Science", prompt: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], correctIndex: 1 },
  { id: "q2", category: "Geography", prompt: "What is the capital of Canada?", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"], correctIndex: 2 },
  { id: "q3", category: "History", prompt: "In which year did the Berlin Wall fall?", options: ["1987", "1989", "1991", "1993"], correctIndex: 1 },
  { id: "q4", category: "Literature", prompt: "Who wrote Frankenstein?", options: ["Jane Austen", "Mary Shelley", "Emily Brontë", "George Eliot"], correctIndex: 1 },
  { id: "q5", category: "Technology", prompt: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "High Transfer Text Process", "Host Terminal Transfer Program", "Hyperlink Text Transmission Path"], correctIndex: 0 },
  { id: "q6", category: "Nature", prompt: "What is the largest species of shark?", options: ["Great white", "Tiger shark", "Whale shark", "Hammerhead"], correctIndex: 2 },
  { id: "q7", category: "Music", prompt: "How many semitones are in a standard octave?", options: ["8", "10", "12", "14"], correctIndex: 2 },
  { id: "q8", category: "Mathematics", prompt: "Which number is the additive identity?", options: ["−1", "0", "1", "∞"], correctIndex: 1 },
  { id: "q9", category: "Cinema", prompt: "Who directed Spirited Away?", options: ["Akira Kurosawa", "Satoshi Kon", "Hayao Miyazaki", "Makoto Shinkai"], correctIndex: 2 },
  { id: "q10", category: "Final · Physics", prompt: "Which symmetry is associated with conservation of electric charge via Noether's theorem?", options: ["Time translation", "Global U(1)", "Spatial rotation", "Lorentz boost"], correctIndex: 1 },
];
