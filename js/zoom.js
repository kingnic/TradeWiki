// zoom.js – Bild-Vollansicht zoom 

function openZoom(src) {
  const z = document.createElement('div');
  z.className = 'zoom';
  z.innerHTML = `<img src="${src}" draggable="false"><button class="zx">✕</button><div class="zh">Mausrad: zoomen · Ziehen: verschieben · Doppelklick: Originalgröße / zurück · Esc: schließen</div>`;
  const im = z.querySelector('img');
  let s = 1, tx = 0, ty = 0, drag = null;

  const ap = () => {
    im.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    im.style.cursor = drag ? 'grabbing' : 'grab';
  };

  // Mausrad zoom um zeiger
  z.addEventListener('wheel', e => {
    e.preventDefault();
    const s2 = Math.min(8, Math.max(1, s * Math.exp(-e.deltaY * .0018)));
    const k = s2 / s, mx = e.clientX - innerWidth / 2, my = e.clientY - innerHeight / 2;
    tx = mx - k * (mx - tx);
    ty = my - k * (my - ty);
    s = s2;
    if (s == 1) tx = ty = 0;
    ap();
  }, { passive: false });

  // Ziehen
  im.addEventListener('mousedown', e => { e.preventDefault(); drag = { x: e.clientX - tx, y: e.clientY - ty }; ap(); });
  z.addEventListener('mousemove', e => { if (drag) { tx = e.clientX - drag.x; ty = e.clientY - drag.y; ap(); } });
  z.addEventListener('mouseup', () => { drag = null; ap(); });

  // Doppelklick: Originalgröße 
  im.addEventListener('dblclick', e => {
    if (s > 1) { s = 1; tx = ty = 0; }
    else {
      const mx = e.clientX - innerWidth / 2, my = e.clientY - innerHeight / 2;
      const r = im.getBoundingClientRect(), q = Math.min(8, Math.max(2, im.naturalWidth / r.width));
      s = q; tx = mx - q * mx; ty = my - q * my;
    }
    ap();
  });

  // Klick auf den Hintergrund oder ✕ 
  z.addEventListener('click', e => {
    if ((e.target === z || e.target.classList.contains('zx')) && (downT === e.target || e.target.classList.contains('zx'))) z.remove();
  });
  document.body.append(z);
  ap();
}
