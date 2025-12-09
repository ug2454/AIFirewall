# Micro Motion CAPTCHA . Human Cursor Behavior Verification
A lightweight web CAPTCHA mechanism that reliably blocks AI agents by analyzing micro-movement patterns that AI mouse controllers cannot replicate.

---

## 1. Overview
The Micro Motion CAPTCHA requires a user to move the mouse cursor along an irregular path without touching the boundaries.  
The system analyzes:
- human jitter
- speed variance
- accelerations
- micro-pauses
- trajectory noise

AI agents typically produce:
- linear motion
- overly smooth curves
- low jitter signals
- unrealistic timing patterns

This makes the CAPTCHA AI-resistant.

---

## 2. How It Works . High Level
1. A randomly generated squiggly path is rendered on a `<canvas>`.
2. User must move cursor from `start` to `end` while staying inside the path.
3. System continuously samples:
   - x,y movement
   - timestamp deltas
   - velocity variance
   - acceleration spikes
   - edge proximity
4. After reaching end, analytics are evaluated against thresholds derived from human samples.
5. If movement matches human-like jitter + chaos → pass.
6. If movement is too smooth or too linear → fail.

---

## 3. Human Behavior Metrics to Capture

### 3.1 Jitter (micro random variation)
Humans have:
- ±1 to ±6 px noise every 10–60 ms  
Agents produce near-perfect smooth curves.

### 3.2 Speed Variance
Humans do:
- accelerate, decelerate, pause  
Agents show constant velocity.

### 3.3 Direction Noise
Humans do slight left/right corrections.  
Agents glide.

### 3.4 Idle Micro-Pauses
10–40 ms pauses appear naturally.  
Agents rarely simulate this.

### 3.5 Path Edge Avoidance
Humans drift near edges but rarely clip.  
Agents overcorrect or clip instantly.

---

## 4. CAPTCHA Flow . UX

1. Show instruction:  
   **"Move your cursor through the path without touching the edges."**
2. Display a neon squiggly path.  
3. On hover into the start node → begin recording.
4. On hover into the end node → stop recording + evaluate.
5. If fail → regenerate path and ask to retry.

---

## 5. Canvas Path Generation . Pseudocode

```js
function generatePath(ctx) {
    const points = [];
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    let x = 30;
    let y = height / 2;

    for (let i = 0; i < 12; i++) {
        x += 60;
        y += (Math.random() * 120) - 60; // up/down wiggle
        points.push({ x, y });
    }

    ctx.lineWidth = 40; // path thickness
    ctx.lineCap = "round";
    ctx.strokeStyle = "#4af7ff";

    ctx.beginPath();
    ctx.moveTo(30, height / 2);

    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    return points;
}
```

---

## 6. Recording Cursor Movement

```js
let movements = [];

function startRecording() {
    movements = [];
    lastTime = performance.now();
    document.addEventListener("mousemove", recordMovement);
}

function recordMovement(e) {
    const now = performance.now();
    movements.push({
        x: e.clientX,
        y: e.clientY,
        dt: now - lastTime
    });
    lastTime = now;
}

function stopRecording() {
    document.removeEventListener("mousemove", recordMovement);
}
```

---

## 7. Evaluation Logic

### 7.1 Velocity Variance

```js
function velocityStats(movements) {
    const vels = [];
    for (let i = 1; i < movements.length; i++) {
        const dx = movements[i].x - movements[i - 1].x;
        const dy = movements[i].y - movements[i - 1].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const t = movements[i].dt;
        vels.push(dist / (t || 1));
    }

    const mean = vels.reduce((a,b) => a+b, 0) / vels.length;
    const variance = vels.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / vels.length;

    return { mean, variance };
}
```

Expected human:
- mean velocity: 0.5 . 8 px/ms
- variance: **high** 0.5 . 3  

AI:
- variance extremely low (<0.2)

---

### 7.2 Jitter Noise Test

```js
function jitterScore(movements) {
    let jitter = 0;
    for (let i = 1; i < movements.length; i++) {
        const dx = Math.abs(movements[i].x - movements[i-1].x);
        const dy = Math.abs(movements[i].y - movements[i-1].y);
        if (dx < 3 && dy < 3) jitter++;
    }
    return jitter;
}
```

Humans produce:
- 15 . 40 percent jitter segments  

AI:
- <5 percent

---

### 7.3 Idle Pause Test

```js
function idlePauses(movements) {
    return movements.filter(m => m.dt > 50).length;
}
```

Humans have:
- 3 . 12 micro-pauses  

AI:
- usually zero

---

### 7.4 Final Combined Score

```js
function evaluate(movements) {
    const { variance } = velocityStats(movements);
    const jitter = jitterScore(movements);
    const pauses = idlePauses(movements);

    const passVariance = variance > 0.4;
    const passJitter = jitter > movements.length * 0.10;
    const passPauses = pauses >= 2;

    return passVariance && passJitter && passPauses;
}
```

---

## 8. Edge Collision Detection
Basic version:
- Sample path thickness  
- If cursor distance from nearest path point > half thickness → fail  

You can also draw a mask and check pixel collision.

---

## 9. Security Notes

- Regenerate path every attempt.
- Add noise to jitter thresholds so AI can't reverse engineer.
- Shuffle evaluation criteria order.
- Occasionally use decoy paths.
- Store user telemetry anonymized only.

---

## 10. Minimal Working HTML Demo

```html
<!DOCTYPE html>
<html>
<head>
<style>
  #canvas { border:1px solid #333; }
</style>
</head>
<body>

<canvas id="canvas" width="900" height="300"></canvas>
<button id="startBtn">Start</button>

<script>
  // Include the code from earlier sections here for a full demo
</script>

</body>
</html>
```

---

## 11. Extensions
- Add multi-path mazes
- Add rotating paths
- Add shrinking sections
- Add fake invisible gaps
- Combine with subjective question at end

---

## 12. License
You may use this system freely for commercial or personal use.

---

## 13. Interactive Demo Included

This repository now ships with a self-contained HTML demo that implements the Micro Motion CAPTCHA:

1. Open `index.html` in any modern desktop browser (no build step required).
2. Follow the instruction panel, hover the glowing start node, and move the cursor through the neon path.
3. Movement analytics (velocity variance, jitter ratio, idle pauses, sample count) are displayed after each attempt to help you tune thresholds.
4. Use the **Reset Attempt** button to try again on the same path or **Regenerate Path** to draw a brand new squiggly track.

All logic lives in `main.js`, and styling is in `styles.css` for easy customization.

---

## 14. Threshold Calibration Notes

The live demo now evaluates movement chaos using three primary signals:

- **Velocity variance (windowed)**: `variance > 0.01` (px/ms)² measured over sliding windows of multiple samples so that hardware-level pointer smoothing no longer zeros out the variance.
- **Coefficient of variation**: `std / mean > 0.25` rewards acceleration spikes even when the absolute variance is low.
- **Direction noise ratio**: percentage of turns whose angle change exceeds ~20°. Requires >8% noisy turns to pass.

Passing any of those chaos checks (plus the jitter, idle pause, and sample-count requirements) clears the CAPTCHA. Adjust the constants in `main.js` to tighten or loosen the filters for your deployment.
