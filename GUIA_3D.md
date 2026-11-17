# FolioMood Lector — guía para hacer los 3D tú misma

La página `folio.html` ya está conectada. Tú solo haces **8 escenas en el editor de three.js** (una por género) y, si quieres, una novena para el momento de las preguntas. Las que vienen en `scenes/` son **plantillas** (una esfera de color sobre la frente que crece al hacer el gesto): reemplázalas por las tuyas.

## 1. Cómo se conecta (qué pasa solo)

| Momento | Qué carga |
|---|---|
| Preguntas | `scenes/quiz.json` (opcional: sticker de Folio, iconos que caen…). Si no existe, no pasa nada. |
| Resultado | `scenes/<genero>.json` |

Ids de género (nombre exacto del archivo): `historico`, `romance`, `misterio`, `drama`, `aventura`, `fantasia`, `terror`, `scifi`.

Si una escena no tiene el objeto `mesh_0`, se usa como máscara el maquillaje `assets/folio/makeup_<genero>.png`. Si **sí** lo tiene, se usa tu máscara.

## 2. Hacer una escena

1. Abre el editor de three.js y carga el `app.json` base como punto de partida (así tienes `mesh_0`). Borra las gafas/nariz de ejemplo.
2. Convenciones (iguales que el filtro base): origen entre los ojos, **+Z hacia delante de la cara, +Y arriba, +X a la derecha de la imagen**. La unidad es la **distancia entre mejillas**: frente ≈ y 0.37, mentón ≈ y −0.79, mejillas x ±0.5, ojos x ±0.29, punta de la nariz (0, −0.25, 0.3).
3. Los textos como textura salen en espejo: ponles `scale.x = -1`.
4. Mantén las escenas livianas (pocas luces, texturas ≤ 1024, pocos polígonos): corre en celular.
5. Exporta: **File → Publish** → dentro del zip está `app.json` → renómbralo `scenes/<genero>.json`.

## 3. Scripts (animación y gestos)

En el editor, añade un **Script** al objeto y define funciones con el nombre del evento:

```js
var k = 0;
function kiss()  { k = 1; window.folio.sfx.play("romance"); }   // se llama al hacer el gesto
function update(event) {                                          // cada frame: event.delta en ms
  k = Math.max(0, k - event.delta / 700);
  this.scale.setScalar(1 + k);                                    // this = el objeto
}
```

Dentro del script tienes `face` con valores continuos 0‒1 (`jawOpen, smile, blink, browRaise, kiss, frown, wink, tongue, puff, funnel, eyesWide, browDown`) y de pose (`tilt` en grados, `yaw`, `pitch`). Ej.: `this.scale.y = 1 + face.jawOpen`.

### Eventos disponibles (cada uno tiene su `...End`)

| Gesto | Evento | Umbral (entra / sale) |
|---|---|---|
| Abrir boca | `mouthOpen` / `mouthClose` | original |
| Sonreír | `smileStart` / `smileEnd` | original |
| Parpadear | `blink` / `blinkEnd` | original |
| Cejas arriba | `browRaise` / `browLower` | original |
| Beso | `kiss` | .45 / .25 |
| Puchero | `frown` | .30 / .15 |
| Guiño (cualquiera / izq / der) | `wink`, `winkLeft`, `winkRight` | .55 / .30 |
| Lengua | `tongue` | .40 / .20 |
| Inflar mejillas | `puff` | .40 / .20 |
| Boca en "O" | `oMouth` | .50 / .30 |
| Ojos muy abiertos | `eyesWide` | .50 / .30 |
| Ceño fruncido | `angry` | .50 / .30 |
| Inclinar cabeza | `tiltLeft`, `tiltRight` | 12° / 6° |
| Girar cabeza | `turnLeft`, `turnRight` | .16 / .09 |
| Mirar arriba / abajo | `lookUp`, `lookDown` | .07 / .08 |

Los umbrales están en `DEFAULT_TRIGGERS` de `js/mediapipe/face_events.js`. **Son valores estimados, no calibrados con cámaras reales**: pruébalos con `folio.html?debug=1` (muestra los valores en vivo) y ajústalos.

Los gestos se pueden repetir entre géneros.

## 4. Gestos por género y textos en pantalla

Están en `js/folio/config.js` → `GENRES[id].gestures = [{ event, reward }]`. El evento solo sirve para mostrar la pista ("Manda un beso") y el "✓ premio"; **lo que se anima lo defines en tu script**. Si cambias un gesto en tu escena, cámbialo también ahí. Sugerencia inicial: fantasía `smileStart/oMouth`, romance `kiss/wink`, ciencia ficción `browRaise/eyesWide`, terror `mouthOpen/angry`, misterio `wink/lookDown`, aventura `turnRight/lookUp`, drama `frown/lookDown`, histórico `tiltLeft/puff`.

## 5. Sonidos

- Sintetizados (sin archivos): `window.folio.sfx.play("nombre")` con `fantasia, romance, scifi, terror, misterio, aventura, drama, historico, pop, twinkle, whoosh, thunder, drip, laser`.
- Tu propio mp3: ponlo en `assets/` y usa `window.folio.sfx.file("assets/mi_sonido.mp3", 0.8)`.
- El botón ♪ silencia todo.

## 6. Probar y publicar

- La cámara solo funciona en `https` o `localhost`: `python3 -m http.server` y abre `http://localhost:8000/folio.html`.
- Forzar un género: `folio.html?genre=terror`. Valores en vivo: `&debug=1`.
- Si una escena falla, sale un aviso en pantalla y el error exacto en la consola (F12).
- Publicar: sube la carpeta a GitHub y despliega con Vercel (https incluido).

## Limitaciones conocidas
- Probado con una cara simulada en Chrome headless, **no con webcam real ni en celular**.
- La selección de tarjetas por inclinación (±10°, 0.8 s) también necesita ajuste con personas reales (`SELECT` en `config.js`).
