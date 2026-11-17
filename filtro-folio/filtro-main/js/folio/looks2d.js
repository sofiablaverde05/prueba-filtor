// Animaciones 2D (canvas) para los generos con mode:"2d" en config.js: romance y misterio.
// Cada look tiene:
//   grade()           -> filtro CSS para el video
//   draw(f, t, dt, P) -> dibuja con f (Face2D) y las particulas P
//   on(type, ev)      -> recibe los eventos de cara (kiss, wink, lookDown...)
// Unidades de f: 1 = distancia entre mejillas, origen entre los ojos, x a la derecha de la imagen, y HACIA ABAJO.

export class Face2D {
    begin(ctx, W, H, lm) {
        const P = (i) => ({ x: lm[i].x * W, y: lm[i].y * H });
        const a = P(33), b = P(263), c1 = P(234), c2 = P(454);
        Object.assign(this, { ctx, W, H });
        this.o = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.u = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        this.roll = Math.atan2(b.y - a.y, b.x - a.x);
    }
    toPx(x, y) {
        const c = Math.cos(this.roll), s = Math.sin(this.roll);
        return { x: this.o.x + this.u * (x * c - y * s), y: this.o.y + this.u * (x * s + y * c) };
    }
    // Dentro de local(): se dibuja en unidades de la cara.
    local(fn) { const { ctx } = this; ctx.save(); ctx.translate(this.o.x, this.o.y); ctx.rotate(this.roll); ctx.scale(this.u, this.u); fn(ctx); ctx.restore(); }
}

