<script>
  import { onMount } from 'svelte';
  import { isDark, onDarkModeChange } from '../../lib/darkmode.js';
  import * as echarts from 'echarts/core';
  import { BoxplotChart as BoxplotChartType } from 'echarts/charts';
  import { TooltipComponent, GridComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([BoxplotChartType, TooltipComponent, GridComponent, CanvasRenderer]);

  let { repos = [], darkMode = false, _autoDetectDark = true } = $props();

  let chartEl;
  let chart;

  function quartiles(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    if (sorted.length === 0) return [0, 0, 0, 0, 0];
    if (sorted.length === 1) return [sorted[0], sorted[0], sorted[0], sorted[0], sorted[0]];
    const q = (p) => {
      const i = (sorted.length - 1) * p;
      const lo = Math.floor(i);
      if (lo + 1 >= sorted.length) return sorted[lo];
      return sorted[lo] + (sorted[lo + 1] - sorted[lo]) * (i - lo);
    };
    return [sorted[0], q(0.25), q(0.5), q(0.75), sorted[sorted.length - 1]];
  }

  onMount(() => {
    const dimNames = repos.length > 0 ? repos[0].dimensions.map((d) => d.name) : [];

    const boxData = dimNames.map((name, idx) => {
      const scores = repos.map((r) => r.dimensions[idx].score);
      return quartiles(scores);
    });

    chart = echarts.init(chartEl, darkMode ? 'dark' : undefined);

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const d = params.data;
          return `<strong>${dimNames[params.dataIndex]}</strong><br>` +
            `Min: ${d[1]}<br>Q1: ${d[2]}<br>Median: ${d[3]}<br>Q3: ${d[4]}<br>Max: ${d[5]}`;
        },
      },
      grid: {
        left: 140,
        right: 40,
        top: 10,
        bottom: 30,
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          color: darkMode ? '#aaa' : '#666',
        },
        splitLine: {
          lineStyle: { color: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
        },
      },
      yAxis: {
        type: 'category',
        data: dimNames,
        axisLabel: {
          color: darkMode ? '#aaa' : '#666',
          fontSize: 12,
        },
      },
      series: [
        {
          type: 'boxplot',
          data: boxData,
          itemStyle: {
            color: darkMode ? 'rgba(26,110,138,0.3)' : 'rgba(26,110,138,0.2)',
            borderColor: '#1a6e8a',
            borderWidth: 2,
          },
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
  aria-label="Box plot showing score distributions across health dimensions"
  style="width: 100%; height: 300px;"
></div>
