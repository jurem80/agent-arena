/** Stylized glowing dotted US map for Grid Defense */

const US_OUTLINE = [
  [8, 22], [14, 18], [22, 16], [30, 14], [40, 12], [52, 12], [62, 14], [72, 16], [80, 18], [88, 22],
  [92, 28], [94, 36], [92, 44], [88, 50], [82, 54], [78, 62], [72, 68], [64, 70], [56, 68], [48, 70],
  [40, 72], [32, 68], [24, 64], [18, 58], [12, 52], [8, 44], [6, 34], [8, 22],
];

function densify(points, step = 2.2) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(d / step));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  return out;
}

function fillDots(outline, spacing = 4.5) {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dots = [];
  const inside = (x, y) => {
    let odd = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, yi] = outline[i];
      const [xj, yj] = outline[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) odd = !odd;
    }
    return odd;
  };
  for (let y = minY; y <= maxY; y += spacing) {
    for (let x = minX; x <= maxX; x += spacing) {
      if (inside(x, y) && Math.random() > 0.35) dots.push([x, y]);
    }
  }
  return dots;
}

/**
 * @param {HTMLElement} host
 * @param {{ regions: any[], progress: any, selectedId: string, onSelect: (id:string)=>void }} opts
 */
export function createMapView(host, opts) {
  const wrap = document.createElement('div');
  wrap.className = 'gd-map-stage';
  wrap.innerHTML = `
    <div class="gd-map-sky"></div>
    <div class="gd-map-grid"></div>
    <div class="gd-map-pan" data-pan>
      <svg class="gd-map-svg" viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet">
        <g class="gd-dots-fill"></g>
        <g class="gd-dots-outline"></g>
        <g class="gd-regions"></g>
      </svg>
    </div>
    <div class="gd-map-vignette"></div>
  `;
  host.appendChild(wrap);

  const svg = wrap.querySelector('.gd-map-svg');
  const fillG = wrap.querySelector('.gd-dots-fill');
  const outG = wrap.querySelector('.gd-dots-outline');
  const regG = wrap.querySelector('.gd-regions');
  const panEl = wrap.querySelector('[data-pan]');

  const outline = densify(US_OUTLINE, 1.6);
  const fill = fillDots(US_OUTLINE, 3.8);

  for (const [x, y] of fill) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', '0.35');
    c.setAttribute('class', 'gd-dot dim');
    fillG.appendChild(c);
  }
  for (const [x, y] of outline) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', '0.55');
    c.setAttribute('class', 'gd-dot');
    outG.appendChild(c);
  }

  const markers = new Map();

  function renderRegions() {
    regG.innerHTML = '';
    markers.clear();
    for (const region of opts.regions) {
      const unlocked = opts.isUnlocked(region.id);
      const secured = opts.progress.secured.includes(region.id);
      const selected = opts.selectedId === region.id;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `gd-region${selected ? ' selected' : ''}${secured ? ' secured' : ''}${unlocked ? '' : ' locked'}`);
      g.style.cursor = unlocked ? 'pointer' : 'not-allowed';
      g.innerHTML = `
        <circle class="gd-glow" cx="${region.x}" cy="${region.y}" r="4.5" />
        <circle class="gd-core" cx="${region.x}" cy="${region.y}" r="1.4" />
        ${selected ? `<line class="gd-pin" x1="${region.x}" y1="${region.y - 1}" x2="${region.x}" y2="${region.y - 7}" />
        <circle class="gd-pin-head" cx="${region.x}" cy="${region.y - 8}" r="1.3" />` : ''}
        <text class="gd-label" x="${region.x}" y="${region.y + 7}" text-anchor="middle">${region.name}</text>
      `;
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onSelect(region.id);
      });
      regG.appendChild(g);
      markers.set(region.id, g);
    }
  }

  renderRegions();

  // pan / drag
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const applyPan = () => {
    panEl.style.transform = `translate(${panX}px, ${panY}px) scale(1.05)`;
  };
  applyPan();

  const onDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    wrap.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    panX = Math.max(-120, Math.min(120, panX));
    panY = Math.max(-80, Math.min(80, panY));
    lastX = e.clientX;
    lastY = e.clientY;
    applyPan();
  };
  const onUp = () => {
    dragging = false;
    wrap.classList.remove('dragging');
  };
  wrap.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  return {
    refresh(next) {
      Object.assign(opts, next);
      renderRegions();
    },
    dispose() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      wrap.remove();
    },
  };
}
