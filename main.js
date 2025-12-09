const canvas = document.getElementById("GAMECanvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const metricsEl = document.getElementById("metrics");
const newPathBtn = document.getElementById("newPathBtn");
const resetBtn = document.getElementById("resetBtn");

const PATH_WIDTH = 44;
const START_RADIUS = 32;
const END_RADIUS = 36;

const state = {
  pathPoints: [],
  pathWidth: PATH_WIDTH,
  movements: [],
  trailPoints: [],
  recording: false,
  lastTime: 0,
  elapsed: 0,
  lastResult: null
};

function init() {
  generateNewPath();
  canvas.addEventListener("mousemove", handlePointerMove);
  canvas.addEventListener("mouseleave", handlePointerLeave);
  newPathBtn.addEventListener("click", generateNewPath);
  resetBtn.addEventListener("click", resetAttempt);
  updateMetrics();
}

function generateNewPath() {
  state.pathPoints = createPathPoints(canvas.width, canvas.height);
  state.movements = [];
  state.trailPoints = [];
  state.recording = false;
  state.elapsed = 0;
  state.lastResult = null;
  setStatus("Hover the start beacon to begin.", "ready");
  updateMetrics();
  renderScene();
}

function resetAttempt() {
  state.movements = [];
  state.trailPoints = [];
  state.recording = false;
  state.elapsed = 0;
  setStatus("Attempt reset. Hover the start beacon to begin.", "ready");
  updateMetrics(state.lastResult);
  renderScene();
}

function handlePointerMove(event) {
  if (!state.pathPoints.length) return;
  const pointer = getPointerPosition(event);

  if (!state.recording && isInsideCircle(pointer, state.pathPoints[0], START_RADIUS)) {
    beginRecording();
    state.trailPoints = [];
  }

  if (!state.recording) return;

  const now = performance.now();
  const dt = Math.max(now - state.lastTime, 0.1);
  state.lastTime = now;

  if (distanceToPath(pointer, state.pathPoints) > state.pathWidth * 0.52) {
    failAttempt("Edge collision detected.");
    return;
  }

  state.elapsed += dt;
  state.movements.push({ x: pointer.x, y: pointer.y, dt, elapsed: state.elapsed });
  state.trailPoints.push({ x: pointer.x, y: pointer.y });
  renderScene();

  const endPoint = state.pathPoints[state.pathPoints.length - 1];
  if (isInsideCircle(pointer, endPoint, END_RADIUS - 4)) {
    completeAttempt();
  }
}

function handlePointerLeave() {
  if (state.recording) {
    failAttempt("Cursor left the canvas.");
  }
}

function beginRecording() {
  state.movements = [];
  state.trailPoints = [];
  state.recording = true;
  state.lastTime = performance.now();
  state.elapsed = 0;
  setStatus("Recording... stay inside the glow.", "recording");
}

function failAttempt(message) {
  state.recording = false;
  state.movements = [];
  state.trailPoints = [];
  state.elapsed = 0;
  setStatus(`${message} Return to start to try again.`, "fail");
  renderScene();
}

function completeAttempt() {
  state.recording = false;
  if (state.movements.length < 12) {
    failAttempt("Movement trace too short.");
    return;
  }

  const attempt = state.movements.slice();
  const evaluation = evaluateMovements(attempt);
  state.lastResult = evaluation;

  const tone = evaluation.pass ? "pass" : "fail";
  const message = evaluation.pass
    ? "Human micro motion detected. GAME cleared."
    : "Motion looked synthetic. Try again.";

  setStatus(message, tone);
  updateMetrics(evaluation);
  state.movements = [];
  state.elapsed = 0;
}

function renderScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.pathPoints.length) return;
  drawGlowPath(state.pathPoints, state.pathWidth);
  drawBeacon(state.pathPoints[0], START_RADIUS, "#32f8ff", "START");
  drawBeacon(state.pathPoints[state.pathPoints.length - 1], END_RADIUS, "#ff7ddc", "END");
  drawTrail(state.trailPoints);
}

function drawGlowPath(points, width) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = "#31d0ff";
  ctx.lineWidth = width;
  ctx.shadowColor = "#25d5ff";
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = width - 14;
  ctx.stroke();
  ctx.restore();
}

function drawBeacon(point, radius, color, label) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#030914";
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius - 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = "600 11px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, point.x, point.y);
  ctx.restore();
}

