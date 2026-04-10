<script>
  import { onMount } from 'svelte';
  import * as echarts from 'echarts/core';
  import { RadarChart as RadarChartType } from 'echarts/charts';
  import { TooltipComponent, LegendComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([RadarChartType, TooltipComponent, LegendComponent, CanvasRenderer]);

  let { dimensions = {}, title = 'Health Dimensions', darkMode = false } = $props();

  let chartEl;
  let chart;

  const gradeColor = (score) => {
    if (score >= 90) return '#237a5e';
    if (score >= 80) return '#1a6e8a';
    if (score >= 70) return '#7a6518';
    if (score >= 60) return '#b35f1e';
    return '#a83830';
  };

  onMount(() => {
    const labels = Object.keys(dimensions);
    const values = Object.values(dimensions);
    const avgScore = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

    chart = echarts.init(chartEl, darkMode ? 'dark' : undefined);

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const data = params.data.value;
          return labels.map((l, i) => `${l}: <strong>${data[i]}/100</strong>`).join('<br>');
        },
      },
      radar: {
        indicator: labels.map((name) => ({ name, max: 100 })),
        shape: 'polygon',
        splitNumber: 5,
        axisName: {
          color: darkMode ? '#ccc' : '#4a4a4a',
          fontSize: 12,
        },
        splitArea: {
          areaStyle: {
            color: darkMode
              ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)']
              : ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.05)'],
          },
        },
        splitLine: {
          lineStyle: { color: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: values,
              name: title,
              areaStyle: {
                color: `${gradeColor(avgScore)}22`,
              },
              lineStyle: {
                color: gradeColor(avgScore),
                width: 2,
              },
              itemStyle: {
                color: gradeColor(avgScore),
              },
            },
          ],
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
  aria-label="Radar chart showing {Object.entries(dimensions).map(([k,v]) => `${k}: ${v}`).join(', ')}"
  style="width: 100%; height: 320px;"
></div>
