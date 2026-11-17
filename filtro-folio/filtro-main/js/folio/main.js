// FolioMood Lector — orquesta camara, preguntas y resultado en 3D.
// Pagina: folio.html. Cada genero es una escena del editor de three.js: scenes/<genero>.json
// (opcional scenes/quiz.json durante las preguntas). Ver GUIA_3D.md.

import Sfx from "./audio.js";
import Quiz from "./quiz.js";
import { QUESTIONS, GENRES, GESTURE_TEXT, genreFor, SELECT } from "./config.js";
import ThreePlayer from "../app.js";
import ThreeFaceRenderer from "../mediapipe/three_face_renderer.js";
import FaceEvents from "../mediapipe/face_events.js";
import { createFaceMask } from "../mediapipe/face_mask.js";
import { Face2D, Particles, createLooks2D } from "./looks2d.js";

const $ = (s) => document.querySelector(s);
const MASK_NAME = "mesh_0";

// `deps` permite sustituir camara/tracker (pruebas): { createCamera(video), createTracker(video) }.
export async function startFolio(deps = {}) {

    const stage = $("#stage"), video = $("#video-renderer"), layer = $("#three-layer"), canvas = $("#canvas-renderer"), ctx2d = canvas.getContext("2d");
    const params = new URLSearchParams(location.search);
    const debugEl = $("#debug");
    if (params.has("debug")) debugEl.hidden = false;

    const sfx = new Sfx();
    const faceEvents = new FaceEvents();
    const player = new ThreePlayer(layer);
    player.face = faceEvents;
    let faceRenderer = null;
    const f2d = new Face2D(), particles = new Particles();
    const looks2d = createLooks2D({ sfx, faceEvents, video });
    let look2d = null, lastGrade = "";

    let phase = "intro";
    let tracker = null, camera = null, trackingOn = false;
    let genreId = null, rewardShown = false, mask = null, sceneToken = 0;

    const setPhase = (p) => { phase = p; stage.dataset.phase = p; };
    const toast = (msg, ms = 4000) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); };

    // ---- Escenas 3D ---------------------------------------------------------

    // Carga scenes/<name>.json. Devuelve true si se cargo; si no existe deja la escena vacia.
    async function loadScene(name, fallbackMakeup = null) {
        const token = ++sceneToken;
        disposeMask();
        player.stop();
        player.rootNode.clear();
        look2d = null; particles.clear();
        if (GENRES[name]?.mode === "2d") { look2d = looks2d[name] || null; return true; }   // sin escena 3D
        let ok = false;
        try {
            await player.loadProject(`scenes/${name}.json`);
            ok = true;
        } catch (err) {
            if (name !== "quiz") toast(`Falta scenes/${name}.json (o tiene un error). Mira la consola.`, 6000);
            console.warn(`Escena "${name}":`, err);
        }
        if (token !== sceneToken) return false;
        if (ok) {
            mask = player.rootNode.getObjectByName(MASK_NAME);
            if (mask) {
                // La mascara se coloca vertice a vertice; sus hijos siguen la cabeza como el resto.
                for (const child of [...mask.children]) mask.parent.attach(child);
                faceRenderer?.faceGroup.add(mask);
            }
        }
        if (!mask && fallbackMakeup) await useMakeupFallback(fallbackMakeup, token);
        return ok;
    }

    function useMakeupFallback(file, token) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                if (token !== sceneToken) return resolve();
                mask = createFaceMask(img, { lit: false });
                faceRenderer?.faceGroup.add(mask);
                resolve();
            };
            img.onerror = () => resolve();
            img.src = file;
        });
    }

    function disposeMask() {
        if (!mask) return;
        mask.parent?.remove(mask);
        mask.geometry?.dispose();
        mask = null;
    }

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
        total: QUESTIONS.length, ...SELECT,
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
        const id = genreFor(answers);
        // Se carga la escena mientras suena la animacion de "revelando".
        const ready = loadScene(id, GENRES[id].makeup === false ? null : `assets/folio/makeup_${id}.png`);
        setTimeout(async () => { await ready; showResult(id, answers, false); }, 1700);
    }

    async function showResult(id, answers = [], load = true) {
        const g = GENRES[id];
        if (load) await loadScene(id, GENRES[id].makeup === false ? null : `assets/folio/makeup_${id}.png`);
        genreId = id;
        rewardShown = false;
        stage.dataset.genre = id;
        stage.style.setProperty("--accent", g.accent);
        $("#r-name").textContent = g.name;
        $("#r-mood").textContent = g.mood;
        $("#r-read").innerHTML = `Para leer hoy: <b></b> <span></span>`;
        $("#r-read b").textContent = g.read.title;
        $("#r-read span").textContent = `· ${g.read.author}`;
        $("#r-gesture-text").textContent = g.gestures.map((x) => GESTURE_TEXT[x.event]).join("  ·  ");
        $("#r-gesture").classList.remove("done");
        $("#r-gesture-reward").textContent = "";
        $("#r-gesture-text").hidden = false;
        $("#r-chips").innerHTML = answers.map(() => `<li></li>`).join("");
        [...$("#r-chips").children].forEach((li, i) => (li.textContent = QUESTIONS[i].options[answers[i]].short));
        $("#r-card").hidden = true;
        setPhase("result");
    }

    // Marca el premio cuando la persona hace uno de los gestos del genero.
    faceEvents.addListener((type, f) => {
        player.dispatch(type, f);
        if (phase === "result" && look2d && f2d.u) look2d.on(type, particles, f2d);
        if (phase !== "result" || !genreId || rewardShown) return;
        const hit = GENRES[genreId].gestures.find((x) => x.event === type);
        if (!hit) return;
        rewardShown = true;
        $("#r-gesture").classList.add("done");
        $("#r-gesture-text").hidden = true;
        $("#r-gesture-reward").textContent = `✓ ${hit.reward}`;
    });

    async function restart() {
        sfx.choose(0);
        quiz.reset();
        genreId = null;
        delete stage.dataset.genre;
        renderQuestion(0);
        setPhase("quiz");
        await loadScene("quiz");   // opcional: sticker / iconos que caen
    }

    $("#restart").addEventListener("click", restart);
    $("#r-toggle").addEventListener("click", () => { const c = $("#r-card"); c.hidden = !c.hidden; });
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
            faceRenderer = new ThreeFaceRenderer(video, player);
            faceRenderer.alignCamera();
            faceRenderer.showHelpers = false;
        } catch (err) {
            console.error(err);
            toast("No pude usar la cámara. Puedes responder tocando las tarjetas o con las flechas ← →.", 7000);
            stage.classList.add("no-camera");
        }
        renderQuestion(0);
        setPhase("quiz");
        const forced = params.get("genre");
        if (forced && GENRES[forced]) showResult(forced, [0, 0, 0]);
        else loadScene("quiz");
    }

    $("#start").addEventListener("click", async () => { await sfx.unlock(); begin(); });
    addEventListener("resize", () => { player.resize(); faceRenderer?.alignCamera(); });

    // ---- Bucle ---------------------------------------------------------------

    let last = performance.now();

    function frame(now) {
        requestAnimationFrame(frame);
        const dt = now - last; last = now;

        if (trackingOn && faceRenderer) {
            tracker.update();
            if (video.videoWidth) faceEvents.aspect = video.videoWidth / video.videoHeight;
            faceEvents.update(tracker);

            const landmarks = tracker.getLandmarks();
            faceRenderer.drawMesh(landmarks);
            faceRenderer.drawConnectors(landmarks);
            faceRenderer.drawContours(landmarks);
            faceRenderer.drawIrises(landmarks);
            faceRenderer.drawPoints(landmarks);
            if (mask) faceRenderer.syncFaceMesh(mask);

            const detected = tracker.getFaceCount() > 0;
            player.rootNode.visible = detected;
            if (mask) mask.visible = detected;
            const pose = detected ? faceRenderer.getHeadPose() : null;
            if (pose) {
                player.rootNode.position.copy(pose.position);
                player.rootNode.quaternion.copy(pose.quaternion);
                player.rootNode.scale.setScalar(pose.scale);
            }
            stage.classList.toggle("no-face", !detected && (phase === "quiz" || phase === "result"));

            if (phase === "quiz") quiz.update(detected ? faceEvents.tilt : null, dt, now);
        }

        // ---- Capa 2D (romance / misterio) ----
        const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
        if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
        ctx2d.clearRect(0, 0, vw, vh);
        const g = phase === "result" && look2d ? look2d.grade() : "";
        if (g !== lastGrade) { video.style.filter = g; lastGrade = g; }
        if (phase === "result" && look2d) {
            const lm = faceEvents.detected ? faceEvents.landmarks : null;
            if (lm) f2d.begin(ctx2d, vw, vh, lm);
            look2d.draw(lm ? f2d : null, now / 1000, dt / 1000, particles, ctx2d, vw, vh);
            particles.update(dt / 1000); particles.draw(ctx2d);
        }

        player.update();

        if (params.has("debug")) {
            const f = faceEvents;
            debugEl.textContent = !f.detected ? "sin cara" :
                `inclinación ${f.tilt.toFixed(0)}° (elige a ±${SELECT.enter}°)  giro ${f.yaw.toFixed(2)}  pitch ${f.pitch.toFixed(2)}\n` +
                `boca ${f.jawOpen.toFixed(2)}  sonrisa ${f.smile.toFixed(2)}  beso ${f.kiss.toFixed(2)}  cejas ${f.browRaise.toFixed(2)}\n` +
                `guiño ${f.wink.toFixed(2)}  puchero ${f.frown.toFixed(2)}  lengua ${f.tongue.toFixed(2)}  mejillas ${f.puff.toFixed(2)}\n` +
                `O ${f.funnel.toFixed(2)}  ojos grandes ${f.eyesWide.toFixed(2)}  ceño ${f.browDown.toFixed(2)}` +
                (genreId ? `\n[${genreId}] gestos: ${GENRES[genreId].gestures.map((g) => g.event).join(", ")}` : "");
        }
    }
    requestAnimationFrame(frame);

    const api = { quiz, sfx, player, faceEvents, showResult, restart, get faceRenderer() { return faceRenderer; }, get phase() { return phase; } };
    window.folio = api;
    return api;
}
