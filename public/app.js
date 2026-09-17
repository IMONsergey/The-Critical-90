import { siteConfig } from './site-config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const focusable = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';

function scrollToSection(target) {
  if (!target) return;
  target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
}

class Navigation {
  constructor() {
    this.panel = $('#navigation-panel');
    this.backdrop = $('#menu-backdrop');
    this.toggle = $('#menu-toggle');
    this.header = $('#site-header');
    this.main = $('#main');
    this.opened = false;
    this.closeTimer = null;
    this.toggle.addEventListener('click', () => this.opened ? this.close() : this.open());
    $('.menu-close', this.panel).addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', () => this.close());
    document.addEventListener('keydown', event => {
      if (!this.opened) return;
      if (event.key === 'Escape') { event.preventDefault(); this.close(); }
      if (event.key === 'Tab') this.trapFocus(event);
    });
    this.panel.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (link && link.hash && link.hash !== '#') {
        event.preventDefault();
        const target = document.getElementById(link.hash.slice(1));
        this.close(false);
        setTimeout(() => { scrollToSection(target); this.focusSection(target); }, reducedMotion.matches ? 0 : 330);
      }
    });
    matchMedia('(min-width: 1351px)').addEventListener('change', event => { if (event.matches) this.close(); });
  }
  focusSection(target) {
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }
  open() {
    clearTimeout(this.closeTimer);
    this.opened = true;
    this.panel.hidden = false;
    this.backdrop.hidden = false;
    this.main.inert = true;
    this.header.inert = true;
    $('.back-top').inert = true;
    document.body.classList.add('has-overlay');
    this.toggle.setAttribute('aria-expanded', 'true');
    this.toggle.setAttribute('aria-label', 'Close navigation');
    requestAnimationFrame(() => {
      this.panel.classList.add('is-open');
      this.backdrop.classList.add('is-open');
      $('.menu-close', this.panel).focus({ preventScroll: true });
    });
  }
  close(restoreFocus = true) {
    if (!this.opened) return;
    this.opened = false;
    this.panel.classList.remove('is-open');
    this.backdrop.classList.remove('is-open');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-label', 'Open navigation');
    this.main.inert = false;
    this.header.inert = false;
    $('.back-top').inert = false;
    document.body.classList.remove('has-overlay');
    if (restoreFocus) this.toggle.focus({ preventScroll: true });
    this.closeTimer = setTimeout(() => { this.panel.hidden = true; this.backdrop.hidden = true; }, reducedMotion.matches ? 0 : 320);
  }
  trapFocus(event) {
    const nodes = $$(focusable, this.panel).filter(node => node.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}

class ShiftCarousel {
  constructor() {
    this.root = $('#shifts');
    this.panel = $('#shift-panel');
    this.tabs = $$('[data-shift]', this.root);
    this.images = $$('.shift-image', this.root);
    this.indicators = $$('.slider-progress>span', this.root);
    this.playButton = $('.slider-play', this.root);
    this.index = 1;
    this.elapsed = 0;
    this.paused = reducedMotion.matches;
    this.visible = false;
    this.hovered = false;
    this.focused = false;
    this.frame = 0;
    this.last = 0;
    this.duration = Math.max(4500, siteConfig.carouselDuration || 7000);
    this.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.select(index, true));
      tab.addEventListener('keydown', event => {
        let next;
        if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % 4;
        if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index + 3) % 4;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = 3;
        if (next !== undefined) { event.preventDefault(); this.select(next, true); this.tabs[next].focus({ preventScroll: true }); }
      });
    });
    $('.slider-next', this.root).addEventListener('click', () => this.select((this.index + 1) % 4, true));
    $('.slider-prev', this.root).addEventListener('click', () => this.select((this.index + 3) % 4, true));
    this.playButton.addEventListener('click', () => { this.paused = !this.paused; this.syncPlay(); this.schedule(); });
    this.root.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') this.hovered = true; });
    this.root.addEventListener('pointerleave', () => { this.hovered = false; this.schedule(); });
    this.root.addEventListener('focusin', () => { this.focused = true; });
    this.root.addEventListener('focusout', () => requestAnimationFrame(() => { this.focused = this.root.contains(document.activeElement); this.schedule(); }));
    let start = null;
    this.panel.addEventListener('pointerdown', event => { if (!event.target.closest('button')) start = { x: event.clientX, y: event.clientY }; });
    this.panel.addEventListener('pointerup', event => {
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) this.select((this.index + (dx < 0 ? 1 : 3)) % 4, true);
      start = null;
    });
    this.panel.addEventListener('pointercancel', () => { start = null; });
    new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      if (this.visible) this.schedule();
      else this.cancel();
    }, { threshold: .25 }).observe(this.panel);
    document.addEventListener('visibilitychange', () => document.hidden ? this.cancel() : this.schedule());
    reducedMotion.addEventListener('change', event => { if (event.matches) this.paused = true; this.syncPlay(); this.schedule(); });
    this.syncPlay();
  }
  select(index, manual = false) {
    this.index = index;
    this.elapsed = 0;
    if (manual) this.paused = true;
    this.tabs.forEach((tab, i) => {
      tab.classList.toggle('is-active', i === index);
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      this.images[i].classList.toggle('is-active', i === index);
      this.images[i].setAttribute('aria-hidden', String(i !== index));
      this.indicators[i].classList.toggle('is-active', i === index);
    });
    this.panel.dataset.active = String(index);
    this.panel.setAttribute('aria-labelledby', this.tabs[index].id);
    $('.media-count', this.root).innerHTML = `${String(index + 1).padStart(2, '0')} <span>/ 04</span>`;
    this.panel.style.setProperty('--slide-progress', this.paused ? '1' : '0');
    this.panel.classList.remove('is-transitioning');
    requestAnimationFrame(() => this.panel.classList.add('is-transitioning'));
    this.syncPlay();
  }
  syncPlay() {
    this.playButton.setAttribute('aria-pressed', String(this.paused));
    this.playButton.setAttribute('aria-label', this.paused ? 'Start automatic slide changes' : 'Pause automatic slide changes');
    if (this.paused) this.panel.style.setProperty('--slide-progress', '1');
  }
  schedule() {
    if (this.frame || !this.visible || document.hidden) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(time => this.tick(time));
  }
  tick(time) {
    this.frame = 0;
    if (!this.visible || document.hidden) return;
    const delta = Math.min(time - this.last, 100);
    this.last = time;
    if (!this.paused && !this.hovered && !this.focused && !reducedMotion.matches) {
      this.elapsed += delta;
      if (this.elapsed >= this.duration) this.select((this.index + 1) % 4);
      this.panel.style.setProperty('--slide-progress', String(clamp(this.elapsed / this.duration, 0, 1)));
    }
    if (!this.paused && !reducedMotion.matches) this.frame = requestAnimationFrame(t => this.tick(t));
  }
  cancel() { cancelAnimationFrame(this.frame); this.frame = 0; }
}

