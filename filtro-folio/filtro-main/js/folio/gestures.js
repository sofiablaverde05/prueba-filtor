// Lectura de gestos: convierte landmarks + blendshapes de MediaPipe en valores
// simples y define los disparadores (con histeresis) de cada genero.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const avg = (a, b) => (a + b) / 2;

// Estado de la cara en una sola estructura.
//  yaw   : giro de cabeza visto EN PANTALLA (espejo). + = hacia la derecha de la pantalla.
//          Es la distancia de la nariz al centro de las mejillas / ancho de la cara.
//  roll  : inclinacion lateral en grados (sin signo util: se usa abs).
//  rollRad: angulo en el sistema del canvas (para rotar accesorios con la cabeza).
export function readFeatures(landmarks, shapes, W = 1, H = 1) {

    const lm = landmarks;
    const bs = {};
    for (const s of shapes) bs[s.categoryName] = s.score;
    const b = (name) => bs[name] ?? 0;

    // Giro: la imagen cruda no esta en espejo, la pantalla si => se invierte el signo.
    const nose = lm[1], cheekA = lm[234], cheekB = lm[454];
    const width = Math.abs(cheekB.x - cheekA.x) || 1e-6;
    const yaw = -((nose.x - (cheekA.x + cheekB.x) / 2) / width);

    // Inclinacion: linea entre las comisuras externas de los ojos (indices 33 y 263).
    const ea = lm[33], eb = lm[263];
    const dx = (eb.x - ea.x) * W, dy = (eb.y - ea.y) * H;
    const sign = dx >= 0 ? 1 : -1;
    const rollRad = Math.atan2(dy * sign, Math.abs(dx) || 1e-6);

    const blinkL = b("eyeBlinkLeft"), blinkR = b("eyeBlinkRight");
    const winkGap = Math.abs(blinkL - blinkR);

    return {
        yaw,
        rollRad,
        roll: Math.abs(rollRad * 180 / Math.PI),
        jaw: b("jawOpen"),
        smile: avg(b("mouthSmileLeft"), b("mouthSmileRight")),
        brow: b("browInnerUp"),
        pucker: b("mouthPucker"),
        frown: avg(b("mouthFrownLeft"), b("mouthFrownRight")),
        // Guino: un ojo cerrado y el otro abierto (un parpadeo normal no cuenta).
        wink: winkGap > 0.3 ? Math.max(blinkL, blinkR) : 0,
        blink: avg(blinkL, blinkR),
    };
}

// Suavizado exponencial para que los umbrales no parpadeen por ruido.
export function smoothFeatures(prev, next, alpha = 0.5) {
    if (!prev) return next;
    const out = {};
    for (const key in next) out[key] = prev[key] + (next[key] - prev[key]) * alpha;
    return out;
}

// Un gesto por genero. `enter`/`exit` = histeresis; `full` = valor con efecto al 100 %.
export const GESTURES = {
    fantasia: { value: (f) => f.smile,          enter: 0.50, exit: 0.30, full: 0.85 },
    romance:  { value: (f) => f.pucker,         enter: 0.45, exit: 0.25, full: 0.85 },
    scifi:    { value: (f) => f.brow,           enter: 0.50, exit: 0.30, full: 0.85 },
    terror:   { value: (f) => f.jaw,            enter: 0.45, exit: 0.25, full: 0.80 },
    misterio: { value: (f) => f.wink,           enter: 0.55, exit: 0.30, full: 0.90 },
    aventura: { value: (f) => Math.abs(f.yaw),  enter: 0.16, exit: 0.09, full: 0.32 },
    drama:    { value: (f) => f.frown,          enter: 0.30, exit: 0.15, full: 0.65 },
    historico:{ value: (f) => f.roll,           enter: 12,   exit: 7,    full: 28 },
};

export class Trigger {

    constructor({ enter, exit, full, cooldown = 1200 }) {
        Object.assign(this, { enter, exit, full, cooldown });
        this.reset();
    }

    reset() { this.active = false; this.lastStart = -1e9; this.t0 = 0; }

    // Devuelve { active, started, ended, v, k, elapsed }:
    //   k = intensidad continua 0..1 mientras el gesto esta activo.
    update(v, nowMs) {

        let started = false, ended = false;

        if (!this.active && v >= this.enter && nowMs - this.lastStart >= this.cooldown) {
            this.active = true; started = true;
            this.lastStart = nowMs; this.t0 = nowMs;
        } else if (this.active && v < this.exit) {
            this.active = false; ended = true;
        }

        const k = this.active ? clamp((v - this.exit) / (this.full - this.exit)) : 0;
        return { active: this.active, started, ended, v, k, elapsed: this.active ? (nowMs - this.t0) / 1000 : 0 };
    }
}
