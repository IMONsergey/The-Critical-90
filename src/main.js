import { initMotion } from './motion.js';
import { initInteractive } from './interactive.js';
import { initForm } from './form.js';

// Each enhancement is isolated so a failed optional effect cannot break navigation or the form.
for (const [name, initialize] of [['navigation', initInteractive], ['form', initForm], ['motion', initMotion]]) {
  try { initialize(); }
  catch (error) {
    console.error(`Unable to initialize ${name}`, error);
    if (name === 'motion') document.documentElement.classList.remove('motion-ready');
  }
}