function setupReveals() {
  const nodes = $$('.reveal');
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.remove('is-waiting');
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: .07, rootMargin: '0px 0px 30px 0px' });
  nodes.forEach(node => {
    node.style.setProperty('--reveal-delay', `${Math.min(Number(node.dataset.revealDelay || 0), 180)}ms`);
    if (node.getBoundingClientRect().top > innerHeight - 40) node.classList.add('is-waiting');
    else node.classList.add('is-visible');
    observer.observe(node);
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) { observer.disconnect(); nodes.forEach(node => node.classList.remove('is-waiting')); }
  });
  window.addEventListener('beforeprint', () => nodes.forEach(node => node.classList.remove('is-waiting')));
}

function setupPointerMaterials() {
  const cards = $$('.glass:not(.consultation-form)');
  cards.forEach(card => {
    let frame = 0;
    card.addEventListener('pointermove', event => {
      if (!finePointer.matches || reducedMotion.matches || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = card.getBoundingClientRect();
        const x = event.clientX - r.left, y = event.clientY - r.top;
        card.style.setProperty('--px', `${x}px`);
        card.style.setProperty('--py', `${y}px`);
        card.style.setProperty('--rx', `${-(y / r.height - .5) * 2}deg`);
        card.style.setProperty('--ry', `${(x / r.width - .5) * 2}deg`);
        card.classList.add('is-hovered');
      });
    });
    card.addEventListener('pointerleave', () => { card.classList.remove('is-hovered'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
  $$('.button').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (!finePointer.matches || reducedMotion.matches) return;
      const r = button.getBoundingClientRect();
      button.style.setProperty('--mx', `${(event.clientX - r.left - r.width / 2) * .035}px`);
      button.style.setProperty('--my', `${(event.clientY - r.top - r.height / 2) * .08}px`);
    });
    button.addEventListener('pointerleave', () => { button.style.setProperty('--mx', '0px'); button.style.setProperty('--my', '0px'); });
  });
  const hero = $('.hero');
  hero.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches) return;
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--hero-x', `${(event.clientX / r.width - .5) * 12}px`);
    hero.style.setProperty('--hero-y', `${(event.clientY / r.height - .5) * 8}px`);
  });
  hero.addEventListener('pointerleave', () => { hero.style.setProperty('--hero-x', '0px'); hero.style.setProperty('--hero-y', '0px'); });
}

