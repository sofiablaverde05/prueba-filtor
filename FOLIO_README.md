# Folio · Mood Lector (filtro facial)

Página nueva: **`folio.html`**. No modifica el filtro base (`index.html`, `app.json`, `studio.html` siguen igual);
reutiliza `js/webcamera.js` y `js/mediapipe/mp_face_tracker.js`.

## Probarlo
- En local: `python3 -m http.server 8000` y abrir `http://localhost:8000/folio.html` (la cámara solo funciona en `localhost` o `https`).
- En el celular: subir a GitHub + Vercel (como el filtro base) y abrir `https://tu-dominio/folio.html`.
- `folio.html?debug=1` muestra los valores en vivo de cada gesto (para calibrar umbrales).
- `folio.html?genre=terror` salta directo al resultado de ese género (ids: historico, romance, misterio, drama, aventura, fantasia, terror, scifi).
- Sin cámara también se puede responder tocando las tarjetas o con las flechas ← →.

## Qué editar
| Quiero cambiar… | Archivo |
|---|---|
| Preguntas, opciones, géneros, textos, libro sugerido | `js/folio/config.js` |
| Sensibilidad de cada gesto (`enter`/`exit`/`full`), cuánto hay que girar la cabeza | `js/folio/gestures.js` (`GESTURES`) y `js/folio/quiz.js` (`holdMs`, `enter`) |
| Sonidos de cada género | `js/folio/audio.js` (una función por género; se puede cambiar por mp3) |
| Maquillaje y efectos de cada género | `js/folio/effects.js` (un bloque `looks.<genero>`) |
| Colores, tipografías, layout | `css/folio.css` |

## Cómo se decide el género
3 preguntas de 2 opciones = 8 combinaciones = 8 géneros (`GENRE_ORDER` en `config.js`):
mundo (real / inventado) · ánimo (luz / inquietud) · movimiento (salir / quedarse a sentir).
