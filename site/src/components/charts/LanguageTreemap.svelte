<script>
  import { onMount } from 'svelte';
  import { isDark, onThemeChange } from '../../lib/darkmode.js';
  import { getChartThemeOptions, getVizRamp } from '../../lib/chart-theme.js';
  import * as echarts from 'echarts/core';
  import { TreemapChart as TreemapChartType } from 'echarts/charts';
  import { TooltipComponent, VisualMapComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([TreemapChartType, TooltipComponent, VisualMapComponent, CanvasRenderer]);

  let { languages = [] } = $props();

  let chartEl;
  let chart;

  function initChart() {
    if (chart) { chart.dispose(); chart = null; }
    if (!chartEl) return;

    const dark = isDark();
    const theme = getChartThemeOptions(dark);
    const filtered = languages.filter((l) => l.count >= 5);

    const treeData = filtered.map((lang) => ({
      name: lang.name,
      value: lang.count,
      averageScore: lang.averageScore,
    }));

    chart = echarts.init(chartEl, dark ? 'dark' : undefined);
    chart.setOption({
      ...theme,
      tooltip: {
        formatter: (params) => {
          const d = params.data;
          return `<strong>${d.name}</strong><br>Repos: ${d.value}<br>Avg Score: ${d.averageScore.toFixed(1)}`;
        },
      },
      series: [{
        type: 'treemap',
        data: treeData,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 13,
          color: '#fff',
        },
        itemStyle: {
          borderColor: dark ? '#1a1a2e' : '#fff',
          borderWidth: 2,
          gapWidth: 2,
        },
        levels: [{
          colorMappingBy: 'value',
          itemStyle: { gapWidth: 2 },
        }],
        visualDimension: 'averageScore',
        visualMin: 0,
        visualMax: 100,
      }],
      visualMap: {
        type: 'continuous',
        min: 0,
        max: 100,
        inRange: { color: getVizRamp(dark) },
        textStyle: { color: dark ? '#aaa' : '#666' },
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        calculable: true,
        dimension: 'averageScore',
      },
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
  aria-label="Treemap showing {languages.filter((l) => l.count >= 5).length} languages sized by repo count and colored by average score"
  style="width: 100%; height: 400px;"
></div>
