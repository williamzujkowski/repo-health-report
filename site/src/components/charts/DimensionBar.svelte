<script>
  import { onMount } from 'svelte';
  import { isDark, onThemeChange } from '../../lib/darkmode.js';
  import { getChartThemeOptions, getDimensionColor } from '../../lib/chart-theme.js';
  import * as echarts from 'echarts/core';
  import { BarChart as BarChartType } from 'echarts/charts';
  import { TooltipComponent, GridComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([BarChartType, TooltipComponent, GridComponent, CanvasRenderer]);

  let { dimensions = {} } = $props();

  let chartEl;
  let chart;


  function initChart() {
    if (chart) { chart.dispose(); chart = null; }
    if (!chartEl) return;

    const dark = isDark();
    const theme = getChartThemeOptions(dark);
    const entries = Object.entries(dimensions).sort(([, a], [, b]) => b - a);
    const labels = entries.map(([name]) => name);
    const values = entries.map(([, score]) => score);

    chart = echarts.init(chartEl, dark ? 'dark' : undefined);
    chart.setOption({
      ...theme,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name}: <strong>${p[0].value}/100</strong>` },
      grid: { left: 110, right: 50, top: 10, bottom: 10 },
      xAxis: { ...theme.xAxis, type: 'value', max: 100 },
      yAxis: { ...theme.yAxis, type: 'category', data: labels.slice().reverse(), axisLabel: { ...theme.yAxis.axisLabel, fontSize: 13, fontWeight: 500 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar',
        data: values.slice().reverse().map((v) => ({ value: v, itemStyle: { color: getDimensionColor(v, dark), borderRadius: [0, 4, 4, 0] } })),
        barWidth: '55%',
        label: { show: true, position: 'right', formatter: '{c}/100', fontSize: 12, color: dark ? '#ccc' : '#333' },
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

<div bind:this={chartEl} role="img" aria-label="Dimension averages: {Object.entries(dimensions).map(([k,v]) => `${k}: ${v}`).join(', ')}" style="width: 100%; height: 280px;"></div>
