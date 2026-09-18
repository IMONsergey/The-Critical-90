import { config } from './config.js';
import { shifts, stages } from './content.js';
import { reducedMotion, animateIn } from './motion.js';

/** Native dialogs handle focus trapping, inert background and Escape across input methods. */
export class DialogController {
  constructor(element) {
    this.element = element;
    this.returnFocus = null;
    this.animation = null;
    this.closing = false;
    element.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    element.addEventListener('close', () => this.afterClose());
    element.addEventListener('click', event => {
      if (event.target !== element) return;
      if (element.classList.contains('menu-dialog')) this.close();
      else {
        const bounds = element.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.close();
      }
    });
  }
  open(trigger = document.activeElement) {
    if (this.element.open) return;
    this.closing = false;
    this.returnFocus = trigger;
    this.element.showModal();
    document.body.classList.add('dialog-open');
    this.animation?.cancel();
    const target = this.element.querySelector('.menu-panel') || this.element;
    this.animation = animateIn(target, { duration: 430 });
    document.dispatchEvent(new CustomEvent('critical:dialog', { detail: { open: true } }));
  }
  async close({ restoreFocus = true } = {}) {
    if (!this.element.open || this.closing) return;
    this.closing = true;
    this.animation?.cancel();
    if (!reducedMotion.matches) {
      const target = this.element.querySelector('.menu-panel') || this.element;
      this.animation = target.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 160, easing: 'ease-out' });
      try { await this.animation.finished; } catch { /* An interrupted close is safe. */ }
    }
    this.element.close();
    this.animation?.cancel();
    if (restoreFocus && this.returnFocus instanceof HTMLElement && this.returnFocus.isConnected) this.returnFocus.focus({ preventScroll: true });
    this.closing = false;
  }
  afterClose() {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
    document.dispatchEvent(new CustomEvent('critical:dialog', { detail: { open: Boolean(document.querySelector('dialog[open]')) } }));
  }
}

