// FolioMood Lector — contenido del filtro (preguntas, generos y textos).
// Todo lo que se lee en pantalla vive aqui: se puede editar sin tocar la logica.
//
// Diseno: 3 preguntas de 2 opciones = 2^3 = 8 combinaciones = 8 generos.
// Cada pregunta es un eje; cada genero es un vertice del "cubo" de respuestas.
//   Eje 1 (mundo):      0 = real / que existio   | 1 = inventado
//   Eje 2 (animo):      0 = luz y calma          | 1 = inquietud
//   Eje 3 (movimiento): 0 = salir y descubrir    | 1 = quedarse a pensar y sentir

// Seleccion de tarjetas: se inclina la cabeza hacia la tarjeta (como en los filtros de TikTok).
// enter/exit en grados de inclinacion; holdMs = cuanto hay que mantenerla.
export const SELECT = { enter: 10, exit: 5, holdMs: 800 };

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
// Hay 8 combinaciones y 6 generos: terror y misterio salen con dos combinaciones cada uno.
// Para repetir otro genero, cambia el nombre en la posicion que quieras.
export const GENRE_ORDER = [
    "misterio",  // 000 real · luz · descubrir   (repetido)
    "romance",   // 001 real · luz · sentir
    "misterio",  // 010 real · inquietud · descubrir
    "drama",     // 011 real · inquietud · sentir
    "terror",    // 100 inventado · luz · descubrir   (repetido)
    "fantasia",  // 101 inventado · luz · sentir
    "terror",    // 110 inventado · inquietud · descubrir
    "scifi",     // 111 inventado · inquietud · sentir
];

export function genreFor(answers) {
    return GENRE_ORDER[answers[0] * 4 + answers[1] * 2 + answers[2]];
}

// Texto que ve la persona para cada evento de face_events.js.
export const GESTURE_TEXT = {
    mouthOpen: "Abre la boca", smileStart: "Sonríe", blink: "Parpadea", browRaise: "Levanta las cejas",
    kiss: "Manda un beso", frown: "Haz un puchero", wink: "Guiña un ojo", winkLeft: "Guiña el ojo izquierdo", winkRight: "Guiña el ojo derecho",
    tongue: "Saca la lengua", puff: "Infla las mejillas", oMouth: "Haz una O con la boca", eyesWide: "Abre muy grandes los ojos", angry: "Frunce el ceño",
    tiltLeft: "Inclina la cabeza a la izquierda", tiltRight: "Inclina la cabeza a la derecha",
    turnLeft: "Gira la cabeza a la izquierda", turnRight: "Gira la cabeza a la derecha",
    lookUp: "Mira hacia arriba", lookDown: "Mira hacia abajo",
};

// Por genero:
//  name / accent / mood / read : textos del resultado.
//  mode     : "3d" = escena scenes/<genero>.json | "2d" = animacion en canvas (js/folio/looks2d.js)
//  makeup   : false = no poner el maquillaje de assets/folio/ si la escena no trae mesh_0
//  gestures : eventos de face_events.js que tu escena (scenes/<genero>.json) reacciona.
//             Solo sirven para mostrar la pista en pantalla y el "✓ premio" cuando la persona
//             lo hace: la animacion real la programas en los scripts de la escena.
//             Los gestos se pueden repetir entre generos.
export const GENRES = {
    romance: {
        name: "Romance", accent: "#e2506f", mode: "2d",
        mood: "Hoy tu corazón pide una historia que abrace: miradas, silencios y vínculos que se construyen despacio.",
        read: { title: "Orgullo y prejuicio", author: "Jane Austen" },
        gestures: [{ event: "kiss", reward: "Lluvia de corazones" }, { event: "wink", reward: "Ojos de corazón" }],
    },
    misterio: {
        name: "Misterio", accent: "#8a6a3f", mode: "2d",
        mood: "Hoy quieres pistas, no respuestas. Una historia que te invite a sospechar de todos (y un poco de ti).",
        read: { title: "Asesinato en el Orient Express", author: "Agatha Christie" },
        gestures: [{ event: "wink", reward: "Lupa de detective" }, { event: "lookDown", reward: "Sombrero de investigador" }],
    },
    drama: {
        name: "Drama", accent: "#c9a227", mode: "3d", makeup: false,
        mood: "Hoy necesitas una historia que te deje sentir hondo: decisiones difíciles y personas que podrían ser reales.",
        read: { title: "Crimen y castigo", author: "Fiódor Dostoievski" },
        gestures: [{ event: "smileStart", reward: "La máscara feliz" }],
    },
    fantasia: {
        name: "Fantasía", accent: "#9a6ad8", mode: "3d", makeup: false,
        mood: "Hoy quieres asombro: mundos con reglas propias donde lo imposible se siente cercano.",
        read: { title: "Alicia en el país de las maravillas", author: "Lewis Carroll" },
        gestures: [{ event: "smileStart", reward: "Polvo de hadas" }, { event: "oMouth", reward: "Soplo mágico" }],
    },
    terror: {
        name: "Terror", accent: "#c0392b", mode: "3d",
        mood: "Hoy te provoca mirar a la oscuridad: una historia que te haga revisar dos veces ese rincón del cuarto.",
        read: { title: "IT", author: "Stephen King" },
        gestures: [{ event: "smileStart", reward: "Ojos amarillos" }],
    },
    scifi: {
        name: "Ciencia ficción", accent: "#1fa7c9", mode: "3d", makeup: false,
        mood: "Hoy quieres preguntas grandes: futuros posibles que te hagan mirar tu presente distinto.",
        read: { title: "Fahrenheit 451", author: "Ray Bradbury" },
        gestures: [{ event: "browRaise", reward: "Escáner holográfico" }, { event: "eyesWide", reward: "Ojos láser" }],
    },
};
