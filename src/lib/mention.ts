import type { TopicNode } from '../types';

/** 从输入文本里解析 @主题 引用（按标题精确或唯一前缀匹配） */
export function extractMentions(text: string, nodes: TopicNode[]): string[] {
  const ids = new Set<string>();
  const matches = text.matchAll(/@([^\s@，。；：、,;:！？!?]+)/g);
  for (const match of matches) {
    const name = match[1].trim();
    if (!name) continue;
    const exact = nodes.find((n) => n.title === name);
    if (exact) {
      ids.add(exact.id);
      continue;
    }
    const partial = nodes.filter((n) => n.title.startsWith(name));
    if (partial.length === 1) ids.add(partial[0].id);
  }
  return [...ids];
}

/** 从一段内容里取一句适合作为「待解决问题」的短句 */
export function firstSentence(text: string, max = 60): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = clean.split(/[。！？!?；;\n]/)[0]?.trim() ?? '';
  const out = sentence || clean;
  return out.length <= max ? out : `${out.slice(0, max)}…`;
}