export class ShiftSelector {
  constructor(root) {
    this.root = root;
    this.visual = root.querySelector('.shift-visual');
    this.panels = [...root.querySelectorAll('.shift-image')];
    this.tabs = [...root.querySelectorAll('[data-shift]')];
    this.indicators = [...root.querySelectorAll('.shift-progress > span')];
    this.playButton = root.querySelector('.carousel-play');
    this.active = 1;
    this.elapsed = 0;
    this.lastTime = 0;
    this.frame = 0;
    this.sequence = 0;
    this.animations = [];
    this.pauses = new Set(['offscreen']);
    this.automatic = !reducedMotion.matches;
    this.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.select(index, true));
      tab.addEventListener('keydown', event => {
        let target;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (index + 1) % shifts.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (index - 1 + shifts.length) % shifts.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = shifts.length - 1;
        if (target === undefined) return;
        event.preventDefault();
        this.select(target, true);
        this.tabs[target].focus({ preventScroll: true });
      });
    });
    root.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch' && matchMedia('(hover: hover) and (pointer: fine)').matches) this.pause('hover');
    }, { passive: true });
    root.addEventListener('pointerleave', () => this.resume('hover'), { passive: true });
    root.addEventListener('focusin', () => this.pause('focus'));
    root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) this.resume('focus'); });
    document.addEventListener('visibilitychange', () => document.hidden ? this.pause('hidden') : this.resume('hidden'));
    document.addEventListener('critical:dialog', event => event.detail.open ? this.pause('dialog') : this.resume('dialog'));
    new IntersectionObserver(entries => {
      for (const entry of entries) entry.isIntersecting ? this.resume('offscreen') : this.pause('offscreen');
    }, { threshold: .15 }).observe(this.visual);
    this.playButton.addEventListener('click', () => {
      this.automatic = !reducedMotion.matches && !this.automatic;
      this.updatePlayControl();
      this.schedule();
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        this.automatic = false;
        this.sequence++;
        this.animations.forEach(animation => animation.cancel());
        this.animations = [];
        this.panels.forEach((panel, index) => { panel.hidden = index !== this.active; });
      }
      this.updatePlayControl();
      this.schedule();
    });
    let touchStart = null;
    this.visual.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') touchStart = { x: event.clientX, y: event.clientY };
    }, { passive: true });
    this.visual.addEventListener('pointerup', event => {
      if (!touchStart) return;
      const dx = event.clientX - touchStart.x;
      const dy = event.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.3) this.select((this.active + (dx < 0 ? 1 : 3)) % 4, true);
    }, { passive: true });
    this.visual.addEventListener('pointercancel', () => { touchStart = null; }, { passive: true });
    this.updatePlayControl();
  }
  pause(reason) { this.pauses.add(reason); this.schedule(); }
  resume(reason) { this.pauses.delete(reason); this.schedule(); }
  updatePlayControl() {
    this.playButton.disabled = reducedMotion.matches;
    this.playButton.setAttribute('aria-label', reducedMotion.matches ? 'Automatic rotation disabled by reduced motion' : this.automatic ? 'Pause automatic slide rotation' : 'Play automatic slide rotation');
    this.playButton.setAttribute('aria-pressed', String(!this.automatic));
    this.playButton.querySelector('use').setAttribute('href', this.automatic ? '#pause' : '#play');
    if (!this.automatic) this.visual.style.setProperty('--slide-progress', '1');
  }
  schedule() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = 0;
    if (this.automatic && !this.pauses.size && !reducedMotion.matches) this.frame = requestAnimationFrame(time => this.tick(time));
  }
  tick(time) {
    if (this.lastTime) this.elapsed += Math.min(100, time - this.lastTime);
    this.lastTime = time;
    this.visual.style.setProperty('--slide-progress', String(Math.min(1, this.elapsed / config.carouselInterval)));
    if (this.elapsed >= config.carouselInterval) this.select((this.active + 1) % 4, false);
    if (this.automatic && !this.pauses.size && !reducedMotion.matches) this.frame = requestAnimationFrame(next => this.tick(next));
    else this.frame = 0;
  }
  select(index, userInitiated = false) {
    if (!Number.isInteger(index) || index < 0 || index >= this.panels.length) return;
    if (userInitiated) { this.automatic = false; this.updatePlayControl(); this.schedule(); }
    this.elapsed = 0;
    if (index === this.active) return;
    this.animations.forEach(animation => animation.cancel());
    this.animations = [];
    const direction = index > this.active ? 1 : -1;
    const old = this.panels[this.active];
    const next = this.panels[index];
    const token = ++this.sequence;
    this.panels.forEach(panel => {
      panel.hidden = panel !== old && panel !== next;
      panel.classList.toggle('is-active', panel === next);
      panel.setAttribute('aria-hidden', String(panel !== next));
    });
    this.active = index;
    this.tabs.forEach((tab, i) => {
      tab.classList.toggle('is-selected', i === index);
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    this.indicators.forEach((indicator, i) => indicator.classList.toggle('is-active', i === index));
    this.root.querySelector('.shift-position').textContent = `${shifts[index].index} / 04`;
    this.root.querySelector('.shift-category').textContent = shifts[index].category;
    if (userInitiated) this.root.querySelector('#shift-announcement').textContent = `${shifts[index].index} of 4. ${shifts[index].title}. ${shifts[index].category}.`;
    if (reducedMotion.matches) { old.hidden = true; return; }
    const incoming = next.animate([
      { opacity:0, transform:`translateX(${direction * 6}px) scale(1.016)` },
      { opacity:1, transform:'translateX(0) scale(1)' },
    ], { duration:460, easing:'cubic-bezier(.16,1,.3,1)' });
    const outgoing = old.animate([
      { opacity:1, transform:'translateX(0) scale(1)' },
      { opacity:0, transform:`translateX(${-direction * 4}px) scale(1.006)` },
    ], { duration:260, easing:'ease-out' });
    this.animations = [incoming, outgoing];
    outgoing.finished.then(() => { if (token === this.sequence) old.hidden = true; }).catch(() => {});
  }
}

export function initInteractive() {
  const menu = new DialogController(document.getElementById('navigation-dialog'));
  const reports = new DialogController(document.getElementById('report-dialog'));
  const stageDialog = new DialogController(document.getElementById('stage-dialog'));
  const selector = new ShiftSelector(document.getElementById('shifts'));
  const menuOpen = document.getElementById('menu-open');
  // The menu uses the same header controls: no duplicate IDs or second language state.
  const header = document.querySelector('.header-inner');
  const headerHome = header.parentElement;
  const menuHeader = menu.element.querySelector('.menu-topbar');
  menuHeader.replaceChildren();
  const closeMenu = menu.close.bind(menu);
  let closingMenu = null;
  menu.close = (options = {}) => {
    if (closingMenu) return closingMenu;
    if (!menu.element.open) return Promise.resolve();
    closingMenu = (async () => {
      await closeMenu({ ...options, restoreFocus:false });
      headerHome.append(header);
      menuOpen.setAttribute('aria-expanded','false');
      menuOpen.setAttribute('aria-label','Open navigation');
      menuOpen.classList.remove('is-open');
      if (options.restoreFocus !== false) {
        const target = menuOpen.getClientRects().length ? menuOpen : header.querySelector('.brand');
        target.focus({ preventScroll:true });
      }
      closingMenu = null;
    })();
    return closingMenu;
  };
  menuOpen.addEventListener('click', () => {
    if (menu.element.open) { menu.close(); return; }
    menuHeader.append(header);
    menuOpen.setAttribute('aria-expanded','true');
    menuOpen.setAttribute('aria-label','Close navigation');
    menuOpen.classList.add('is-open');
    menu.open(menuOpen);
  });
  header.querySelector('.brand').addEventListener('click', async event => {
    if (!menu.element.open) return;
    event.preventDefault();
    await menu.close({ restoreFocus:false });
    goTo('#top');
  });
  document.querySelectorAll('[data-close-menu]').forEach(element => element.addEventListener('click', async event => {
    event.preventDefault();
    const hash = element.getAttribute('href');
    await menu.close({ restoreFocus: !hash });
    if (hash) goTo(hash);
  }));
  document.querySelectorAll('[data-close-report]').forEach(button => button.addEventListener('click', () => reports.close()));
  document.querySelectorAll('[data-close-stage]').forEach(button => button.addEventListener('click', () => stageDialog.close()));

  function goTo(hash) {
    if (!hash || !hash.startsWith('#')) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }

  document.querySelectorAll('[data-shift-link]').forEach(button => button.addEventListener('click', () => {
    selector.select(Number(button.dataset.shiftLink), true);
    goTo('#shifts');
  }));

  const chapters = reports.element.querySelector('.report-chapters');
  shifts.forEach((shift, index) => {
    const button = document.createElement('button');
    button.className = 'report-chapter';
    const number = document.createElement('span');
    number.textContent = shift.index;
    const label = document.createElement('span');
    label.textContent = shift.title;
    button.append(number, label);
    button.addEventListener('click', async () => {
      await reports.close({ restoreFocus: false });
      selector.select(index, true);
      goTo('#shifts');
    });
    chapters.append(button);
  });

  document.querySelectorAll('[data-report]').forEach(trigger => trigger.addEventListener('click', async event => {
    event.preventDefault();
    const type = trigger.dataset.report;
    const url = type === 'preview' ? config.previewUrl : type === 'report' ? config.reportUrl : '';
    if (url) {
      let parsed;
      try { parsed = new URL(url, location.href); } catch { return; }
      if (parsed.protocol !== 'https:' && parsed.origin !== location.origin) return;
      window.open(parsed.href, '_blank', 'noopener,noreferrer');
      return;
    }
    await Promise.all([menu.close({ restoreFocus: false }), stageDialog.close({ restoreFocus: false })]);
    reports.element.querySelector('.report-availability').textContent = type === 'overview'
      ? 'Explore the four shifts above, or visit Kaspersky resources for more reports.'
      : 'Interactive website preview. The downloadable PDF has not been connected yet.';
    reports.open(trigger);
  }));
  reports.element.querySelector('.report-consultation').addEventListener('click', async event => {
    event.preventDefault();
    await reports.close({ restoreFocus: false });
    goTo('#consultation');
  });

  document.querySelectorAll('[data-day]').forEach(button => {
    const stage = stages.find(item => item.day === Number(button.dataset.day));
    if (!stage) return;
    const emphasize = () => document.querySelector('.timeline-wrap')?.style.setProperty('--halo-index', stages.indexOf(stage));
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') emphasize(); }, { passive:true });
    button.addEventListener('focus', emphasize);
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-day]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      stageDialog.element.querySelector('#stage-dialog-label').textContent = stage.label;
      stageDialog.element.querySelector('#stage-dialog-title').textContent = stage.title;
      stageDialog.element.querySelector('#stage-dialog-body').textContent = stage.body;
      const image = document.createElement('img');
      image.src = `./assets/number-${stage.day}.svg`;
      image.alt = '';
      stageDialog.element.querySelector('.stage-dialog-number').replaceChildren(image);
      stageDialog.open(button);
    });
  });
  stageDialog.element.addEventListener('close', () => document.querySelectorAll('[data-day]').forEach(item => item.setAttribute('aria-pressed', 'false')));

  const languageTrigger = document.querySelector('.language-trigger');
  const languageOptions = document.getElementById('language-options');
  const closeLanguage = () => { languageOptions.hidden = true; languageTrigger.setAttribute('aria-expanded', 'false'); };
  languageTrigger.addEventListener('click', () => {
    const expanded = languageTrigger.getAttribute('aria-expanded') === 'true';
    languageOptions.hidden = expanded;
    languageTrigger.setAttribute('aria-expanded', String(!expanded));
  });
  document.addEventListener('click', event => { if (!event.target.closest('.language-select')) closeLanguage(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLanguage(); });
  return { selector, menu, reports, stageDialog };
}
