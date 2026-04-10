<script>
  import { onMount } from 'svelte';
  import { isDark, onDarkModeChange } from '../../lib/darkmode.js';
  import * as echarts from 'echarts/core';
  import { BarChart as BarChartType } from 'echarts/charts';
  import { TooltipComponent, GridComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([BarChartType, TooltipComponent, GridComponent, CanvasRenderer]);

  let { distribution = {}, darkMode = false, _autoDetectDark = true } = $props();

  let chartEl;
  let chart;

  const gradeColors = {
    A: '#237a5e',
    B: '#1a6e8a',
    C: '#7a6518',
    D: '#b35f1e',
    F: '#a83830',
  };

  onMount(() => {
    darkMode = isDark();
    const cleanupDarkMode = onDarkModeChange((dark) => { darkMode = dark; chart?.dispose(); chart = null; });
    const grades = ['A', 'B', 'C', 'D', 'F'];
    const values = grades.map((g) => distribution[g] || 0);
    const total = values.reduce((a, b) => a + b, 0);

    chart = echarts.init(chartEl, darkMode ? 'dark' : undefined);

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const p = params[0];
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
          return `Grade ${p.name}: <strong>${p.value.toLocaleString()}</strong> repos (${pct}%)`;
        },
      },
      grid: {
        left: 60,
        right: 20,
        top: 10,
        bottom: 30,
      },
      xAxis: {
        type: 'category',
        data: grades,
        axisLabel: {
          fontSize: 14,
          fontWeight: 700,
          color: (value) => gradeColors[value] || '#666',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v),
          color: darkMode ? '#aaa' : '#666',
        },
        splitLine: {
          lineStyle: { color: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
        },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: gradeColors[grades[i]] },
          })),
          barWidth: '60%',
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' },
          },
        },
      ],
    });

    const resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(chartEl);

    return () => {
      resizeObserver.disconnect();
      chart?.dispose();
    };
  });
</script>

<div
  bind:this={chartEl}
  role="img"
  aria-label="Grade distribution: {Object.entries(distribution).map(([k,v]) => `${k}: ${v}`).join(', ')}"
  style="width: 100%; height: 300px;"
></div>
