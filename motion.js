// Clips load and play only once they are near the viewport, so opening a page
// does not download every clip on it up front
(function () {
  // Clips marked data-play="hover" are handled further down
  const clips = [].slice.call(document.querySelectorAll('video:not([data-play="hover"])'));
  if (!clips.length) return;

  // Respect reduced motion: leave the clips paused and let the reader start them
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    clips.forEach((v) => { v.controls = true; });
    return;
  }

  // A screen of lead time, so a clip is ready by the time it scrolls into view
  const MARGIN = 600;

  const start = (v) => {
    if (v.preload !== 'auto') v.preload = 'auto';
    if (!v.paused) return;
    const playing = v.play();
    if (playing && playing.catch) playing.catch(() => {});
  };

  const sync = () => {
    const h = window.innerHeight || document.documentElement.clientHeight;
    clips.forEach((v) => {
      const box = v.getBoundingClientRect();
      const near = box.bottom > -MARGIN && box.top < h + MARGIN;
      if (near) {
        start(v);
      } else if (!v.paused) {
        v.pause();
      }
    });
  };

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  };

  sync();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', sync);

  // Second trigger, in case the scroll handler never runs. It only ever starts
  // a clip; pausing stays with sync() so the two cannot fight each other.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) start(entry.target); });
    }, { rootMargin: MARGIN + 'px 0px' });
    clips.forEach((v) => io.observe(v));
  }
})();

// Subtle scroll reveal: sections, cards and timeline rows fade up as they enter the viewport
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const groups = [
    ['main > section > h2, .page-head', 0],
    ['.card--hero', 0],
    ['.cards > .card', 80],
    ['.timeline > li', 60],
    ['.more', 0],
    ['.case-hero, .case-head, .case-meta', 80],
    ['.case-section > h2, .case-text, .case-stats, .case-list', 0],
    ['.case-figure', 0],
    ['.cta > *', 60],
    ['footer > *', 60],
  ];
  const items = [];
  groups.forEach(([selector, step]) => {
    // Stagger siblings within the same parent
    const byParent = new Map();
    document.querySelectorAll(selector).forEach((el) => {
      const list = byParent.get(el.parentElement) || [];
      list.push(el);
      byParent.set(el.parentElement, list);
    });
    byParent.forEach((list) => list.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', Math.min(i * step, 360) + 'ms');
      items.push(el);
    }));
  });

  document.documentElement.classList.add('reveal-ready');

  // Reveal anything already in or near the viewport. Measuring rectangles works
  // everywhere, so content is never left invisible when the observer below does
  // not report. A missed animation is recoverable, a blank page is not.
  const MARGIN = 80;
  const sync = () => {
    const h = window.innerHeight || document.documentElement.clientHeight;
    for (let i = items.length - 1; i >= 0; i--) {
      const box = items[i].getBoundingClientRect();
      if (box.top < h + MARGIN && box.bottom > -MARGIN) {
        items[i].classList.add('is-visible');
        items.splice(i, 1);
      }
    }
  };

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  };

  sync();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', sync);

  // The observer is the cheaper path once the page is running. It only ever
  // reveals, so it cannot fight sync() above.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { rootMargin: MARGIN + 'px 0px', threshold: 0 });
    items.slice().forEach((el) => io.observe(el));
  }
})();