export class Particles {
    constructor() { this.list = []; }
    clear() { this.list.length = 0; }
    add(p) { this.list.push({ life: 0, max: 1.5, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, size: 30, color: "#ff6b8b", type: "heart", ...p }); }
    update(dt) {
        for (const p of this.list) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
        this.list = this.list.filter((p) => p.life < p.max);
    }
    draw(ctx) {
        for (const p of this.list) {
            const k = p.life / p.max, a = k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 2);
            ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
            if (p.type === "heart") heart(ctx, p.size);
            else if (p.type === "q") { ctx.scale(-1, 1); ctx.font = `bold ${p.size * 1.6}px Georgia, serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", 0, 0); }
            ctx.restore();
        }
    }
}

export function heart(ctx, s) {
    ctx.beginPath(); ctx.moveTo(0, s * 0.35);
    ctx.bezierCurveTo(-s * 0.9, -s * 0.25, -s * 0.5, -s * 0.9, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 0.5, -s * 0.9, s * 0.9, -s * 0.25, 0, s * 0.35); ctx.fill();
}

const vignette = (ctx, W, H, color, a0, a1) => {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * a0, W / 2, H / 2, Math.hypot(W, H) * a1);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, color); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
};
const ease = (v, target, dt, rate = 8) => v + (target - v) * Math.min(1, dt * rate);

// ---------------------------------------------------------------- ROMANCE
function romance(sfx, faceEvents) {
    let heartEyes = 0, amb = 0;
    return {
        grade: () => "saturate(1.2) sepia(.12) hue-rotate(-8deg) brightness(1.04)",
        on(type, P, f) {
            if (type === "kiss") {
                sfx.play("romance");
                const m = f.toPx(0, 0.45);
                for (let i = 0; i < 14; i++) P.add({ x: m.x + (Math.random() - 0.5) * f.u * 0.3, y: m.y, vx: (Math.random() - 0.5) * f.u * 0.9, vy: -f.u * (0.5 + Math.random() * 0.9), g: 0, size: f.u * (0.06 + Math.random() * 0.09), max: 1.6 + Math.random() * 0.8, color: ["#ff4d78", "#ff8fab", "#ffc2d1"][i % 3], rot: (Math.random() - 0.5) * 0.8 });
            }
            if (type === "wink") { sfx.play("romance"); heartEyes = 1.8; }
        },
        draw(f, t, dt, P, ctx, W, H) {
            amb -= dt; if (amb < 0) { amb = 0.7; P.add({ x: Math.random() * W, y: H + 20, vy: -H * 0.12, vx: (Math.random() - 0.5) * 20, size: 10 + Math.random() * 12, max: 6, color: "rgba(255,120,150,.7)" }); }
            vignette(ctx, W, H, "rgba(255,70,110,.38)", 0.3, 0.62);
            if (!f) return;
            f.local((c) => {
                for (const sx of [-1, 1]) {   // rubor
                    const g = c.createRadialGradient(sx * 0.36, 0.22, 0, sx * 0.36, 0.22, 0.2); g.addColorStop(0, "rgba(255,90,120,.42)"); g.addColorStop(1, "rgba(255,90,120,0)");
                    c.fillStyle = g; c.beginPath(); c.arc(sx * 0.36, 0.22, 0.2, 0, 7); c.fill();
                }
                if (heartEyes > 0) {
                    const k = Math.min(1, heartEyes / 0.3) * (1 + 0.1 * Math.sin(t * 12));
                    c.fillStyle = "#ff2e63";
                    for (const sx of [-1, 1]) { c.save(); c.translate(sx * 0.205, 0); c.scale(k, k); heart(c, 0.16); c.restore(); }
                }
            });
            heartEyes = Math.max(0, heartEyes - dt);
        },
    };
}

// ---------------------------------------------------------------- MISTERIO
function misterio(sfx, faceEvents, video) {
    let lupa = 0, side = 1, hat = 0, hatOn = false, fog = 0, q = 0;
    return {
        grade: () => "grayscale(.6) sepia(.5) contrast(1.15) brightness(.88)",
        on(type, P, f) {
            if (type === "wink") { sfx.play("misterio"); lupa = 2.2; side = faceEvents.winkLeft > faceEvents.winkRight ? 1 : -1; }
            if (type === "lookDown") { sfx.play("misterio"); hatOn = true; }
            if (type === "lookDownEnd") hatOn = false;
        },
        draw(f, t, dt, P, ctx, W, H) {
            fog += dt * 0.03;
            for (let i = 0; i < 3; i++) {
                const x = ((fog * (0.6 + i * 0.3) + i * 0.37) % 1.4 - 0.2) * W, y = H * (0.25 + i * 0.28);
                const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.35); g.addColorStop(0, "rgba(220,215,200,.16)"); g.addColorStop(1, "rgba(220,215,200,0)");
                ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            }
            vignette(ctx, W, H, "rgba(5,3,0,.7)", 0.25, 0.6);
            q -= dt; if (q < 0) { q = 1.6; P.add({ type: "q", x: W * (0.1 + Math.random() * 0.8), y: H * 0.9, vy: -H * 0.08, size: 18 + Math.random() * 22, max: 7, color: "rgba(214,184,120,.75)", rot: (Math.random() - 0.5) * 0.5 }); }
            hat = ease(hat, hatOn ? 1 : 0, dt, 9);
            if (!f) return;
            if (hat > 0.01) f.local((c) => {            // sombrero (fedora)
                const lift = (1 - hat) * -0.8;
                c.translate(0, -0.42 + lift); c.rotate(-0.05);
                c.fillStyle = "#2a1d16"; c.beginPath(); c.ellipse(0, 0, 0.72, 0.13, 0, 0, 7); c.fill();
                c.fillStyle = "#3b2a20"; c.beginPath(); c.moveTo(-0.36, 0); c.quadraticCurveTo(-0.38, -0.44, -0.12, -0.45); c.quadraticCurveTo(0, -0.38, 0.12, -0.45); c.quadraticCurveTo(0.38, -0.44, 0.36, 0); c.closePath(); c.fill();
                c.fillStyle = "#c9a45c"; c.fillRect(-0.365, -0.13, 0.73, 0.07);
            });
            if (lupa > 0) {
                const k = Math.min(1, lupa / 0.3), c0 = f.toPx(side * 0.205, 0), r = f.u * 0.24 * k;
                ctx.save(); ctx.beginPath(); ctx.arc(c0.x, c0.y, r, 0, 7); ctx.clip();
                ctx.translate(c0.x, c0.y); ctx.scale(1.7, 1.7); ctx.translate(-c0.x, -c0.y); ctx.drawImage(video, 0, 0, W, H); ctx.restore();
                ctx.save(); ctx.strokeStyle = "#b08a3c"; ctx.lineWidth = f.u * 0.035; ctx.beginPath(); ctx.arc(c0.x, c0.y, r, 0, 7); ctx.stroke();
                ctx.lineWidth = f.u * 0.06; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(c0.x + r * 0.72, c0.y + r * 0.72); ctx.lineTo(c0.x + r * 1.7, c0.y + r * 1.7); ctx.stroke();
                const g = ctx.createRadialGradient(c0.x - r * 0.4, c0.y - r * 0.4, 0, c0.x, c0.y, r); g.addColorStop(0, "rgba(255,255,255,.35)"); g.addColorStop(0.4, "rgba(255,255,255,0)");
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c0.x, c0.y, r, 0, 7); ctx.fill(); ctx.restore();
                lupa -= dt;
            }
        },
    };
}

export function createLooks2D({ sfx, faceEvents, video }) {
    return { romance: romance(sfx, faceEvents), misterio: misterio(sfx, faceEvents, video) };
}
