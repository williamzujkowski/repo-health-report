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
      A: 'grade-A', B: 'grade-B', C: 'grade-C', D: 'grade-D', F: 'grade-F', 'N/A': 'grade-NA',
    };
    return 'grade-pill ' + (map[grade] ?? map['N/A']);
  }

  function typeClasses(type: string): string {
    const map: Record<string, string> = {
      application: 'type-application', library: 'type-library', framework: 'type-framework',
      documentation: 'type-documentation', tool: 'type-tool',
    };
    return 'type-badge ' + (map[type] ?? 'type-default');
  }

  function scoreBarColor(score: number): string {
    if (score >= 70) return 'var(--color-grade-a)';
    if (score >= 55) return 'var(--color-grade-b)';
    if (score >= 40) return 'var(--color-grade-c)';
    return 'var(--color-grade-f)';
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
    A: 'border-color: rgba(45,157,120,0.4); background: rgba(45,157,120,0.08); color: #2d9d78;',
    B: 'border-color: rgba(29,129,162,0.4); background: rgba(29,129,162,0.08); color: #1d81a2;',
    C: 'border-color: rgba(196,160,53,0.4); background: rgba(196,160,53,0.08); color: #a68a2a;',
    D: 'border-color: rgba(212,118,44,0.4); background: rgba(212,118,44,0.08); color: #d4762c;',
    F: 'border-color: rgba(201,70,62,0.4); background: rgba(201,70,62,0.08); color: #c9463e;',
    'N/A': 'border-color: rgba(153,153,153,0.4); background: rgba(153,153,153,0.08); color: #999;',
  };
</script>

<div style="display: flex; flex-direction: column; gap: 16px;">
  <!-- Filters -->
  <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
    <input
      type="text"
      placeholder="Search repos..."
      value={search}
      oninput={handleSearchInput}
      style="padding: 6px 12px; font-size: 13px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; outline: none; width: 240px; color: var(--color-text);"
    />

    <select
      value={selectedLanguage}
      onchange={handleLanguageChange}
      style="padding: 6px 12px; font-size: 13px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; outline: none; color: var(--color-text);"
    >
      <option value="all">All Languages</option>
      {#each languages as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>

    <select
      value={selectedType}
      onchange={handleTypeChange}
      style="padding: 6px 12px; font-size: 13px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; outline: none; color: var(--color-text);"
    >
      <option value="all">All Types</option>
      {#each types as t}
        <option value={t}>{t}</option>
      {/each}
    </select>

    <!-- Grade filter chips -->
    <div style="display: flex; align-items: center; gap: 6px;">
      {#each allGrades as grade}
        <button
          onclick={() => toggleGrade(grade)}
          class="filter-chip"
          style={selectedGrades.has(grade) ? gradeFilterColors[grade] : ''}
        >
          {grade}
        </button>
      {/each}
    </div>

    <span style="font-size: 12px; color: var(--color-text-muted); margin-left: auto; font-variant-numeric: tabular-nums;">{filtered.length} repos</span>
  </div>

  <!-- Table -->
  <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--color-border);">
    <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
      <thead>
        <tr style="text-align: left; background: var(--color-surface-alt);">
          <th style="padding: 10px 16px; font-weight: 500; cursor: pointer; color: var(--color-text-secondary);" onclick={() => setSort('slug')}>
            Repository{sortIndicator('slug')}
          </th>
          <th style="padding: 10px 16px; font-weight: 500; cursor: pointer; text-align: center; width: 64px; color: var(--color-text-secondary);" onclick={() => setSort('grade')}>
            Grade{sortIndicator('grade')}
          </th>
          <th style="padding: 10px 16px; font-weight: 500; cursor: pointer; width: 140px; color: var(--color-text-secondary);" onclick={() => setSort('score')}>
            Score{sortIndicator('score')}
          </th>
          <th style="padding: 10px 16px; font-weight: 500; cursor: pointer; color: var(--color-text-secondary);" onclick={() => setSort('language')}>
            Language{sortIndicator('language')}
          </th>
          <th style="padding: 10px 16px; font-weight: 500; cursor: pointer; color: var(--color-text-secondary);" onclick={() => setSort('type')}>
            Type{sortIndicator('type')}
          </th>
          <th style="padding: 10px 16px; font-weight: 500; cursor: pointer; text-align: right; color: var(--color-text-secondary);" onclick={() => setSort('stars')}>
            Stars{sortIndicator('stars')}
          </th>
        </tr>
      </thead>
      <tbody>
        {#each paginatedRepos as repo, i}
          <tr style="border-top: 1px solid #f0f0f0; {i % 2 === 0 ? '' : 'background: var(--color-surface-alt);'}">
            <td style="padding: 10px 16px;">
              <a
                href="{baseUrl}/repo/{repo.slug.replace('/', '--')}/"
                style="color: var(--color-accent); text-decoration: none;"
              >
                {repo.slug}
              </a>
            </td>
            <td style="padding: 10px 16px; text-align: center;">
              <span class={gradeClasses(repo.grade)}>
                {repo.grade}
              </span>
            </td>
            <td style="padding: 10px 16px;">
              {#if repo.graded}
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="flex: 1; height: 3px; background: #eee; border-radius: 9999px; overflow: hidden;">
                    <div
                      style="height: 100%; border-radius: 9999px; width: {repo.score}%; background: {scoreBarColor(repo.score)};"
                    ></div>
                  </div>
                  <span style="font-variant-numeric: tabular-nums; font-weight: 600; width: 28px; text-align: right; font-size: 12px; color: var(--color-text);">{repo.score}</span>
                </div>
              {:else}
                <span style="color: var(--color-text-muted); font-size: 12px;">--</span>
              {/if}
            </td>
            <td style="padding: 10px 16px; color: var(--color-text-secondary); font-size: 12px;">{repo.language ?? 'unknown'}</td>
            <td style="padding: 10px 16px;">
              <span class={typeClasses(repo.type)}>{repo.type}</span>
            </td>
            <td style="padding: 10px 16px; text-align: right; font-variant-numeric: tabular-nums; color: var(--color-text-secondary); font-size: 12px;">{formatStars(repo.stars)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px;">
      <span style="font-size: 12px; color: var(--color-text-muted); font-variant-numeric: tabular-nums;">
        Showing {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length}
      </span>
      <div style="display: flex; align-items: center; gap: 4px;">
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