// Dot grid band (Automation Agents case study): as the reader scrolls past it, the dots
// drift up a little slower than the page, shrink and fade. style.css reads --dots-p.
(function () {
  const band = document.querySelector('.case-hero--dots');
  if (!band || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let queued = false;
  const update = () => {
    queued = false;
    // Finish as the content covers the band. When the masthead is pinned the band stays
    // put on screen, so its on-screen bottom is already the full distance.
    const bottom = band.getBoundingClientRect().bottom;
    const pinned = document.documentElement.classList.contains('masthead-pinned');
    const distance = Math.max(1, pinned ? bottom : bottom + window.scrollY);
    const p = Math.min(1, Math.max(0, window.scrollY / distance));
    // Ease out so the change starts gently and settles
    const eased = 1 - Math.pow(1 - p, 2);
    band.style.setProperty('--dots-p', eased.toFixed(4));
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
})();

// Dot grid band, title: move the title so its text baseline sits exactly on a row of
// dots. The dots are 20px apart, centred in 20px tiles laid from the band's bottom edge.
(function () {
  const band = document.querySelector('.case-hero--dots');
  const title = band && band.querySelector('.dots-title');
  const probe = title && title.querySelector('.dots-title__probe');
  const subProbe = title && title.querySelector('.dots-title__probe--sub');
  if (!probe) return;
  const snap = () => {
    // The second line sits a fixed number of dot rows under the title's baseline:
    // three rows on wider screens, two on small ones
    if (subProbe) {
      band.style.setProperty('--sub-snap', '0px');
      const gap = window.matchMedia('(min-width: 768px)').matches ? 60 : 40;
      const offset = probe.getBoundingClientRect().top + gap - subProbe.getBoundingClientRect().top;
      band.style.setProperty('--sub-snap', offset.toFixed(2) + 'px');
    }
    // Both boxes carry the same transform, so their difference is the layout offset
    // (title.offsetTop is where the title box starts relative to the band, before the transform)
    const baseline = band.getBoundingClientRect().top + title.offsetTop + (probe.getBoundingClientRect().top - title.getBoundingClientRect().top);
    const bottom = band.getBoundingClientRect().bottom;
    const rows = Math.round((bottom - 10 - baseline) / 20);
    const target = bottom - 10 - rows * 20;
    band.style.setProperty('--title-snap', (target - baseline).toFixed(2) + 'px');
  };
  snap();
  if (document.fonts) document.fonts.ready.then(snap);
  window.addEventListener('resize', snap);
})();

// Dot grid band, typing: the title and its second line type out letter by letter at an
// uneven, human pace. Letters wait a little longer after spaces, hyphens and commas, and
// the second line starts after a short pause.
(function () {
  const title = document.querySelector('.dots-title');
  if (!title) return;
  const layers = [].slice.call(title.querySelectorAll('.dots-title__gloss'));
  // Screen readers get the whole text at once, not letter by letter
  const subEl = layers[0].querySelector('.dots-title__sub');
  const subText = subEl ? subEl.textContent.trim() : '';
  const headText = layers[0].textContent.slice(0, layers[0].textContent.length - (subEl ? subEl.textContent.length : 0)).trim();
  title.setAttribute('aria-label', subText ? headText + '. ' + subText : headText);
  layers.forEach((l) => l.setAttribute('aria-hidden', 'true'));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Wrap every letter of a line in a span, keeping the probes and nested spans in place
  const wrap = (el) => {
    const out = [];
    [].slice.call(el.childNodes).forEach((node) => {
      if (node.nodeType !== 3) return;
      const frag = document.createDocumentFragment();
      for (const chr of node.textContent) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = chr;
        frag.appendChild(s);
        out.push(s);
      }
      node.replaceWith(frag);
    });
    return out;
  };
  // Per layer: the title letters first, then the second line's
  const perLayer = layers.map((l) => {
    const sub = l.querySelector('.dots-title__sub');
    return wrap(l).concat(sub ? wrap(sub) : []);
  });
  const count = perLayer[0].length;
  const titleCount = layers[0].textContent.length - (layers[0].querySelector('.dots-title__sub') || { textContent: '' }).textContent.length;

  let i = 0;
  const step = () => {
    perLayer.forEach((letters) => { if (letters[i]) letters[i].classList.add('is-typed'); });
    const chr = perLayer[0][i] ? perLayer[0][i].textContent : '';
    i += 1;
    if (i >= count) return;
    const inSub = i >= titleCount;
    let wait = (inSub ? 34 : 62) * (0.6 + Math.random() * 0.8);
    if (chr === ' ') wait += inSub ? 40 : 70;
    if (chr === '-') wait += 120;
    if (chr === ',') wait += 220;
    if (i === titleCount) wait = 520; // a breath between the two lines
    setTimeout(step, wait);
  };
  setTimeout(step, 650);
})();

// Hover clips: data-play="hover" shows the clip's first frame and plays it only while
// the reader hovers or focuses its card, then returns to the first frame. Screens without
// hover (phones, tablets) play it while it is on screen instead.
(function () {
  const clips = [].slice.call(document.querySelectorAll('video[data-play="hover"]'));
  if (!clips.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;

  clips.forEach((v) => {
    const card = v.closest('.card') || v;
    v.loop = true;
    // Load early enough that the first frame is there before the card scrolls into view
    const load = () => { if (v.preload !== 'auto') v.preload = 'auto'; };
    const play = () => { load(); const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const rest = () => { v.pause(); if (v.currentTime > 0) v.currentTime = 0; };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) load(); });
      }, { rootMargin: '600px 0px' }).observe(card);
    } else {
      load();
    }
    if (reduced) return;

    if (canHover) {
      card.addEventListener('mouseenter', play);
      card.addEventListener('mouseleave', rest);
      card.addEventListener('focusin', play);
      card.addEventListener('focusout', (e) => { if (!card.contains(e.relatedTarget)) rest(); });
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? play() : v.pause()));
      }, { threshold: 0.5 }).observe(card);
    }
  });
})();

