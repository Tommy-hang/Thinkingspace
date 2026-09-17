// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { ProviderConfig } from '../../types';
import type { RawUsage } from './usage';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ThinkingOptions {
  enabled: boolean;
  effort: 'low' | 'high' | 'max';
}

export interface StreamChatOptions {
  provider: ProviderConfig;
  apiKey: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  /** 深度思考模型返回的推理过程 */
  onReasoning?: (text: string) => void;
  /** 是否开启深度思考，以及思考强度 */
  thinking?: ThinkingOptions;
  /**
   * 用量回调：**各 Provider 在适配器内部**把自家原始字段解析成与厂商无关的 RawUsage，
   * 再交给上层统一归一化。聊天组件永远不接触厂商原始字段。
   */
  onUsage?: (raw: RawUsage) => void;
}

export const SYSTEM_PROMPT = [
  '你是 ThinkingSpace 中的思考协作 AI。',
  '用户不是在和你线性聊天，而是在一个以「主题」为单位、可分支、可导航的思维空间中与你协作。',
  '请遵循以下原则：',
  '1. 紧扣当前主题作答，不要复述无关历史。',
  '2. 如果当前主题来自某个父主题的具体片段，请自然地把回答与那段上下文衔接起来。',
  '3. 结构清晰、克制、准确；优先使用简短段落与列表。',
  '4. 除非用户要求其他语言，默认使用中文回答。',
  '5. 不确定时明确说明不确定，不要编造。',
  '6. 数学公式统一使用 $...$（行内）与 $$...$$（独立成行）作为定界符；不要使用 \\(...\\) 或 \\[...\\]。',
].join('\n');
