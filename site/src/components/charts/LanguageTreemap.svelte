<script>
  import { onMount } from 'svelte';
  import { isDark, onDarkModeChange } from '../../lib/darkmode.js';
  import * as echarts from 'echarts/core';
  import { TreemapChart as TreemapChartType } from 'echarts/charts';
  import { TooltipComponent, VisualMapComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([TreemapChartType, TooltipComponent, VisualMapComponent, CanvasRenderer]);

  let { languages = [], darkMode = false, _autoDetectDark = true } = $props();

  let chartEl;
  let chart;

  onMount(() => {
    darkMode = isDark();
    const cleanupDarkMode = onDarkModeChange((dark) => { darkMode = dark; chart?.dispose(); chart = null; });
    const filtered = languages.filter((l) => l.count >= 5);

    const treeData = filtered.map((lang) => ({
      name: lang.name,
      value: lang.count,
      averageScore: lang.averageScore,
    }));

    chart = echarts.init(chartEl, darkMode ? 'dark' : undefined);

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (params) => {
          const d = params.data;
          return `<strong>${d.name}</strong><br>Repos: ${d.value}<br>Avg Score: ${d.averageScore.toFixed(1)}`;
        },
      },
      series: [
        {
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
            borderColor: darkMode ? '#1a1a2e' : '#fff',
            borderWidth: 2,
            gapWidth: 2,
          },
          levels: [
            {
              colorMappingBy: 'value',
              itemStyle: {
                gapWidth: 2,
              },
            },
          ],
          visualDimension: 'averageScore',
          visualMin: 0,
          visualMax: 100,
        },
      ],
      visualMap: {
        type: 'continuous',
        min: 0,
        max: 100,
        inRange: {
          color: ['#a83830', '#7a6518', '#237a5e'],
        },
        textStyle: {
          color: darkMode ? '#aaa' : '#666',
        },
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        calculable: true,
        dimension: 'averageScore',
      },
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
  aria-label="Treemap showing {languages.filter((l) => l.count >= 5).length} languages sized by repo count and colored by average score"
  style="width: 100%; height: 400px;"
></div>
