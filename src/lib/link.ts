// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

export interface NodeLink {
  projectId: string;
  nodeId: string;
}

/** 使用 hash 路由，GitHub Pages 等静态托管无需任何服务端配置 */
export function buildNodeHash(projectId: string, nodeId: string): string {
  return `#/p/${encodeURIComponent(projectId)}/n/${encodeURIComponent(nodeId)}`;
}

export function buildNodeUrl(projectId: string, nodeId: string): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${buildNodeHash(projectId, nodeId)}`;
}

export function parseNodeHash(hash: string): NodeLink | null {
  const match = /#\/p\/([^/]+)\/n\/([^/?#]+)/.exec(hash);
  if (!match) return null;
  return {
    projectId: decodeURIComponent(match[1]),
    nodeId: decodeURIComponent(match[2]),
  };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续尝试兜底方案 */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
