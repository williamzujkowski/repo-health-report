/**
 * Shared ECharts theme configuration for the Repo Health Report dashboard.
 * Provides consistent colors in both light and dark modes that match the oklch palette.
 *
 * Usage:
 *   import { getChartThemeOptions, GRADE_COLORS } from '../lib/chart-theme.js';
 *   const opts = getChartThemeOptions(isDark);
 *   chart = echarts.init(el, isDark ? 'dark' : undefined);
 *   chart.setOption({ ...opts, ...yourChartOptions });
 */

/** Grade colors — high contrast in both light and dark modes */
export const GRADE_COLORS = {
  light: { A: '#166534', B: '#1d4ed8', C: '#92400e', D: '#9a3412', F: '#991b1b' },
  dark: { A: '#86efac', B: '#93c5fd', C: '#fcd34d', D: '#fdba74', F: '#fca5a5' },
};

/** Get grade colors for the current mode */
export function getGradeColors(isDark) {
  return isDark ? GRADE_COLORS.dark : GRADE_COLORS.light;
}

/** Get a score-based color for dimension bars (green=high, red=low) */
export function getDimensionColor(score, isDark) {
  if (isDark) {
    if (score >= 70) return '#86efac';
    if (score >= 55) return '#93c5fd';
    if (score >= 40) return '#fcd34d';
    return '#fca5a5';
  }
  if (score >= 70) return '#166534';
  if (score >= 55) return '#1d4ed8';
  if (score >= 40) return '#92400e';
  return '#991b1b';
}

/** Sequential color ramp for visualMap (score 0→100) */
export function getVizRamp(isDark) {
  return isDark
    ? ['#fca5a5', '#fdba74', '#fcd34d', '#86efac']
    : ['#991b1b', '#9a3412', '#92400e', '#166534'];
}

/** Accent color for single-series charts */
export function getAccentColor(isDark) {
  return isDark ? '#93c5fd' : '#1d4ed8';
}

/**
 * Returns base ECharts option overrides for consistent styling.
 * Merge these into your chart's setOption call.
 */
export function getChartThemeOptions(isDark) {
  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: isDark ? '#e0e0e0' : '#333333',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    },
    // Default axis styling
    xAxis: isDark ? {
      axisLabel: { color: '#aaa' },
      axisLine: { lineStyle: { color: '#444' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    } : {
      axisLabel: { color: '#555' },
      axisLine: { lineStyle: { color: '#ddd' } },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
    },
    yAxis: isDark ? {
      axisLabel: { color: '#aaa' },
      axisLine: { lineStyle: { color: '#444' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    } : {
      axisLabel: { color: '#555' },
      axisLine: { lineStyle: { color: '#ddd' } },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
    },
  };
}
