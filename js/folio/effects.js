// Efectos de cara en canvas 2D, uno por genero. Cada "look" tiene:
//   grade(st)    -> filtro CSS para el video
//   vignette(st) -> fondo CSS de la vineta
//   draw(f, st, t, dt, P) -> dibuja el maquillaje base y la reaccion al gesto
// f = FaceCtx (landmarks en pixeles del video), st = estado del gesto
// ({active, started, k, elapsed}), t = segundos, P = particulas.
// El canvas se muestra en espejo por CSS, igual que el video: el texto se
// dibuja invertido a proposito para que se lea bien.

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
const backOut = (t) => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rnd = (a, b) => a + Math.random() * (b - a);
const count = (perSecond, dt) => { const n = perSecond * dt; return Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); };

// Indices estandar de la malla facial de MediaPipe.
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const EYE_A = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_B = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const LIPS_OUT = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LIPS_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
const LID_A = [33, 246, 161, 160, 159, 158, 157, 173, 133];
const LID_B = [263, 466, 388, 387, 386, 385, 384, 398, 362];
const FOREHEAD_ARC = [54, 103, 67, 109, 10, 338, 297, 332, 284];

// ---- Contexto de cara ------------------------------------------------------

export class FaceCtx {

    begin(c, W, H, lm, feat) {
        this.c = c; this.W = W; this.H = H; this.lm = lm; this.feat = feat;
        const a = this.p(234), b = this.p(454);
        this.w = Math.hypot(a.x - b.x, a.y - b.y);                // ancho de cara (px)
        this.roll = feat.rollRad;                                  // giro en el canvas
        const top = this.p(10), chin = this.p(152);
        const L = Math.hypot(top.x - chin.x, top.y - chin.y) || 1;
        this.up = { x: (top.x - chin.x) / L, y: (top.y - chin.y) / L };
        this.eyeA = this.mid(33, 133);
        this.eyeB = this.mid(263, 362);
        this.eyeMid = this.mid(33, 263);
        this.mouth = this.mid(61, 291);
        return this;
    }

    p(i) { const q = this.lm[i]; return { x: q.x * this.W, y: q.y * this.H }; }
    mid(i, j) { const a = this.p(i), b = this.p(j); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    off(pt, amount) { return { x: pt.x + this.up.x * amount, y: pt.y + this.up.y * amount }; }
    // Mueve el origen a un punto de la cara y rota con la cabeza: 1 unidad = 1 px.
    local(pt) { this.c.save(); this.c.translate(pt.x, pt.y); this.c.rotate(this.roll); }
    done() { this.c.restore(); }
    poly(idx) { const c = this.c; c.beginPath(); idx.forEach((i, k) => { const q = this.p(i); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }); c.closePath(); }
}

// ---- Formas ----------------------------------------------------------------

function glow(c, x, y, r, rgb, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function star4(c, x, y, r, rot = 0) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
}
function heart(c, x, y, s, rot = 0) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.beginPath(); c.moveTo(0, 0.45); c.bezierCurveTo(-1, -0.2, -0.6, -1, 0, -0.45); c.bezierCurveTo(0.6, -1, 1, -0.2, 0, 0.45);
    c.fill(); c.restore();
}
function drop(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(0.75, -0.1, 0.8, 0.6, 0, 0.9); c.bezierCurveTo(-0.8, 0.6, -0.75, -0.1, 0, -1);
    c.fill(); c.restore();
}
function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
             y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y };
}
// Trazo con grosor que se afina, hecho con circulos a lo largo de una curva.
function taper(c, pts, r0, r1) {
    pts.forEach((q, i) => { c.beginPath(); c.arc(q.x, q.y, lerp(r0, r1, i / (pts.length - 1)), 0, TAU); c.fill(); });
}
function spotlight(c, f, k) { /* cono de luz desde arriba hacia la cara */
    const top = f.off(f.eyeMid, f.w * 1.5), w = f.w;
    const g = c.createLinearGradient(top.x, top.y, f.eyeMid.x, f.eyeMid.y + w * 0.5);
    g.addColorStop(0, `rgba(255,244,200,${0.0})`); g.addColorStop(1, `rgba(255,244,200,${0.32 * k})`);
    c.fillStyle = g; c.beginPath();
    c.moveTo(top.x - w * 0.12, top.y); c.lineTo(top.x + w * 0.12, top.y);
    c.lineTo(f.eyeMid.x + w * 0.9, f.eyeMid.y + w * 0.7); c.lineTo(f.eyeMid.x - w * 0.9, f.eyeMid.y + w * 0.7);
    c.closePath(); c.fill();
}

