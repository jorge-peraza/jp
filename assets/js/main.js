/* JP · interacciones, animaciones y demos del laboratorio (sin dependencias). */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mxn = (n, dec = 2) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const hora = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  const CFG = window.JPCFG || {};

  function onVisible(els, cb, opts = { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }, once = true) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { cb(en.target, true); if (once) io.unobserve(en.target); }
      else if (!once) cb(en.target, false);
    }), opts);
    els.forEach(el => el && io.observe(el));
    return io;
  }

  /** Reinicia una animación CSS de un elemento. */
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  /* ------------------------------------------------------------------------
     Pantallas escaladas (contenido dibujado a un ancho virtual)
     ------------------------------------------------------------------------ */
  function fit(el) {
    if (el.hasAttribute('data-fixed')) return;
    const w = el.clientWidth;
    if (!w) return;
    const vw = (w < (+el.dataset.smAt || 600) && el.dataset.vwSm) ? +el.dataset.vwSm : +el.dataset.vw;
    el.style.setProperty('--vw', vw);
    el.style.setProperty('--s', (w / vw).toFixed(4));
  }
  const fitRO = new ResizeObserver(entries => entries.forEach(en => fit(en.target)));
  $$('[data-vw]').forEach(el => { fit(el); fitRO.observe(el); });

  /* ------------------------------------------------------------------------
     Controles segmentados con píldora deslizable (clic o arrastre)
     ------------------------------------------------------------------------ */
  function initSeg(seg) {
    const btns = $$('.seg-btn', seg);
    const activeBtn = () => btns.find(b => b.classList.contains('is-active')) || btns[0];
    const place = btn => {
      seg.style.setProperty('--px', btn.offsetLeft + 'px');
      seg.style.setProperty('--pw', btn.offsetWidth + 'px');
    };
    const select = (btn, emit = true) => {
      btns.forEach(b => {
        b.classList.toggle('is-active', b === btn);
        if (b.hasAttribute('role')) b.setAttribute('aria-selected', String(b === btn));
      });
      place(btn);
      if (seg.classList.contains('seg-scroll')) {
        seg.scrollTo({ left: btn.offsetLeft - (seg.clientWidth - btn.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
      }
      if (emit) seg.dispatchEvent(new CustomEvent('seg:change', { detail: btn.dataset.value }));
    };
    seg.segSelect = value => { const b = btns.find(x => x.dataset.value === value); if (b) select(b); };
    btns.forEach(b => b.addEventListener('click', () => { if (!seg.dataset.dragged) select(b); }));

    // Arrastre de la píldora (no en los que hacen scroll horizontal).
    if (!seg.classList.contains('seg-scroll')) {
      let drag = null;
      seg.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        drag = { x: e.clientX, px: parseFloat(seg.style.getPropertyValue('--px')) || 0, moved: false, id: e.pointerId };
      });
      seg.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        if (!drag.moved) {
          if (Math.abs(dx) < 6) return;
          drag.moved = true;
          seg.dataset.dragged = '1';
          seg.classList.add('is-dragging');
          try { seg.setPointerCapture(drag.id); } catch (_) { /* sin captura */ }
        }
        const pw = parseFloat(seg.style.getPropertyValue('--pw')) || 0;
        const last = btns[btns.length - 1];
        seg.style.setProperty('--px', clamp(drag.px + dx, btns[0].offsetLeft, last.offsetLeft + last.offsetWidth - pw) + 'px');
      });
      const end = () => {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        if (!moved) return;
        seg.classList.remove('is-dragging');
        const center = (parseFloat(seg.style.getPropertyValue('--px')) || 0) + (parseFloat(seg.style.getPropertyValue('--pw')) || 0) / 2;
        let best = btns[0], dist = Infinity;
        btns.forEach(b => { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - center); if (d < dist) { dist = d; best = b; } });
        select(best);
        setTimeout(() => delete seg.dataset.dragged, 0);
      };
      seg.addEventListener('pointerup', end);
      seg.addEventListener('pointercancel', end);
    }

    place(activeBtn());
    new ResizeObserver(() => place(activeBtn())).observe(seg);
    document.fonts?.ready.then(() => place(activeBtn()));
  }
  $$('.seg').forEach(initSeg);
  const seg = name => $(`[data-seg="${name}"]`);
  const onSeg = (name, cb) => seg(name)?.addEventListener('seg:change', e => cb(e.detail));

  /* ------------------------------------------------------------------------
     Intro: cargador con el monograma y entrada del hero
     ------------------------------------------------------------------------ */
  $$('[data-intro]').forEach((el, i) => el.style.setProperty('--di', (i * 90) + 'ms'));
  $$('.cc').forEach((el, i) => el.style.setProperty('--ci', (500 + i * 90) + 'ms'));

  let rotatorStarted = false;
  const ready = () => {
    if (root.classList.contains('is-ready')) return;
    root.classList.add('is-ready');
    startRotator();
  };
  const skipIntro = reduce || root.classList.contains('no-intro');
  if (skipIntro) {
    root.classList.add('is-loaded');
    setTimeout(ready, 50);
  } else {
    const counter = $('[data-loader-count]');
    const t0 = performance.now();
    const dur = 1100;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      counter.textContent = Math.round((1 - Math.pow(1 - k, 2)) * 100);
      if (k < 1) setTimeout(tick, 30);
      else finish();
    };
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      root.classList.add('is-loaded');
      setTimeout(ready, 420);
      try { sessionStorage.setItem('jp-intro', '1'); } catch (_) { /* almacenamiento no disponible */ }
    };
    tick();
    setTimeout(finish, 2600);
  }

  /* Palabra rotativa del título */
  function startRotator() {
    const rot = $('[data-rotate]');
    if (!rot || rotatorStarted) return;
    rotatorStarted = true;
    const items = $$('.rot-item', rot);
    let i = 0;
    const underline = () => rot.style.setProperty('--rw', items[i].offsetWidth + 'px');
    underline();
    document.fonts?.ready.then(underline);
    addEventListener('resize', underline);
    if (reduce || items.length < 2) return;
    setInterval(() => {
      const prev = items[i];
      i = (i + 1) % items.length;
      const next = items[i];
      prev.classList.remove('is-on');
      prev.classList.add('is-out');
      next.classList.add('is-on');
      underline();
      setTimeout(() => {
        prev.style.transition = 'none';
        prev.classList.remove('is-out');
        void prev.offsetWidth;
        prev.style.transition = '';
      }, 1050);
    }, 2400);
  }

  /* ------------------------------------------------------------------------
     Apariciones al hacer scroll
     ------------------------------------------------------------------------ */
  $$('[data-delay]').forEach(el => el.style.setProperty('--d', el.dataset.delay + 'ms'));
  let pendientes = $$('[data-reveal], [data-chat], [data-term]');
  onVisible(pendientes, el => el.classList.add('is-in'));
  let ultimoBarrido = 0;
  const barrer = () => {
    const ahora = Date.now();
    if (ahora - ultimoBarrido < 120 || !pendientes.length) return;
    ultimoBarrido = ahora;
    pendientes = pendientes.filter(el => {
      if (el.classList.contains('is-in')) return false;
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.9 && r.bottom > 0) { el.classList.add('is-in'); return false; }
      return true;
    });
  };
  addEventListener('scroll', barrer, { passive: true });
  setTimeout(barrer, 700);

  /* Cambio de tema claro/oscuro según la sección en pantalla */
  const metaTheme = $('meta[name="theme-color"]');
  onVisible($$('[data-theme]').filter(el => el !== root), (sec, visible) => {
    if (!visible) return;
    const t = sec.dataset.theme;
    if (root.dataset.theme !== t) {
      root.dataset.theme = t;
      metaTheme?.setAttribute('content', t === 'dark' ? '#0d0d0f' : '#eeebe5');
    }
  }, { rootMargin: '-50% 0px -50% 0px' }, false);

  /* ------------------------------------------------------------------------
     Navegación
     ------------------------------------------------------------------------ */
  const nav = $('#nav');
  const navToggle = $('.nav-toggle');
  const closeMenu = () => { nav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false'); navToggle.setAttribute('aria-label', 'Abrir menú'); };
  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  $$('.nav-movil a').forEach(a => a.addEventListener('click', closeMenu));
  const navLinks = $$('.nav-links a');
  onVisible($$('section[id]'), (sec, visible) => {
    if (visible) navLinks.forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + sec.id));
  }, { rootMargin: '-45% 0px -50% 0px' }, false);

  /* ------------------------------------------------------------------------
     Efectos ligados al scroll
     ------------------------------------------------------------------------ */
  const progress = $('.scroll-progress');
  const scrub = $('[data-scrub]');
  let words = [];
  if (scrub) {
    scrub.innerHTML = scrub.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    words = $$('.w', scrub);
  }

  // Servicios: scroll horizontal fijado
  const hs = $('[data-hscroll]');
  const track = $('[data-hs-track]');
  const hsIndex = $('[data-hs-index]');
  const hsBar = $('[data-hs-bar]');
  const mqWide = matchMedia('(min-width: 901px)');
  let hsDist = 0;
  const hsLayout = () => {
    if (!hs) return;
    if (!mqWide.matches || reduce) { hs.style.height = ''; track.style.setProperty('--hx', '0px'); return; }
    hsDist = Math.max(0, track.scrollWidth - innerWidth);
    hs.style.height = (Math.max(innerHeight, 640) + hsDist) + 'px';
  };
  // El carrusel sigue al scroll con inercia para que se mueva suave aunque la rueda avance a saltos.
  let hsCur = 0, hsTarget = 0, hsRunning = false;
  const hsAnimate = () => {
    hsCur += (hsTarget - hsCur) * 0.12;
    if (Math.abs(hsTarget - hsCur) < 0.4) hsCur = hsTarget;
    track.style.setProperty('--hx', hsCur.toFixed(2) + 'px');
    if (hsCur !== hsTarget) requestAnimationFrame(hsAnimate);
    else hsRunning = false;
  };
  hsLayout();
  addEventListener('resize', hsLayout);
  document.fonts?.ready.then(hsLayout);

  // Proceso: línea que se dibuja
  const steps = $('[data-steps]');
  const stepItems = $$('.step');
  $('.steps-line-fill')?.setAttribute('pathLength', '1');

  // Collage del hero: parallax con mouse y scroll
  const ccs = $$('.cc');
  let mouseX = 0, mouseY = 0;
  const moveCollage = () => {
    const sy = scrollY;
    ccs.forEach(c => {
      const d = +c.dataset.depth || 0.5;
      c.style.setProperty('--tx', (mouseX * d * 26).toFixed(1) + 'px');
      c.style.setProperty('--ty', (mouseY * d * 18 - sy * d * 0.18).toFixed(1) + 'px');
    });
  };
  if (finePointer && !reduce) {
    $('.hero')?.addEventListener('pointermove', e => {
      mouseX = (e.clientX / innerWidth - 0.5) * 2;
      mouseY = (e.clientY / innerHeight - 0.5) * 2;
      requestAnimationFrame(moveCollage);
    });
  }

  const footerBig = $('[data-footer-big]');
  let lastY = scrollY, ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);

    nav.classList.toggle('is-scrolled', y > 20);
    if (!nav.classList.contains('is-open')) {
      if (y > lastY + 2 && y > 600) nav.classList.add('is-hidden');
      else if (y < lastY - 2) nav.classList.remove('is-hidden');
    }
    lastY = y;

    if (!reduce && y < innerHeight * 1.5) moveCollage();

    if (words.length) {
      const r = scrub.getBoundingClientRect();
      const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35), 0, 1);
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    }

    if (hs && mqWide.matches && !reduce && hsDist) {
      const r = hs.getBoundingClientRect();
      const p = clamp(-r.top / hsDist, 0, 1);
      hsTarget = -p * hsDist;
      if (!hsRunning) { hsRunning = true; requestAnimationFrame(hsAnimate); }
      hsBar?.style.setProperty('--hp', p.toFixed(4));
      const cards = track.children.length;
      if (hsIndex) hsIndex.textContent = String(Math.min(cards - 1, Math.round(p * (cards - 1)) + 1)).padStart(2, '0');
    }

    if (steps) {
      const r = steps.getBoundingClientRect();
      const p = clamp((innerHeight * 0.6 - r.top) / r.height, 0, 1);
      steps.style.setProperty('--lp', p.toFixed(4));
      stepItems.forEach(s => s.classList.toggle('is-lit', s.getBoundingClientRect().top < innerHeight * 0.6));
    }

    if (footerBig) {
      const r = footerBig.getBoundingClientRect();
      const p = clamp((innerHeight - r.top) / r.height, 0, 1);
      footerBig.style.setProperty('--fy', ((1 - p) * 60).toFixed(1) + '%');
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ------------------------------------------------------------------------
     Laboratorio: elegir demo y dispositivo
     ------------------------------------------------------------------------ */
  const frame = $('#lab-frame');
  if (frame) {
    const stage = $('.lab-stage');
    const screen = $('.lab-screen', frame);
    const caption = $('[data-lab-caption]');
    const urlEl = $('[data-lab-url]');
    const apps = $$('.lab-app', screen);
    const DEV = {
      pc:     { w: 1180, vw: 1240, ratio: 0.6,  pad: 0,  nombre: 'PC' },
      tablet: { w: 680,  vw: 820,  ratio: 1.3,  pad: 16, nombre: 'Tablet' },
      movil:  { w: 330,  vw: 390,  ratio: 1.95, pad: 12, nombre: 'Móvil' },
    };
    const APPS = {
      web:         ['Página web',              'Cambia de categoría en el menú del restaurante.'],
      tienda:      ['Tienda en línea',         'Agrega productos y abre el carrito para pagar.'],
      pos:         ['Punto de venta',          'Agrega productos, registra el cobro y calcula el cambio.'],
      citas:       ['Agenda de citas',         'Selecciona servicio, día y hora, y confirma la cita.'],
      facturacion: ['Facturación electrónica', 'Selecciona un cliente, agrega conceptos y timbra la factura.'],
      procesos:    ['Procesos digitales',      'Avanza solicitudes y compara el antes y el después.'],
    };
    let device = 'pc', app = 'web', morphTimer = null;

    const layout = () => {
      const c = DEV[device];
      const barH = device === 'movil' ? 72 : 44;
      const maxH = Math.max(420, innerHeight * 0.8);
      const byHeight = (maxH - barH) / c.ratio + c.pad * 2;
      const fw = Math.round(Math.min(stage.clientWidth, c.w, device === 'pc' ? Infinity : byHeight));
      const bw = fw - c.pad * 2;
      let bh = Math.round(bw * c.ratio);
      if (device === 'pc') bh = Math.min(bh, Math.round(maxH - barH));
      const s = bw / c.vw;
      frame.style.width = fw + 'px';
      screen.style.height = bh + 'px';
      screen.style.setProperty('--vw', c.vw);
      screen.style.setProperty('--s', s.toFixed(4));
      screen.style.setProperty('--vh', Math.round(bh / s) + 'px');
    };
    const describe = () => {
      const [nombre, hint] = APPS[app];
      caption.innerHTML = `<b>${nombre}</b> · ${DEV[device].nombre} · ${hint}`;
    };
    const morph = () => {
      if (reduce) return;
      frame.classList.add('is-morphing');
      clearTimeout(morphTimer);
      morphTimer = setTimeout(() => frame.classList.remove('is-morphing'), 520);
    };
    const showApp = id => {
      app = id;
      frame.dataset.app = id;
      apps.forEach(a => a.classList.toggle('is-on', a.dataset.show === id));
      const cur = apps.find(a => a.dataset.show === id);
      urlEl.textContent = cur.dataset.url;
      cur.scrollTo({ top: 0 });
      describe();
    };

    onSeg('lab-device', value => {
      if (value === device) return;
      device = value;
      morph();
      frame.dataset.device = device;
      apps.forEach(a => a.scrollTo({ top: 0 }));
      layout();
      describe();
    });
    onSeg('lab-app', showApp);

    $$('[data-demo]').forEach(a => a.addEventListener('click', () => seg('lab-app').segSelect(a.dataset.demo)));

    new ResizeObserver(layout).observe(stage);
    addEventListener('resize', layout);
    layout();
    showApp('web');
  }

  const scrollerOf = el => el.closest('.scaled');

  /* ------------------------------------------------------------------------
     Demo: página web (menú por categorías)
     ------------------------------------------------------------------------ */
  $$('.app-web').forEach(w => {
    const tabs = $$('.w-tabs button', w);
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('is-on', x === t));
      $$('.w-item', w).forEach(it => it.classList.toggle('is-on', it.dataset.cat === t.dataset.cat));
    }));
  });

  /* ------------------------------------------------------------------------
     Demo: tienda en línea (carrito)
     ------------------------------------------------------------------------ */
  $$('.app-tienda').forEach(t => {
    const cart = new Map();
    const count = $('[data-cart-count]', t);
    const btnCart = $('.t-cart-btn', t);
    const lines = $('[data-cart-lines]', t);
    const total = $('[data-cart-total]', t);
    const pay = $('[data-cart-pay]', t);

    const render = () => {
      let n = 0, sum = 0;
      cart.forEach(it => { n += it.qty; sum += it.qty * it.price; });
      count.textContent = n;
      total.textContent = mxn(sum);
      pay.disabled = n === 0;
      if (!n) { lines.innerHTML = '<p class="t-empty">Tu carrito está vacío.</p>'; return; }
      lines.innerHTML = [...cart.values()].map(it => `
        <div class="t-line" data-id="${it.id}">
          <span class="t-line-thumb" style="--h:${it.hue}"></span>
          <div><b>${it.name}</b><small>${mxn(it.price, 0)} c/u</small></div>
          <div class="t-qty"><button type="button" data-q="-1" aria-label="Quitar uno">−</button><span>${it.qty}</span><button type="button" data-q="1" aria-label="Agregar uno">+</button></div>
        </div>`).join('');
    };
    const open = () => { scrollerOf(t)?.scrollTo({ top: 0, behavior: 'smooth' }); t.classList.add('is-cart-open'); };
    const close = () => t.classList.remove('is-cart-open');

    $$('[data-add]', t).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.add;
      const it = cart.get(id) || { id, name: b.dataset.name, price: +b.dataset.price, hue: b.dataset.hue, qty: 0 };
      it.qty++;
      cart.set(id, it);
      render();
      replay(btnCart, 'is-bump');
      b.classList.add('is-added');
      $('i', b).textContent = 'Agregado';
      clearTimeout(b._t);
      b._t = setTimeout(() => { b.classList.remove('is-added'); $('i', b).textContent = 'Agregar'; }, 1300);
    }));
    lines.addEventListener('click', e => {
      const q = e.target.closest('[data-q]');
      if (!q) return;
      const id = q.closest('.t-line').dataset.id;
      const it = cart.get(id);
      it.qty += +q.dataset.q;
      if (it.qty <= 0) cart.delete(id);
      render();
    });
    $$('[data-cart-open]', t).forEach(b => b.addEventListener('click', open));
    $$('[data-cart-close]', t).forEach(b => b.addEventListener('click', close));
    pay.addEventListener('click', () => t.classList.add('is-paid'));
    $('[data-cart-reset]', t).addEventListener('click', () => {
      cart.clear();
      render();
      t.classList.remove('is-paid', 'is-cart-open');
    });
  });

  /* ------------------------------------------------------------------------
     Demo: punto de venta
     ------------------------------------------------------------------------ */
  $$('.app-pos').forEach(p => {
    const order = new Map();
    let folio = 483, method = 'efectivo', received = null;
    const lines = $('[data-pos-lines]', p);
    const charge = $('[data-pos-charge]', p);
    const modal = $('[data-pos-modal]', p);
    const cashBox = $('[data-pos-cash]', p);
    const changeEl = $('[data-pos-change]', p);
    const totalOf = () => [...order.values()].reduce((s, it) => s + it.qty * it.price, 0);
    const emptyHtml = lines.innerHTML;
    const clock = $('[data-pos-clock]', p);
    clock.textContent = hora();
    setInterval(() => { clock.textContent = hora(); }, 30000);

    const render = () => {
      const total = totalOf();
      $('[data-pos-sub]', p).textContent = mxn(total / 1.16);
      $('[data-pos-iva]', p).textContent = mxn(total - total / 1.16);
      $('[data-pos-total]', p).textContent = mxn(total);
      $('[data-pos-charge-amt]', p).textContent = mxn(total);
      charge.disabled = total === 0;
      lines.innerHTML = order.size ? [...order.values()].map(it => `
        <div class="p-line" data-name="${it.name}">
          <b>${it.name}</b>
          <div class="p-qty"><button type="button" data-q="-1" aria-label="Quitar uno">−</button><span>${it.qty}</span><button type="button" data-q="1" aria-label="Agregar uno">+</button></div>
          <span>${mxn(it.qty * it.price)}</span>
        </div>`).join('') : emptyHtml;
    };
    const updateChange = () => {
      const total = totalOf();
      const rec = received ?? total;
      const diff = rec - total;
      changeEl.textContent = diff >= 0 ? mxn(diff) : 'Faltan ' + mxn(-diff);
    };

    $$('[data-pos-cat]', p).forEach(b => b.addEventListener('click', () => {
      $$('[data-pos-cat]', p).forEach(x => x.classList.toggle('is-on', x === b));
      $$('.p-tile', p).forEach(t => t.classList.toggle('is-hidden', b.dataset.posCat !== 'todo' && t.dataset.cat !== b.dataset.posCat));
    }));
    $$('.p-tile', p).forEach(tile => tile.addEventListener('click', () => {
      const name = tile.dataset.name;
      const it = order.get(name) || { name, price: +tile.dataset.price, qty: 0 };
      it.qty++;
      order.set(name, it);
      render();
    }));
    lines.addEventListener('click', e => {
      const q = e.target.closest('[data-q]');
      if (!q) return;
      const it = order.get(q.closest('.p-line').dataset.name);
      it.qty += +q.dataset.q;
      if (it.qty <= 0) order.delete(it.name);
      render();
    });
    $('[data-pos-clear]', p).addEventListener('click', () => { order.clear(); render(); });

    charge.addEventListener('click', () => {
      received = null;
      $$('[data-cash]', p).forEach(b => b.classList.toggle('is-on', b.dataset.cash === 'exacto'));
      $('[data-pos-modal-total]', p).textContent = mxn(totalOf());
      updateChange();
      modal.dataset.paso = 'pago';
      scrollerOf(p)?.scrollTo({ top: 0, behavior: 'smooth' });
      modal.classList.add('is-open');
    });
    $$('[data-pos-method]', p).forEach(b => b.addEventListener('click', () => {
      method = b.dataset.posMethod;
      $$('[data-pos-method]', p).forEach(x => x.classList.toggle('is-on', x === b));
      cashBox.classList.toggle('is-hidden', method !== 'efectivo');
    }));
    $$('[data-cash]', p).forEach(b => b.addEventListener('click', () => {
      received = b.dataset.cash === 'exacto' ? null : +b.dataset.cash;
      $$('[data-cash]', p).forEach(x => x.classList.toggle('is-on', x === b));
      updateChange();
    }));
    $('[data-pos-cancel]', p).addEventListener('click', () => modal.classList.remove('is-open'));
    $('[data-pos-confirm]', p).addEventListener('click', () => {
      if (method === 'efectivo' && received !== null && received < totalOf()) { replay(changeEl, 'is-pop'); return; }
      $('[data-pos-ok-folio]', p).textContent = '#' + String(folio).padStart(4, '0');
      $('[data-pos-ok-total]', p).textContent = mxn(totalOf());
      modal.dataset.paso = 'ok';
    });
    $('[data-pos-new]', p).addEventListener('click', () => {
      modal.classList.remove('is-open');
      order.clear();
      folio++;
      $('[data-pos-folio]', p).textContent = '#' + String(folio).padStart(4, '0');
      render();
    });
  });

  /* ------------------------------------------------------------------------
     Demo: agenda de citas
     ------------------------------------------------------------------------ */
  $$('.app-citas').forEach(c => {
    const st = { svc: null, day: null, slot: null };
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const confirm = $('[data-c-confirm]', c);
    const pick = (sel, btn) => $$(sel, c).forEach(b => b.classList.toggle('is-on', b === btn));
    const update = () => {
      $('[data-c-svc]', c).textContent = st.svc ? st.svc.name : '—';
      $('[data-c-date]', c).textContent = st.day ? `${dias[(st.day - 1) % 7]} ${st.day} nov${st.slot ? ' · ' + st.slot : ''}` : '—';
      $('[data-c-total]', c).textContent = st.svc ? mxn(st.svc.price, 0) : '—';
      const n = [st.svc, st.day, st.slot].filter(Boolean).length;
      $$('.c-steps i', c).forEach((i, k) => i.classList.toggle('is-on', k < Math.max(1, n)));
      confirm.disabled = n < 3;
    };
    $$('.c-svc', c).forEach(b => b.addEventListener('click', () => { st.svc = { name: b.dataset.name, price: +b.dataset.price }; pick('.c-svc', b); update(); }));
    $$('.c-day', c).forEach(b => b.addEventListener('click', () => { st.day = +b.dataset.day; pick('.c-day', b); update(); }));
    $$('.c-slot', c).forEach(b => b.addEventListener('click', () => { st.slot = b.dataset.slot; pick('.c-slot', b); update(); }));
    confirm.addEventListener('click', () => {
      $('[data-c-done-text]', c).textContent = `${st.svc.name} · ${dias[(st.day - 1) % 7]} ${st.day} de noviembre a las ${st.slot}.`;
      scrollerOf(c)?.scrollTo({ top: 0, behavior: 'smooth' });
      c.classList.add('is-done');
    });
    $('[data-c-reset]', c).addEventListener('click', () => {
      st.svc = st.day = st.slot = null;
      $$('.is-on', $('.c-body', c)).forEach(b => b.classList.remove('is-on'));
      c.classList.remove('is-done');
      update();
    });
    update();
  });

  /* ------------------------------------------------------------------------
     Demo: facturación electrónica
     ------------------------------------------------------------------------ */
  $$('.app-fact').forEach(f => {
    const paper = $('[data-f-paper]', f);
    const stampBtn = $('[data-f-stamp]', f);
    const addBtn = $('[data-f-add]', f);
    const status = $('[data-f-status]', f);
    const conceptos = [['Desarrollo de página web', 12000], ['Hosting y dominio anual', 2400]];
    const extras = [['Soporte mensual', 1500], ['Correo corporativo (5 cuentas)', 900]];
    const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const b64 = n => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n))));

    const backToDraft = () => {
      if (paper.dataset.estado === 'borrador') return;
      paper.dataset.estado = 'borrador';
      status.textContent = 'Borrador';
      $('[data-f-uuid]', f).textContent = '—';
      $('[data-f-sello]', f).textContent = '—';
      stampBtn.disabled = false;
      addBtn.disabled = extras.length === 0;
    };
    const renderTotals = () => {
      const sub = conceptos.reduce((s, [, m]) => s + m, 0);
      $('[data-f-sub]', f).textContent = mxn(sub);
      $('[data-f-iva]', f).textContent = mxn(sub * 0.16);
      $('[data-f-total]', f).textContent = mxn(sub * 1.16);
    };
    const drawQR = () => {
      const svg = $('[data-f-qr]', f);
      const bits = crypto.getRandomValues(new Uint8Array(441));
      const finder = (x, y) => (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const inFinder = (x, y) => {
        const ox = x > 13 ? 14 : 0, oy = y > 13 ? 14 : 0;
        const dx = x - ox, dy = y - oy;
        return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      };
      let rects = '';
      for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
        const on = finder(x, y) ? inFinder(x, y) : bits[y * 21 + x] > 128;
        if (on) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
      svg.innerHTML = rects;
    };
    drawQR();

    $$('.f-client', f).forEach(b => b.addEventListener('click', () => {
      $$('.f-client', f).forEach(x => x.classList.toggle('is-on', x === b));
      $('[data-f-r-name]', f).textContent = b.dataset.name;
      $('[data-f-r-rfc]', f).textContent = b.dataset.rfc;
      backToDraft();
    }));
    $('[data-f-uso]', f).addEventListener('change', e => { $('[data-f-r-uso]', f).textContent = e.target.selectedOptions[0].text; backToDraft(); });
    $('[data-f-forma]', f).addEventListener('change', e => { $('[data-f-r-forma]', f).textContent = e.target.selectedOptions[0].text; backToDraft(); });

    addBtn.addEventListener('click', () => {
      const next = extras.shift();
      if (!next) return;
      conceptos.push(next);
      const [nombre, monto] = next;
      $('[data-f-concepts]', f).insertAdjacentHTML('beforeend', `<div class="f-concept"><span>${nombre}</span><span>1</span><b>${mxn(monto)}</b></div>`);
      $('[data-f-lines]', f).insertAdjacentHTML('beforeend', `<div><span>${nombre}</span><b>${mxn(monto)}</b></div>`);
      renderTotals();
      backToDraft();
      addBtn.disabled = extras.length === 0;
    });

    stampBtn.addEventListener('click', () => {
      stampBtn.disabled = true;
      addBtn.disabled = true;
      paper.dataset.estado = 'proceso';
      status.textContent = 'Validando datos…';
      setTimeout(() => { status.textContent = 'Enviando al PAC…'; }, 700);
      setTimeout(() => {
        const u = hex(16);
        $('[data-f-uuid]', f).textContent = `${u.slice(0, 8)}-${u.slice(8, 12)}-4${u.slice(13, 16)}-${u.slice(16, 20)}-${u.slice(20, 32)}`;
        $('[data-f-sello]', f).textContent = b64(90);
        drawQR();
        paper.dataset.estado = 'timbrada';
        status.textContent = 'Timbrada · ' + hora();
      }, 1600);
    });
    renderTotals();
  });

  /* ------------------------------------------------------------------------
     Demo: digitalización de procesos
     ------------------------------------------------------------------------ */
  $$('.app-proc').forEach(k => {
    const orden = ['solicitud', 'revision', 'aprobada', 'pagada'];
    const accion = { revision: ['Ana', 'envió a revisión'], aprobada: ['Marco', 'aprobó'], pagada: ['Sofía', 'registró el pago de'] };
    const log = $('[data-k-log]', k);
    const counts = () => $$('.k-col', k).forEach(col => { $('[data-count]', col).textContent = $$('.k-card', col).length; });

    $$('[data-modo-btn]', k).forEach(b => b.addEventListener('click', () => {
      k.dataset.modo = b.dataset.modoBtn;
      $$('[data-modo-btn]', k).forEach(x => x.classList.toggle('is-on', x === b));
    }));
    k.addEventListener('click', e => {
      const btn = e.target.closest('.k-next');
      if (!btn) return;
      const card = btn.closest('.k-card');
      const from = card.closest('.k-col').dataset.col;
      const to = orden[orden.indexOf(from) + 1];
      if (!to) return;
      $(`.k-col[data-col="${to}"] .k-cards`, k).prepend(card);
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = '';
      counts();
      const [quien, que] = accion[to];
      log.insertAdjacentHTML('afterbegin', `<li class="is-new"><span>${hora()}</span>${quien} ${que} la solicitud ${$('small', card).textContent}</li>`);
      $$('li', log).slice(6).forEach(li => li.remove());
      $$('li', log).slice(1).forEach(li => li.classList.remove('is-new'));
    });
    counts();
  });

  /* ------------------------------------------------------------------------
     Cotizador
     ------------------------------------------------------------------------ */
  const quote = $('#cotizar');
  if (quote) {
    const st = { servicios: new Map(), giro: null, presupuesto: null, monto: null, tiempo: 'Este mes' };
    const pesos = n => '$' + Math.round(n).toLocaleString('es-MX');
    const presupuestoTxt = () => st.presupuesto
      ? (st.monto ? `≈ ${pesos(st.monto)} (${st.presupuesto.label})` : st.presupuesto.label)
      : null;
    const wa = $('[data-q-wa]', quote);
    const sum = k => $(`[data-sum="${k}"]`, quote);
    const setSum = (k, txt) => { const el = sum(k); if (el.textContent !== txt) { el.textContent = txt; replay(el, 'is-pop'); } };

    const mensaje = () => [
      'Hola JP, me gustaría solicitar una cotización.',
      '',
      '• Servicios: ' + ([...st.servicios.values()].join(', ') || 'Por definir'),
      '• Giro: ' + (st.giro?.label || 'Por definir'),
      '• Presupuesto: ' + (presupuestoTxt() || 'Por definir'),
      '• Plazo: ' + st.tiempo,
    ].join('\n');

    const update = () => {
      setSum('servicios', [...st.servicios.values()].join(', ') || 'Elige al menos uno');
      setSum('giro', st.giro?.label || '—');
      setSum('presupuesto', presupuestoTxt() || '—');
      setSum('tiempo', st.tiempo);
      const ok = st.servicios.size > 0;
      wa.classList.toggle('is-disabled', !ok);
      wa.setAttribute('aria-disabled', String(!ok));
      wa.href = 'https://wa.me/' + (CFG.whatsapp || '') + '?text=' + encodeURIComponent(mensaje());
    };

    // Presupuesto: slider y rangos sincronizados.
    const range = $('[data-budget-range]', quote);
    const rangeOut = $('[data-budget-out]', quote);
    const rangeBtns = $$('[data-q="presupuesto"] .q-range', quote);
    const tope = +range.dataset.max;
    const pintarSlider = () => range.style.setProperty('--fill', ((range.value - range.min) / (range.max - range.min) * 100) + '%');
    // Los botones llegan hasta un tope menor que el slider: arriba del último rango
    // se marca "Más de …" pero se conserva el monto exacto, hasta pasar el máximo del slider.
    const desdeSlider = (exacto = true) => {
      const v = +range.value;
      const btn = rangeBtns.find(b => b.dataset.hasta && v <= +b.dataset.hasta) || rangeBtns[rangeBtns.length - 1];
      rangeBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      st.presupuesto = { value: btn.dataset.value, label: v > tope ? 'Más de ' + pesos(tope) : btn.dataset.label };
      st.monto = exacto && v <= tope ? v : null;
      st.montoMax = v > tope;
      rangeOut.textContent = st.monto ? pesos(v) : st.presupuesto.label;
      pintarSlider();
      update();
    };
    range.addEventListener('input', () => desdeSlider());
    rangeBtns.forEach(b => b.addEventListener('click', () => {
      if (b.dataset.hasta) {
        range.value = Math.round((+b.dataset.desde + +b.dataset.hasta) / 2 / 500) * 500;
        desdeSlider();
      } else {
        // "Más de …" de los botones: coloca el slider justo arriba de ese tope, sin monto exacto.
        range.value = +b.dataset.desde + 500;
        desdeSlider(false);
      }
    }));
    pintarSlider();

    $$('[data-q]:not([data-q="presupuesto"])', quote).forEach(group => {
      const multi = group.hasAttribute('data-multi');
      const key = group.dataset.q;
      group.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (multi) {
          const on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', String(on));
          on ? st.servicios.set(b.dataset.value, b.dataset.label) : st.servicios.delete(b.dataset.value);
        } else {
          $$('button', group).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          st[key] = { value: b.dataset.value, label: b.dataset.label };
        }
        update();
      });
    });
    onSeg('q-tiempo', v => { st.tiempo = v; update(); });

    // "Cotizar" desde una tarjeta de servicio: preselecciona ese servicio.
    $$('[data-pick]').forEach(a => a.addEventListener('click', () => {
      const chip = $(`[data-q="servicios"] [data-value="${a.dataset.pick}"]`, quote);
      if (chip && chip.getAttribute('aria-pressed') !== 'true') chip.click();
    }));

    $('[data-q-form]', quote).addEventListener('click', () => {
      const form = $('#form-contacto');
      const first = [...st.servicios.keys()][0];
      if (first) form.servicio.value = first;
      if (st.presupuesto) form.presupuesto.value = st.presupuesto.value;
      form.monto.value = st.montoMax ? tope + 1 : (st.monto || '');
      form.mensaje.value = mensaje().split('\n').slice(2).join('\n');
      $('#contacto').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(() => form.nombre.focus({ preventScroll: true }), 900);
    });
    // Si cambian el rango a mano en el formulario, el monto exacto del slider ya no aplica.
    $('#form-contacto')?.presupuesto.addEventListener('change', e => { e.target.form.monto.value = ''; });
    update();
  }

  /* ------------------------------------------------------------------------
     FAQ: una respuesta abierta a la vez
     ------------------------------------------------------------------------ */
  const faqs = $$('.faq-item');
  faqs.forEach(d => d.addEventListener('toggle', () => { if (d.open) faqs.forEach(o => { if (o !== d) o.open = false; }); }));

  /* ------------------------------------------------------------------------
     Cursor, tarjetas con brillo y botones magnéticos
     ------------------------------------------------------------------------ */
  if (finePointer && !reduce) {
    const cursor = $('.cursor');
    const label = $('.cursor-ring em', cursor);
    let x = -100, y = -100, rx = -100, ry = -100, running = false;
    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      cursor.style.setProperty('--rx', rx.toFixed(1) + 'px');
      cursor.style.setProperty('--ry', ry.toFixed(1) + 'px');
      if (Math.abs(x - rx) > 0.2 || Math.abs(y - ry) > 0.2) requestAnimationFrame(loop);
      else running = false;
    };
    addEventListener('pointermove', e => {
      x = e.clientX; y = e.clientY;
      cursor.style.setProperty('--x', x + 'px');
      cursor.style.setProperty('--y', y + 'px');
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener('pointerover', e => {
      const withLabel = e.target.closest('[data-cursor]');
      cursor.classList.toggle('has-label', !!withLabel);
      if (withLabel) label.textContent = withLabel.dataset.cursor;
      cursor.classList.toggle('is-hover', !withLabel && !!e.target.closest('a, button, input, select, textarea, label'));
    });
    document.addEventListener('pointerleave', () => cursor.classList.remove('has-label', 'is-hover'));

    $$('.spot').forEach(el => el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
    $$('.magnetic').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ------------------------------------------------------------------------
     Formulario de contacto
     ------------------------------------------------------------------------ */
  const form = $('#form-contacto');
  if (form) {
    const msg = $('.form-msg', form);
    const btn = $('button[type="submit"]', form);
    const btnLabel = $('.btn-label', btn);
    const setMsg = (text, ok) => { msg.textContent = text; msg.className = 'form-msg ' + (ok ? 'is-ok' : 'is-err'); };
    const markErrors = errs => Object.keys(errs).forEach(n => form.elements[n]?.closest('.field')?.classList.add('is-error'));
    form.addEventListener('input', e => e.target.closest('.field')?.classList.remove('is-error'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      $$('.field.is-error', form).forEach(el => el.classList.remove('is-error'));
      const errs = {};
      if (form.nombre.value.trim().length < 2) errs.nombre = 1;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.value.trim())) errs.correo = 1;
      if (Object.keys(errs).length) { markErrors(errs); setMsg('Revisa tu nombre y correo.', false); return; }

      // Versión estática (sin servidor): el mensaje se arma y se abre en WhatsApp.
      if (CFG.estatico) {
        const opt = sel => sel.value ? sel.selectedOptions[0].text : '';
        const monto = +form.monto.value;
        const tope = +($('[data-budget-range]')?.dataset.max || Infinity);
        const presupuesto = monto > tope ? 'Más de $' + tope.toLocaleString('es-MX')
          : monto > 0 ? `${opt(form.presupuesto)} (aprox. $${monto.toLocaleString('es-MX')})`
          : opt(form.presupuesto);
        const lineas = [
          'Hola JP, me gustaría solicitar una cotización.',
          '',
          '• Nombre: ' + form.nombre.value.trim(),
          form.negocio.value.trim() && '• Negocio: ' + form.negocio.value.trim(),
          '• Correo: ' + form.correo.value.trim(),
          form.telefono.value.trim() && '• WhatsApp: ' + form.telefono.value.trim(),
          opt(form.servicio) && '• Servicio: ' + opt(form.servicio),
          presupuesto && '• Presupuesto: ' + presupuesto,
          form.mensaje.value.trim() && '\n' + form.mensaje.value.trim(),
        ].filter(Boolean);
        window.open('https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(lineas.join('\n')), '_blank', 'noopener');
        setMsg('Se abrió WhatsApp con tu mensaje listo para enviar.', true);
        return;
      }

      btn.disabled = true;
      btnLabel.textContent = 'Enviando…';
      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        const data = await res.json();
        setMsg(data.mensaje, data.ok);
        if (data.ok) form.reset();
        else if (data.errores) markErrors(data.errores);
      } catch (_) {
        setMsg('No pude enviar tu mensaje. Escríbeme por WhatsApp, por favor.', false);
      } finally {
        btn.disabled = false;
        btnLabel.textContent = 'Enviar mensaje';
      }
    });
  }
})();
