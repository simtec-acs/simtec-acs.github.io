(() => {
  const canvas = document.getElementById("motion-bg");

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: false });

  if (!ctx) {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    nodes: [],
    glyphs: [],
    rings: []
  };

  const palette = ["#6de8ff", "#9af7e2", "#eaa7d8", "#b9d8ff"];

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    seed();
  }

  function seed() {
    const nodeCount = Math.round(Math.min(145, Math.max(76, state.width / 12)));
    const glyphCount = Math.round(Math.min(115, Math.max(52, state.width / 16)));
    state.nodes = Array.from({ length: nodeCount }, (_, index) => ({
      angle: rand(0, Math.PI * 2),
      radius: rand(42, Math.max(state.width, state.height) * 0.55),
      depth: rand(0.2, 1),
      speed: rand(0.00014, 0.00052) * (index % 2 ? 1 : -1),
      size: rand(0.7, 2.4),
      color: palette[index % palette.length],
      phase: rand(0, Math.PI * 2)
    }));
    state.glyphs = Array.from({ length: glyphCount }, (_, index) => ({
      lane: rand(-0.92, 0.92),
      y: rand(-0.2, 1.2),
      speed: rand(0.00012, 0.00036),
      depth: rand(0.24, 1),
      value: index % 4 === 0 ? "01" : String(index % 2),
      color: palette[(index + 1) % palette.length],
      phase: rand(0, Math.PI * 2)
    }));
    state.rings = Array.from({ length: 7 }, (_, index) => ({
      radius: 110 + index * 78,
      speed: rand(0.00008, 0.00018) * (index % 2 ? 1 : -1),
      tilt: rand(-0.42, 0.42),
      phase: rand(0, Math.PI * 2)
    }));
  }

  function project(node, now) {
    const centerX = state.width * 0.52;
    const centerY = state.height * 0.46;
    const drift = Math.sin(now * 0.00018 + node.phase) * 28;
    const angle = node.angle + now * node.speed;
    const depthScale = 0.28 + node.depth * 1.34;

    return {
      x: centerX + Math.cos(angle) * (node.radius + drift) * depthScale,
      y: centerY + Math.sin(angle) * (node.radius * 0.42 + drift) * depthScale,
      alpha: 0.18 + node.depth * 0.58,
      size: node.size * depthScale,
      color: node.color
    };
  }

  function drawBackground() {
    const gradient = ctx.createRadialGradient(
      state.width * 0.5,
      state.height * 0.44,
      0,
      state.width * 0.5,
      state.height * 0.44,
      Math.max(state.width, state.height) * 0.72
    );

    gradient.addColorStop(0, "#0a3350");
    gradient.addColorStop(0.42, "#061727");
    gradient.addColorStop(1, "#010409");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function drawRings(now) {
    const centerX = state.width * 0.52;
    const centerY = state.height * 0.46;

    ctx.save();
    ctx.translate(centerX, centerY);
    state.rings.forEach((ring, index) => {
      ctx.save();
      ctx.rotate(now * ring.speed + ring.phase);
      ctx.scale(1, 0.28 + index * 0.03 + ring.tilt);
      ctx.strokeStyle = `rgba(112, 224, 255, ${0.11 - index * 0.008})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 12 + index * 2]);
      ctx.beginPath();
      ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
    ctx.setLineDash([]);
  }

  function drawDataGlyphs(now) {
    ctx.font = "600 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    state.glyphs.forEach((glyph) => {
      const perspective = 0.22 + glyph.depth * 1.45;
      const centerX = state.width * 0.52;
      const yProgress = (glyph.y + now * glyph.speed) % 1.4 - 0.2;
      const x = centerX + glyph.lane * state.width * 0.62 * perspective;
      const y = state.height * yProgress;
      const alpha = (0.07 + glyph.depth * 0.3) * (0.65 + Math.sin(now * 0.002 + glyph.phase) * 0.35);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = glyph.color;
      ctx.fillText(glyph.value, x, y);

      if (glyph.depth > 0.7) {
        ctx.fillRect(x - 1, y + 18, 2, 18 + glyph.depth * 24);
      }
    });

    ctx.globalAlpha = 1;
  }

  function drawNetwork(now) {
    const points = state.nodes.map((node) => project(node, now));
    const centerX = state.width * 0.52;
    const centerY = state.height * 0.46;

    points.forEach((point, index) => {
      if (index % 3 === 0) {
        ctx.strokeStyle = `rgba(104, 219, 255, ${point.alpha * 0.16})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }

      for (let nextIndex = index + 1; nextIndex < Math.min(points.length, index + 9); nextIndex += 1) {
        const next = points[nextIndex];
        const distance = Math.hypot(point.x - next.x, point.y - next.y);

        if (distance < 128) {
          ctx.strokeStyle = `rgba(133, 238, 234, ${(1 - distance / 128) * 0.22})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }
      }

      ctx.shadowColor = point.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = point.color;
      ctx.globalAlpha = point.alpha;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    drawBackground();
    drawRings(now);
    drawNetwork(now);
    drawDataGlyphs(now);

    if (!prefersReducedMotion) {
      requestAnimationFrame(draw);
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  requestAnimationFrame(draw);
})();