function setupReadingPosition() {
  const header = $('#site-header'), top = $('.back-top');
  const parallax = [$('.why-number'), $('.cta-art')];
  const sections = ['priority', 'shifts', 'agenda'].map(id => document.getElementById(id));
  let scheduled = false;
  function update() {
    scheduled = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    header.classList.toggle('is-scrolled', y > 28);
    header.style.setProperty('--scroll-progress', String(max > 0 ? clamp(y / max, 0, 1) : 0));
    top.hidden = y < 900;
    let current = '';
    for (const section of sections) if (section.getBoundingClientRect().top < innerHeight * .4) current = section.id;
    $$('.desktop-nav a[href^="#"]').forEach(link => link.hash === `#${current}` ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'));
    if (!reducedMotion.matches && finePointer.matches) parallax.forEach(image => {
      const rect = image.parentElement.getBoundingClientRect();
      if (rect.top < innerHeight && rect.bottom > 0) image.style.setProperty('--parallax-y', `${clamp((innerHeight / 2 - rect.top - rect.height / 2) * .035, -16, 16)}px`);
    });
  }
  addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update, { passive: true });
  top.addEventListener('click', () => scrollToSection($('#top')));
  update();
}

function setupTimeline() {
  const cards = $$('[data-day]'), grid = $('.timeline-grid');
  const select = (card, announce = true) => {
    cards.forEach(item => { item.classList.toggle('is-active', item === card); item.setAttribute('aria-pressed', String(item === card)); });
    grid.style.setProperty('--timeline-x', `${cards.indexOf(card) * 33.33 + 16.66}%`);
    if (announce) $('#timeline-status').textContent = `${$('.timeline-unit', card).textContent}. ${$('.timeline-title', card).textContent}. ${$('.timeline-body', card).textContent}.`;
  };
  cards.forEach((card, index) => {
    card.addEventListener('click', () => select(card));
    card.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      const next = cards[(index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 2)) % cards.length];
      select(next); next.focus({ preventScroll: true });
    });
  });
}

function validPublicUrl(value) {
  if (!value) return null;
  try { const url = new URL(value, location.href); return url.protocol === 'https:' || url.origin === location.origin ? url : null; }
  catch { return null; }
}

