<script lang="ts">
  interface Repo {
    slug: string;
    grade: string;
    score: number;
    language: string | null;
    type: string;
    stars: number;
    graded: boolean;
  }

  interface Props {
    repos: Repo[];
  }

  let { repos }: Props = $props();

  let search = $state('');
  let sortKey = $state<keyof Repo>('score');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let selectedLanguage = $state('all');
  let selectedType = $state('all');
  let selectedGrades = $state<Set<string>>(new Set(['A', 'B', 'C', 'D', 'F', 'N/A']));

  const languages = $derived(
    [...new Set(repos.map((r) => r.language ?? 'unknown'))].sort()
  );
  const types = $derived(
    [...new Set(repos.map((r) => r.type))].sort()
  );

  function toggleGrade(grade: string) {
    const next = new Set(selectedGrades);
    if (next.has(grade)) {
      next.delete(grade);
    } else {
      next.add(grade);
    }
    selectedGrades = next;
  }

  function setSort(key: keyof Repo) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = key === 'slug' ? 'asc' : 'desc';
    }
  }

  const filtered = $derived.by(() => {
    let result = repos;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.slug.toLowerCase().includes(q));
    }

    if (selectedLanguage !== 'all') {
      result = result.filter(
        (r) => (r.language ?? 'unknown') === selectedLanguage
      );
    }

    if (selectedType !== 'all') {
      result = result.filter((r) => r.type === selectedType);
    }

    result = result.filter((r) => selectedGrades.has(r.grade));

    result = [...result].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  function gradeColor(grade: string): string {
    const map: Record<string, string> = {
      A: 'bg-green-500/20 text-green-400',
      B: 'bg-teal-500/20 text-teal-400',
      C: 'bg-yellow-500/20 text-yellow-400',
      D: 'bg-orange-500/20 text-orange-400',
      F: 'bg-red-500/20 text-red-400',
      'N/A': 'bg-stone-500/20 text-stone-400',
    };
    return map[grade] ?? map['N/A'];
  }

  function formatStars(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function sortIndicator(key: keyof Repo): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  }

  const allGrades = ['A', 'B', 'C', 'D', 'F', 'N/A'];
</script>

<div class="space-y-4">
  <!-- Filters -->
  <div class="flex flex-wrap items-center gap-3">
    <input
      type="text"
      placeholder="Search repos..."
      bind:value={search}
      class="px-3 py-1.5 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/50 w-64"
    />

    <select
      bind:value={selectedLanguage}
      class="px-3 py-1.5 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/50"
    >
      <option value="all">All Languages</option>
      {#each languages as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>

    <select
      bind:value={selectedType}
      class="px-3 py-1.5 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/50"
    >
      <option value="all">All Types</option>
      {#each types as t}
        <option value={t}>{t}</option>
      {/each}
    </select>

    <div class="flex items-center gap-1.5">
      {#each allGrades as grade}
        <button
          onclick={() => toggleGrade(grade)}
          class="px-2 py-0.5 text-xs font-medium rounded transition-colors {selectedGrades.has(grade)
            ? gradeColor(grade)
            : 'bg-stone-200 dark:bg-stone-700 text-stone-500'}"
        >
          {grade}
        </button>
      {/each}
    </div>

    <span class="text-xs text-stone-500 ml-auto">{filtered.length} repos</span>
  </div>

  <!-- Table -->
  <div class="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-800">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-stone-100 dark:bg-stone-900 text-left">
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 transition-colors select-none" onclick={() => setSort('slug')}>
            Repository{sortIndicator('slug')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 transition-colors text-center select-none" onclick={() => setSort('grade')}>
            Grade{sortIndicator('grade')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 transition-colors text-right select-none" onclick={() => setSort('score')}>
            Score{sortIndicator('score')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 transition-colors select-none" onclick={() => setSort('language')}>
            Language{sortIndicator('language')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 transition-colors select-none" onclick={() => setSort('type')}>
            Type{sortIndicator('type')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 transition-colors text-right select-none" onclick={() => setSort('stars')}>
            Stars{sortIndicator('stars')}
          </th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as repo, i}
          <tr class="border-t border-stone-100 dark:border-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors {i % 2 === 0 ? '' : 'bg-stone-50/50 dark:bg-stone-900/20'}">
            <td class="px-4 py-2">
              <a
                href="https://github.com/{repo.slug}"
                target="_blank"
                rel="noopener noreferrer"
                class="text-teal-600 dark:text-teal-400 hover:underline"
              >
                {repo.slug}
              </a>
            </td>
            <td class="px-4 py-2 text-center">
              <span class="inline-block px-2 py-0.5 rounded text-xs font-semibold {gradeColor(repo.grade)}">
                {repo.grade}
              </span>
            </td>
            <td class="px-4 py-2 text-right tabular-nums font-medium">{repo.graded ? repo.score : '--'}</td>
            <td class="px-4 py-2 text-stone-600 dark:text-stone-400">{repo.language ?? 'unknown'}</td>
            <td class="px-4 py-2 text-stone-600 dark:text-stone-400">{repo.type}</td>
            <td class="px-4 py-2 text-right tabular-nums text-stone-600 dark:text-stone-400">{formatStars(repo.stars)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
