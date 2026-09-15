import type { KnowledgePoint } from '../types';
import { flattenKnowledge } from './knowledgeMap';
import { layoutTree } from './layout';

const NODE_W = 264;
const NODE_H = 84;
const X_GAP = 330;
const Y_GAP = 118;
const PAD = 46;
const HEADER_H = 86;

/** 打印用固定浅色配色，保证 PDF 在任何主题下都清晰 */
const C = {
  text: '#1c1917',
  muted: '#78716c',
  faint: '#a8a29e',
  border: '#d6d3d1',
  nodeBg: '#ffffff',
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  edge: '#c4c1be',
};

const FONT =
  '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",sans-serif';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapText(text: string, perLine: number, maxLines: number): string[] {
  const chars = [...text];
  if (chars.length <= perLine) return [text];
  const lines: string[] = [];
  for (let i = 0; i < chars.length && lines.length < maxLines; i += perLine) {
    lines.push(chars.slice(i, i + perLine).join(''));
  }
  if (chars.length > perLine * maxLines) {
    const last = [...lines[maxLines - 1]];
    lines[maxLines - 1] = `${last.slice(0, Math.max(1, perLine - 1)).join('')}…`;
  }
  return lines;
}

function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`;
}

export interface KnowledgeSvgInput {
  projectTitle: string;
  root: KnowledgePoint;
  /** 把来源卡片 id 解析成标题 */
  resolveSources: (ids: string[]) => string[];
  generatedAt: number;
}

/** 把知识点树渲染成一张自包含的 SVG（矢量，适合打印/PDF） */
export function buildKnowledgeSvg(input: KnowledgeSvgInput): string {
  const { projectTitle, root, resolveSources, generatedAt } = input;
  const flat = flattenKnowledge(root);

  const positions = layoutTree(
    flat.map((item) => ({ id: item.point.id, parentId: item.parentId })),
    { xGap: X_GAP, yGap: Y_GAP },
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of flat) {
    const pos = positions.get(item.point.id) ?? { x: 0, y: 0 };
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + NODE_W);
    maxY = Math.max(maxY, pos.y + NODE_H);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = NODE_W;
    maxY = NODE_H;
  }

  const width = Math.ceil(maxX - minX + PAD * 2);
  const height = Math.ceil(maxY - minY + PAD * 2 + HEADER_H);
  const offsetX = PAD - minX;
  const offsetY = PAD + HEADER_H - minY;

  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family='${FONT}'>`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);

  // 标题区
  parts.push(
    `<text x="${PAD}" y="${PAD + 18}" font-size="22" font-weight="700" fill="${C.text}">${esc(
      truncate(projectTitle, 40),
    )}</text>`,
  );
  const stamp = new Date(generatedAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  parts.push(
    `<text x="${PAD}" y="${PAD + 44}" font-size="12" fill="${C.muted}">知识地图 · 共 ${
      flat.length
    } 个知识点 · 生成于 ${esc(stamp)}</text>`,
  );

  // 连线
  for (const item of flat) {
    if (!item.parentId) continue;
    const from = positions.get(item.parentId);
    const to = positions.get(item.point.id);
    if (!from || !to) continue;
    const x1 = from.x + NODE_W + offsetX;
    const y1 = from.y + NODE_H / 2 + offsetY;
    const x2 = to.x + offsetX;
    const y2 = to.y + NODE_H / 2 + offsetY;
    const mid = (x1 + x2) / 2;
    parts.push(
      `<path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" fill="none" stroke="${C.edge}" stroke-width="1.4"/>`,
    );
  }

  // 节点
  for (const item of flat) {
    const pos = positions.get(item.point.id) ?? { x: 0, y: 0 };
    const x = pos.x + offsetX;
    const y = pos.y + offsetY;
    const isRoot = item.depth === 0;
    const sources = resolveSources(item.point.sourceNodeIds);

    parts.push(`<g transform="translate(${x},${y})">`);
    parts.push(
      `<rect width="${NODE_W}" height="${NODE_H}" rx="14" fill="${
        isRoot ? C.accent : C.nodeBg
      }" stroke="${isRoot ? C.accent : C.border}" stroke-width="1"/>`,
    );

    const labelLines = wrapText(item.point.label, isRoot ? 15 : 16, 2);
    const textColor = isRoot ? '#ffffff' : C.text;
    labelLines.forEach((line, i) => {
      parts.push(
        `<text x="14" y="${26 + i * 19}" font-size="${isRoot ? 15 : 14}" font-weight="600" fill="${textColor}">${esc(
          line,
        )}</text>`,
      );
    });

    if (sources.length > 0) {
      parts.push(
        `<text x="14" y="${NODE_H - 14}" font-size="11" fill="${
          isRoot ? '#e0e7ff' : C.accent
        }">${esc(truncate(sources.join(' · '), 30))}</text>`,
      );
    }
    parts.push('</g>');
  }

  parts.push('</svg>');
  return parts.join('\n');
}

/**
 * 在隐藏 iframe 中渲染 SVG 并唤起系统打印窗口。
 * 用户在打印窗口里选「另存为 PDF」即可得到矢量 PDF，无需任何第三方库。
 */
export function printSvg(svg: string, title: string): void {
  const html = [
    '<!doctype html>',
    '<html lang="zh-CN"><head><meta charset="utf-8">',
    `<title>${esc(title)}</title>`,
    '<style>',
    '  @page { size: A4 landscape; margin: 10mm; }',
    '  html, body { margin: 0; padding: 0; background: #fff; }',
    '  .wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; }',
    '  svg { max-width: 100%; max-height: 96vh; height: auto; }',
    '</style></head><body>',
    `<div class="wrap">${svg}</div>`,
    '</body></html>',
  ].join('\n');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.setTimeout(() => iframe.remove(), 500);
  };

  iframe.onload = () => {
    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        /* 忽略：用户仍可手动打印 */
      }
      cleanup();
    }, 260);
  };

  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}
