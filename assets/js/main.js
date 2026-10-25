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

  /* Desplazamiento suave con inercia (solo con mouse; en celular se usa el scroll nativo). */
  let lenis = null;
  if (window.Lenis && finePointer && !reduce) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  /** Desplaza la página hasta un elemento (o una posición) de forma suave. */
  const irA = (destino, offset = 0) => {
    if (lenis) { lenis.scrollTo(destino, { offset, duration: 1.1 }); return; }
    const top = typeof destino === 'number' ? destino : destino.getBoundingClientRect().top + scrollY + offset;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  };
  if (lenis) {
    // Los enlaces internos (#seccion) también usan el desplazamiento suave.
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      const id = a?.getAttribute('href');
      if (!id || id.length < 2) return;
      const destino = id === '#laboratorio' ? ($('[data-lab-dock]') || $(id)) : $(id);
      if (!destino) return;
      e.preventDefault();
      irA(destino);
    });
  }

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
    if (ahora - ultimoBarrido < 250 || !pendientes.length) return;
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
  // Solo cambian la capa de fondo y los elementos fijos (barra y cursor); cada sección ya tiene sus colores.
  const metaTheme = $('meta[name="theme-color"]');
  const pageBg = $('.page-bg');
  const fijos = [$('#nav'), $('.cursor')].filter(Boolean);
  let temaActual = 'light';
  onVisible($$('section[data-theme], footer[data-theme]'), (sec, visible) => {
    if (!visible) return;
    const t = sec.dataset.theme;
    if (t === temaActual) return;
    temaActual = t;
    pageBg?.classList.toggle('is-dark', t === 'dark');
    fijos.forEach(el => { el.dataset.theme = t; });
    metaTheme?.setAttribute('content', t === 'dark' ? '#0d0d0f' : '#eeebe5');
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
    hsCur += (hsTarget - hsCur) * (lenis ? 0.28 : 0.12);
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

  // Collage del hero: se mueve con el mouse (solo mientras está en el hero).
  const ccs = $$('.cc').map(c => ({ el: c, d: +c.dataset.depth || 0.5 }));
  let mouseX = 0, mouseY = 0, collageQueued = false;
  const moveCollage = () => {
    collageQueued = false;
    ccs.forEach(({ el, d }) => {
      el.style.setProperty('--tx', (mouseX * d * 26).toFixed(1) + 'px');
      el.style.setProperty('--ty', (mouseY * d * 18).toFixed(1) + 'px');
    });
  };
  if (finePointer && !reduce) {
    $('.hero')?.addEventListener('pointermove', e => {
      mouseX = (e.clientX / innerWidth - 0.5) * 2;
      mouseY = (e.clientY / innerHeight - 0.5) * 2;
      if (!collageQueued) { collageQueued = true; requestAnimationFrame(moveCollage); }
    }, { passive: true });
  }

  const footerBig = $('[data-footer-big]');

  // Posiciones medidas una sola vez (y al cambiar el tamaño), no en cada cuadro del scroll:
  // así el navegador no recalcula el diseño mientras se desplaza la página.
  const labDock = $('[data-lab-dock]');
  const geo = { max: 1, vh: innerHeight, scrubTop: 0, scrubH: 1, hsTop: 0, stepsTop: 0, stepsH: 1, stepTops: [], footTop: 0, footH: 1, dockTop: 0, dockH: 0 };
  const absTop = el => el.getBoundingClientRect().top + scrollY;
  const measure = () => {
    geo.vh = innerHeight;
    geo.max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    if (scrub) { geo.scrubTop = absTop(scrub); geo.scrubH = scrub.offsetHeight; }
    if (hs) geo.hsTop = absTop(hs);
    if (steps) { geo.stepsTop = absTop(steps); geo.stepsH = steps.offsetHeight || 1; geo.stepTops = stepItems.map(absTop); }
    if (footerBig) { geo.footTop = absTop(footerBig); geo.footH = footerBig.offsetHeight || 1; }
    if (labDock) { geo.dockTop = absTop(labDock); geo.dockH = labDock.offsetHeight || 1; }
  };

  // Barra superior: visible al inicio; después del primer scroll se oculta y en computadora
  // solo aparece al acercar el mouse a la parte de arriba (en celular, al subir un poco).
  let navNear = false, lastY = scrollY;
  const updateNav = y => {
    nav.classList.toggle('is-scrolled', y > 20);
    if (nav.classList.contains('is-open')) { nav.classList.remove('is-hidden'); return; }
    let hide;
    if (finePointer) hide = y > 40 && !navNear && !nav.matches(':focus-within');
    else hide = y > 300 ? (y > lastY + 2 ? true : y < lastY - 2 ? false : nav.classList.contains('is-hidden')) : false;
    // Mientras el laboratorio ocupa la parte de arriba, la barra no se muestra para no tapar sus botones.
    if (labDock && y > geo.dockTop - 100 && y < geo.dockTop + geo.dockH - 120) hide = true;
    nav.classList.toggle('is-hidden', hide);
  };
  if (finePointer) {
    addEventListener('pointermove', e => {
      // Aparece solo al tocar el borde superior; se queda mientras el mouse esté sobre la barra.
      const near = e.clientY < (navNear ? 96 : 12);
      if (near !== navNear) { navNear = near; updateNav(scrollY); }
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { navNear = false; updateNav(scrollY); });
    nav.addEventListener('focusin', () => updateNav(scrollY));
  }

  const last = { sp: -1, words: -1, lp: -1, lit: -1, fy: -1, hp: -1, idx: '' };
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY, vh = geo.vh;

    const sp = Math.round(y / geo.max * 1000) / 1000;
    if (sp !== last.sp) { last.sp = sp; progress.style.setProperty('--sp', sp); }

    updateNav(y);
    lastY = y;

    // Texto de presentación: se ilumina palabra por palabra.
    if (words.length) {
      const top = geo.scrubTop - y;
      if (top < vh && top + geo.scrubH > 0 || last.words === -1) {
        const p = clamp((vh * 0.85 - top) / (geo.scrubH + vh * 0.35), 0, 1);
        const n = Math.round(p * words.length);
        if (n !== last.words) {
          const from = Math.min(n, Math.max(0, last.words)), to = Math.max(n, last.words);
          for (let i = from; i < to; i++) words[i].classList.toggle('on', i < n);
          last.words = n;
        }
      }
    }

    // Servicios: carrusel horizontal
    if (hs && mqWide.matches && !reduce && hsDist) {
      const p = clamp((y - geo.hsTop) / hsDist, 0, 1);
      const target = -p * hsDist;
      if (target !== hsTarget) {
        hsTarget = target;
        if (!hsRunning) { hsRunning = true; requestAnimationFrame(hsAnimate); }
      }
      const hp = Math.round(p * 1000) / 1000;
      if (hp !== last.hp) { last.hp = hp; hsBar?.style.setProperty('--hp', hp); }
      const cards = track.children.length;
      const idx = String(Math.min(cards - 1, Math.round(p * (cards - 1)) + 1)).padStart(2, '0');
      if (idx !== last.idx && hsIndex) { last.idx = idx; hsIndex.textContent = idx; }
    }

    // Proceso: línea y pasos encendidos
    if (steps) {
      const top = geo.stepsTop - y;
      if (top < vh * 1.2 && top + geo.stepsH > -vh * 0.2) {
        const lp = Math.round(clamp((vh * 0.6 - top) / geo.stepsH, 0, 1) * 500) / 500;
        if (lp !== last.lp) { last.lp = lp; steps.style.setProperty('--lp', lp); }
        const lit = geo.stepTops.filter(t => t - y < vh * 0.6).length;
        if (lit !== last.lit) { last.lit = lit; stepItems.forEach((s, i) => s.classList.toggle('is-lit', i < lit)); }
      }
    }

    // Letras grandes del pie de página
    if (footerBig) {
      const top = geo.footTop - y;
      if (top < vh) {
        const fy = Math.round((1 - clamp((vh - top) / geo.footH, 0, 1)) * 60);
        if (fy !== last.fy) { last.fy = fy; footerBig.style.setProperty('--fy', fy + '%'); }
      }
    }
  }
  const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  addEventListener('scroll', requestTick, { passive: true });
  let resizeT = null;
  const remeasure = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { hsLayout(); measure(); requestTick(); }, 120); };
  addEventListener('resize', remeasure);
  addEventListener('load', remeasure);
  document.fonts?.ready.then(remeasure);
  new ResizeObserver(remeasure).observe(document.body);
  measure();
  onScroll();

  // Pausa las animaciones continuas de las secciones que no están en pantalla.
  onVisible($$('section, footer'), (sec, visible) => sec.classList.toggle('is-offscreen', !visible), { rootMargin: '200px 0px' }, false);

  /* ------------------------------------------------------------------------
     Laboratorio: elegir demo y dispositivo
     ------------------------------------------------------------------------ */
  const frame = $('#lab-frame');
  if (frame) {
    const dock = $('[data-lab-dock]');
    const stage = $('.lab-stage');
    const controls = $('.lab-controls');
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
      web:         ['Página web',              'Cambia de categoría en el menú y reserva una mesa.'],
      tienda:      ['Tienda en línea',         'Filtra productos, agrégalos al carrito y paga.'],
      pos:         ['Punto de venta',          'Agrega productos, aplica un descuento y registra el cobro.'],
      citas:       ['Agenda de citas',         'Elige servicio, barbero, día y hora, y confirma la cita.'],
      facturacion: ['Facturación electrónica', 'Selecciona un cliente, agrega conceptos y timbra la factura.'],
      procesos:    ['Procesos digitales',      'Avanza solicitudes y compara el antes y el después.'],
    };
    let device = 'pc', app = 'web', morphTimer = null;

    // La pantalla usa la altura que queda libre en la ventana después de los controles y la leyenda,
    // para que el bloque completo quepa sin cortarse.
    const layout = () => {
      const c = DEV[device];
      const barH = device === 'movil' ? 72 : 44;
      const free = innerHeight - controls.offsetHeight - caption.offsetHeight - 14 - 12 - 28 - c.pad * 2;
      const maxH = Math.max(360, free);
      const byHeight = (maxH - barH) / c.ratio + c.pad * 2;
      const fw = Math.round(Math.min(stage.clientWidth, c.w, device === 'pc' ? Infinity : byHeight));
      const bw = fw - c.pad * 2;
      let bh = Math.round(bw * c.ratio);
      bh = Math.min(bh, Math.round(maxH - barH));
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

    // "Seguro" del laboratorio: si giras la rueda sobre la demo antes de que el bloque esté
    // alineado con la ventana, primero se alinea la página y después se desplaza la demo.
    let aligning = false;
    screen.addEventListener('wheel', e => {
      const top = dock.getBoundingClientRect().top;
      if (Math.abs(top) <= 6) return;
      e.preventDefault();
      if (aligning) return;
      aligning = true;
      irA(dock);
      setTimeout(() => { aligning = false; }, 450);
    }, { passive: false });

    // Con el scroll suave el "imán" de CSS no aplica: al detenerse cerca del laboratorio, la página se alinea con él.
    if (lenis) {
      let quieto = null;
      lenis.on('scroll', () => {
        clearTimeout(quieto);
        quieto = setTimeout(() => {
          const top = dock.getBoundingClientRect().top;
          if (Math.abs(top) > 4 && Math.abs(top) < innerHeight * 0.22) irA(dock);
        }, 160);
      });
    }

    new ResizeObserver(layout).observe(stage);
    addEventListener('resize', layout);
    document.fonts?.ready.then(layout);
    layout();
    showApp('web');
  }

  const scrollerOf = el => el.closest('.scaled');
  const escalaDe = el => { const s = scrollerOf(el); return s ? s.getBoundingClientRect().width / s.offsetWidth : 1; };

  /* ------------------------------------------------------------------------
     Demo: página web (menú por categorías y reservación)
     ------------------------------------------------------------------------ */
  $$('.app-web').forEach(w => {
    const tabs = $$('.w-tabs button', w);
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('is-on', x === t));
      $$('.w-item', w).forEach(it => it.classList.toggle('is-on', it.dataset.cat === t.dataset.cat));
    }));

    const book = $('[data-w-book]', w);
    const personas = $('[data-w-personas]', w);
    let n = 2;
    $$('[data-w-group]', w).forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) $$('button', g).forEach(x => x.classList.toggle('is-on', x === b));
    }));
    $$('[data-w-step]', w).forEach(b => b.addEventListener('click', () => {
      n = clamp(n + +b.dataset.wStep, 1, 12);
      personas.textContent = n;
    }));
    $('[data-w-reservar]', w).addEventListener('click', () => {
      const dia = $('[data-w-group="dia"] .is-on', w).textContent;
      const hora = $('[data-w-group="hora"] .is-on', w).textContent;
      $('[data-w-resumen]', w).textContent = `${dia} · ${hora} · ${n} ${n === 1 ? 'persona' : 'personas'}. Te enviamos la confirmación por WhatsApp.`;
      book.classList.add('is-done');
    });
    $('[data-w-otra]', w).addEventListener('click', () => book.classList.remove('is-done'));
  });

  /* ------------------------------------------------------------------------
     Demo: tienda en línea (filtros, carrito y envío gratis)
     ------------------------------------------------------------------------ */
  $$('.app-tienda').forEach(t => {
    const cart = new Map();
    const ENVIO_GRATIS = 599, ENVIO = 99;
    const count = $('[data-cart-count]', t);
    const btnCart = $('.t-cart-btn', t);
    const lines = $('[data-cart-lines]', t);
    const pay = $('[data-cart-pay]', t);
    const ship = $('.t-ship', t);
    let pedido = 10482;

    $$('[data-t-filters] button', t).forEach(b => b.addEventListener('click', () => {
      $$('[data-t-filters] button', t).forEach(x => x.classList.toggle('is-on', x === b));
      $$('.t-card', t).forEach(c => c.classList.toggle('is-hidden', b.dataset.f !== 'todo' && c.dataset.cat !== b.dataset.f));
    }));

    const render = () => {
      let n = 0, sub = 0;
      cart.forEach(it => { n += it.qty; sub += it.qty * it.price; });
      const envio = n === 0 ? 0 : sub >= ENVIO_GRATIS ? 0 : ENVIO;
      count.textContent = n;
      $('[data-cart-sub]', t).textContent = mxn(sub);
      $('[data-cart-envio]', t).textContent = n === 0 ? '—' : envio ? mxn(envio) : 'Gratis';
      $('[data-cart-total]', t).textContent = mxn(sub + envio);
      pay.disabled = n === 0;
      const falta = Math.max(0, ENVIO_GRATIS - sub);
      ship.classList.toggle('is-free', n > 0 && falta === 0);
      $('[data-ship-txt]', t).textContent = falta === 0 && n > 0 ? '¡Tu pedido tiene envío gratis!' : `Agrega ${mxn(falta, 0)} para obtener envío gratis`;
      $('[data-ship-bar]', t).style.setProperty('--p', Math.min(100, sub / ENVIO_GRATIS * 100) + '%');
      if (!n) { lines.innerHTML = '<p class="t-empty">Tu carrito está vacío.</p>'; return; }
      lines.innerHTML = [...cart.values()].map(it => `
        <div class="t-line" data-id="${it.id}">
          <span class="t-line-thumb" style="--bag:${it.color}"></span>
          <div><b>${it.name}</b><small>${mxn(it.price, 0)} c/u</small></div>
          <div class="t-qty"><button type="button" data-q="-1" aria-label="Quitar uno">−</button><span>${it.qty}</span><button type="button" data-q="1" aria-label="Agregar uno">+</button></div>
        </div>`).join('');
    };

    // Punto que "vuela" del botón al carrito.
    const fly = from => {
      if (reduce || !from.animate) return;
      const base = t.getBoundingClientRect(), s = escalaDe(t) || 1;
      const a = from.getBoundingClientRect(), b = btnCart.getBoundingClientRect();
      const x1 = (a.left + a.width / 2 - base.left) / s, y1 = (a.top + a.height / 2 - base.top) / s;
      const x2 = (b.left + b.width / 2 - base.left) / s, y2 = (b.top + b.height / 2 - base.top) / s;
      const dot = document.createElement('span');
      dot.className = 't-fly';
      dot.style.left = x1 + 'px';
      dot.style.top = y1 + 'px';
      t.appendChild(dot);
      dot.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${(x2 - x1) * 0.5}px, ${(y2 - y1) * 0.5 - 60}px) scale(1.2)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${x2 - x1}px, ${y2 - y1}px) scale(.4)`, opacity: 0.2 },
      ], { duration: 700, easing: 'cubic-bezier(.5, 0, .3, 1)' }).onfinish = () => { dot.remove(); replay(btnCart, 'is-bump'); };
    };

    $$('[data-add]', t).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.add;
      const it = cart.get(id) || { id, name: b.dataset.name, price: +b.dataset.price, color: b.dataset.color, qty: 0 };
      it.qty++;
      cart.set(id, it);
      render();
      fly(b);
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
    $$('[data-cart-open]', t).forEach(b => b.addEventListener('click', () => { scrollerOf(t)?.scrollTo({ top: 0, behavior: 'smooth' }); t.classList.add('is-cart-open'); }));
    $$('[data-cart-close]', t).forEach(b => b.addEventListener('click', () => t.classList.remove('is-cart-open')));
    pay.addEventListener('click', () => {
      $('[data-cart-order]', t).textContent = '#TS-' + pedido++;
      t.classList.add('is-paid');
    });
    $('[data-cart-reset]', t).addEventListener('click', () => {
      cart.clear();
      render();
      t.classList.remove('is-paid', 'is-cart-open');
    });
    render();
  });

  /* ------------------------------------------------------------------------
     Demo: punto de venta
     ------------------------------------------------------------------------ */
  $$('.app-pos').forEach(p => {
    const order = new Map();
    let folio = 483, method = 'efectivo', received = null, descuento = false;
    const kpi = { ventas: 3480, tickets: 42, caja: 1950 };
    const lines = $('[data-pos-lines]', p);
    const charge = $('[data-pos-charge]', p);
    const modal = $('[data-pos-modal]', p);
    const cashBox = $('[data-pos-cash]', p);
    const cardWait = $('[data-pos-card]', p);
    const changeEl = $('[data-pos-change]', p);
    const discountBtn = $('[data-pos-discount]', p);
    const emptyHtml = lines.innerHTML;
    const clock = $('[data-pos-clock]', p);
    clock.textContent = hora();
    setInterval(() => { clock.textContent = hora(); }, 30000);

    const bruto = () => [...order.values()].reduce((s, it) => s + it.qty * it.price, 0);
    const totalOf = () => bruto() * (descuento ? 0.9 : 1);

    const render = () => {
      const b = bruto(), total = totalOf();
      $('[data-pos-sub]', p).textContent = mxn(b);
      $('[data-pos-desc]', p).textContent = '−' + mxn(b - total);
      $('.p-sum-desc', p).style.display = descuento ? '' : 'none';
      $('[data-pos-iva]', p).textContent = mxn(total - total / 1.16);
      $('[data-pos-total]', p).textContent = mxn(total);
      $('[data-pos-charge-amt]', p).textContent = mxn(total);
      charge.disabled = total === 0;
      $$('.p-tile', p).forEach(tile => {
        const q = order.get(tile.dataset.name)?.qty || 0;
        const badge = $('[data-qty]', tile);
        badge.textContent = q;
        badge.classList.toggle('is-on', q > 0);
      });
      lines.innerHTML = order.size ? [...order.values()].map(it => `
        <div class="p-line" data-name="${it.name}">
          <b>${it.name}</b>
          <div class="p-qty"><button type="button" data-q="-1" aria-label="Quitar uno">−</button><span>${it.qty}</span><button type="button" data-q="1" aria-label="Agregar uno">+</button></div>
          <span>${mxn(it.qty * it.price)}</span>
        </div>`).join('') : emptyHtml;
    };
    const updateChange = () => {
      const total = totalOf();
      const diff = (received ?? total) - total;
      changeEl.textContent = diff >= 0 ? mxn(diff) : 'Faltan ' + mxn(-diff);
    };
    const filtrar = () => {
      const cat = $('[data-pos-cat].is-on', p).dataset.posCat;
      const q = $('[data-pos-search]', p).value.trim().toLowerCase();
      $$('.p-tile', p).forEach(t => t.classList.toggle('is-hidden', (cat !== 'todo' && t.dataset.cat !== cat) || (q && !t.dataset.name.toLowerCase().includes(q))));
    };

    $$('[data-pos-cat]', p).forEach(b => b.addEventListener('click', () => {
      $$('[data-pos-cat]', p).forEach(x => x.classList.toggle('is-on', x === b));
      filtrar();
    }));
    $('[data-pos-search]', p).addEventListener('input', filtrar);
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
    discountBtn.addEventListener('click', () => {
      descuento = !descuento;
      discountBtn.classList.toggle('is-on', descuento);
      discountBtn.lastChild.textContent = descuento ? 'Descuento 10% aplicado' : 'Aplicar descuento 10%';
      render();
    });
    $('[data-pos-clear]', p).addEventListener('click', () => { order.clear(); render(); });

    const setMethod = m => {
      method = m;
      $$('[data-pos-method]', p).forEach(x => x.classList.toggle('is-on', x.dataset.posMethod === m));
      cashBox.classList.toggle('is-hidden', m !== 'efectivo');
      cardWait.classList.toggle('is-on', m === 'tarjeta');
    };
    charge.addEventListener('click', () => {
      received = null;
      setMethod('efectivo');
      $$('[data-cash]', p).forEach(b => b.classList.toggle('is-on', b.dataset.cash === 'exacto'));
      $('[data-pos-modal-total]', p).textContent = mxn(totalOf());
      updateChange();
      modal.dataset.paso = 'pago';
      scrollerOf(p)?.scrollTo({ top: 0, behavior: 'smooth' });
      modal.classList.add('is-open');
    });
    $$('[data-pos-method]', p).forEach(b => b.addEventListener('click', () => setMethod(b.dataset.posMethod)));
    $$('[data-cash]', p).forEach(b => b.addEventListener('click', () => {
      received = b.dataset.cash === 'exacto' ? null : +b.dataset.cash;
      $$('[data-cash]', p).forEach(x => x.classList.toggle('is-on', x === b));
      updateChange();
    }));
    $('[data-pos-cancel]', p).addEventListener('click', () => modal.classList.remove('is-open'));
    $('[data-pos-confirm]', p).addEventListener('click', () => {
      const total = totalOf();
      if (method === 'efectivo' && received !== null && received < total) { replay(changeEl, 'is-pop'); return; }
      const f = '#' + String(folio).padStart(4, '0');
      $('[data-pos-ok-folio]', p).textContent = f;
      $('[data-pos-ok-total]', p).textContent = mxn(total);
      $('[data-pos-receipt]', p).innerHTML = [...order.values()].map(it => `<div><span>${it.qty} × ${it.name}</span><span>${mxn(it.qty * it.price)}</span></div>`).join('')
        + (descuento ? `<div><span>Descuento 10%</span><span>−${mxn(bruto() - total)}</span></div>` : '')
        + `<div class="is-total"><span>Total · ${method === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</span><span>${mxn(total)}</span></div>`;
      // Actualiza los indicadores del día.
      kpi.ventas += total;
      kpi.tickets += 1;
      if (method === 'efectivo') kpi.caja += total;
      const pon = (sel, val) => { const el = $(sel, p); el.textContent = val; replay(el, 'is-pop'); };
      pon('[data-pos-kpi-ventas]', mxn(kpi.ventas));
      pon('[data-pos-kpi-tickets]', kpi.tickets);
      pon('[data-pos-kpi-prom]', mxn(kpi.ventas / kpi.tickets));
      if (method === 'efectivo') pon('[data-pos-kpi-caja]', mxn(kpi.caja));
      modal.dataset.paso = 'ok';
    });
    $('[data-pos-new]', p).addEventListener('click', () => {
      modal.classList.remove('is-open');
      order.clear();
      descuento = false;
      discountBtn.classList.remove('is-on');
      discountBtn.lastChild.textContent = 'Aplicar descuento 10%';
      folio++;
      $('[data-pos-folio]', p).textContent = '#' + String(folio).padStart(4, '0');
      render();
    });
    render();
  });

  /* ------------------------------------------------------------------------
     Demo: agenda de citas
     ------------------------------------------------------------------------ */
  $$('.app-citas').forEach(c => {
    const st = { svc: null, barber: null, day: null, slot: null };
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const confirm = $('[data-c-confirm]', c);
    const av = $('[data-c-av]', c);
    const pick = (sel, btn) => $$(sel, c).forEach(b => b.classList.toggle('is-on', b === btn));
    const update = () => {
      $('[data-c-svc]', c).textContent = st.svc ? st.svc.name : 'Tu cita';
      $('[data-c-barber]', c).textContent = st.barber ? 'Con ' + st.barber.name : 'Elige servicio y barbero';
      av.textContent = st.barber ? st.barber.name[0] : '?';
      av.style.setProperty('--c', st.barber ? st.barber.color : '#3a3b40');
      $('[data-c-date]', c).textContent = st.day ? `${dias[(st.day - 1) % 7]} ${st.day} nov${st.slot ? ' · ' + st.slot : ''}` : '—';
      $('[data-c-total]', c).textContent = st.svc ? mxn(st.svc.price, 0) : '—';
      const pasos = [st.svc, st.barber, st.day, st.slot];
      const n = pasos.filter(Boolean).length;
      $$('.c-steps li', c).forEach((li, k) => li.classList.toggle('is-on', k <= n && k < 4 && (k === 0 || pasos[k - 1])));
      confirm.disabled = n < 4;
    };
    $$('.c-svc', c).forEach(b => b.addEventListener('click', () => { st.svc = { name: b.dataset.name, price: +b.dataset.price }; pick('.c-svc', b); update(); }));
    $$('.c-barber', c).forEach(b => b.addEventListener('click', () => { st.barber = { name: b.dataset.name, color: b.dataset.color }; pick('.c-barber', b); update(); }));
    $$('.c-day', c).forEach(b => b.addEventListener('click', () => { st.day = +b.dataset.day; pick('.c-day', b); update(); }));
    $$('.c-slot', c).forEach(b => b.addEventListener('click', () => { st.slot = b.dataset.slot; pick('.c-slot', b); update(); }));
    confirm.addEventListener('click', () => {
      $('[data-c-done-text]', c).textContent = `${st.svc.name} con ${st.barber.name} · ${dias[(st.day - 1) % 7]} ${st.day} de noviembre a las ${st.slot}.`;
      scrollerOf(c)?.scrollTo({ top: 0, behavior: 'smooth' });
      c.classList.add('is-done');
    });
    $('[data-c-reset]', c).addEventListener('click', () => {
      st.svc = st.barber = st.day = st.slot = null;
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
    let folio = 127;

    const backToDraft = () => {
      if (paper.dataset.estado === 'borrador') return;
      paper.dataset.estado = 'borrador';
      status.textContent = 'Borrador';
      $('[data-f-uuid]', f).textContent = '—';
      $('[data-f-sello]', f).textContent = '—';
      stampBtn.disabled = false;
      addBtn.disabled = extras.length === 0;
    };
    const total = () => conceptos.reduce((s, [, m]) => s + m, 0) * 1.16;
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
        // La factura nueva aparece en la lista de recientes.
        const lista = $('[data-f-recent]', f);
        lista.querySelector('.is-new')?.classList.remove('is-new');
        lista.insertAdjacentHTML('afterbegin', `<li class="is-new"><span><b>A-0${folio}</b><small>${$('[data-f-r-name]', f).textContent}</small></span><span><b>${mxn(total(), 0)}</b><em class="is-ok">Timbrada</em></span></li>`);
        $$('li', lista).slice(5).forEach(li => li.remove());
        folio++;
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
    let pagadasMes = 12;
    const kpi = (name, val) => { const el = $(`[data-k-kpi="${name}"]`, k); if (el.textContent !== String(val)) { el.textContent = val; replay(el, 'is-pop'); } };
    const counts = () => {
      $$('.k-col', k).forEach(col => { $('[data-count]', col).textContent = $$('.k-card', col).length; });
      kpi('abiertas', $$('.k-col[data-col="solicitud"] .k-card, .k-col[data-col="revision"] .k-card', k).length);
      kpi('revision', $$('.k-col[data-col="revision"] .k-card', k).length);
      kpi('pagadas', pagadasMes);
    };

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
      card.dataset.paso = orden.indexOf(to) + 1;
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = '';
      if (to === 'pagada') pagadasMes++;
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
      irA($('#contacto'));
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
