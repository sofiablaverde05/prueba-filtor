// FolioMood Lector — contenido del filtro (preguntas, generos y textos).
// Todo lo que se lee en pantalla vive aqui: se puede editar sin tocar la logica.
//
// Diseno: 3 preguntas de 2 opciones = 2^3 = 8 combinaciones = 8 generos.
// Cada pregunta es un eje; cada genero es un vertice del "cubo" de respuestas.
//   Eje 1 (mundo):      0 = real / que existio   | 1 = inventado
//   Eje 2 (animo):      0 = luz y calma          | 1 = inquietud
//   Eje 3 (movimiento): 0 = salir y descubrir    | 1 = quedarse a pensar y sentir

export const QUESTIONS = [
    {
        kicker: "Qué prefieres",
        title: "Hoy prefiero…",
        options: [
            { glyph: "◉", label: "Un mundo que ya existió", note: "o que podría existir", short: "Mundo real" },
            { glyph: "✷", label: "Un mundo que nadie ha visto", note: "inventado desde cero", short: "Mundo inventado" },
        ],
    },
    {
        kicker: "Qué sientes",
        title: "Hoy siento ganas de…",
        options: [
            { glyph: "☺", label: "Luz y calma", note: "algo que me abrace", short: "Luz y calma" },
            { glyph: "!", label: "Inquietud", note: "algo que me haga mirar dos veces", short: "Inquietud" },
        ],
    },
    {
        kicker: "Qué te pide el cuerpo",
        title: "Ahora mismo prefiero…",
        options: [
            { glyph: "→", label: "Salir a descubrir", note: "moverme, buscar, avanzar", short: "Salir a descubrir" },
            { glyph: "♡", label: "Quedarme a pensar y sentir", note: "ir hacia adentro", short: "Quedarme a sentir" },
        ],
    },
];

// Indice = respuesta1*4 + respuesta2*2 + respuesta3 (cada una 0 = izquierda, 1 = derecha).
export const GENRE_ORDER = [
    "historico", // 000 real · luz · descubrir
    "romance",   // 001 real · luz · sentir
    "misterio",  // 010 real · inquietud · descubrir
    "drama",     // 011 real · inquietud · sentir
    "aventura",  // 100 inventado · luz · descubrir
    "fantasia",  // 101 inventado · luz · sentir
    "terror",    // 110 inventado · inquietud · descubrir
    "scifi",     // 111 inventado · inquietud · sentir
];

export function genreFor(answers) {
    return GENRE_ORDER[answers[0] * 4 + answers[1] * 2 + answers[2]];
}

// `gesture` es el movimiento de cara que activa el efecto propio del genero
// (los umbrales estan en gestures.js). `read` es la sugerencia de lectura.
export const GENRES = {
    historico: {
        name: "Histórico", accent: "#b8862f",
        mood: "Hoy te pide ver cómo era el mundo antes de ti: épocas, imperios y personas que existieron de verdad.",
        read: { title: "Los pilares de la Tierra", author: "Ken Follett" },
        gesture: { hint: "Inclina la cabeza", reward: "Corona de laurel" },
    },
    romance: {
        name: "Romance", accent: "#e2506f",
        mood: "Hoy tu corazón pide una historia que abrace: miradas, silencios y vínculos que se construyen despacio.",
        read: { title: "Orgullo y prejuicio", author: "Jane Austen" },
        gesture: { hint: "Manda un beso", reward: "Lluvia de corazones" },
    },
    misterio: {
        name: "Misterio", accent: "#4a6fa5",
        mood: "Hoy quieres pistas, no respuestas. Una historia que te invite a sospechar de todos (y un poco de ti).",
        read: { title: "Asesinato en el Orient Express", author: "Agatha Christie" },
        gesture: { hint: "Guiña un ojo", reward: "Foco de investigación" },
    },
    drama: {
        name: "Drama", accent: "#5b7fa3",
        mood: "Hoy necesitas una historia que te deje sentir hondo: decisiones difíciles y personas que podrían ser reales.",
        read: { title: "Crimen y castigo", author: "Fiódor Dostoievski" },
        gesture: { hint: "Haz un puchero (cara triste)", reward: "Llanto y lluvia" },
    },
    aventura: {
        name: "Aventura", accent: "#e08a1e",
        mood: "Hoy el cuerpo pide camino: mapas, riesgos y compañeros para cruzar lo desconocido.",
        read: { title: "El Hobbit", author: "J. R. R. Tolkien" },
        gesture: { hint: "Gira la cabeza", reward: "Brújula y fanfarria" },
    },
    fantasia: {
        name: "Fantasía", accent: "#9a6ad8",
        mood: "Hoy quieres asombro: mundos con reglas propias donde lo imposible se siente cercano.",
        read: { title: "Alicia en el país de las maravillas", author: "Lewis Carroll" },
        gesture: { hint: "Sonríe", reward: "Polvo de hadas" },
    },
    terror: {
        name: "Terror", accent: "#c0392b",
        mood: "Hoy te provoca mirar a la oscuridad: una historia que te haga revisar dos veces ese rincón del cuarto.",
        read: { title: "IT", author: "Stephen King" },
        gesture: { hint: "Abre la boca (grita)", reward: "Grito" },
    },
    scifi: {
        name: "Ciencia ficción", accent: "#1fa7c9",
        mood: "Hoy quieres preguntas grandes: futuros posibles que te hagan mirar tu presente distinto.",
        read: { title: "Fahrenheit 451", author: "Ray Bradbury" },
        gesture: { hint: "Levanta las cejas", reward: "Escáner holográfico" },
    },
};
