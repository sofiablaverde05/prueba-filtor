// Logica de las 3 preguntas. Se elige girando la cabeza hacia una tarjeta y
// manteniendola un momento (la tarjeta se "llena"). Tambien admite toque/teclas.

export default class Quiz {

    constructor({ total = 3, holdMs = 800, enter = 0.14, exit = 0.07, lockMs = 900, onPick, onDone, onProgress, onTick }) {
        Object.assign(this, { total, holdMs, enter, exit, lockMs, onPick, onDone, onProgress, onTick });
        this.reset();
    }

    reset() {
        this.index = 0;
        this.answers = [];
        this.hold = [0, 0];
        this.lockUntil = 0;
        this.needCenter = false;
        this.finished = false;
        this.lastTick = 0;
        this.emitProgress();
    }

    emitProgress() { this.onProgress?.(this.hold, this.index); }

    // yaw: valor de readFeatures (+ = derecha de la pantalla) o null si no hay cara.
    update(yaw, dtMs, nowMs) {

        if (this.finished || nowMs < this.lockUntil) return;

        // Tras elegir hay que volver al centro antes de elegir otra vez.
        if (this.needCenter) {
            if (yaw === null || Math.abs(yaw) < this.exit) this.needCenter = false;
            else return;
        }

        let side = null;
        if (yaw !== null) {
            if (yaw > this.enter) side = 1;
            else if (yaw < -this.enter) side = 0;
        }

        for (const s of [0, 1]) {
            if (s === side) this.hold[s] = Math.min(1, this.hold[s] + dtMs / this.holdMs);
            else this.hold[s] = Math.max(0, this.hold[s] - (dtMs / this.holdMs) * 1.5);
        }

        if (side !== null) {
            const step = Math.floor(this.hold[side] * 5);
            if (step !== this.lastTick && this.hold[side] < 1) this.onTick?.(this.hold[side], side);
            this.lastTick = step;
        } else {
            this.lastTick = 0;
        }

        this.emitProgress();

        if (side !== null && this.hold[side] >= 1) this.pick(side, nowMs);
    }

    pick(side, nowMs = performance.now()) {

        if (this.finished) return;

        this.answers.push(side);
        this.hold = [0, 0];
        this.lastTick = 0;
        this.needCenter = true;
        this.lockUntil = nowMs + this.lockMs;
        this.index++;
        this.onPick?.(side, this.index - 1);

        if (this.index >= this.total) {
            this.finished = true;
            this.onDone?.([...this.answers]);
        }
        this.emitProgress();
    }
}
