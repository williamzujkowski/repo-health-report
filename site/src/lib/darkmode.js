/**
 * Dark mode detection for Svelte chart components.
 *
 * Usage:
 *   import { isDark, onThemeChange } from '../lib/darkmode.js';
 *   const dark = isDark();
 *   const cleanup = onThemeChange(() => { // reinit chart });
 */

/** Check if dark mode is currently active */
export function isDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * Listen for theme changes (fired by the toggle button).
 * Returns a cleanup function.
 * @param {() => void} callback — called when theme changes
 * @returns {() => void} cleanup
 */
export function onThemeChange(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener('theme-changed', handler);
  return () => window.removeEventListener('theme-changed', handler);
}
