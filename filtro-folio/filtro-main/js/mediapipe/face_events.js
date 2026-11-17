// Convierte los resultados de MPFaceTracker en un estado facial (valores 0..1)
// y en eventos discretos (mouthOpen, kiss, wink, tiltLeft, ...) que pueden usar
// los scripts de la escena del editor de three.js.
//
// Cada gesto tiene un par de eventos: el nombre de inicio y su "End"
// (por ejemplo kiss / kissEnd). En un script basta con definir la funcion:
//     function kiss() { ... }      function kissEnd() { ... }
// y leer el valor continuo en update():  face.kiss  (0..1).
//
// Los valores de pose (face.tilt, face.yaw, face.pitch) estan en el sentido de la
// PANTALLA en espejo: + = derecha de la pantalla / hacia arriba segun se indica.

const average = (a, b) => (a + b) / 2;

// Cada trigger se activa cuando el valor supera `enter` y se desactiva cuando
// baja de `exit` (histeresis), para no disparar eventos repetidos en el limite.
export const DEFAULT_TRIGGERS = [
    // --- gestos originales ---
    { on: "mouthOpen", off: "mouthClose", value: (face) => face.jawOpen, enter: 0.35, exit: 0.2 },
    { on: "smileStart", off: "smileEnd", value: (face) => face.smile, enter: 0.5, exit: 0.3 },
    { on: "blink", off: "blinkEnd", value: (face) => face.blink, enter: 0.5, exit: 0.3 },
    { on: "browRaise", off: "browLower", value: (face) => face.browRaise, enter: 0.5, exit: 0.3 },

    // --- gestos nuevos (cara) ---
    { on: "kiss", off: "kissEnd", value: (face) => face.kiss, enter: 0.45, exit: 0.25 },            // boca de beso
    { on: "frown", off: "frownEnd", value: (face) => face.frown, enter: 0.3, exit: 0.15 },          // puchero / cara triste
    { on: "wink", off: "winkEnd", value: (face) => face.wink, enter: 0.55, exit: 0.3 },             // guino (cualquier ojo)
    { on: "winkLeft", off: "winkLeftEnd", value: (face) => face.winkLeft, enter: 0.55, exit: 0.3 }, // ojo izquierdo (de la persona)
    { on: "winkRight", off: "winkRightEnd", value: (face) => face.winkRight, enter: 0.55, exit: 0.3 },
    { on: "tongue", off: "tongueEnd", value: (face) => face.tongue, enter: 0.4, exit: 0.2 },        // sacar la lengua
    { on: "puff", off: "puffEnd", value: (face) => face.puff, enter: 0.4, exit: 0.2 },              // inflar las mejillas
    { on: "oMouth", off: "oMouthEnd", value: (face) => face.funnel, enter: 0.5, exit: 0.3 },        // boca en "O"
    { on: "eyesWide", off: "eyesWideEnd", value: (face) => face.eyesWide, enter: 0.5, exit: 0.3 },  // ojos muy abiertos
    { on: "angry", off: "angryEnd", value: (face) => face.browDown, enter: 0.5, exit: 0.3 },        // cejas hacia abajo

    // --- gestos nuevos (cabeza; grados / razon de giro) ---
    { on: "tiltLeft", off: "tiltLeftEnd", value: (face) => Math.max(0, -face.tilt), enter: 12, exit: 6 },
    { on: "tiltRight", off: "tiltRightEnd", value: (face) => Math.max(0, face.tilt), enter: 12, exit: 6 },
    { on: "turnLeft", off: "turnLeftEnd", value: (face) => Math.max(0, -face.yaw), enter: 0.16, exit: 0.09 },
    { on: "turnRight", off: "turnRightEnd", value: (face) => Math.max(0, face.yaw), enter: 0.16, exit: 0.09 },
    { on: "lookUp", off: "lookUpEnd", value: (face) => Math.max(0, -face.pitch), enter: 0.07, exit: 0.035 },
    { on: "lookDown", off: "lookDownEnd", value: (face) => Math.max(0, face.pitch), enter: 0.08, exit: 0.04 },
];

export const FACE_EVENT_TYPES = [
    "faceUpdate",
    "faceFound",
    "faceLost",
    ...DEFAULT_TRIGGERS.flatMap((trigger) => [trigger.on, trigger.off]),
];

// Razon (nariz - ojos) / (menton - ojos) del modelo canonico con la cabeza recta.
const NEUTRAL_PITCH_RATIO = 0.314;

export default class FaceEvents {

    constructor(triggers = DEFAULT_TRIGGERS) {

        this.triggers = triggers.map((trigger) => ({ ...trigger, active: false }));

        this.detected = false;
        this.blendshapes = {};
        this.landmarks = null;
        this.headMatrix = null;
        this.aspect = 16 / 9;       // ancho/alto del video; main.js lo actualiza

        // 0..1
        this.jawOpen = 0;
        this.smile = 0;
        this.blink = 0;
        this.blinkLeft = 0;
        this.blinkRight = 0;
        this.browRaise = 0;
        this.kiss = 0;
        this.frown = 0;
        this.wink = 0;
        this.winkLeft = 0;
        this.winkRight = 0;
        this.tongue = 0;
        this.puff = 0;
        this.funnel = 0;
        this.eyesWide = 0;
        this.browDown = 0;
        // pose
        this.tilt = 0;      // grados; + = la parte de arriba de la cabeza hacia la DERECHA de la pantalla
        this.yaw = 0;       // razon de giro; + = mirar hacia la DERECHA de la pantalla
        this.pitch = 0;     // razon; - = mirar hacia arriba, + = mirar hacia abajo

        this.listeners = [];

    }

