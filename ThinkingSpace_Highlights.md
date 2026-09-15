# ThinkingSpace

> ## 从 AI Chat 到 AI Thinking Space
>
> **一种面向非线性思考的新型人机交互范式**

---

## 目录

- [一、我们正在解决什么问题](#一我们正在解决什么问题)
- [二、传统 AI Chat 的结构性缺陷](#二传统-ai-chat-的结构性缺陷)
- [三、上下文污染](#三上下文污染)
- [四、空间记忆丢失](#四空间记忆丢失)
- [五、Conversation Map](#五conversation-map)
- [六、Card 不是 Message](#六card-不是-message)
- [七、Map View 与 Focus View](#七map-view-与-focus-view)
- [八、返回地图不是简单导航](#八返回地图不是简单导航)
- [九、Inline Selection](#九inline-selection)
- [十、Quick Question 与 Branch 的区别](#十quick-question-与-branch-的区别)
- [十一、渐进式结构化](#十一渐进式结构化)
- [十二、Branch 是一等公民](#十二branch-是一等公民)
- [十三、Branch Anchor](#十三branch-anchor)
- [十四、Conversation Graph](#十四conversation-graph)
- [十五、Conversation Graph 与 Knowledge Graph 不一样](#十五conversation-graph-与-knowledge-graph-不一样)
- [十六、Branch → Merge](#十六branch--merge)
- [十七、Semantic Zoom](#十七semantic-zoom)
- [十八、地图不是可视化结果，而是认知界面](#十八地图不是可视化结果而是认知界面)
- [十九、AI Context Engine](#十九ai-context-engine)
- [二十、UI结构同时成为 AI Memory 结构](#二十ui结构同时成为-ai-memory-结构)
- [二十一、BYOK](#二十一byok)
- [二十二、Provider Neutral](#二十二provider-neutral)
- [二十三、ThinkingSpace 与传统 Chat 的区别](#二十三thinkingspace-与传统-chat-的区别)
- [二十四、为什么不直接使用传统思维导图](#二十四为什么不直接使用传统思维导图)
- [二十五、为什么不只是 Obsidian + AI](#二十五为什么不只是-obsidian--ai)
- [二十六、为什么不只是 ChatGPT Branch](#二十六为什么不只是-chatgpt-branch)
- [二十七、ThinkingSpace 的真正竞争优势](#二十七thinkingspace-的真正竞争优势)
- [二十八、适合什么场景](#二十八适合什么场景)
- [二十九、不一定适合什么](#二十九不一定适合什么)
- [三十、Progressive Disclosure](#三十progressive-disclosure)
- [三十一、产品精神](#三十一产品精神)
- [三十二、长期愿景](#三十二长期愿景)
- [三十三、产品的一句话定义](#三十三产品的一句话定义)
- [三十四、我们真正想改变的事情](#三十四我们真正想改变的事情)

---

## 一、我们正在解决什么问题

今天绝大多数生成式 AI 产品仍然继承了传统即时通讯软件的基本结构：

```text
用户问题
↓
AI回答
↓
用户继续提问
↓
AI继续回答
↓
不断向下滚动
```

这种形式极其简单，也因此非常成功。

但它存在一个越来越明显的矛盾：

> 🧠 **AI 的能力正在从"回答一个问题"进化为"辅助人类完成复杂学习、研究、创造和决策"，而承载 AI 的交互方式仍然是线性的聊天记录。**

复杂思考从来不是线性的。

真实的人类思维更接近：

```text
一个问题
├─ 一个陌生概念
│  ├─ 为什么？
│  └─ 一个例子
├─ 一个反例
├─ 一个替代方案
└─ 一个新的问题
```

因此真正的问题不是：

> 现在的聊天框是否足够漂亮。

而是：

> ❓ **线性聊天是否仍然是复杂 AI 工作最适合的信息结构？**

ThinkingSpace 对这个问题给出的答案是：

**不是。**

---

## 二、传统 AI Chat 的结构性缺陷

### 1. 对话是线性的，思考不是

传统聊天本质上是一列：

```text
Message[]
```

而研究过程更接近：

```text
Graph
```

当用户在 AI 回答中的三个不同位置分别产生疑问时，传统聊天要求这些问题全部进入同一个时间顺序。

原本存在的语义关系：

```text
概念 A
├ 问题 A1
└ 问题 A2

概念 B
└ 问题 B1
```

最终被压扁为：

```text
A
A1
A2
B
B1
```

信息关系消失了。

---

## 三、上下文污染

假设用户正在学习 Transformer。

AI 回答：

```text
Transformer
包含 Attention、
Positional Encoding、
Feed Forward Network……
```

用户突然对 Attention 中的 QKV 产生疑问。

于是继续追问：

```text
为什么需要 QKV？
```

随后讨论五轮。

当讨论结束，用户原本正在阅读的：

```text
Positional Encoding
```

已经消失在屏幕上方很远的位置。

局部问题侵入了主线。

我们把这个问题称为：

> ⚠️ **Local Question → Global Conversation Pollution**

ThinkingSpace 的目标之一，就是让：

> ✅ **局部探索保持局部。**

---

## 四、空间记忆丢失

传统 Chat 主要利用：

```text
时间顺序
```

帮助用户寻找信息。

但人类记忆并不只有时间。

我们经常记得：

> "那段内容好像在左上角。"

或者：

> "那个概念就在这个分支旁边。"

这属于空间认知。

无限滚动聊天几乎完全放弃了这种能力。

ThinkingSpace 希望重新引入：

**Spatial Memory**

让用户不仅知道：

> "我讨论过这个。"

还知道：

> "它在我的思考空间中的哪个位置。"

---

## 五、Conversation Map

ThinkingSpace 的基本单位不再是 Message。

而是：

**Topic Node**

例如：

```text
                 Transformer
                      │
           ┌──────────┼──────────┐
           │          │          │
       Attention   Position      FFN
           │
       ┌───┴────┐
       │        │
      QKV   Multi-head
```

这不是一张事后自动生成的"漂亮思维导图"。

这张地图本身就是：

> 🗺️ **用户与 AI 进行思考的主要工作空间。**

---

## 六、Card 不是 Message

这是 ThinkingSpace 最重要的设计原则之一：

> 📌 **一条消息不应该成为一个 Node。**

否则：

```text
200 messages
=
200 nodes
```

地图会快速失去意义。

ThinkingSpace 中：

```text
Node = 一个认知主题
```

例如：

```text
┌────────────────────────┐
│ Multi-head Attention   │
│                        │
│ 为什么需要多个 Head？  │
│                        │
│ 6 turns                │
│ 3 branches             │
└────────────────────────┘
```

Node 内部仍然可以拥有：

```text
Q
A
Q
A
Q
A
```

因此：

**Conversation 属于 Topic。**

而不是：

**Topic 被 Conversation 顺序绑架。**

---

## 七、Map View 与 Focus View

ThinkingSpace 拥有两个核心空间尺度。

### 🗺️ Map View

回答：

> "我的整个思考现在是什么结构？"

用户能够看到：

```text
项目
↓
主题
↓
分支
↓
关系
```

### 🔍 Focus View

回答：

> "我现在正在深入研究什么？"

点击一个 Card：

```text
Map
↓
Card
↓
全屏展开
```

进入完整沉浸式对话。

因此用户获得：

```text
全局结构
+
局部沉浸
```

而不需要二选一。

---

## 八、返回地图不是简单导航

传统网页：

```text
Page A
→
Page B
```

ThinkingSpace 希望建立：

**空间连续性**

用户从：

```text
Multi-head Attention
```

返回地图时，理想体验不是突然切屏。

而是：

```text
全屏内容
↓
逐渐缩回 Card
↓
周围节点重新出现
```

让用户理解：

> "我刚才就在这里。"

这种动画不是装饰。

它承担的是：

**认知定位功能。**

---

## 九、Inline Selection

用户在 Focus View 中阅读 AI 回答：

```text
The attention score is scaled by √dₖ.
```

用户可以直接选中：

```text
√dₖ
```

出现：

```text
Explain
Ask
Branch
```

此时问题拥有非常精确的语义锚点。

AI 不再需要猜测：

> "用户说的'这里'究竟指哪里？"

---

## 十、Quick Question 与 Branch 的区别

不是每个疑问都值得进入地图。

ThinkingSpace 区分：

```text
Quick Question
```

和：

```text
Topic Branch
```

一个很小的问题：

```text
"这个符号是什么意思？"
```

可以只出现短暂的 Inline Bubble。

如果用户继续深入：

```text
为什么？
↓
数学依据是什么？
↓
Transformer具体怎么算？
```

那么这个问题已经发生：

```text
Question
→
Exploration
→
Topic
```

此时系统允许：

```text
Convert to Branch
```

地图才增加新节点。

---

## 十一、渐进式结构化

这产生了 ThinkingSpace 一个非常独特的理念：

> 💡 **用户不需要提前决定信息结构。**

而是：

```text
产生疑问
↓
探索
↓
问题自然变大
↓
系统帮助形成结构
```

我们称之为：

**Progressive Structuring**

传统知识管理软件常常要求：

> 用户先分类，才能思考。

ThinkingSpace 希望反过来：

> 用户先思考，结构随后形成。

---

## 十二、Branch 是一等公民

传统 Chat 中：

```text
继续追问
```

意味着：

```text
继续向下
```

ThinkingSpace 中：

```text
继续追问
```

可以意味着：

```text
继续当前 Topic
```

也可以意味着：

```text
产生 Branch
```

例如：

```text
Attention
├ QKV
├ Softmax
└ Multi-head
```

用户第一次拥有真正与思维结构对应的 AI Conversation。

---

## 十三、Branch Anchor

Branch 不只是：

```text
Node A → Node B
```

它应该知道：

> Node B 是从 Node A 的哪一句话产生的。

因此每一个 Branch 可以携带：

```text
source node
source message
selected text
context summary
```

这意味着：

```text
知识结构
```

和：

```text
原始推理过程
```

之间仍然保持连接。

---

## 十四、Conversation Graph

随着项目成长：

```text
Tree
```

最终可能演变为：

```text
Graph
```

因为知识不是严格树形的。

例如：

```text
Transformer ──────┐
                  ▼
               Attention
                  ▲
Diffusion ────────┘
```

因此 ThinkingSpace 的数据设计应该允许：

```text
branch
reference
dependency
contrast
example
```

等多种 Edge。

---

## 十五、Conversation Graph 与 Knowledge Graph 不一样

> ⭐ 这是项目未来最重要的研究方向之一。

Conversation Graph 描述：

> "我是怎样想到这里的？"

Knowledge Graph 描述：

> "这些概念客观上是什么关系？"

例如：

```text
Conversation Graph

Main Question
├ 为什么 Attention？
│ └ 为什么 Softmax？
└ Position Encoding 是什么？
```

而：

```text
Knowledge Graph

Transformer
├ Attention
│ ├ Query
│ ├ Key
│ ├ Value
│ └ Softmax
└ Position Encoding
```

前者保存：

```text
Thinking Process
```

后者保存：

```text
Knowledge Structure
```

ThinkingSpace 未来可以让 AI 在两者之间进行转换。

---

## 十六、Branch → Merge

传统聊天擅长：

```text
继续
```

但不擅长：

```text
汇合
```

假设用户探索：

```text
Transformer
├ QKV
├ Positional Encoding
└ Residual Connection
```

完成以后：

```text
Merge Insights
```

AI 可以将三个分支重新总结为：

```text
当前对 Transformer 的整体理解
```

并回写父节点。

这非常接近软件开发中的：

```text
branch
↓
work
↓
merge
```

ThinkingSpace 将其转换为：

**认知工作流。**

---

## 十七、Semantic Zoom

当节点越来越多，一个简单的 Graph 必然失控。

ThinkingSpace 不应该显示：

```text
100个同等大小的 Node
```

而应该采用类似地图的语义缩放。

远距离：

```text
AI
Frontend
Product Design
```

稍微靠近：

```text
AI
├ LLM
├ Agent
└ Diffusion
```

继续靠近：

```text
LLM
├ Transformer
├ Training
├ Tokenizer
└ Alignment
```

继续：

```text
Transformer
├ Attention
├ FFN
└ Position
```

也就是：

```text
Project
↓
Topic
↓
Concept
↓
Conversation
```

空间缩放同时成为：

**语义缩放。**

---

## 十八、地图不是可视化结果，而是认知界面

很多产品拥有：

```text
Graph View
```

但 Graph 只是：

> "把数据画出来看看。"

ThinkingSpace 的不同是：

> 🎯 **Graph 本身就是主要交互空间。**

用户直接在图上：

```text
进入 Topic
创建 Branch
重新组织
比较
跳转
继续推理
```

所以这是：

**Map as Interface**

而不是：

**Map as Visualization**

---

## 十九、AI Context Engine

ThinkingSpace 的树形/图形结构还可以解决 LLM 工程中的一个实际问题：

**Context Management**

传统长对话经常采用：

```text
Conversation History
↓
全部发送给模型
```

这会产生：

```text
Token成本增长
上下文噪声
无关信息
注意力分散
```

ThinkingSpace 可以根据结构构建上下文：

```text
Project Summary
↓
Ancestor Topics
↓
Parent Summary
↓
Current Conversation
↓
Branch Anchor
↓
Current Prompt
```

例如用户位于：

```text
AI
↓
Transformer
↓
Attention
↓
QKV
```

模型重点看到这条路径。

而不是：

```text
整个 Project 的所有历史
```

---

## 二十、UI结构同时成为 AI Memory 结构

这是 ThinkingSpace 非常独特的一点。

很多产品：

```text
UI结构
```

和：

```text
LLM Memory结构
```

是两个完全独立的系统。

ThinkingSpace 中：

```text
用户看到的 Topic Tree
```

本身可以参与：

```text
Context Retrieval
```

因此：

> 🔗 **信息架构、用户认知结构、模型上下文结构第一次可以高度一致。**

---

## 二十一、BYOK

ThinkingSpace 计划采用：

**Bring Your Own Key**

用户可以提供自己的：

```text
DeepSeek
OpenAI
Anthropic
OpenRouter
Custom Provider
```

API Key。

这意味着产品不需要：

```text
为每个用户承担推理成本
```

同时高级用户拥有更强控制权。

---

## 二十二、Provider Neutral

产品内部不应该：

```text
ThinkingSpace = DeepSeek客户端
```

而应该：

```text
ThinkingSpace
↓
AI Provider Layer
├ DeepSeek
├ OpenAI
├ Anthropic
├ OpenRouter
└ Custom
```

DeepSeek 只是第一家 Provider。

由于 DeepSeek 当前官方 API 提供兼容 OpenAI/Anthropic 的调用格式，这种抽象在工程上具备良好可行性。

---

## 二十三、ThinkingSpace 与传统 Chat 的区别

| 传统产品 | ThinkingSpace |
| :--- | :--- |
| `Conversation = Product` | `Conversation = Knowledge Node内部的一种交互` |
| **Time First** | **Structure First** |
| Scroll | Navigate |
| History | Space |
| 继续往下聊 | 深入、分支、跳转、合并、回顾 |

---

## 二十四、为什么不直接使用传统思维导图

ThinkingSpace 也不是普通 Mind Map。

传统思维导图：

```text
Node = 用户自己写出的总结
```

ThinkingSpace：

```text
Node = 一个可以继续与 AI 深入工作的活对象
```

节点不是标签。

节点是：

```text
Conversation Container
+
Context
+
Memory
+
AI Interface
+
Knowledge Object
```

---

## 二十五、为什么不只是 Obsidian + AI

传统知识管理：

```text
先写笔记
↓
再建立链接
```

ThinkingSpace：

```text
对话产生
↓
问题分支
↓
结构自动形成
```

重点不是：

> 管理已经写好的知识。

而是：

> ✨ **管理正在形成的思维。**

---

## 二十六、为什么不只是 ChatGPT Branch

简单 Conversation Branching 解决：

> "我能否从过去某一条消息创建另一条路线？"

但 ThinkingSpace 更进一步：

```text
Branch
↓
Topic Node
↓
Map
↓
Spatial Navigation
↓
Context Engine
↓
Semantic Zoom
↓
Merge
```

Branch 不是附属功能。

它是整个产品的数据基本单位之一。

---

## 二十七、ThinkingSpace 的真正竞争优势

不是某一个按钮。

而是几个机制组合后形成新的范式：

```text
Topic-based Conversation
+
Map-based Navigation
+
Inline Anchoring
+
Branching
+
Focus Mode
+
Structural Context
+
Progressive Structuring
```

单独任何一个功能都可能已经存在。

但它们组合后产生：

> 🚀 **一种真正围绕复杂思考，而不是围绕消息流设计的 AI Workspace。**

---

## 二十八、适合什么场景

ThinkingSpace 特别适合：

```text
复杂学习
论文阅读
技术研究
产品设计
软件架构
创意发散
哲学讨论
知识探索
Debug
战略分析
研究项目
长期 AI 协作
```

这些任务共同特点是：

> **问题会产生问题。**

---

## 二十九、不一定适合什么

如果用户只是：

```text
今天天气怎么样？
```

传统 Chat 更好。

如果只是：

```text
帮我把这句话改礼貌一点。
```

传统 Chat 更高效。

所以 ThinkingSpace 不是为了消灭 Chat。

而是认为：

> 💬 **Chat 是优秀的最小交互界面，但不应该是所有 AI 工作的最大交互界面。**

---

## 三十、Progressive Disclosure

因此第一眼依然应该简单。

用户最开始看到：

```text
一个 Topic
+
一个输入框
```

随着探索：

```text
Topic
↓
Branch
↓
Map
↓
Graph
```

复杂性随着需求出现。

不是一打开软件就面对：

```text
100个按钮
20种节点
复杂关系编辑器
```

---

## 三十一、产品精神

ThinkingSpace 不应该成为：

```text
一个看起来很酷的 Node Editor
```

而应该成为：

> 🌱 **一个让人更容易思考的空间。**

因此设计应坚持：

```text
内容优先
阅读优先
认知优先
空间连续
克制
长期耐看
低视觉噪声
```

避免：

```text
俗套赛博朋克
过多发光
无意义渐变
过度动画
Graph炫技
```

地图不是为了炫耀技术。

地图是为了：

> 🧭 **帮用户找到自己。**

---

## 三十二、长期愿景

今天的生成式 AI：

```text
Human
↓
Prompt
↓
AI
↓
Response
```

ThinkingSpace 希望演化为：

```text
Human
        ↘
     Shared Thinking Space
        ↗
AI
```

人与 AI 不再只是交换消息。

而是共同操作：

```text
问题
概念
关系
分支
证据
反例
结论
```

这些认知对象。

---

## 三十三、产品的一句话定义

> **ThinkingSpace 是一个以 Topic 为基本认知单元、以 Branch 为思考扩展机制、以 Map 为全局导航界面、以 AI 为协作伙伴的非线性思维工作空间。**

更简短的版本：

> **ThinkingSpace turns AI conversations into a navigable space for thought.**

中文：

> **让 AI 对话从一条时间线，变成一个可以探索的思维空间。**

---

## 三十四、我们真正想改变的事情

传统聊天保存的是：

```text
我和 AI 说过什么。
```

ThinkingSpace 希望保存的是：

```text
我是怎样想到这里的。
```

再进一步：

```text
我的理解最终形成了什么结构。
```

这正是 **Conversation History** 和 **Thinking History** 之间的区别。

ThinkingSpace 真正试图构建的不是：

**更好的聊天记录。**

而是：

> 🏁 **可导航、可继续、可重组、可扩展的人机共同思考空间。**

---

<div align="center">

**— 文档结束 —**

</div>
