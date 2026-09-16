// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { memo } from 'react';
import type { PluggableList } from 'unified';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { normalizeMathDelimiters } from '../lib/markdown';

const components: Components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer noopener" />
  ),
};

const remarkPlugins: PluggableList = [remarkGfm, remarkMath];

const rehypePlugins: PluggableList = [
  [rehypeKatex, { throwOnError: false, strict: false }],
  [rehypeHighlight, { detect: false, ignoreMissing: true }],
];

function MarkdownImpl({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="ts-markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
