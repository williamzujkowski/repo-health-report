<script>
  import { onMount } from 'svelte';
  import { isDark } from '../../lib/darkmode.js';
  import { getGradeColors } from '../../lib/chart-theme.js';
  import * as echarts from 'echarts/core';
  import { RadarChart as RadarChartType } from 'echarts/charts';
  import { TooltipComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([RadarChartType, TooltipComponent, CanvasRenderer]);

  let { dimensions = {}, title = 'Health Dimensions' } = $props();

  let chartEl;
  let chart;

  onMount(() => {
    const dark = isDark();
    const gc = getGradeColors(dark);
    const labels = Object.keys(dimensions);
    const values = Object.values(dimensions);
    const avgScore = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

    const fillColor = avgScore >= 90 ? gc.A : avgScore >= 80 ? gc.B : avgScore >= 70 ? gc.C : avgScore >= 60 ? gc.D : gc.F;

    chart = echarts.init(chartEl, dark ? 'dark' : undefined);

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
        axisName: { color: dark ? '#ccc' : '#444', fontSize: 12 },
        splitArea: {
          areaStyle: {
            color: dark
              ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)']
              : ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.05)'],
          },
        },
        splitLine: { lineStyle: { color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: values,
          name: title,
          areaStyle: { color: fillColor + '33' },
          lineStyle: { color: fillColor, width: 2 },
          itemStyle: { color: fillColor },
        }],
      }],
    });

    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(chartEl);
    return () => { ro.disconnect(); chart?.dispose(); };
  });
</script>

<div
  bind:this={chartEl}
  role="img"
  aria-label="Radar chart showing {Object.entries(dimensions).map(([k,v]) => `${k}: ${v}`).join(', ')}"
  style="width: 100%; height: 320px;"
></div>
