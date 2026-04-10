<script>
  import { onMount } from 'svelte';
  import { isDark, onThemeChange } from '../../lib/darkmode.js';
  import { getGradeColors, getChartThemeOptions } from '../../lib/chart-theme.js';
  import * as echarts from 'echarts/core';
  import { ScatterChart as ScatterChartType } from 'echarts/charts';
  import { TooltipComponent, GridComponent, DataZoomComponent, LegendComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([ScatterChartType, TooltipComponent, GridComponent, DataZoomComponent, LegendComponent, CanvasRenderer]);

  let { repos = [] } = $props();

  let chartEl;
  let chart;

  function initChart() {
    if (chart) { chart.dispose(); chart = null; }
    if (!chartEl) return;

    const dark = isDark();
    const gc = getGradeColors(dark);
    const theme = getChartThemeOptions(dark);

    chart = echarts.init(chartEl, dark ? 'dark' : undefined);

    const gradeGroups = {};
    for (const r of repos) {
      if (!r.graded) continue;
      const g = r.grade || 'F';
      if (!gradeGroups[g]) gradeGroups[g] = [];
      gradeGroups[g].push([r.stars || 0, r.score, r.slug]);
    }

    const series = ['A', 'B', 'C', 'D', 'F']
      .filter((g) => gradeGroups[g]?.length)
      .map((g) => ({
        name: `Grade ${g}`,
        type: 'scatter',
        data: gradeGroups[g],
        symbolSize: 6,
        itemStyle: { color: gc[g], opacity: 0.8 },
        emphasis: { itemStyle: { opacity: 1, borderColor: dark ? '#fff' : '#000', borderWidth: 1 } },
      }));

    chart.setOption({
      ...theme,
      tooltip: { trigger: 'item', formatter: (p) => `<strong>${p.data[2]}</strong><br>Score: ${p.data[1]}/100<br>Stars: ${p.data[0].toLocaleString()}` },
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      xAxis: { ...theme.xAxis, type: 'log', name: 'Stars', nameLocation: 'center', nameGap: 30, min: 'dataMin', axisLabel: { ...theme.xAxis.axisLabel, formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v) } },
      yAxis: { ...theme.yAxis, type: 'value', name: 'Health Score', nameLocation: 'center', nameGap: 40, min: 0, max: 100 },
      dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'inside', yAxisIndex: 0 }],
      legend: { data: series.map((s) => s.name), top: 0, textStyle: { color: dark ? '#ccc' : '#333' } },
      series,
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

<div bind:this={chartEl} role="img" aria-label="Scatter plot showing {repos.length} repositories: stars (x-axis) vs health score (y-axis)" style="width: 100%; height: 400px;"></div>
