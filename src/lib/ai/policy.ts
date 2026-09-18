// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type {
  OutputBudget,
  ReasoningLevel,
  RequestPlan,
  RuntimeSettings,
} from '../../types';

/**
 * 请求规划（V1，纯规则）。
 *
 * 关键约束：**绝不为了做判断而再调用一次模型**。
 * 规则能定的就用规则，定不了就保持原有默认行为。
 */

/** 稳定前缀指纹：稳定部分变一个字节，指纹就变 —— 用于排查「为什么 cache 命中率低」 */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const GREETING =
  /^(你好|您好|hi|hello|hey|谢谢|多谢|thanks|thank you|ok|好的|收到|在吗|早上好|晚上好)[!！。.~～\s]*$/i;
const ASK_DETAIL = /(详细|深入|全面|系统|一步一步|逐条|展开|完整|教程|讲解|为什么|原理)/;
const ASK_SHORT = /(一句话|简短|简要|简单说|概括|总结一下|tl;?dr|大概说)/i;
const HARD =
  /(证明|推导|定理|算法|复杂度|架构设计|系统设计|重构|数学|公式|积分|微分|矩阵|概率|并发|分布式|一致性|设计一个|从零实现)/;
const CODE = /(```|代码|函数|接口|sql|正则|regex|class |function |import |const |报错|异常|stack|bug|调试)/i;

export interface ReasoningDecision {
  level: ReasoningLevel;
  why: string;
}

/** 按问题本身的特征决定思考强度 */
export function planReasoning(question: string): ReasoningDecision {
  const q = question.trim();
  const len = q.length;

  if (GREETING.test(q)) return { level: 'none', why: '寒暄，不需要推理' };
  if (len <= 10) return { level: 'none', why: '问题很短，直接回答即可' };

  const hard = HARD.test(q);
  const code = CODE.test(q);
  const detail = ASK_DETAIL.test(q);

  if (hard && (len > 160 || detail)) {
    return { level: 'max', why: '涉及推导或架构类难题，且要求较深' };
  }
  if (hard || code || len > 240) {
    return {
      level: 'high',
      why: hard ? '涉及推理或算法类问题' : code ? '涉及代码或报错排查' : '问题较长、信息量大',
    };
  }
  if (detail) return { level: 'high', why: '你要求深入解释' };
  return { level: 'low', why: '普通问答，轻量推理即可' };
}

export interface OutputDecision {
  budget: OutputBudget;
  /** 输出 token 上限（安全网，设置得比较宽松，避免把正常回答截断） */
  max?: number;
  why: string;
}

/** 按问题类型给出「最小够用」的回答长度预算，而不是「能写多长」 */
export function planOutput(question: string, reasoning: ReasoningLevel): OutputDecision {
  const q = question.trim();

  if (ASK_SHORT.test(q)) return { budget: 'compact', max: 1200, why: '你要求简短' };
  if (ASK_DETAIL.test(q) || reasoning === 'max') {
    return { budget: 'deep', max: 10000, why: '要求详细展开' };
  }
  if (reasoning === 'high') return { budget: 'detailed', max: 6000, why: '问题较复杂，需要展开' };
  if (q.length <= 20) return { budget: 'compact', max: 1500, why: '问题很短，答案通常也短' };
  return { budget: 'normal', max: 3000, why: '普通回答长度' };
}

export interface PlanRequestInput {
  question: string;
  /** 稳定前缀的完整文本（用于算指纹） */
  stableText: string;
  stableChars: number;
  dynamicChars: number;
  runtime: RuntimeSettings | undefined;
  /** 设置里用户手动选的思考开关与强度 */
  manualThinking?: { enabled: boolean; effort: 'low' | 'high' | 'max' };
}

const RUNTIME_FALLBACK: RuntimeSettings = {
  stablePrefix: true,
  adaptiveReasoning: true,
  adaptiveOutput: true,
  contextIntelligence: true,
};

export function planRequest(input: PlanRequestInput): RequestPlan {
  // 兜底：设置缺字段也不能崩（与 normalizeSettings 双保险）
  const runtime = input.runtime ?? RUNTIME_FALLBACK;
  let reasoning: ReasoningLevel;
  let reasoningWhy: string;

  if (!runtime.adaptiveReasoning) {
    reasoning =
      input.manualThinking && !input.manualThinking.enabled
        ? 'none'
        : (input.manualThinking?.effort ?? 'high');
    reasoningWhy = '按设置里的固定思考强度';
  } else {
    const decided = planReasoning(input.question);
    reasoning = decided.level;
    reasoningWhy = decided.why;
    // 用户明确关掉深度思考时，最高只到 low
    if (input.manualThinking && !input.manualThinking.enabled && reasoning !== 'none') {
      reasoning = 'low';
      reasoningWhy = '你关闭了深度思考';
    }
  }

  const output = runtime.adaptiveOutput
    ? planOutput(input.question, reasoning)
    : { budget: 'normal' as OutputBudget, max: undefined, why: '未启用长度自适应' };

  return {
    reasoning,
    reasoningWhy,
    outputBudget: output.budget,
    maxOutputTokens: output.max,
    outputWhy: output.why,
    prefixFingerprint: fingerprint(input.stableText),
    stableChars: input.stableChars,
    dynamicChars: input.dynamicChars,
  };
}