// ---- Particulas ------------------------------------------------------------

export class Particles {

    constructor(max = 500) { this.list = []; this.max = max; }
    clear() { this.list.length = 0; }

    emit(p) {
        if (this.list.length >= this.max) this.list.shift();
        this.list.push({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, sway: 0, life: 1, age: 0, size: 10, rot: 0, vr: 0,
                         kind: "spark", color: "255,255,255", seed: Math.random() * 10, ...p });
    }

    update(dt) {
        for (const p of this.list) {
            p.age += dt;
            p.vy += p.g * dt;
            if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
            p.x += p.vx * dt + (p.sway ? Math.sin(p.age * 3 + p.seed) * p.sway * dt : 0);
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
        }
        this.list = this.list.filter((p) => p.age < p.life);
    }

    draw(c) {
        for (const p of this.list) {
            const k = p.age / p.life;
            const a = clamp(Math.min((1 - k) * 2, k * 10));
            const col = `rgba(${p.color},${a})`;
            c.fillStyle = col; c.strokeStyle = col;
            switch (p.kind) {
                case "spark": star4(c, p.x, p.y, p.size, p.rot); break;
                case "heart": heart(c, p.x, p.y, p.size, p.rot); break;
                case "drop": drop(c, p.x, p.y, p.size); break;
                case "dust": glow(c, p.x, p.y, p.size, p.color, a * 0.7); break;
                case "smoke": glow(c, p.x, p.y, p.size * (0.6 + k), p.color, a * 0.5); break;
                case "rain": c.lineWidth = Math.max(1.5, p.size * 0.18); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke(); break;
                case "qmark":
                    c.save(); c.translate(p.x, p.y); c.scale(-1, 1); c.rotate(p.rot);
                    c.font = `700 ${p.size}px "Gaegu", "DM Sans", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
                    c.fillText("?", 0, 0); c.restore(); break;
            }
        }
    }
}

// ---- Looks -----------------------------------------------------------------

const GLITTER = [33, 246, 161, 160, 159, 158, 157, 173, 133, 263, 466, 388, 387, 386, 385, 384, 398, 362,
                 117, 118, 119, 100, 47, 126, 346, 347, 348, 329, 277, 355, 205, 425, 4];

export function createLooks() {

    const looks = {};

    // 1. FANTASIA — polvo de hadas; sonrie para llenar de magia
    looks.fantasia = {
        grade: (st) => `saturate(${1.15 + 0.2 * st.k}) brightness(${1.03 + 0.06 * st.k})`,
        vignette: (st) => `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 52%, rgba(70,30,120,${0.38 + 0.15 * st.k}) 100%)`,
        draw(f, st, t, dt, P) {
            const c = f.c, w = f.w;
            for (const i of [50, 280]) { const q = f.p(i); glow(c, q.x, q.y, w * 0.2, "200,160,255", 0.35 + 0.25 * st.k); }
            for (const i of GLITTER) {
                const q = f.p(i), tw = 0.5 + 0.5 * Math.sin(t * 3.1 + i * 1.7);
                c.fillStyle = `rgba(255,${225 + 30 * tw | 0},255,${0.2 + 0.75 * tw})`;
                star4(c, q.x, q.y, w * (0.008 + 0.014 * tw), t * 0.5 + i);
            }
            // Luna creciente dorada sobre el entrecejo
            const m = f.off(f.p(9), w * 0.3), r = w * 0.06;
            f.local(m);
            c.fillStyle = "rgba(255,214,120,.95)"; c.shadowColor = "rgba(255,200,90,.9)"; c.shadowBlur = w * 0.05;
            c.beginPath(); c.arc(0, 0, r, 0, TAU); c.arc(r * 0.18, -r * 0.05, r * 0.8, 0, TAU); c.fill("evenodd");
            star4(c, r * 1.7, -r * 0.7, r * 0.55, t);
            c.shadowBlur = 0; f.done();

            if (st.started) for (let i = 0; i < 45; i++) burst(P, f);
            if (st.k > 0) {
                glow(c, f.eyeMid.x, f.eyeMid.y + w * 0.2, w * 0.95, "255,215,130", 0.18 * st.k);
                for (let i = count(70 * st.k, dt); i--;) burst(P, f);
            }
            function burst(P, f) {
                const q = f.p(Math.random() < 0.5 ? 50 : 280);
                P.emit({ kind: "spark", x: q.x + rnd(-1, 1) * f.w * 0.1, y: q.y + rnd(-1, 1) * f.w * 0.1,
                         vx: rnd(-1, 1) * f.w * 0.4, vy: rnd(-1.1, -0.2) * f.w * 0.5, g: f.w * 0.1, drag: 0.8,
                         life: rnd(0.8, 1.6), size: f.w * rnd(0.015, 0.04), rot: rnd(0, 6), vr: rnd(-3, 3),
                         color: Math.random() < 0.5 ? "255,225,140" : "220,190,255" });
            }
        },
    };

    // 2. ROMANCE — rubor y labios; manda un beso y salen corazones
    looks.romance = {
        grade: (st) => `saturate(${1.1 + 0.2 * st.k}) brightness(1.05) sepia(.12)`,
        vignette: (st) => `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 50%, rgba(160,40,80,${0.3 + 0.15 * st.k}) 100%)`,
        draw(f, st, t, dt, P) {
            const c = f.c, w = f.w;
            for (const i of [50, 280]) { const q = f.p(i); glow(c, q.x, q.y, w * 0.2, "255,95,130", 0.5 + 0.2 * st.k); }
            f.poly(LIPS_OUT); c.fillStyle = `rgba(215,40,80,${0.42 + 0.2 * st.k})`; c.fill();
            // Corazoncito en la mejilla
            const ch = f.p(205);
            c.fillStyle = "rgba(255,70,110,.9)"; heart(c, ch.x, ch.y, w * 0.035, f.roll + Math.sin(t * 2) * 0.1);
            c.fillStyle = "rgba(255,255,255,.85)"; star4(c, ch.x + w * 0.05, ch.y - w * 0.04, w * 0.012, t);

            if (st.started) for (let i = 0; i < 10; i++) love(P, f);
            if (st.k > 0) {
                glow(c, f.mouth.x, f.mouth.y, w * 0.3, "255,80,120", 0.35 * st.k);
                for (let i = count(9 * st.k, dt); i--;) love(P, f);
            }
            function love(P, f) {
                P.emit({ kind: "heart", x: f.mouth.x + rnd(-0.05, 0.05) * f.w, y: f.mouth.y,
                         vx: rnd(-0.15, 0.15) * f.w, vy: -rnd(0.35, 0.7) * f.w, sway: f.w * 0.25, life: rnd(1.6, 2.6),
                         size: f.w * rnd(0.04, 0.1), rot: rnd(-0.4, 0.4), vr: rnd(-0.6, 0.6),
                         color: Math.random() < 0.5 ? "255,70,110" : "255,150,180" });
            }
        },
    };

    // 3. CIENCIA FICCION — visor holografico; levanta las cejas para escanear
    looks.scifi = {
        grade: (st) => `hue-rotate(${-10}deg) saturate(1.25) contrast(1.08) brightness(${0.95 + 0.1 * st.k})`,
        vignette: (st) => `radial-gradient(ellipse at 50% 45%, rgba(0,20,40,0) 45%, rgba(0,40,70,${0.5 + 0.1 * st.k}) 100%)`,
        draw(f, st, t, dt) {
            const c = f.c, w = f.w, cyan = "0,230,255";
            // Visor sobre los ojos
            f.local(f.eyeMid);
            const vw = w * 1.18, vh = w * 0.24;
            c.shadowColor = `rgba(${cyan},.9)`; c.shadowBlur = w * 0.05;
            c.strokeStyle = `rgba(${cyan},.95)`; c.lineWidth = w * 0.012; c.fillStyle = `rgba(${cyan},${0.1 + 0.12 * st.k})`;
            c.beginPath(); c.roundRect(-vw / 2, -vh / 2, vw, vh, vh / 2); c.fill(); c.stroke();
            c.shadowBlur = 0;
            const sx = ((t * 0.6) % 1) * vw - vw / 2;                 // brillo que recorre el visor
            const g = c.createLinearGradient(sx - w * 0.1, 0, sx + w * 0.1, 0);
            g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
            c.fillStyle = g; c.beginPath(); c.roundRect(-vw / 2, -vh / 2, vw, vh, vh / 2); c.fill();
            f.done();

            // Esquinas HUD alrededor de la cara
            let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
            for (const i of OVAL) { const q = f.p(i); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
            const pad = w * 0.12, L = w * 0.16;
            c.strokeStyle = `rgba(${cyan},.9)`; c.lineWidth = w * 0.01; c.lineCap = "round";
            for (const [x, y, sx2, sy2] of [[x0 - pad, y0 - pad, 1, 1], [x1 + pad, y0 - pad, -1, 1], [x0 - pad, y1 + pad, 1, -1], [x1 + pad, y1 + pad, -1, -1]]) {
                c.beginPath(); c.moveTo(x, y + sy2 * L); c.lineTo(x, y); c.lineTo(x + sx2 * L, y); c.stroke();
            }
            // Circuito en las mejillas
            for (const [i, d] of [[50, -1], [280, 1]]) {
                const q = f.p(i); f.local(q);
                c.beginPath(); c.moveTo(0, 0); c.lineTo(d * w * 0.1, w * 0.02); c.lineTo(d * w * 0.15, w * 0.08); c.lineTo(d * w * 0.15, w * 0.15); c.stroke();
                c.fillStyle = `rgba(${cyan},1)`; c.beginPath(); c.arc(d * w * 0.15, w * 0.15, w * 0.014, 0, TAU); c.fill(); f.done();
            }

            if (st.k > 0) {
                // Holograma: reja + rayo que baja por la cara
                c.save(); f.poly(OVAL); c.clip();
                c.strokeStyle = `rgba(${cyan},${0.28 * st.k})`; c.lineWidth = 1;
                const step = w * 0.08;
                for (let x = x0; x < x1; x += step) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); }
                for (let y = y0; y < y1; y += step) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
                const by = y0 + ((t * 0.9) % 1) * (y1 - y0);
                const bg = c.createLinearGradient(0, by - w * 0.15, 0, by + w * 0.02);
                bg.addColorStop(0, `rgba(${cyan},0)`); bg.addColorStop(1, `rgba(${cyan},${0.7 * st.k})`);
                c.fillStyle = bg; c.fillRect(x0, by - w * 0.15, x1 - x0, w * 0.17);
                c.restore();
                for (const e of [f.eyeA, f.eyeB]) glow(c, e.x, e.y, w * 0.14, cyan, 0.8 * st.k);
            }
        },
    };

    // 4. TERROR — palidez, ojeras y un globo rojo; abre la boca y es un grito
    looks.terror = {
        grade: (st) => `grayscale(${0.55 - 0.2 * st.k}) contrast(${1.15 + 0.35 * st.k}) brightness(${0.82 + 0.35 * st.k})`,
        vignette: (st) => `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(${st.k > 0 ? "120,0,0" : "0,0,0"},${0.7 + 0.2 * st.k}) 100%)`,
        draw(f, st, t, dt, P) {
            const c = f.c, w = f.w;
            c.save();
            if (st.k > 0) c.translate(rnd(-1, 1) * w * 0.012 * st.k, rnd(-1, 1) * w * 0.012 * st.k);   // temblor
            c.save(); f.poly(OVAL); c.clip(); c.fillStyle = "rgba(215,222,222,.3)"; c.fillRect(0, 0, f.W, f.H); c.restore();
            for (const e of [f.eyeA, f.eyeB]) glow(c, e.x, e.y, w * 0.19, "10,0,0", 0.8);
            // Venas
            c.strokeStyle = "rgba(120,10,10,.55)"; c.lineWidth = Math.max(1, w * 0.004); c.lineCap = "round";
            for (const [i, d] of [[33, -1], [263, 1]]) {
                const q = f.p(i);
                for (let n = 0; n < 4; n++) {
                    c.beginPath(); c.moveTo(q.x, q.y);
                    let x = q.x, y = q.y;
                    for (let s = 0; s < 4; s++) { x += d * w * (0.03 + 0.012 * Math.sin(n * 3 + s * 2)); y += w * (0.03 * (n - 1.5) / 2 + 0.02 * Math.cos(n + s)); c.lineTo(x, y); }
                    c.stroke();
                }
            }
            // Lagrima de sangre que gotea lenta
            const e = f.p(145), ph = (t * 0.25) % 1;
            c.fillStyle = `rgba(150,10,10,${0.85 * (1 - ph * 0.5)})`; drop(c, e.x, e.y + ph * w * 0.3, w * 0.012);
            // Globo rojo flotando junto a la cabeza
            const bp = f.off({ x: f.eyeMid.x + w * 0.85, y: f.eyeMid.y }, w * (0.35 + 0.04 * Math.sin(t * 1.3)));
            const bx = bp.x + Math.sin(t * 0.9) * w * 0.03, br = w * 0.2;
            c.strokeStyle = "rgba(240,235,225,.7)"; c.lineWidth = Math.max(1, w * 0.005);
            c.beginPath(); c.moveTo(bx, bp.y + br * 1.2); c.quadraticCurveTo(bx - w * 0.05, bp.y + br * 2.2, bx + w * 0.02, bp.y + br * 3); c.stroke();
            const bg = c.createRadialGradient(bx - br * 0.3, bp.y - br * 0.4, br * 0.1, bx, bp.y, br * 1.1);
            bg.addColorStop(0, "#ff6a5a"); bg.addColorStop(0.5, "#d4231b"); bg.addColorStop(1, "#6e0a08");
            c.fillStyle = bg; c.beginPath(); c.ellipse(bx, bp.y, br * 0.85, br, 0, 0, TAU); c.fill();
            c.beginPath(); c.moveTo(bx, bp.y + br); c.lineTo(bx - br * 0.09, bp.y + br * 1.14); c.lineTo(bx + br * 0.09, bp.y + br * 1.14); c.fill();
            c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(bx - br * 0.35, bp.y - br * 0.4, br * 0.12, br * 0.22, -0.5, 0, TAU); c.fill();

            if (st.k > 0) {
                f.poly(LIPS_IN); c.fillStyle = `rgba(0,0,0,${0.9 * st.k})`; c.fill();
                for (const e2 of [f.eyeA, f.eyeB]) glow(c, e2.x, e2.y, w * 0.16, "255,30,20", 0.9 * st.k);
                glow(c, f.eyeMid.x, f.eyeMid.y, w * 1.2, "150,0,0", 0.18 * st.k);
                for (let i = count(40 * st.k, dt); i--;)
                    P.emit({ kind: "smoke", x: f.mouth.x, y: f.mouth.y, vx: rnd(-1, 1) * w * 0.3, vy: rnd(0.1, 0.6) * w * 0.4, life: rnd(0.6, 1.1), size: w * rnd(0.08, 0.16), color: "20,0,0" });
            }
            c.restore();
        },
    };

    // 5. MISTERIO — antifaz, lupa y niebla; guina un ojo para encender el foco
    looks.misterio = {
        grade: (st) => `grayscale(.7) sepia(.3) hue-rotate(170deg) contrast(${1.12 + 0.1 * st.k}) brightness(${0.85 + 0.1 * st.k})`,
        vignette: (st) => `radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) ${40 - 15 * st.k}%, rgba(5,10,25,${0.8 + 0.1 * st.k}) 100%)`,
        draw(f, st, t, dt, P) {
            const c = f.c, w = f.w;
            // Antifaz con huecos para los ojos: el trazado se construye con la
            // transformacion de la cabeza y se rellena con evenodd (ojos = huecos).
            f.local(f.eyeMid);
            c.beginPath(); c.roundRect(-w * 0.62, -w * 0.15, w * 1.24, w * 0.3, w * 0.15);
            f.done();
            for (const idx of [EYE_A, EYE_B]) {
                idx.forEach((i, k) => { const q = f.p(i); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
                c.closePath();
            }
            c.fillStyle = "rgba(8,10,20,.78)"; c.fill("evenodd");

            // Lupa sobre un ojo
            const L = f.eyeB, r = w * 0.2;
            c.strokeStyle = "#b8893d"; c.lineWidth = w * 0.03; c.lineCap = "round";
            c.beginPath(); c.moveTo(L.x + r * 0.7, L.y + r * 0.7); c.lineTo(L.x + r * 1.9, L.y + r * 1.9); c.stroke();
            c.fillStyle = "rgba(220,235,255,.1)"; c.beginPath(); c.arc(L.x, L.y, r, 0, TAU); c.fill(); c.stroke();
            c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = w * 0.01;
            c.beginPath(); c.arc(L.x, L.y, r * 0.78, Math.PI * 1.1, Math.PI * 1.45); c.stroke();

            // Niebla baja
            for (let i = 0; i < 5; i++) {
                const x = ((t * 0.02 * (i + 1) + i * 0.23) % 1.4 - 0.2) * f.W;
                glow(c, x, f.H * (0.78 + 0.04 * Math.sin(t + i)), w * 0.9, "200,210,225", 0.1);
            }

            if (st.k > 0) {
                spotlight(c, f, st.k);
                for (let i = count(4 * st.k, dt); i--;)
                    P.emit({ kind: "qmark", x: f.eyeMid.x + rnd(-0.7, 0.7) * w, y: f.eyeMid.y - w * 0.4, vy: -rnd(0.3, 0.6) * w, sway: w * 0.15,
                             life: rnd(1.6, 2.4), size: w * rnd(0.12, 0.22), rot: rnd(-0.4, 0.4), color: "240,225,170" });
            }
            if (st.started) for (let i = 0; i < 6; i++)
                P.emit({ kind: "qmark", x: f.eyeMid.x + rnd(-0.7, 0.7) * w, y: f.eyeMid.y - w * 0.3, vy: -rnd(0.3, 0.7) * w, life: 2, size: w * rnd(0.12, 0.22), rot: rnd(-0.4, 0.4), color: "240,225,170" });
        },
    };

    // 6. AVENTURA — pañuelo y pintura de guerra; gira la cabeza para abrir el camino
    looks.aventura = {
        grade: (st) => `saturate(1.3) contrast(1.08) sepia(.15) brightness(${1.02 + 0.08 * st.k})`,
        vignette: (st) => `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(120,60,0,${0.3 + 0.15 * st.k}) 100%)`,
        draw(f, st, t, dt, P) {
            const c = f.c, w = f.w;
            // Pañuelo rojo en la frente
            c.strokeStyle = "#c0392b"; c.lineWidth = w * 0.07; c.lineCap = "round"; c.lineJoin = "round";
            c.beginPath(); FOREHEAD_ARC.forEach((i, k) => { const q = f.off(f.p(i), w * 0.01); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }); c.stroke();
            c.fillStyle = "rgba(255,255,255,.85)";
            FOREHEAD_ARC.forEach((i, k) => { if (k % 2) { const q = f.off(f.p(i), w * 0.01); c.beginPath(); c.arc(q.x, q.y, w * 0.007, 0, TAU); c.fill(); } });
            // Pintura de guerra bajo los ojos
            for (const [i, d] of [[50, 1], [280, -1]]) {
                f.local(f.p(i));
                for (let n = 0; n < 3; n++) {
                    c.strokeStyle = n === 1 ? "rgba(244,192,91,.9)" : "rgba(228,87,46,.9)"; c.lineWidth = w * 0.018;
                    c.beginPath(); c.moveTo(d * w * (-0.07 + n * 0.035), -w * 0.03); c.lineTo(d * w * (-0.02 + n * 0.035), w * 0.09); c.stroke();
                }
                f.done();
            }
            // Motas de polvo dorado
            for (let i = 0; i < 14; i++) {
                const x = ((i * 0.137 + t * 0.01 * (1 + i % 3)) % 1) * f.W, y = (0.15 + ((i * 0.31 + t * 0.02) % 0.8)) * f.H;
                glow(c, x, y, w * 0.025, "255,215,130", 0.6);
            }

            if (st.k > 0) {
                const dir = -Math.sign(f.feat.yaw) || 1;                 // lado de giro, en coordenadas del canvas
                const src = { x: f.eyeMid.x + dir * w * 0.9, y: f.eyeMid.y - w * 0.2 };
                c.save(); c.globalCompositeOperation = "lighter";
                for (let i = 0; i < 9; i++) {
                    const a = (-0.6 + i * 0.15) + (dir < 0 ? Math.PI : 0) + Math.sin(t + i) * 0.04;
                    const g = c.createLinearGradient(src.x, src.y, src.x + Math.cos(a) * w * 3, src.y + Math.sin(a) * w * 3);
                    g.addColorStop(0, `rgba(255,210,110,${0.3 * st.k})`); g.addColorStop(1, "rgba(255,210,110,0)");
                    c.fillStyle = g; c.beginPath(); c.moveTo(src.x, src.y);
                    c.lineTo(src.x + Math.cos(a - 0.04) * w * 3, src.y + Math.sin(a - 0.04) * w * 3);
                    c.lineTo(src.x + Math.cos(a + 0.04) * w * 3, src.y + Math.sin(a + 0.04) * w * 3); c.fill();
                }
                c.restore();
                // Brujula sobre la cabeza con la aguja hacia donde miras
                const R = w * 0.22 * backOut(st.elapsed * 3), cp0 = f.off(f.p(10), w * 0.42), cp = { x: cp0.x, y: Math.max(cp0.y, w * 0.25) };
                f.local(cp);
                c.fillStyle = "rgba(250,240,215,.92)"; c.strokeStyle = "#8a5a1b"; c.lineWidth = w * 0.02;
                c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.stroke();
                c.lineWidth = w * 0.006; c.strokeStyle = "#8a5a1b";
                for (let i = 0; i < 12; i++) { const a = i * TAU / 12; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); c.lineTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92); c.stroke(); }
                const ang = -Math.PI / 2 + dir * 1.1 * clamp(st.k * 1.4) + Math.sin(t * 9) * 0.06 * (1 - st.k);
                c.rotate(ang + Math.PI / 2);
                c.fillStyle = "#c0392b"; c.beginPath(); c.moveTo(0, -R * 0.8); c.lineTo(R * 0.14, 0); c.lineTo(-R * 0.14, 0); c.fill();
                c.fillStyle = "#274f6b"; c.beginPath(); c.moveTo(0, R * 0.8); c.lineTo(R * 0.14, 0); c.lineTo(-R * 0.14, 0); c.fill();
                f.done();
                for (let i = count(25 * st.k, dt); i--;)
                    P.emit({ kind: "spark", x: src.x, y: src.y + rnd(-1, 1) * w * 0.5, vx: -dir * -rnd(0.3, 0.9) * w, vy: rnd(-0.3, 0.3) * w, life: rnd(0.8, 1.4), size: w * rnd(0.015, 0.035), color: "255,215,120", vr: 3 });
            }
        },
    };

    // 7. DRAMA — delineado y lagrima; haz un puchero y llora bajo la lluvia
    looks.drama = {
        grade: (st) => `saturate(${0.6 - 0.2 * st.k}) brightness(${0.92 - 0.1 * st.k}) contrast(1.12) hue-rotate(${-8}deg)`,
        vignette: (st) => `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(15,30,55,${0.6 + 0.25 * st.k}) 100%)`,
        draw(f, st, t, dt, P) {
            const c = f.c, w = f.w;
            // Delineado con alita
            c.strokeStyle = "rgba(10,10,20,.9)"; c.lineWidth = w * 0.014; c.lineCap = "round"; c.lineJoin = "round";
            for (const [lid, outer, d] of [[LID_A, 33, -1], [LID_B, 263, 1]]) {
                c.beginPath(); lid.forEach((i, k) => { const q = f.p(i); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
                const o = f.p(outer); c.lineTo(o.x + d * w * 0.07, o.y - w * 0.04); c.stroke();
            }
            // Huella de lagrima brillante en cada mejilla
            for (const [i, d] of [[145, -1], [374, 1]]) {
                const q = f.p(i), g = c.createLinearGradient(q.x, q.y, q.x, q.y + w * 0.28);
                g.addColorStop(0, "rgba(190,220,255,.55)"); g.addColorStop(1, "rgba(190,220,255,0)");
                c.strokeStyle = g; c.lineWidth = w * 0.012;
                c.beginPath(); c.moveTo(q.x, q.y); c.quadraticCurveTo(q.x + d * w * 0.015, q.y + w * 0.14, q.x + d * w * 0.01, q.y + w * 0.28); c.stroke();
            }
            if (st.started) for (let i = 0; i < 6; i++) tear(P, f);
            if (st.k > 0) {
                for (let i = count(10 * st.k, dt); i--;) tear(P, f);
                for (let i = count(70 * st.k, dt); i--;)           // lluvia
                    P.emit({ kind: "rain", x: rnd(0, f.W), y: -20, vx: -w * 0.2, vy: rnd(1.6, 2.6) * w * 1.4, life: (f.H / (w * 2.8)) + 0.4, size: w * 0.06, color: "180,205,235" });
            }
            function tear(P, f) {
                const q = f.p(Math.random() < 0.5 ? 145 : 374);
                P.emit({ kind: "drop", x: q.x, y: q.y, vx: rnd(-0.03, 0.03) * f.w, vy: rnd(0.05, 0.2) * f.w, g: f.w * 1.6, life: rnd(0.9, 1.5), size: f.w * rnd(0.018, 0.034), color: "200,225,255" });
            }
        },
    };

    // 8. HISTORICO — bigote de epoca y marco dorado; inclina la cabeza para coronarte
    looks.historico = {
        grade: (st) => `sepia(${0.85}) contrast(1.1) brightness(${0.96 + 0.06 * st.k}) saturate(1.1)`,
        vignette: (st) => `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 50%, rgba(60,35,10,${0.55 + 0.1 * st.k}) 100%)`,
        draw(f, st, t, dt, P) {
            const c = f.c, w = f.w;
            // Bigote de manubrio
            const a = f.p(2), b = f.p(0), at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + w * 0.005 };
            f.local(at);
            c.fillStyle = "#2b1a0d";
            for (const d of [1, -1]) {
                const p0 = { x: d * w * 0.01, y: 0 }, p1 = { x: d * w * 0.1, y: -w * 0.045 }, p2 = { x: d * w * 0.17, y: w * 0.06 }, p3 = { x: d * w * 0.24, y: -w * 0.02 };
                const pts = []; for (let i = 0; i <= 28; i++) pts.push(bezier(p0, p1, p2, p3, i / 28));
                taper(c, pts, w * 0.026, w * 0.006);
            }
            f.done();

            if (st.k > 0) {
                // Corona de laurel sobre la frente: arco de hojas que sigue la inclinacion.
                const s = backOut(st.elapsed * 2.5) * clamp(st.k * 3);
                const rx = w * 0.52, ry = w * 0.24;
                f.local(f.p(10));
                c.translate(0, ry * 0.9); c.scale(s, s);
                c.strokeStyle = "#a57514"; c.lineWidth = w * 0.014; c.lineCap = "round";
                c.beginPath(); c.ellipse(0, 0, rx, ry, 0, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
                for (let i = 0; i < 15; i++) {
                    const ang = Math.PI * (1.04 + 0.92 * i / 14);
                    const x = Math.cos(ang) * rx, y = Math.sin(ang) * ry;
                    for (const side of [-1, 1]) {
                        c.save(); c.translate(x, y); c.rotate(ang + Math.PI / 2 + side * 0.55);
                        const g = c.createLinearGradient(0, 0, w * 0.09, 0);
                        g.addColorStop(0, "#9a6b12"); g.addColorStop(1, "#ffd966");
                        c.fillStyle = g; c.beginPath(); c.ellipse(w * 0.04, 0, w * 0.05, w * 0.022, 0, 0, TAU); c.fill(); c.restore();
                    }
                }
                f.done();
                for (let i = count(20 * st.k, dt); i--;) {
                    const q = f.off(f.p(10), w * rnd(0.05, 0.3));
                    P.emit({ kind: "spark", x: q.x + rnd(-0.5, 0.5) * w, y: q.y, vy: -rnd(0.05, 0.25) * w, life: rnd(0.7, 1.3), size: w * rnd(0.012, 0.03), color: "255,217,102", vr: 2 });
                }
            }
        },
    };

    return looks;
}
