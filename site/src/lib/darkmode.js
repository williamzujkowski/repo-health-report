/**
 * Reactive dark mode detection for Svelte chart components.
 * Watches the <html> element for the 'dark' class toggle.
 *
 * Usage in Svelte 5:
 *   import { isDark, onDarkModeChange } from '../lib/darkmode.js';
 *   let dark = $state(isDark());
 *   onDarkModeChange((v) => { dark = v; reinitChart(); });
 */

/** Check if dark mode is currently active */
export function isDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * Watch for dark mode changes. Returns a cleanup function.
 * @param {(isDark: boolean) => void} callback
 * @returns {() => void} cleanup
 */
export function onDarkModeChange(callback) {
  if (typeof MutationObserver === 'undefined') return () => {};

  const observer = new MutationObserver(() => {
    callback(isDark());
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => observer.disconnect();
}
