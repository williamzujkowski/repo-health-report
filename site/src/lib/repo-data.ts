import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Finding {
  name: string;
  passed: boolean;
  detail: string;
  weight: number;
}

export interface Dimension {
  name: string;
  score: number;
  findings?: Finding[];
}

export interface LanguageBreakdownEntry {
  language: string;
  fileCount: number;
  percentage: number;
}

export interface TreeAnalytics {
  testToSourceRatio?: number;
  configScore?: number;
  antiPatternCount?: number;
  sizeCategory?: string;
  fileCount?: number;
  sourceFileCount?: number;
  testFileCount?: number;
  isMonorepo?: boolean;
}

export interface RepoDetail {
  repo: string;
  letter: string;
  overall: number;
  graded: boolean;
  dimensions: Dimension[];
  // Enriched metadata
  description?: string;
  topics?: string[];
  pushed_at?: string;
  created_at?: string;
  forks_count?: number;
  size?: number;
  languages?: { primary: string; all: LanguageBreakdownEntry[] };
  treeAnalytics?: TreeAnalytics;
}

export function loadRepoDetail(slug: string): RepoDetail | null {
  const fileName = slug.replace('/', '-') + '.json';
  const filePath = resolve(process.cwd(), '..', 'data', 'dashboard', 'repos', fileName);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as RepoDetail;
  } catch {
    return null;
  }
}
