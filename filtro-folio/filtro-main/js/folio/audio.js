// Sonidos sintetizados con WebAudio (sin archivos): cada genero tiene el suyo.
// Para cambiarlos por mp3 reales, reemplaza el cuerpo de la funcion del genero
// por `this.file("assets/mi_sonido.mp3")`.

const SOUND_NAMES = new Set(["fantasia", "romance", "scifi", "terror", "misterio", "aventura", "drama", "historico", "pop", "twinkle", "whoosh", "thunder", "drip", "laser", "itlaugh"]);

export default class Sfx {

    constructor() { this.ctx = null; this.muted = false; this.buffers = {}; }

    async unlock() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();
            const comp = this.ctx.createDynamicsCompressor();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.85;
            this.master.connect(comp);
            comp.connect(this.ctx.destination);

            // Reverb simple a partir de ruido con caida exponencial.
            const len = Math.floor(this.ctx.sampleRate * 1.8);
            const impulse = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = impulse.getChannelData(ch);
                for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
            }
            this.verb = this.ctx.createConvolver();
            this.verb.buffer = impulse;
            const wet = this.ctx.createGain();
            wet.gain.value = 0.55;
            this.verb.connect(wet);
            wet.connect(this.master);

            this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
            const n = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === "suspended") await this.ctx.resume();
    }

    setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.85; }

    // ---- Primitivas ------------------------------------------------------

    _out(node, wet = 0, pan = 0) {
        let last = node;
        if (pan && this.ctx.createStereoPanner) {
            const p = this.ctx.createStereoPanner();
            p.pan.value = pan;
            last.connect(p);
            last = p;
        }
        last.connect(this.master);
        if (wet) {
            const s = this.ctx.createGain();
            s.gain.value = wet;
            last.connect(s);
            s.connect(this.verb);
        }
    }

    // o: f, f2 (glissando), slide, t (retardo), dur, vol, a (ataque), type, lp, vib {rate,depth}, wet, pan, detune
    tone(o) {
        if (!this.ctx) return;
        const ctx = this.ctx, t0 = ctx.currentTime + (o.t || 0), dur = o.dur ?? 0.4;
        const osc = ctx.createOscillator();
        osc.type = o.type || "sine";
        osc.frequency.setValueAtTime(o.f, t0);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.slide ?? dur));
        if (o.detune) osc.detune.value = o.detune;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(o.vol ?? 0.2, t0 + (o.a ?? 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        let node = osc;
        if (o.lp) {
            const f = ctx.createBiquadFilter();
            f.type = "lowpass"; f.frequency.value = o.lp;
            osc.connect(f); node = f;
        }
        node.connect(g);
        this._out(g, o.wet, o.pan);

        if (o.vib) {
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = o.vib.rate; lg.gain.value = o.vib.depth;
            lfo.connect(lg); lg.connect(osc.frequency);
            lfo.start(t0); lfo.stop(t0 + dur + 0.05);
        }
        osc.start(t0); osc.stop(t0 + dur + 0.05);
    }

    // o: t, dur, vol, type (bandpass|lowpass|highpass), f, f2, q, wet
    noise(o) {
        if (!this.ctx) return;
        const ctx = this.ctx, t0 = ctx.currentTime + (o.t || 0), dur = o.dur ?? 0.3;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = o.type || "bandpass";
        f.frequency.setValueAtTime(o.f || 1000, t0);
        if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
        f.Q.value = o.q ?? 1;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(o.vol ?? 0.15, t0 + (o.a ?? 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f); f.connect(g);
        this._out(g, o.wet);
        src.start(t0); src.stop(t0 + dur + 0.05);
    }

    // ---- Interfaz --------------------------------------------------------

    tick(p, side = 0) { this.tone({ f: 500 + p * 500, dur: 0.07, vol: 0.07, type: "triangle", pan: side ? 0.4 : -0.4 }); }

    choose(side) {
        const pan = side ? 0.5 : -0.5;
        this.tone({ f: 659, dur: 0.14, vol: 0.16, type: "triangle", pan, wet: 0.2 });
        this.tone({ f: 988, t: 0.07, dur: 0.22, vol: 0.16, type: "triangle", pan, wet: 0.3 });
        this.noise({ type: "highpass", f: 4000, dur: 0.06, vol: 0.05 });
    }

    reveal() {
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ f, t: i * 0.09, dur: 0.5, vol: 0.1, type: "triangle", wet: 0.5 }));
        this.noise({ type: "bandpass", f: 300, f2: 3500, q: 0.8, dur: 0.7, vol: 0.08, a: 0.3 });
    }

    // ---- Un sonido por genero -------------------------------------------

    playGenre(id) { this.play(id); }

    // Desde los scripts de la escena:  window.folio.sfx.play("terror")
    // Nombres: fantasia romance scifi terror misterio aventura drama historico (uno por genero)
    //          + pop twinkle whoosh thunder drip laser (cortos, para reutilizar).
    // Para un mp3 propio:  window.folio.sfx.file("assets/mi_sonido.mp3", 0.8)
    play(name) {
        if (!this.ctx || this.muted || !SOUND_NAMES.has(name)) return;
        this[name]();
    }

    async file(url, vol = 1) {
        if (!this.ctx || this.muted) return;
        try {
            if (!this.buffers[url]) this.buffers[url] = await this.ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
            const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
            src.buffer = this.buffers[url]; g.gain.value = vol;
            src.connect(g); g.connect(this.master); src.start();
        } catch (err) { console.warn("Sfx.file:", url, err); }
    }

    // Intenta tu mp3; si no existe, suena el sonido sintetizado `fallback`.
    async fileOr(url, fallback, vol = 1) {
        if (!this.ctx || this.muted) return;
        try {
            if (!this.buffers[url]) {
                const res = await fetch(url);
                if (!res.ok) throw new Error(res.status);
                this.buffers[url] = await this.ctx.decodeAudioData(await res.arrayBuffer());
            }
            const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
            src.buffer = this.buffers[url]; g.gain.value = vol;
            src.connect(g); g.connect(this.master); src.start();
        } catch { this.play(fallback); }
    }

    // Risa de payaso malvada (original, sintetizada): "ha-ha-ha-haaa".
    itlaugh() {
        if (!this.ctx) return;
        const ctx = this.ctx, t0 = ctx.currentTime + 0.02;
        const bursts = [[0, .17], [.24, .17], [.48, .17], [.72, .18], [.98, .2], [1.26, .55]];
        bursts.forEach(([t, dur], i) => {
            const last = i === bursts.length - 1, f0 = 300 - i * 18, f1 = f0 * (last ? 0.62 : 0.82);
            const osc = ctx.createOscillator(); osc.type = "sawtooth";
            osc.frequency.setValueAtTime(f0, t0 + t); osc.frequency.exponentialRampToValueAtTime(f1, t0 + t + dur);
            if (last) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 14; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0 + t); lfo.stop(t0 + t + dur); }
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t0 + t); g.gain.linearRampToValueAtTime(0.34, t0 + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + dur);
            const f1n = ctx.createBiquadFilter(), f2n = ctx.createBiquadFilter();
            f1n.type = f2n.type = "bandpass"; f1n.frequency.value = 800; f2n.frequency.value = 1250; f1n.Q.value = f2n.Q.value = 4;
            osc.connect(f1n); osc.connect(f2n); f1n.connect(g); f2n.connect(g);
            this._out(g, 0.35); osc.start(t0 + t); osc.stop(t0 + t + dur + 0.05);
            this.noise({ type: "bandpass", f: 3200, dur: 0.08, vol: 0.05, t: t });
        });
    }

    // ---- Sonidos cortos reutilizables ----
    pop() { this.tone({ f: 500, f2: 150, dur: 0.12, vol: 0.3, type: "triangle" }); this.noise({ type: "bandpass", f: 1500, dur: 0.05, vol: 0.12 }); }
    twinkle() { [1760, 2349, 2637].forEach((f, i) => this.tone({ f, t: i * 0.05, dur: 0.35, vol: 0.08, wet: 0.7 })); }
    whoosh() { this.noise({ type: "bandpass", f: 300, f2: 4000, q: 0.7, dur: 0.5, vol: 0.14, a: 0.2 }); }
    thunder() { this.noise({ type: "lowpass", f: 600, f2: 80, dur: 1.6, vol: 0.5, a: 0.05, wet: 0.5 }); this.tone({ f: 60, f2: 30, dur: 1.2, vol: 0.4 }); }
    drip() { this.tone({ f: 1400, f2: 600, dur: 0.12, vol: 0.12, wet: 0.5 }); }
    laser() { this.tone({ f: 1800, f2: 200, slide: 0.18, dur: 0.22, vol: 0.12, type: "sawtooth", lp: 4000 }); }

    fantasia() {
        [1047, 1319, 1568, 1760, 2093, 2637].forEach((f, i) => {
            this.tone({ f, t: i * 0.07, dur: 0.7, vol: 0.1, wet: 0.8 });
            this.tone({ f: f / 2, t: i * 0.07, dur: 0.5, vol: 0.05, type: "triangle", wet: 0.5 });
        });
    }

    romance() {
        [523, 659, 784].forEach((f) => this.tone({ f, a: 0.08, dur: 1.2, vol: 0.09, wet: 0.7 }));
        this.tone({ f: 320, f2: 140, dur: 0.1, vol: 0.22, type: "triangle" });   // el "muac"
        this.noise({ type: "bandpass", f: 1400, q: 2, dur: 0.06, vol: 0.14 });
    }

    scifi() {
        this.tone({ f: 2400, f2: 160, slide: 0.25, dur: 0.3, vol: 0.12, type: "sawtooth", lp: 5000 });
        [880, 1320, 1760].forEach((f, i) => this.tone({ f, t: 0.28 + i * 0.07, dur: 0.06, vol: 0.06, type: "square" }));
        this.noise({ type: "highpass", f: 6000, dur: 0.12, vol: 0.06 });
    }

    terror() {
        this.tone({ f: 380, f2: 1500, slide: 0.35, dur: 0.95, vol: 0.12, type: "sawtooth", lp: 3500, vib: { rate: 11, depth: 45 } });
        this.tone({ f: 570, f2: 2100, slide: 0.35, dur: 0.95, vol: 0.08, type: "sawtooth", lp: 4000, detune: 30, vib: { rate: 13, depth: 60 } });
        this.noise({ type: "bandpass", f: 2500, q: 0.8, dur: 0.8, vol: 0.12 });
        this.tone({ f: 90, f2: 38, dur: 0.7, vol: 0.5 });
    }

    misterio() {
        this.tone({ f: 185, a: 0.2, dur: 1.8, vol: 0.12, type: "triangle", vib: { rate: 5, depth: 3 }, wet: 0.8 });
        this.tone({ f: 262, t: 0.45, a: 0.2, dur: 1.6, vol: 0.1, type: "triangle", vib: { rate: 5, depth: 3 }, wet: 0.8 });
        this.tone({ f: 92, dur: 2, vol: 0.12, a: 0.3 });
    }

    aventura() {
        [[262, 0, 0.22], [392, 0.2, 0.22], [523, 0.4, 0.7]].forEach(([f, t, dur]) => {
            this.tone({ f, t, dur, a: 0.03, vol: 0.12, type: "sawtooth", lp: 1500, vib: { rate: 6, depth: 4 }, wet: 0.25 });
            this.tone({ f: f * 2, t, dur, a: 0.03, vol: 0.03, type: "triangle" });
        });
    }

    drama() {
        [147, 175, 220].forEach((f) =>
            this.tone({ f, a: 0.35, dur: 2.2, vol: 0.07, type: "sawtooth", lp: 800, vib: { rate: 5.5, depth: 3 }, wet: 0.7 }));
    }

    historico() {
        [0, 0.18].forEach((t) => {
            this.tone({ f: 120, f2: 55, slide: 0.25, t, dur: 0.5, vol: 0.5 });
            this.noise({ type: "lowpass", f: 400, t, dur: 0.1, vol: 0.2 });
        });
        [[392, 0.38, 0.2], [523, 0.58, 0.2], [659, 0.78, 0.8]].forEach(([f, t, dur]) =>
            this.tone({ f, t, dur, a: 0.02, vol: 0.09, type: "sawtooth", lp: 2300, wet: 0.3 }));
    }
}
