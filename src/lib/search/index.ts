// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { SearchProviderConfig, SearchSource } from '../../types';

export interface RunSearchInput {
  provider: SearchProviderConfig;
  apiKey: string;
  query: string;
  maxResults: number;
  signal?: AbortSignal;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw new Error(`搜索请求失败（HTTP ${res.status}）。${detail}`);
  }

  return res.json();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function searchTavily(
  provider: SearchProviderConfig,
  apiKey: string,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchSource[]> {
  const data = (await postJson(
    provider.endpoint,
    { Authorization: `Bearer ${apiKey}` },
    {
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
    },
    signal,
  )) as { results?: { title?: string; url?: string; content?: string }[] };

  return (data.results ?? []).slice(0, maxResults).map((r) => ({
    title: str(r.title) || str(r.url),
    url: str(r.url),
    content: str(r.content),
  }));
}

async function searchExa(
  provider: SearchProviderConfig,
  apiKey: string,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchSource[]> {
  const data = (await postJson(
    provider.endpoint,
    { 'x-api-key': apiKey },
    {
      query,
      numResults: maxResults,
      contents: { text: { maxCharacters: 1200 } },
    },
    signal,
  )) as { results?: { title?: string; url?: string; text?: string }[] };

  return (data.results ?? []).slice(0, maxResults).map((r) => ({
    title: str(r.title) || str(r.url),
    url: str(r.url),
    content: str(r.text),
  }));
}

async function searchSerper(
  provider: SearchProviderConfig,
  apiKey: string,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchSource[]> {
  const data = (await postJson(
    provider.endpoint,
    { 'X-API-KEY': apiKey },
    { q: query, num: maxResults },
    signal,
  )) as { organic?: { title?: string; link?: string; snippet?: string }[] };

  return (data.organic ?? []).slice(0, maxResults).map((r) => ({
    title: str(r.title) || str(r.link),
    url: str(r.link),
    content: str(r.snippet),
  }));
}

export async function runSearch(input: RunSearchInput): Promise<SearchSource[]> {
  const { provider, apiKey, query, maxResults, signal } = input;

  if (!apiKey.trim()) {
    throw new Error(
      `尚未配置「${provider.displayName}」的搜索 API Key。请在 设置 → 联网搜索 中填入。`,
    );
  }

  switch (provider.kind) {
    case 'tavily':
      return searchTavily(provider, apiKey, query, maxResults, signal);
    case 'exa':
      return searchExa(provider, apiKey, query, maxResults, signal);
    case 'serper':
      return searchSerper(provider, apiKey, query, maxResults, signal);
    default:
      return [];
  }
}

export function formatSourcesForPrompt(sources: SearchSource[]): string {
  if (sources.length === 0) return '';
  const lines = sources.map((s, i) => {
    const body = s.content.replace(/\s+/g, ' ').trim().slice(0, 1200);
    return `[${i + 1}] ${s.title}\nURL: ${s.url}\n摘要: ${body}`;
  });
  return [
    '【联网检索结果】以下是刚刚从互联网检索到的资料，请优先依据它们回答，',
    '并在引用具体信息时用 [1] [2] 这样的编号标注来源。如果资料不足以回答，请明确说明。',
    '',
    lines.join('\n\n'),
  ].join('\n');
}