// Mirrored crops: a canvas repaints part of a playing clip on every frame, so part of
// a clip can be shown again, larger, without a second download. data-mirror names the
// video's id. Two ways to choose the part:
// - data-crop="x,y,width,height" draws that fixed source region into the canvas, and
//   data-fit="cover" fills the canvas from its top-left corner without stretching.
// - data-fit="focus" with data-focus="x,y,width,height" frames that source region in
//   the space the element named by data-avoid leaves uncovered, scaled to fit it.
//   data-zoom scales that fit up or down (1.15 is 15% closer).
//   data-min-y keeps the frame below that source row, and anything below data-max-y is
//   blanked out. In both ways data-pan="seconds:dx,dy" moves the
//   framing with the recording when its content jumps, so the content holds still.
// The canvas is drawn at the screen's real pixel density with high-quality scaling,
// because a browser shrinking a large video in one step blurs small text.
(function () {
  const nums = (s) => s.split(',').map(Number);
  const canvases = [].slice.call(document.querySelectorAll('canvas[data-mirror]'));
  canvases.forEach((c) => {
    const v = document.getElementById(c.dataset.mirror);
    if (!v) return;
    const g = c.getContext('2d');
    const mid = document.createElement('canvas');
    const mg = mid.getContext('2d');
    const focus = c.dataset.fit === 'focus' && c.dataset.focus ? nums(c.dataset.focus) : null;
    const crop = c.dataset.crop ? nums(c.dataset.crop) : null;
    const lift = c.dataset.lift ? nums(c.dataset.lift) : null;
    const cover = c.dataset.fit === 'cover';
    if (!focus && !crop) return;
    const avoid = c.dataset.avoid ? document.querySelector(c.dataset.avoid) : null;
    const minY = Number(c.dataset.minY || 0);
    const zoom = Number(c.dataset.zoom || 1);
    const maxY = c.dataset.maxY ? Number(c.dataset.maxY) : Infinity;
    const pans = (c.dataset.pan || '').split(/\s+/).filter(Boolean).map((p) => {
      const [t, d] = p.split(':');
      const [dx, dy] = nums(d);
      return { t: Number(t), dx, dy };
    });

    const panAt = (time) => {
      let dx = 0;
      let dy = 0;
      pans.forEach((p) => { if (time >= p.t) { dx = p.dx; dy = p.dy; } });
      return [dx, dy];
    };

    const region = (time) => {
      if (!focus) {
        // A fixed source region: it only scales with the canvas, it never reframes.
        // data-fit="cover" fills the canvas from its top-left corner.
        let [sx, sy, sw, sh] = crop;
        if (cover) {
          const target = c.width / c.height;
          if (sw / sh > target) sw = sh * target;
          else sh = sw / target;
        }
        const [dx, dy] = panAt(time);
        return [sx + dx, sy + dy, sw, sh];
      }
      const [fx, fy, fw, fh] = focus;
      const W = c.clientWidth;
      const H = c.clientHeight;
      // How much of the canvas is left of the overlapping element (both scale together on hover)
      let room = W;
      if (avoid) {
        const r = c.getBoundingClientRect();
        const a = avoid.getBoundingClientRect();
        if (r.width) room = Math.max(W * 0.3, Math.min(W, ((a.left - r.left) / r.width) * W));
      }
      const pad = 14;
      const s = Math.min((room - 2 * pad) / fw, (H - 2 * pad) / fh) * zoom;
      const sw = W / s;
      const sh = H / s;
      const [dx, dy] = panAt(time);
      // Centre the nodes in the free space, or when zoomed past it keep their left edge
      // in view and let the rest run under the overlapping element
      const sx = fx - pad / s - Math.max(0, (room - 2 * pad) - fw * s) / 2 / s;
      const sy = Math.max(minY, fy + fh / 2 - sh / 2);
      return [sx + dx, sy + dy, sw, sh];
    };

    const paint = (time) => {
      if (v.readyState < 2 || !c.width) return;
      const [sx, sy, sw, sh] = region(time == null ? v.currentTime : time);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      // Shrinking more than 2x in one step drops detail, so go through a half-way size first
      if (sw / c.width > 2) {
        const w = c.width * 2;
        const h = c.height * 2;
        if (mid.width !== w || mid.height !== h) { mid.width = w; mid.height = h; }
        mg.imageSmoothingEnabled = true;
        mg.imageSmoothingQuality = 'high';
        mg.fillStyle = '#fff';
        mg.fillRect(0, 0, w, h);
        mg.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
        g.drawImage(mid, 0, 0, c.width, c.height);
      } else {
        g.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      }
      // data-lift="x,y,radiusX,radiusY,strength" brightens a soft shadow baked into the
      // recording back to white, strongest at x,y and fading out over the radii
      if (lift) {
        const [lx, ly, rx, ry, k] = lift;
        const kx = c.width / sw;
        const ky = c.height / sh;
        g.save();
        g.globalCompositeOperation = 'color-dodge';
        g.translate((lx - sx) * kx, (ly - sy) * ky);
        g.scale(rx * kx, ry * ky);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        const a = Math.round(k * 255);
        grad.addColorStop(0, 'rgb(' + a + ',' + a + ',' + a + ')');
        grad.addColorStop(1, 'rgb(0,0,0)');
        g.fillStyle = grad;
        g.fillRect(-1, -1, 2, 2);
        g.restore();
      }
      // Blank out anything below data-max-y, such as the app's own toolbar
      if (sy + sh > maxY) {
        const y = Math.max(0, ((maxY - sy) / sh) * c.height);
        g.fillRect(0, y, c.width, c.height - y);
      }
    };
    const size = () => {
      // Exactly one device pixel per canvas pixel: drawing larger and letting the
      // browser shrink it again would blur the text a second time
      const r = window.devicePixelRatio || 1;
      c.width = Math.round(c.clientWidth * r);
      c.height = Math.round(c.clientHeight * r);
      paint();
    };

    if ('requestVideoFrameCallback' in v) {
      const onFrame = (now, meta) => { paint(meta && meta.mediaTime); v.requestVideoFrameCallback(onFrame); };
      v.requestVideoFrameCallback(onFrame);
    } else {
      const tick = () => { if (!v.paused) paint(); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    v.addEventListener('loadeddata', () => paint());
    v.addEventListener('seeked', () => paint());
    window.addEventListener('resize', size);
    size();
  });
})();