function setupDocumentPreview(navigation) {
  const dialog = $('#document-dialog');
  let previousFocus;
  const close = () => { if (dialog.open) dialog.close(); };
  $$('.dialog-close', dialog).forEach(button => button.addEventListener('click', close));
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('has-overlay');
    if (previousFocus && !previousFocus.closest('[hidden]')) previousFocus.focus({ preventScroll: true });
  });
  $$('[data-document]').forEach(button => button.addEventListener('click', () => {
    previousFocus = button;
    const kind = button.dataset.document;
    const url = validPublicUrl(kind === 'report' ? siteConfig.reportUrl : siteConfig.previewUrl);
    const download = $('.document-download', dialog), availability = $('.document-availability', dialog);
    if (url) {
      download.hidden = false; availability.hidden = true;
      download.href = url.href; download.target = '_blank'; download.rel = 'noopener noreferrer';
      download.firstChild.textContent = kind === 'report' ? 'Download report ' : 'Download preview ';
    } else {
      download.hidden = true; availability.hidden = false;
      availability.textContent = `The ${kind === 'report' ? 'full report' : 'preview'} download file has not been connected to this website preview.`;
    }
    if (navigation.opened) navigation.close(false);
    dialog.showModal();
    document.body.classList.add('has-overlay');
    window.dispatchEvent(new CustomEvent('critical90:document', { detail: { kind } }));
  }));
  $('[data-go-consultation]', dialog).addEventListener('click', () => { previousFocus = null; close(); scrollToSection($('#consultation')); setTimeout(() => $('#name').focus({ preventScroll: true }), reducedMotion.matches ? 0 : 450); });
  $$('[data-reports]').forEach(link => {
    const url = validPublicUrl(siteConfig.moreReportsUrl);
    if (url) { link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else link.addEventListener('click', event => { event.preventDefault(); $('[data-document="preview"]').click(); });
  });
}

function setupLanguage() {
  const button = $('.language-control'), list = $('#language-list');
  const close = () => { list.hidden = true; button.setAttribute('aria-expanded', 'false'); };
  button.addEventListener('click', () => { const open = list.hidden; list.hidden = !open; button.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', event => { if (!event.target.closest('.language-select')) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
}

function setupConsultationForm() {
  const form = $('.consultation-form'), country = $('#country'), status = $('.form-status', form), submit = $('.form-submit', form);
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  codes.map(code => ({ code, name: names ? names.of(code) : code })).sort((a, b) => a.name.localeCompare(b.name)).forEach(item => country.add(new Option(item.name, item.code)));
  const controls = $$('input[required],select[required]', form);
  const messages = { name: 'Please enter your name.', email: 'Please enter a valid email address.', phone: 'Please enter a valid phone number.', country: 'Please select your country.', company: 'Please enter your company name.', employees: 'Please select a company size.', privacy: 'Please confirm your consent before submitting.' };
  function validate(input) {
    let valid = input.checkValidity();
    if (input.type !== 'checkbox' && !input.value.trim()) valid = false;
    if (input.id === 'phone' && input.value.replace(/\D/g, '').length < 6) valid = false;
    const error = document.getElementById(`${input.id}-error`);
    if (valid) { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); if (error) error.textContent = ''; }
    else { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', `${input.id}-error`); if (error) error.textContent = messages[input.id] || 'Please check this field.'; }
    return valid;
  }
  controls.forEach(input => {
    input.addEventListener('blur', () => { if (input.value || input.hasAttribute('aria-invalid')) validate(input); });
    input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', () => { if (input.hasAttribute('aria-invalid')) validate(input); });
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); status.textContent = ''; status.classList.remove('is-error');
    const invalid = controls.filter(input => !validate(input));
    if (invalid.length) { invalid[0].focus(); return; }
    if ($('#website').value) return;
    const endpoint = validPublicUrl(siteConfig.formEndpoint);
    if (!endpoint) {
      status.textContent = 'This website preview does not send personal details. The consultation service has not been connected yet.';
      return;
    }
    submit.disabled = true; submit.setAttribute('aria-busy', 'true');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const data = Object.fromEntries(new FormData(form)); delete data.website;
      data.newsletter = $('[name="newsletter"]', form).checked; data.privacy = true;
      const response = await fetch(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('The service did not accept the request.');
      status.textContent = 'Your consultation request has been sent. Thank you.'; form.reset();
    } catch {
      status.textContent = 'Your request was not sent. Please try again later. Your details are still here.'; status.classList.add('is-error');
    } finally { clearTimeout(timeout); submit.disabled = false; submit.removeAttribute('aria-busy'); }
  });
}

const navigation = new Navigation();
const carousel = new ShiftCarousel();
setupReveals();
setupPointerMaterials();
setupReadingPosition();
setupTimeline();
setupDocumentPreview(navigation);
setupLanguage();
setupConsultationForm();
window.addEventListener('pagehide', () => carousel.cancel());
window.addEventListener('pageshow', () => carousel.schedule());
document.documentElement.dataset.ready = 'true';