function drawTrail(points) {
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function evaluateMovements(movements) {
  const { mean, variance } = velocityStats(movements);
  const velocityStd = Math.sqrt(Math.max(variance, 0));
  const velocityCv = mean ? velocityStd / mean : 0;
  const jitterCount = jitterScore(movements);
  const jitterRatio = jitterCount / Math.max(1, movements.length - 1);
  const directionNoise = directionNoiseRatio(movements);
  const pauses = idlePauses(movements);
  const sampleCount = movements.length;

  const passVariance = variance > 0.01;
  const passCv = velocityCv > 0.25;
  const passDirection = directionNoise > 0.08;
  const passChaos = passVariance || passCv || passDirection;
  const passJitter = jitterRatio > 0.1;
  const passPauses = pauses >= 2;
  const passSamples = sampleCount > 70;
  const pass = passChaos && passJitter && passPauses && passSamples;

  return {
    pass,
    meanVelocity: mean,
    variance,
    velocityStd,
    velocityCv,
    jitterCount,
    jitterRatio,
    directionNoise,
    pauses,
    samples: sampleCount,
    requirements: { passVariance, passCv, passDirection, passChaos, passJitter, passPauses, passSamples }
  };
}

function velocityStats(movements) {
  const window = 6;
  if (movements.length <= window) {
    return { mean: 0, variance: 0 };
  }

  const vels = [];
  for (let i = window; i < movements.length; i++) {
    const curr = movements[i];
    const prev = movements[i - window];
    const elapsedCurr = typeof curr.elapsed === "number" ? curr.elapsed : null;
    const elapsedPrev = typeof prev.elapsed === "number" ? prev.elapsed : null;
    const dt =
      elapsedCurr !== null && elapsedPrev !== null
        ? elapsedCurr - elapsedPrev
        : movements
            .slice(i - window + 1, i + 1)
            .reduce((sum, m) => sum + Math.max(m.dt, 0.1), 0);
    if (dt <= 0) continue;
    const distance = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    vels.push(distance / dt);
  }

  if (!vels.length) {
    return { mean: 0, variance: 0 };
  }

  const mean = vels.reduce((acc, v) => acc + v, 0) / vels.length;
  const variance =
    vels.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vels.length;
  return { mean, variance };
}

function jitterScore(movements) {
  let jitter = 0;
  for (let i = 1; i < movements.length; i++) {
    const dx = Math.abs(movements[i].x - movements[i - 1].x);
    const dy = Math.abs(movements[i].y - movements[i - 1].y);
    if (dx < 3 && dy < 3) jitter++;
  }
  return jitter;
}

function idlePauses(movements) {
  return movements.filter((m) => m.dt > 50).length;
}

function directionNoiseRatio(movements) {
  let noisy = 0;
  let comparisons = 0;
  for (let i = 2; i < movements.length; i++) {
    const prevVec = {
      x: movements[i - 1].x - movements[i - 2].x,
      y: movements[i - 1].y - movements[i - 2].y
    };
    const currVec = {
      x: movements[i].x - movements[i - 1].x,
      y: movements[i].y - movements[i - 1].y
    };
    const prevMag = Math.hypot(prevVec.x, prevVec.y);
    const currMag = Math.hypot(currVec.x, currVec.y);
    if (prevMag < 0.4 || currMag < 0.4) continue;
    comparisons++;
    const dot = (prevVec.x * currVec.x + prevVec.y * currVec.y) / (prevMag * currMag);
    if (dot < 0.93) noisy++;
  }
  return comparisons ? noisy / comparisons : 0;
}

function updateMetrics(result) {
  if (!result) {
    metricsEl.textContent =
      "samples: --\nmean velocity: --\nvariance: --\nvelocity std / cv: --\ndirection noise: --\nchaos metric: --\njitter ratio: --\nidle pauses: --";
    return;
  }

  const badge = (ok) => (ok ? "ok" : "LOW");
  metricsEl.textContent = [
    `samples: ${result.samples} (${badge(result.requirements.passSamples)})`,
    `mean velocity: ${result.meanVelocity.toFixed(2)} px/ms`,
    `variance: ${result.variance.toFixed(3)} (${badge(result.requirements.passVariance)})`,
    `velocity std: ${result.velocityStd.toFixed(3)} | cv: ${(result.velocityCv * 100).toFixed(1)}% (${badge(result.requirements.passCv)})`,
    `direction noise: ${(result.directionNoise * 100).toFixed(1)}% (${badge(result.requirements.passDirection)})`,
    `chaos metric: ${badge(result.requirements.passChaos)} (variance | cv | turns)`,
    `jitter ratio: ${(result.jitterRatio * 100).toFixed(1)}% (${badge(result.requirements.passJitter)})`,
    `idle pauses: ${result.pauses} (${badge(result.requirements.passPauses)})`
  ].join("\n");
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function isInsideCircle(point, center, radius) {
  if (!center) return false;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return dx * dx + dy * dy <= radius * radius;
}

function distanceToPath(point, points) {
  let min = Infinity;
  for (let i = 1; i < points.length; i++) {
    min = Math.min(min, distanceToSegment(point, points[i - 1], points[i]));
  }
  return min;
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = clamp(
    ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy),
    0,
    1
  );
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function createPathPoints(width, height) {
  const paddingX = 70;
  const paddingY = 60;
  const segments = 12;
  const stepX = (width - paddingX * 2) / segments;

  let x = paddingX;
  let y = height / 2 + randomRange(-30, 30);
  const points = [{ x, y }];

  for (let i = 0; i < segments; i++) {
    x += stepX;
    y = clamp(y + randomRange(-90, 90), paddingY, height - paddingY);
    points.push({ x, y });
  }

  return points;
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function setStatus(text, tone = "ready") {
  statusEl.textContent = text;
  statusEl.dataset.state = tone;
}

init();
