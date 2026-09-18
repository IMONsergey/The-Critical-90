/** Motion is input-driven; a single scheduled frame batches geometry reads before writes. */
// Animation frames read cached state, not the native MediaQueryList getter.
// This keeps frame-time reads from consuming a pending media-change notification.
function mediaPreference(query) {
  const media = window.matchMedia(query);
  const preference = new EventTarget();
  let matches = media.matches;
  Object.defineProperty(preference, 'matches', { get: () => matches });
  media.addEventListener('change', event => {
    matches = event.matches;
    preference.dispatchEvent(new Event('change'));
  });
  return preference;
}
export const reducedMotion = mediaPreference('(prefers-reduced-motion: reduce)');
const finePointer = mediaPreference('(hover: hover) and (pointer: fine)');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function animateIn(element, options = {}) {
  if (reducedMotion.matches || !element?.animate) return null;
  return element.animate(
    [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)', ...options },
  );
}

export function initMotion() {
  const header = document.querySelector('.site-header');
  const progress = document.querySelector('.reading-progress span');
  const hero = document.querySelector('.hero');
  const heroArtwork = document.querySelector('.hero-artwork');
  const backTop = document.querySelector('.back-top');
  const parallaxItems = [...document.querySelectorAll('[data-parallax="gentle"]')];
  const lightItems = [...document.querySelectorAll('[data-light],.shift-card,.timeline-card,.button,.priority,.shifts,.guide')];
  const visible = new Set();
  const pending = new Map();
  const changed = new Set();
  const entranceAnimations = new Set();
  const spring = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, time: 0 };
  let frame = 0;
  let scrollDirty = true;
  let viewportHeight = innerHeight;
  let maxScroll = 1;
  const canMove = () => finePointer.matches && !reducedMotion.matches && !document.hidden;
  const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(update); };

  function reset(element) {
    pending.delete(element);
    for (const property of ['--light-x','--light-y','--magnet-x','--magnet-y','--ambient-x','--ambient-y']) element.style.removeProperty(property);
    changed.delete(element);
  }
  function resetHero() {
    Object.assign(spring, { x:0,y:0,tx:0,ty:0,vx:0,vy:0,time:0 });
    for (const property of ['--hero-x','--hero-y','--scroll-depth']) heroArtwork?.style.removeProperty(property);
  }

  function update(now) {
    frame = 0;
    const motion = canMove();
    const y = Math.max(0, scrollY);
    // Complete all layout reads before assigning any styles.
    const samples = motion ? [...pending].filter(([element]) => visible.has(element)).map(([element, point]) => ({ element, point, rect:element.getBoundingClientRect() })) : [];
    const depths = motion && innerWidth > 799 && scrollDirty ? parallaxItems.filter(element => visible.has(element)).map(element => ({ element, rect:element.getBoundingClientRect() })) : [];
    const heroHeight = scrollDirty ? hero?.offsetHeight ?? 0 : 0;
    pending.clear();
    if (scrollDirty) {
      header?.classList.toggle('is-scrolled', y > 32);
      backTop?.classList.toggle('is-visible', y > viewportHeight * 1.4);
      if (progress) progress.style.transform = `scaleX(${clamp(y / maxScroll, 0, 1)})`;
      if (motion && innerWidth > 799 && visible.has(hero)) heroArtwork?.style.setProperty('--scroll-depth', `${Math.min(22, y * .035, heroHeight * .035)}px`);
      for (const { element, rect } of depths) {
        const offset = clamp((viewportHeight / 2 - rect.top - rect.height / 2) * .025, -14, 14);
        element.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
      }
      scrollDirty = false;
    }
    for (const { element, point, rect } of samples) {
      if (!rect.width || !rect.height) continue;
      const x = clamp((point.x - rect.left) / rect.width, 0, 1);
      const y = clamp((point.y - rect.top) / rect.height, 0, 1);
      if (element === hero) {
        if (innerWidth > 799) { spring.tx = (x - .5) * 14; spring.ty = (y - .5) * 10; }
        continue;
      }
      element.style.setProperty('--light-x', `${(x * 100).toFixed(2)}%`);
      element.style.setProperty('--light-y', `${(y * 100).toFixed(2)}%`);
      if (element.matches('.button')) {
        element.style.setProperty('--magnet-x', `${((x - .5) * 6).toFixed(2)}px`);
        element.style.setProperty('--magnet-y', `${((y - .5) * 4).toFixed(2)}px`);
      }
      if (element.matches('.section,.closing-card')) {
        element.style.setProperty('--ambient-x', `${((x - .5) * 12).toFixed(2)}px`);
        element.style.setProperty('--ambient-y', `${((y - .5) * 8).toFixed(2)}px`);
      }
      changed.add(element);
    }
    if (!motion || innerWidth < 800 || !visible.has(hero)) { resetHero(); return; }
    const distance = Math.abs(spring.tx - spring.x) + Math.abs(spring.ty - spring.y) + Math.abs(spring.vx) + Math.abs(spring.vy);
    if (distance < .025) { spring.time = 0; return; }
    const dt = spring.time ? Math.min(2, (now - spring.time) / 16.667) : 1;
    spring.time = now;
    spring.vx = (spring.vx + (spring.tx - spring.x) * .065 * dt) * Math.pow(.75, dt);
    spring.vy = (spring.vy + (spring.ty - spring.y) * .065 * dt) * Math.pow(.75, dt);
    spring.x += spring.vx * dt;
    spring.y += spring.vy * dt;
    heroArtwork?.style.setProperty('--hero-x', `${spring.x.toFixed(2)}px`);
    heroArtwork?.style.setProperty('--hero-y', `${spring.y.toFixed(2)}px`);
    schedule();
  }

  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else {
        visible.delete(entry.target);
        reset(entry.target);
        entry.target.style.removeProperty('--parallax-y');
        if (entry.target === hero) resetHero();
      }
    }
  });
  new Set([hero, ...parallaxItems, ...lightItems]).forEach(element => { if (element) visibility.observe(element); });
  const resize = () => {
    viewportHeight = innerHeight;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - viewportHeight);
    scrollDirty = true;
    schedule();
  };
  addEventListener('scroll', () => { scrollDirty = true; schedule(); }, { passive:true });
  addEventListener('resize', resize, { passive:true });
  new ResizeObserver(resize).observe(document.body);
  backTop?.addEventListener('click', () => scrollTo({ top:0, behavior:reducedMotion.matches ? 'instant' : 'smooth' }));

  [hero, ...lightItems].forEach(element => {
    element?.addEventListener('pointermove', event => {
      if (!canMove() || event.pointerType === 'touch') return;
      pending.set(element, { x:event.clientX, y:event.clientY });
      schedule();
    }, { passive:true });
    element?.addEventListener('pointerleave', () => {
      reset(element);
      if (element === hero) { spring.tx = 0; spring.ty = 0; schedule(); }
    }, { passive:true });
  });

  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('is-revealed');
      revealObserver.unobserve(entry.target);
    }
  }, { rootMargin:'0px 0px -24px 0px', threshold:.04 });
  document.querySelectorAll('[data-reveal]').forEach(element => {
    element.dataset.revealKind = element.matches('.shift-visual,.why-card,.closing-card,.timeline-card') ? 'visual' : 'copy';
    element.style.setProperty('--reveal-delay', `${Math.min(140, Number(element.dataset.delay) || 0)}ms`);
    revealObserver.observe(element);
  });
  document.documentElement.classList.add('motion-ready');
  function remember(animation) {
    if (!animation) return;
    entranceAnimations.add(animation);
    animation.finished.catch(() => {}).finally(() => entranceAnimations.delete(animation));
  }
  document.querySelectorAll('[data-hero-enter]').forEach((element, index) => remember(animateIn(element, { duration:650, delay:40 + index * 80 })));
  if (!reducedMotion.matches) {
    remember(header?.animate([{opacity:0},{opacity:1}], {duration:450}));
    remember(heroArtwork?.animate([{opacity:0},{opacity:1}], {duration:850,easing:'ease-out'}));
  }

  function preferenceChanged() {
    if (!canMove()) {
      cancelAnimationFrame(frame); frame = 0; pending.clear();
      [...changed].forEach(reset);
      parallaxItems.forEach(element => element.style.removeProperty('--parallax-y'));
      resetHero();
      entranceAnimations.forEach(animation => animation.cancel());
    }
    resize();
  }
  reducedMotion.addEventListener('change', preferenceChanged);
  finePointer.addEventListener('change', preferenceChanged);
  document.addEventListener('visibilitychange', preferenceChanged);

  const navigationLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"]')];
  const navObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) navigationLinks.forEach(link => {
      if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin:'-15% 0px -50% 0px', threshold:0 });
  ['priority','shifts','agenda'].forEach(id => { const element = document.getElementById(id); if (element) navObserver.observe(element); });
  resize();
}
