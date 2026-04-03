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
    baseUrl?: string;
  }

  let { repos, baseUrl = '/repo-health-report' }: Props = $props();

  let search = $state('');
  let sortKey = $state<keyof Repo>('score');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let selectedLanguage = $state('all');
  let selectedType = $state('all');
  let selectedGrades = $state<Set<string>>(new Set(['A', 'B', 'C', 'D', 'F', 'N/A']));
  let currentPage = $state(1);
  const perPage = 50;

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
    currentPage = 1;
  }

  function setSort(key: keyof Repo) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = key === 'slug' ? 'asc' : 'desc';
    }
    currentPage = 1;
  }

  function handleSearchInput(e: Event) {
    search = (e.target as HTMLInputElement).value;
    currentPage = 1;
  }

  function handleLanguageChange(e: Event) {
    selectedLanguage = (e.target as HTMLSelectElement).value;
    currentPage = 1;
  }

  function handleTypeChange(e: Event) {
    selectedType = (e.target as HTMLSelectElement).value;
    currentPage = 1;
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

  const totalPages = $derived(Math.ceil(filtered.length / perPage));
  const paginatedRepos = $derived(
    filtered.slice((currentPage - 1) * perPage, currentPage * perPage)
  );

  // Show a window of page numbers around current
  const pageNumbers = $derived.by(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  function gradeClasses(grade: string): string {
    const map: Record<string, string> = {
      A: 'grade-A',
      B: 'grade-B',
      C: 'grade-C',
      D: 'grade-D',
      F: 'grade-F',
      'N/A': 'grade-NA',
    };
    return 'grade-pill ' + (map[grade] ?? map['N/A']);
  }

  function typeClasses(type: string): string {
    const map: Record<string, string> = {
      application: 'type-application',
      library: 'type-library',
      framework: 'type-framework',
      documentation: 'type-documentation',
      tool: 'type-tool',
    };
    return 'type-badge ' + (map[type] ?? 'type-default');
  }

  function scoreBarColor(score: number): string {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-teal-500';
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
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

  const gradeFilterColors: Record<string, string> = {
    A: 'border-green-500/40 bg-green-500/10 text-green-400',
    B: 'border-teal-500/40 bg-teal-500/10 text-teal-400',
    C: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
    D: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
    F: 'border-red-500/40 bg-red-500/10 text-red-400',
    'N/A': 'border-stone-500/40 bg-stone-500/10 text-stone-400',
  };
</script>

<div class="space-y-4">
  <!-- Filters -->
  <div class="flex flex-wrap items-center gap-3">
    <input
      type="text"
      placeholder="Search repos..."
      value={search}
      oninput={handleSearchInput}
      class="px-3 py-1.5 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 w-64"
    />

    <select
      value={selectedLanguage}
      onchange={handleLanguageChange}
      class="px-3 py-1.5 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50"
    >
      <option value="all">All Languages</option>
      {#each languages as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>

    <select
      value={selectedType}
      onchange={handleTypeChange}
      class="px-3 py-1.5 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50"
    >
      <option value="all">All Types</option>
      {#each types as t}
        <option value={t}>{t}</option>
      {/each}
    </select>

    <!-- Grade filter chips -->
    <div class="flex items-center gap-1.5">
      {#each allGrades as grade}
        <button
          onclick={() => toggleGrade(grade)}
          class="filter-chip {selectedGrades.has(grade) ? gradeFilterColors[grade] : 'text-stone-500'}"
        >
          {grade}
        </button>
      {/each}
    </div>

    <span class="text-xs text-stone-500 ml-auto tabular-nums">{filtered.length} repos</span>
  </div>

  <!-- Table -->
  <div class="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-stone-50 dark:bg-stone-900 text-left">
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 select-none" onclick={() => setSort('slug')}>
            Repository{sortIndicator('slug')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 text-center select-none w-16" onclick={() => setSort('grade')}>
            Grade{sortIndicator('grade')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 select-none w-36" onclick={() => setSort('score')}>
            Score{sortIndicator('score')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 select-none" onclick={() => setSort('language')}>
            Language{sortIndicator('language')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 select-none" onclick={() => setSort('type')}>
            Type{sortIndicator('type')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-teal-500 text-right select-none" onclick={() => setSort('stars')}>
            Stars{sortIndicator('stars')}
          </th>
        </tr>
      </thead>
      <tbody>
        {#each paginatedRepos as repo, i}
          <tr class="border-t border-stone-100 dark:border-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-900/50 {i % 2 === 0 ? '' : 'bg-stone-50/30 dark:bg-stone-900/20'}">
            <td class="px-4 py-2.5">
              <a
                href="{baseUrl}/repo/{repo.slug.replace('/', '--')}/"
                class="text-teal-600 dark:text-teal-400 hover:underline"
              >
                {repo.slug}
              </a>
            </td>
            <td class="px-4 py-2.5 text-center">
              <span class={gradeClasses(repo.grade)}>
                {repo.grade}
              </span>
            </td>
            <td class="px-4 py-2.5">
              {#if repo.graded}
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full score-bar-inline {scoreBarColor(repo.score)}"
                      style="width: {repo.score}%"
                    ></div>
                  </div>
                  <span class="tabular-nums font-medium w-7 text-right text-xs">{repo.score}</span>
                </div>
              {:else}
                <span class="text-stone-400 text-xs">--</span>
              {/if}
            </td>
            <td class="px-4 py-2.5 text-stone-500 dark:text-stone-400 text-xs">{repo.language ?? 'unknown'}</td>
            <td class="px-4 py-2.5">
              <span class={typeClasses(repo.type)}>{repo.type}</span>
            </td>
            <td class="px-4 py-2.5 text-right tabular-nums text-stone-500 dark:text-stone-400 text-xs">{formatStars(repo.stars)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex items-center justify-between pt-2">
      <span class="text-xs text-stone-500 tabular-nums">
        Showing {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length}
      </span>
      <div class="flex items-center gap-1">
        <button
          class="pagination-btn"
          disabled={currentPage === 1}
          onclick={() => { currentPage = 1; }}
        >
          First
        </button>
        <button
          class="pagination-btn"
          disabled={currentPage === 1}
          onclick={() => { currentPage = Math.max(1, currentPage - 1); }}
        >
          Prev
        </button>
        {#each pageNumbers as page}
          <button
            class="pagination-btn {page === currentPage ? 'pagination-btn-active' : ''}"
            onclick={() => { currentPage = page; }}
          >
            {page}
          </button>
        {/each}
        <button
          class="pagination-btn"
          disabled={currentPage === totalPages}
          onclick={() => { currentPage = Math.min(totalPages, currentPage + 1); }}
        >
          Next
        </button>
        <button
          class="pagination-btn"
          disabled={currentPage === totalPages}
          onclick={() => { currentPage = totalPages; }}
        >
          Last
        </button>
      </div>
    </div>
  {/if}
</div>
