/** Keep Tab cycling in the active dialog, including browsers that tab into browser chrome. */
export function initDialogFocus() {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    const dialog = dialogs.at(-1);
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      focusable.at(-1).focus();
    } else if (!event.shiftKey && (index === -1 || index === focusable.length - 1)) {
      event.preventDefault();
      focusable[0].focus();
    }
  });
}
