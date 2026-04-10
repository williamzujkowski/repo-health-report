<script>
  import { onMount } from 'svelte';
  import * as echarts from 'echarts/core';
  import { ScatterChart as ScatterChartType } from 'echarts/charts';
  import { TooltipComponent, GridComponent, DataZoomComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([ScatterChartType, TooltipComponent, GridComponent, DataZoomComponent, CanvasRenderer]);

  /**
   * @type {{ slug: string, score: number, stars: number, grade: string }[]}
   */
  let { repos = [], darkMode = false } = $props();

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
    chart = echarts.init(chartEl, darkMode ? 'dark' : undefined);

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
        itemStyle: { color: gradeColors[g], opacity: 0.7 },
        emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 1 } },
      }));

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p) => `<strong>${p.data[2]}</strong><br>Score: ${p.data[1]}/100<br>Stars: ${p.data[0].toLocaleString()}`,
      },
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      xAxis: {
        type: 'log',
        name: 'Stars',
        nameLocation: 'center',
        nameGap: 30,
        min: 1,
        axisLabel: {
          formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v),
          color: darkMode ? '#aaa' : '#666',
        },
        splitLine: { lineStyle: { color: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
      },
      yAxis: {
        type: 'value',
        name: 'Health Score',
        nameLocation: 'center',
        nameGap: 40,
        min: 0,
        max: 100,
        axisLabel: { color: darkMode ? '#aaa' : '#666' },
        splitLine: { lineStyle: { color: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'inside', yAxisIndex: 0 },
      ],
      legend: {
        data: series.map((s) => s.name),
        top: 0,
        textStyle: { color: darkMode ? '#ccc' : '#333' },
      },
      series,
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
  aria-label="Scatter plot showing {repos.length} repositories: stars (x-axis) vs health score (y-axis)"
  style="width: 100%; height: 400px;"
></div>
