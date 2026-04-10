<script>
  import { onMount } from 'svelte';
  import * as echarts from 'echarts/core';
  import { BarChart as BarChartType } from 'echarts/charts';
  import { TooltipComponent, GridComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([BarChartType, TooltipComponent, GridComponent, CanvasRenderer]);

  let { dimensions = {}, darkMode = false } = $props();

  let chartEl;
  let chart;

  function dimColor(score) {
    if (score >= 70) return '#237a5e';
    if (score >= 55) return '#1a6e8a';
    if (score >= 40) return '#7a6518';
    return '#a83830';
  }

  onMount(() => {
    const entries = Object.entries(dimensions).sort(([, a], [, b]) => b - a);
    const labels = entries.map(([name]) => name);
    const values = entries.map(([, score]) => score);

    chart = echarts.init(chartEl, darkMode ? 'dark' : undefined);

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => `${params[0].name}: <strong>${params[0].value}/100</strong>`,
      },
      grid: {
        left: 110,
        right: 40,
        top: 10,
        bottom: 10,
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: darkMode ? '#aaa' : '#666' },
        splitLine: { lineStyle: { color: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
      },
      yAxis: {
        type: 'category',
        data: labels.reverse(),
        axisLabel: {
          fontSize: 13,
          fontWeight: 500,
          color: darkMode ? '#ccc' : '#333',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: values.reverse().map((v) => ({
            value: v,
            itemStyle: { color: dimColor(v), borderRadius: [0, 4, 4, 0] },
          })),
          barWidth: '55%',
          label: {
            show: true,
            position: 'right',
            formatter: '{c}/100',
            fontSize: 12,
            color: darkMode ? '#ccc' : '#333',
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
  aria-label="Dimension averages: {Object.entries(dimensions).map(([k,v]) => `${k}: ${v}`).join(', ')}"
  style="width: 100%; height: 280px;"
></div>
