/** Small, interruptible motion primitives. No scroll hijacking or continuous offscreen loops. */
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

export function animateIn(element, options = {}) {
  if (reducedMotion.matches || !element?.animate) return null;
  return element.animate(
    [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)', ...options },
  );
}

export function initMotion() {
  const header = document.querySelector('.site-header');
  const progress = document.querySelector('.reading-progress span');
  const hero = document.querySelector('.hero');
  const heroArtwork = document.querySelector('.hero-artwork');
  const backTop = document.querySelector('.back-top');
  const parallaxItems = [...document.querySelectorAll('[data-parallax="gentle"]')];
  const visibleParallax = new Set();
  let scrollFrame = 0;
  let viewportHeight = window.innerHeight;
  let maxScroll = Math.max(1, document.documentElement.scrollHeight - viewportHeight);

  function updateScroll() {
    scrollFrame = 0;
    const y = Math.max(0, window.scrollY);
    header?.classList.toggle('is-scrolled', y > 32);
    backTop?.classList.toggle('is-visible', y > viewportHeight * 1.4);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, y / maxScroll)})`;
    if (!reducedMotion.matches && window.innerWidth > 799) {
      if (heroArtwork && y < (hero?.offsetHeight ?? 1000)) {
        heroArtwork.style.setProperty('--scroll-depth', `${Math.min(36, y * .05)}px`);
      }
      for (const element of visibleParallax) {
        const bounds = element.getBoundingClientRect();
        const offset = Math.max(-18, Math.min(18, (viewportHeight / 2 - bounds.top - bounds.height / 2) * .035));
        element.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
      }
    }
  }
  const requestScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); };
  const resize = () => {
    viewportHeight = window.innerHeight;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - viewportHeight);
    requestScroll();
  };
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  new ResizeObserver(resize).observe(document.body);
  backTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
  updateScroll();

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -32px 0px', threshold: .07 });
    document.querySelectorAll('[data-reveal]').forEach((element) => {
      element.style.setProperty('--reveal-delay', `${Math.min(220, Number(element.dataset.delay) || 0)}ms`);
      revealObserver.observe(element);
    });
    document.documentElement.classList.add('motion-ready');
    const parallaxObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.isIntersecting ? visibleParallax.add(entry.target) : visibleParallax.delete(entry.target);
    }, { rootMargin: '100px' });
    parallaxItems.forEach(element => parallaxObserver.observe(element));
  }

  if (!reducedMotion.matches) {
    document.querySelectorAll('[data-hero-enter]').forEach((element, index) => {
      animateIn(element, { duration: 950, delay: 80 + index * 140 });
    });
    header?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 650, delay: 80, fill: 'backwards' });
    heroArtwork?.animate([{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 1250, easing: 'ease-out' });
  }

  // A damped spring is started only by pointer input and stops once settled.
  let springFrame = 0;
  const spring = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, time: 0 };
  function springTick(now) {
    if (document.hidden || reducedMotion.matches || !finePointer.matches || window.innerWidth < 800) {
      springFrame = 0;
      heroArtwork?.style.removeProperty('--hero-x');
      heroArtwork?.style.removeProperty('--hero-y');
      return;
    }
    const dt = spring.time ? Math.min(2, (now - spring.time) / 16.667) : 1;
    spring.time = now;
    spring.vx = (spring.vx + (spring.tx - spring.x) * .065 * dt) * Math.pow(.75, dt);
    spring.vy = (spring.vy + (spring.ty - spring.y) * .065 * dt) * Math.pow(.75, dt);
    spring.x += spring.vx * dt;
    spring.y += spring.vy * dt;
    heroArtwork?.style.setProperty('--hero-x', `${spring.x.toFixed(2)}px`);
    heroArtwork?.style.setProperty('--hero-y', `${spring.y.toFixed(2)}px`);
    if (Math.abs(spring.tx - spring.x) + Math.abs(spring.ty - spring.y) + Math.abs(spring.vx) + Math.abs(spring.vy) > .05) {
      springFrame = requestAnimationFrame(springTick);
    } else { springFrame = 0; spring.time = 0; }
  }
  function scheduleSpring() { if (!springFrame) { spring.time = 0; springFrame = requestAnimationFrame(springTick); } }
  hero?.addEventListener('pointermove', (event) => {
    if (!finePointer.matches || reducedMotion.matches || window.innerWidth < 800) return;
    const rect = hero.getBoundingClientRect();
    spring.tx = ((event.clientX - rect.left) / rect.width - .5) * 18;
    spring.ty = ((event.clientY - rect.top) / rect.height - .5) * 12;
    scheduleSpring();
  }, { passive: true });
  hero?.addEventListener('pointerleave', () => { spring.tx = 0; spring.ty = 0; scheduleSpring(); }, { passive: true });

  document.querySelectorAll('[data-light]').forEach(element => {
    element.addEventListener('pointermove', event => {
      if (reducedMotion.matches || !finePointer.matches) return;
      const rect = element.getBoundingClientRect();
      element.style.setProperty('--light-x', `${event.clientX - rect.left}px`);
      element.style.setProperty('--light-y', `${event.clientY - rect.top}px`);
    }, { passive: true });
  });

  const navigationLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"]')];
  const navObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      navigationLinks.forEach(link => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-15% 0px -50% 0px', threshold: 0 });
  ['priority', 'shifts', 'agenda'].forEach(id => { const el = document.getElementById(id); if (el) navObserver.observe(el); });
}
