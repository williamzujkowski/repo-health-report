<script>
  import { onMount } from 'svelte';
  import { isDark, onThemeChange } from '../../lib/darkmode.js';
  import { getChartThemeOptions, getVizRamp } from '../../lib/chart-theme.js';
  import * as echarts from 'echarts/core';
  import { HeatmapChart as HeatmapChartType } from 'echarts/charts';
  import { TooltipComponent, GridComponent, VisualMapComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([HeatmapChartType, TooltipComponent, GridComponent, VisualMapComponent, CanvasRenderer]);

  let { repos = [] } = $props();

  let chartEl;
  let chart;

  function initChart() {
    if (chart) { chart.dispose(); chart = null; }
    if (!chartEl) return;

    const dark = isDark();
    const theme = getChartThemeOptions(dark);
    const trimmed = repos.slice(0, 50);
    const repoNames = trimmed.map((r) => r.slug);
    const dimNames = trimmed.length > 0 ? trimmed[0].dimensions.map((d) => d.name) : [];

    const data = [];
    trimmed.forEach((repo, yIdx) => {
      repo.dimensions.forEach((dim, xIdx) => {
        data.push([xIdx, yIdx, dim.score]);
      });
    });

    chart = echarts.init(chartEl, dark ? 'dark' : undefined);
    chart.setOption({
      ...theme,
      tooltip: {
        position: 'top',
        formatter: (params) => {
          const [xIdx, yIdx, value] = params.data;
          return `${repoNames[yIdx]}<br>${dimNames[xIdx]}: <strong>${value}</strong>`;
        },
      },
      grid: { left: 160, right: 60, top: 10, bottom: 40 },
      xAxis: {
        ...theme.xAxis,
        type: 'category',
        data: dimNames,
        splitArea: { show: true },
        axisLabel: { ...theme.xAxis.axisLabel, fontSize: 11, rotate: 30 },
      },
      yAxis: {
        ...theme.yAxis,
        type: 'category',
        data: repoNames,
        splitArea: { show: true },
        axisLabel: { ...theme.yAxis.axisLabel, fontSize: 10, overflow: 'truncate', width: 140 },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: getVizRamp(dark) },
        textStyle: { color: dark ? '#aaa' : '#666' },
      },
      series: [{
        type: 'heatmap',
        data: data,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' },
        },
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
  aria-label="Heatmap showing scores across {repos.length} repositories and their health dimensions"
  style="width: 100%; height: 600px;"
></div>