    // listener(type, event) recibe todos los eventos; ver FACE_EVENT_TYPES.
    addListener(listener) { this.listeners.push(listener); }

    emit(type) {
        for (const listener of this.listeners) {
            listener(type, this);
        }
    }

    update(tracker) {

        const detected = tracker.getFaceCount() > 0;

        if (detected !== this.detected) {
            this.detected = detected;
            this.emit(detected ? "faceFound" : "faceLost");
        }

        if (!detected) {
            this.reset();
            return;
        }

        this.blendshapes = {};
        for (const category of tracker.getBlendShapes()) {
            this.blendshapes[category.categoryName] = category.score;
        }

        const bs = (name) => this.blendshapes[name] ?? 0;

        this.landmarks = tracker.getLandmarks();
        this.headMatrix = tracker.getHeadMatrix();

        this.jawOpen = bs("jawOpen");
        this.smile = average(bs("mouthSmileLeft"), bs("mouthSmileRight"));
        this.blinkLeft = bs("eyeBlinkLeft");
        this.blinkRight = bs("eyeBlinkRight");
        this.blink = average(this.blinkLeft, this.blinkRight);
        this.browRaise = bs("browInnerUp");

        this.kiss = bs("mouthPucker");
        this.frown = average(bs("mouthFrownLeft"), bs("mouthFrownRight"));
        // Guino: un ojo cerrado y el otro abierto (un parpadeo normal no cuenta).
        const gap = this.blinkLeft - this.blinkRight;
        this.winkLeft = gap > 0.3 ? this.blinkLeft : 0;
        this.winkRight = -gap > 0.3 ? this.blinkRight : 0;
        this.wink = Math.max(this.winkLeft, this.winkRight);
        this.tongue = bs("tongueOut");
        this.puff = bs("cheekPuff");
        this.funnel = bs("mouthFunnel");
        this.eyesWide = average(bs("eyeWideLeft"), bs("eyeWideRight"));
        this.browDown = average(bs("browDownLeft"), bs("browDownRight"));

        this.updatePose();

        this.emit("faceUpdate");
        this.updateTriggers();

    }

    // Inclinacion, giro y cabeceo a partir de los landmarks (suavizados).
    updatePose() {

        const lm = this.landmarks;
        if (!lm || lm.length < 468) return;

        const ea = lm[33], eb = lm[263], nose = lm[1], chin = lm[152];
        const cheekA = lm[234], cheekB = lm[454];

        // Giro: la imagen cruda no esta en espejo, la pantalla si => se invierte el signo.
        const width = Math.abs(cheekB.x - cheekA.x) || 1e-6;
        const yaw = -((nose.x - (cheekA.x + cheekB.x) / 2) / width);

        // Inclinacion: linea entre las comisuras externas de los ojos.
        const dx = (eb.x - ea.x) * this.aspect, dy = eb.y - ea.y;
        const roll = Math.atan2(dy * (dx >= 0 ? 1 : -1), Math.abs(dx) || 1e-6);
        const tilt = -roll * 180 / Math.PI;

        // Cabeceo: posicion vertical relativa de la nariz entre ojos y menton.
        const eyeY = (ea.y + eb.y) / 2;
        const pitch = (nose.y - eyeY) / ((chin.y - eyeY) || 1e-6) - NEUTRAL_PITCH_RATIO;

        const a = 0.5;
        this.yaw += (yaw - this.yaw) * a;
        this.tilt += (tilt - this.tilt) * a;
        this.pitch += (pitch - this.pitch) * a;
        this.rollRad = roll;

    }

    // Al perder la cara, cierra los triggers activos (p. ej. emite mouthClose).
    reset() {

        this.jawOpen = 0;
        this.smile = 0;
        this.blink = 0;
        this.blinkLeft = 0;
        this.blinkRight = 0;
        this.browRaise = 0;
        this.kiss = 0;
        this.frown = 0;
        this.wink = 0;
        this.winkLeft = 0;
        this.winkRight = 0;
        this.tongue = 0;
        this.puff = 0;
        this.funnel = 0;
        this.eyesWide = 0;
        this.browDown = 0;
        this.tilt = 0;
        this.yaw = 0;
        this.pitch = 0;
        this.landmarks = null;
        this.headMatrix = null;

        for (const name of Object.keys(this.blendshapes)) {
            this.blendshapes[name] = 0;
        }

        this.updateTriggers();

    }

    updateTriggers() {

        for (const trigger of this.triggers) {

            const value = trigger.value(this);

            if (!trigger.active && value > trigger.enter) {
                trigger.active = true;
                this.emit(trigger.on);
            } else if (trigger.active && value < trigger.exit) {
                trigger.active = false;
                this.emit(trigger.off);
            }

        }

    }

}
