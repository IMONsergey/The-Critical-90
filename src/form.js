import { config } from './config.js';

// ISO region identifiers; display names use the visitor's browser locale data, not a network request.
const regions = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

export function initForm() {
  const form = document.getElementById('consultation-form');
  if (!form) return;
  const country = document.getElementById('country');
  const status = document.getElementById('form-status');
  const submit = form.querySelector('[type="submit"]');
  const nameDisplay = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  const options = regions.map(code => ({ code, label: nameDisplay?.of(code) || code })).sort((a, b) => a.label.localeCompare(b.label, 'en'));
  const fragment = document.createDocumentFragment();
  options.forEach(({ code, label }) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = label;
    fragment.append(option);
  });
  country.append(fragment);
  const required = [...form.querySelectorAll('[required]')];
  let sending = false;
  let attempted = false;

  function validate(field) {
    let message = '';
    if (field.type === 'checkbox' && !field.checked) message = 'Please confirm your consent to continue.';
    else if (field.type !== 'checkbox' && !field.value.trim()) message = 'This field is required.';
    else if (field.type === 'email' && field.validity.typeMismatch) message = 'Enter a valid email address.';
    else if (field.type === 'tel') {
      const digits = field.value.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 18 || !/^[+()\d\s.\-]+$/.test(field.value)) message = 'Enter a valid phone number, including the country code.';
    }
    const error = document.getElementById(`${field.id}-error`);
    if (error) error.textContent = message;
    field.setAttribute('aria-invalid', String(Boolean(message)));
    if (message) field.setAttribute('aria-describedby', `${field.id}-error`);
    else field.removeAttribute('aria-describedby');
    return !message;
  }
  required.forEach(field => {
    field.addEventListener('blur', () => { if (field.value || attempted || field.getAttribute('aria-invalid') === 'true') validate(field); });
    field.addEventListener('input', () => {
      if (attempted || field.getAttribute('aria-invalid') === 'true') validate(field);
      if (!sending) status.hidden = true;
    });
    field.addEventListener('change', () => { if (attempted) validate(field); });
  });

  function showStatus(title, message, isError = false) {
    status.replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = title;
    const body = document.createElement('span');
    body.textContent = message;
    status.append(heading, body);
    status.classList.toggle('is-error', isError);
    status.hidden = false;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    attempted = true;
    const invalid = required.filter(field => !validate(field));
    if (invalid.length) {
      invalid[0].focus({ preventScroll: false });
      return;
    }
    if (form.elements.website.value) return;
    if (!config.formEndpoint) {
      showStatus('The form is ready for integration.', 'This is a website preview. Your details have not been sent or saved; a submission endpoint still needs to be connected.');
      return;
    }
    const endpoint = new URL(config.formEndpoint, location.href);
    if (endpoint.protocol !== 'https:' && endpoint.origin !== location.origin) {
      showStatus('Unable to submit.', 'The form endpoint is not configured correctly. Please try again later.', true);
      return;
    }
    sending = true;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.querySelector('span').textContent = 'Sending…';
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const body = Object.fromEntries(new FormData(form));
      body.newsletter = form.elements.newsletter.checked;
      body.privacy = form.elements.privacy.checked;
      delete body.website;
      const response = await fetch(endpoint.href, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body), signal: abort.signal, credentials: 'omit',
      });
      if (!response.ok) throw new Error('Submission was not accepted.');
      showStatus('Thank you. Your request has been sent.', 'A specialist will contact you using the details you provided.');
      form.reset();
      attempted = false;
      required.forEach(field => { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); });
    } catch {
      showStatus('Your request could not be sent.', 'Your entries are still here. Please check your connection and try again.', true);
    } finally {
      clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.querySelector('span').textContent = 'Submit';
    }
  });
}
