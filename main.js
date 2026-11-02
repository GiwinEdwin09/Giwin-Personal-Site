(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.getElementById("year").textContent = new Date().getFullYear();

  // Nav border once the page scrolls
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Reveal sections on scroll
  const revealEls = document.querySelectorAll(".project, .log li, .stack-card, .section-head, .contact");
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealEls.forEach((el) => el.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  }

  // Cycle the tagline
  const typed = document.getElementById("typed");
  const phrases = [
    "embedding ideas into products",
    "forecasting the premier league",
    "teaching agents to disagree well",
    "fixing the map, one POI at a time",
  ];
  if (!reduceMotion) {
    let p = 0, i = phrases[0].length, deleting = true;
    const tick = () => {
      const word = phrases[p];
      if (deleting) {
        i--;
        if (i <= 0) { deleting = false; p = (p + 1) % phrases.length; }
      } else {
        i++;
        if (i >= phrases[p].length) { deleting = true; typed.textContent = phrases[p]; return setTimeout(tick, 2600); }
      }
      typed.textContent = (deleting ? word : phrases[p]).slice(0, i);
      setTimeout(tick, deleting ? 28 : 55);
    };
    setTimeout(tick, 2600);
  }

  // Latent space point cloud
  const canvas = document.getElementById("latent");
  const ctx = canvas.getContext("2d");
  const tip = document.getElementById("tip");
  const hero = document.querySelector(".hero");

  const COLORS = { teal: [93, 202, 165], violet: [143, 135, 230], coral: [240, 153, 123], gray: [120, 119, 114] };

  // Cluster centers in a unit-ish 3D space
  const clusters = {
    teal: [0.55, -0.15, 0.25],
    violet: [-0.35, 0.45, -0.2],
    coral: [0.1, 0.55, 0.55],
  };

  // Labeled anchor points: projects and timeline entries
  const anchors = [
    { c: "teal", p: [0.62, -0.22, 0.32], title: "Prem Predict", sub: "Dixon-Coles + XGBoost forecasting", href: "#prem-predict" },
    { c: "teal", p: [0.42, -0.02, 0.05], title: "TruePin", sub: "Overture Maps · +7% over baseline", href: "#timeline" },
    { c: "violet", p: [-0.42, 0.52, -0.1], title: "MAGI", sub: "three-agent incident council", href: "#magi" },
    { c: "violet", p: [-0.18, 0.32, -0.38], title: "ClawForge", sub: "1st place · NVIDIA Cloud Track", href: "#timeline" },
    { c: "coral", p: [0.2, 0.62, 0.62], title: "LAIQA", sub: "real-time biometric tracking", href: "#timeline" },
    { c: "coral", p: [-0.02, 0.48, 0.42], title: "Soshal", sub: "Flutter app for UCSC clubs", href: "#timeline" },
  ];

  // Seeded RNG so the cloud looks the same on every load
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const points = [];
  const isSmall = () => window.innerWidth < 760;
  Object.entries(clusters).forEach(([c, center]) => {
    for (let k = 0; k < 110; k++) {
      points.push({ c, p: center.map((v) => v + gauss() * 0.13), r: 0.8 + rand() * 1.3, ph: rand() * Math.PI * 2 });
    }
  });
  for (let k = 0; k < 160; k++) {
    points.push({ c: "gray", p: [(rand() - 0.5) * 2.4, (rand() - 0.5) * 1.8, (rand() - 0.5) * 1.8], r: 0.6 + rand() * 0.8, ph: rand() * Math.PI * 2 });
  }

  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth; H = hero.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener("resize", resize);
  resize();

  let angle = 0.6, tilt = -0.25;
  let targetTilt = tilt, mouseX = -1, mouseY = -1, hovered = null;

  const project = ([x, y, z]) => {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    let x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    let y1 = y * ct - z1 * st, z2 = y * st + z1 * ct;
    const depth = 2.6;
    const s = depth / (depth + z2);
    const small = isSmall();
    const scale = small ? Math.min(W, H) * 0.36 : Math.min(W * 0.5, H) * 0.42;
    const cx = small ? W * 0.44 : W * 0.72;
    const cy = small ? H * 0.22 : H * 0.48;
    return { x: cx + x1 * scale * s, y: cy - y1 * scale * s, s, z: z2 };
  };

  const rgba = (c, a) => `rgba(${COLORS[c][0]},${COLORS[c][1]},${COLORS[c][2]},${a})`;

  let t = 0;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    tilt += (targetTilt - tilt) * 0.05;

    const proj = points.map((pt) => ({ pt, q: project(pt.p) }));
    proj.sort((a, b) => b.q.z - a.q.z);

    for (const { pt, q } of proj) {
      const tw = 0.75 + 0.25 * Math.sin(t * 1.4 + pt.ph);
      const base = pt.c === "gray" ? 0.28 : 0.62;
      ctx.fillStyle = rgba(pt.c, base * tw * Math.min(1, q.s));
      ctx.beginPath();
      ctx.arc(q.x, q.y, pt.r * q.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Anchors, with faint edges to their cluster's nearest neighbors
    const aproj = anchors.map((a) => ({ a, q: project(a.p) }));
    hovered = null;
    let best = isSmall() ? 0 : 26;
    for (const item of aproj) {
      const d = Math.hypot(item.q.x - mouseX, item.q.y - mouseY);
      if (d < best) { best = d; hovered = item; }
    }

    for (const { a, q } of aproj) {
      const active = hovered && hovered.a === a;
      const near = points
        .filter((p) => p.c === a.c)
        .map((p) => ({ p, d: (p.p[0] - a.p[0]) ** 2 + (p.p[1] - a.p[1]) ** 2 + (p.p[2] - a.p[2]) ** 2 }))
        .sort((m, n) => m.d - n.d)
        .slice(0, active ? 10 : 4);
      ctx.strokeStyle = rgba(a.c, active ? 0.45 : 0.14);
      ctx.lineWidth = 1;
      for (const { p } of near) {
        const pq = project(p.p);
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(pq.x, pq.y); ctx.stroke();
      }

      const r = (active ? 6.5 : 4.5) * q.s;
      ctx.fillStyle = rgba(a.c, active ? 0.22 : 0.12);
      ctx.beginPath(); ctx.arc(q.x, q.y, r * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(a.c, 1);
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();

      ctx.font = `${active ? 500 : 400} 11px "JetBrains Mono", monospace`;
      ctx.fillStyle = active ? "rgba(236,235,230,0.95)" : "rgba(163,162,156,0.7)";
      ctx.fillText(a.title.toLowerCase(), q.x + r + 8, q.y + 4);
    }

    if (hovered) {
      tip.innerHTML = `<b>${hovered.a.title}</b><span>${hovered.a.sub}</span>`;
      tip.style.left = `${Math.min(hovered.q.x + 16, W - 250)}px`;
      tip.style.top = `${hovered.q.y + 16}px`;
      tip.classList.add("on");
      canvas.style.cursor = "pointer";
    } else {
      tip.classList.remove("on");
      canvas.style.cursor = "default";
    }
  };

  const loop = () => {
    t += 0.016;
    if (!hovered) angle += 0.0016;
    draw();
    if (heroVisible) requestAnimationFrame(loop);
  };

  let heroVisible = true;
  if (reduceMotion) {
    draw();
    window.addEventListener("resize", draw);
  } else {
    new IntersectionObserver(([e]) => {
      const was = heroVisible;
      heroVisible = e.isIntersecting;
      if (heroVisible && !was) requestAnimationFrame(loop);
    }).observe(hero);
    requestAnimationFrame(loop);
  }

  hero.addEventListener("mousemove", (e) => {
    const r = hero.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
    targetTilt = -0.25 + ((mouseY / H) - 0.5) * 0.4;
    angle += ((mouseX / W) - 0.5) * 0.002;
    if (reduceMotion) draw();
  });
  hero.addEventListener("mouseleave", () => { mouseX = mouseY = -1; targetTilt = -0.25; if (reduceMotion) draw(); });
  canvas.addEventListener("click", () => {
    if (hovered) document.querySelector(hovered.a.href).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
})();
