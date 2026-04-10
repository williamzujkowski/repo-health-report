<script>
  import { onMount } from 'svelte';
  import { isDark, onThemeChange } from '../../lib/darkmode.js';
  import { getGradeColors, getChartThemeOptions } from '../../lib/chart-theme.js';
  import * as echarts from 'echarts/core';
  import { BarChart as BarChartType } from 'echarts/charts';
  import { TooltipComponent, GridComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([BarChartType, TooltipComponent, GridComponent, CanvasRenderer]);

  let { distribution = {} } = $props();

  let chartEl;
  let chart;

  function initChart() {
    if (chart) { chart.dispose(); chart = null; }
    if (!chartEl) return;

    const dark = isDark();
    const gc = getGradeColors(dark);
    const theme = getChartThemeOptions(dark);
    const grades = ['A', 'B', 'C', 'D', 'F'];
    const values = grades.map((g) => distribution[g] || 0);
    const total = values.reduce((a, b) => a + b, 0);

    chart = echarts.init(chartEl, dark ? 'dark' : undefined);
    chart.setOption({
      ...theme,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const p = params[0];
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
          return `Grade ${p.name}: <strong>${p.value.toLocaleString()}</strong> repos (${pct}%)`;
        },
      },
      grid: { left: 60, right: 20, top: 10, bottom: 30 },
      xAxis: {
        ...theme.xAxis,
        type: 'category',
        data: grades,
        axisLabel: { fontSize: 14, fontWeight: 700, color: (value) => gc[value] || (dark ? '#aaa' : '#555') },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        ...theme.yAxis,
        type: 'value',
        axisLabel: { ...theme.yAxis.axisLabel, formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v) },
      },
      series: [{
        type: 'bar',
        data: values.map((v, i) => ({ value: v, itemStyle: { color: gc[grades[i]] } })),
        barWidth: '60%',
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
      }],
    });
  }

  onMount(() => {
    initChart();
    const cleanupTheme = onThemeChange(initChart);
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(chartEl);
    return () => { cleanupTheme(); ro.disconnect(); chart?.dispose(); };
  });
</script>

<div
  bind:this={chartEl}
  role="img"
  aria-label="Grade distribution: {Object.entries(distribution).map(([k,v]) => `${k}: ${v}`).join(', ')}"
  style="width: 100%; height: 300px;"
></div>
