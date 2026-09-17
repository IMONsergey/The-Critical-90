/** Cycle focus explicitly so Tab never leaves the active modal for browser chrome. */
export function initDialogFocus() {
  const selector = 'a[href],button,input,select,textarea,[tabindex]';
  const activeDialog = () => [...document.querySelectorAll('dialog[open]')].at(-1);
  const controls = dialog => [...dialog.querySelectorAll(selector)].filter(element => {
    if (element.disabled || element.tabIndex < 0 || element.closest('[inert],[hidden]')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const dialog = activeDialog();
    if (!dialog) return;
    const items = controls(dialog);
    event.preventDefault();
    if (!items.length) {
      dialog.focus({ preventScroll: true });
      return;
    }
    const current = items.indexOf(document.activeElement);
    const next = current < 0
      ? (event.shiftKey ? items.length - 1 : 0)
      : (current + (event.shiftKey ? -1 : 1) + items.length) % items.length;
    items[next].focus({ preventScroll: true });
  }, true);

  // Native showModal already makes the document inert. This is an additional
  // guard for programmatic focus calls made while the opening animation runs.
  document.addEventListener('focusin', event => {
    const dialog = activeDialog();
    if (!dialog || dialog.contains(event.target)) return;
    const first = controls(dialog)[0];
    (first || dialog).focus({ preventScroll: true });
  });
}
