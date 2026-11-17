// FolioMood Lector — orquesta camara, preguntas, resultado y efectos.
// Pagina: folio.html. Reutiliza WebCamera y MPFaceTracker del filtro base.

import Sfx from "./audio.js";
import Quiz from "./quiz.js";
import { QUESTIONS, GENRES, genreFor } from "./config.js";
import { readFeatures, smoothFeatures, GESTURES, Trigger } from "./gestures.js";
import { createLooks, FaceCtx, Particles } from "./effects.js";

const $ = (s) => document.querySelector(s);

// `deps` permite sustituir camara/tracker (pruebas): { createCamera(video), createTracker(video) }.
export async function startFolio(deps = {}) {

    const stage = $("#stage"), video = $("#video-renderer"), canvas = $("#canvas-renderer");
    const vignette = $("#vignette"), ctx = canvas.getContext("2d");
    const params = new URLSearchParams(location.search);
    const debugEl = $("#debug");
    if (params.has("debug")) debugEl.hidden = false;

    const sfx = new Sfx();
    const looks = createLooks();
    const particles = new Particles();
    const face = new FaceCtx();

    let phase = "intro";
    let tracker = null, camera = null, trackingOn = false;
    let feats = null, landmarks = null;
    let genreId = null, trigger = null, rewardShown = false;
    let lastGrade = "", lastVig = "";

    const setPhase = (p) => { phase = p; stage.dataset.phase = p; };
    const toast = (msg, ms = 4000) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); };

    // ---- Tarjetas -----------------------------------------------------------

    const cards = [$("#card-0"), $("#card-1")];

    function renderQuestion(i) {
        const q = QUESTIONS[i];
        $("#q-step").textContent = `${i + 1} / ${QUESTIONS.length}`;
        $("#q-kicker").textContent = q.kicker;
        $("#q-title").textContent = q.title;
        q.options.forEach((o, n) => {
            cards[n].querySelector(".glyph").textContent = o.glyph;
            cards[n].querySelector(".label").textContent = o.label;
            cards[n].querySelector(".note").textContent = o.note;
            cards[n].classList.remove("picked");
        });
        document.querySelectorAll(".dots i").forEach((d, n) => d.classList.toggle("on", n <= i));
        stage.classList.remove("swap"); void stage.offsetWidth; stage.classList.add("swap");
    }

    const quiz = new Quiz({
        total: QUESTIONS.length,
        onProgress: (hold) => hold.forEach((h, n) => { cards[n].style.setProperty("--p", h.toFixed(3)); cards[n].classList.toggle("charging", h > 0.02); }),
        onTick: (p, side) => sfx.tick(p, side),
        onPick: (side, i) => {
            sfx.choose(side);
            cards[side].classList.add("picked");
            if (i + 1 < QUESTIONS.length) setTimeout(() => renderQuestion(i + 1), 650);
        },
        onDone: (answers) => setTimeout(() => reveal(answers), 750),
    });

    cards.forEach((card, side) => card.addEventListener("click", () => { if (phase === "quiz") quiz.pick(side); }));
    addEventListener("keydown", (e) => {
        if (phase === "quiz" && e.key === "ArrowLeft") quiz.pick(0);
        if (phase === "quiz" && e.key === "ArrowRight") quiz.pick(1);
        if (phase === "result" && e.key.toLowerCase() === "r") restart();
    });

    // ---- Resultado ----------------------------------------------------------

    function reveal(answers) {
        setPhase("reveal");
        sfx.reveal();
        quiz.answers = answers;
        setTimeout(() => showResult(genreFor(answers), answers), 1700);
    }

    function showResult(id, answers = []) {
        const g = GENRES[id];
        genreId = id;
        const gc = GESTURES[id];
        trigger = new Trigger({ ...gc, cooldown: 1400 });
        rewardShown = false;
        particles.clear();

        stage.dataset.genre = id;
        stage.style.setProperty("--accent", g.accent);
        $("#r-name").textContent = g.name;
        $("#r-mood").textContent = g.mood;
        $("#r-read").innerHTML = `Para leer hoy: <b></b> <span></span>`;
        $("#r-read b").textContent = g.read.title;
        $("#r-read span").textContent = `· ${g.read.author}`;
        $("#r-gesture-text").textContent = g.gesture.hint;
        $("#r-gesture").classList.remove("done");
        $("#r-gesture-reward").textContent = "";
        $("#r-chips").innerHTML = answers.map((a, i) => `<li></li>`).join("");
        [...$("#r-chips").children].forEach((li, i) => (li.textContent = QUESTIONS[i].options[answers[i]].short));
        $("#r-card").classList.remove("min");
        setPhase("result");
    }

    function restart() {
        sfx.choose(0);
        quiz.reset();
        particles.clear();
        genreId = null;
        delete stage.dataset.genre;
        video.style.filter = ""; vignette.style.background = ""; lastGrade = lastVig = "";
        renderQuestion(0);
        setPhase("quiz");
    }

    $("#restart").addEventListener("click", restart);
    $("#r-toggle").addEventListener("click", () => $("#r-card").classList.toggle("min"));
    $("#mute").addEventListener("click", (e) => {
        sfx.setMuted(!sfx.muted);
        e.currentTarget.setAttribute("aria-pressed", String(sfx.muted));
        e.currentTarget.textContent = sfx.muted ? "♪̸" : "♪";
    });

    // ---- Arranque (camara + MediaPipe) --------------------------------------

    async function begin() {
        setPhase("loading");
        try {
            const mkCam = deps.createCamera || (async (v) => { const { default: WebCamera } = await import("../webcamera.js"); return new WebCamera(v); });
            const mkTracker = deps.createTracker || (async (v) => { const { default: MPFaceTracker } = await import("../mediapipe/mp_face_tracker.js"); return new MPFaceTracker(v); });
            camera = await mkCam(video);
            await camera.startCamera();
            tracker = await mkTracker(video);
            await tracker.init();
            trackingOn = true;
        } catch (err) {
            console.error(err);
            toast("No pude usar la cámara. Puedes responder tocando las tarjetas o con las flechas ← →.", 7000);
            stage.classList.add("no-camera");
        }
        renderQuestion(0);
        setPhase("quiz");
        if (params.get("genre") && GENRES[params.get("genre")]) showResult(params.get("genre"), [0, 0, 0]);
    }

    $("#start").addEventListener("click", async () => { await sfx.unlock(); begin(); });

    // ---- Bucle ---------------------------------------------------------------

    let last = performance.now();

    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        // Camara -> rasgos de la cara
        if (trackingOn) {
            tracker.update();
            landmarks = tracker.getLandmarks();
            if (landmarks) {
                const W = video.videoWidth || 1280, H = video.videoHeight || 720;
                feats = smoothFeatures(feats, readFeatures(landmarks, tracker.getBlendShapes(), W, H));
            } else feats = null;
            stage.classList.toggle("no-face", !landmarks && (phase === "quiz" || phase === "result"));
        }

        const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
        if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (phase === "quiz") {
            quiz.update(feats ? feats.yaw : null, dt * 1000, now);
        } else if (phase === "result" && genreId) {
            drawResult(now, dt);
        }

        if (!params.has("debug")) return;
        const f = feats;
        debugEl.textContent = !f ? "sin cara" :
            `yaw ${f.yaw.toFixed(2)}  roll ${f.roll.toFixed(0)}°\nsonrisa ${f.smile.toFixed(2)}  beso ${f.pucker.toFixed(2)}\nboca ${f.jaw.toFixed(2)}  cejas ${f.brow.toFixed(2)}\nguiño ${f.wink.toFixed(2)}  puchero ${f.frown.toFixed(2)}` +
            (genreId ? `\n[${genreId}] gesto ${GESTURES[genreId].value(f).toFixed(2)} / umbral ${GESTURES[genreId].enter}` : "");
    }

    function drawResult(now, dt) {
        const look = looks[genreId];
        const t = now / 1000;
        let st = { active: false, started: false, ended: false, k: 0, elapsed: 0, v: 0 };

        if (landmarks && feats) {
            st = trigger.update(GESTURES[genreId].value(feats), now);
            if (st.started) {
                sfx.playGenre(genreId);
                if (!rewardShown) {
                    rewardShown = true;
                    $("#r-gesture").classList.add("done");
                    $("#r-gesture-reward").textContent = `✓ ${GENRES[genreId].gesture.reward}`;
                }
            }
            face.begin(ctx, canvas.width, canvas.height, landmarks, feats);
            ctx.save();
            look.draw(face, st, t, dt, particles);
            ctx.restore();
        } else trigger.update(0, now);

        particles.update(dt);
        particles.draw(ctx);

        const grade = look.grade(st), vig = look.vignette(st);
        if (grade !== lastGrade) { video.style.filter = grade; lastGrade = grade; }
        if (vig !== lastVig) { vignette.style.background = vig; lastVig = vig; }
    }

    requestAnimationFrame(frame);

    // Para depurar desde la consola.
    const api = { quiz, sfx, particles, looks, showResult, restart, get feats() { return feats; }, get phase() { return phase; } };
    window.folio = api;
    return api;
}
