# 前端页面重构指引

适用 React + Next.js App Router 页面的**纯重构**：不改 UI/UX、不改业务逻辑，只调整代码组织，让臃肿的 `page.tsx` 或大型容器变得好读、好改、好测。

## 不变量

重构 PR 不引入任何业务/UX 变更。验证时重点对齐：

- JSX 输出等价：className、aria-label、属性、子节点、条件分支逐字保留。
- React rules of hooks：调用顺序、useEffect 触发条件、useCallback/useMemo 依赖项与原代码等价（或更窄）。
- 回调签名不变：传给子组件的回调参数和语义保持原样。
- 早期 return 分支保留：loading / not-found / 错误态不能被"顺手简化"掉。
- 中文语义注释保留：`// 历史加载失败不阻塞主流程` 这类标注业务意图的注释不要删。

## 拆分思路

按"关注点"切，不要按行数切。一个页面常见的关注点：

- **路由参数**：从 `useParams` / `useSearchParams` 取的输入。
- **数据获取**：useQuery / SWR 等。
- **派生状态**：基于查询结果计算出的 ready/canChat/statusSummary 之类。
- **副作用聚合**：URL 同步、历史加载、滚动恢复等 useEffect。
- **局部状态机**：弹窗开关、当前选中项、source panel 状态等。
- **视觉块**：header、loading 骨架、空状态、消息流等。
- **容器编排**：把上面这些 hook 和组件粘起来的地方。

常见命名约定（同模块下放 `features/<feature>/`）：

```
page.tsx              路由薄壳，只取参数渲染 Client
<feature>-client.tsx  容器编排
<feature>-<part>.tsx  视觉块（header / loading / empty 等）
use-<feature>-<x>.ts  custom hook
<feature>-prompts.ts  常量
```

行数仅供参考，不当硬指标。路由薄壳通常几十行；容器在 100-200 行范围内都合理；视觉组件和 hook 通常自然落在 50-100 行。AI 自己根据职责判断。

## 复用优先

在抽新 hook 或定义新 interface 之前，先搜一下是不是已经有现成的：

```bash
grep -rn "queryKey.*\['<entity>'," apps/web/src
grep -rn "interface <Entity>\|type <Entity>" apps/web/src
```

generated client（`@devbrain/api/client`）通常已经导出业务实体类型，优先复用 generated 类型而不是新造 `XxxInfo` 这种 minimal interface。复用既有 hook + generated 类型 = 一次重构同时消掉一个重复点。

## 步骤

1. **读现状**：把目标文件读完，列出页面承担的所有关注点。
2. **粒度对齐**：给用户 2-3 个粒度候选（小/中/大），preview 用文件树展示，默认推荐中粒度。
3. **底向上落地**：常量 → hooks → 视觉组件 → 容器 → 路由薄壳。底向上能避免向前依赖、便于增量验证。
4. **类型 export 不复制**：原文件内部 interface 如果要被新 hook 引用，加 `export type { ... }`，不要在新文件里再写一遍。
5. **三件套验证**：`typecheck` + `lint` + `test` 全过才算完。
6. **git diff 自检**：对照 JSX 块（className 是否逐字保留）、依赖项数组（合并 effect 后是否等价）、回调签名。
7. **commit**：`refactor:` 前缀，body 一句话写明业务/UX 不变。

## 别做的事

- 抽离只调用一次、和某个 hook 状态紧耦合的小回调（如 handleSend 只用一次又依赖 streamContext，单独抽 hook 反而割裂上下文）。
- 把没有 state、没有副作用的纯 JSX 子块拆出来，结果接 10+ props，造成 prop drilling。
- 用 Context 替代 1-2 层组件树的 prop 传递，引入不必要的 re-render 边界。
- 看到顺手能改的 UI/UX 小问题就一起改了。下一个 PR 处理。
- 删保留性注释、改回调参数顺序、调整 useEffect 依赖以"看起来更干净"。

## 与 OpenSpec 的边界

纯重构不进 OpenSpec apply 流程。重构过程中如果发现需要改 schema / API 契约 / 鉴权 / 性能预算，停下来，开 OpenSpec change 单独处理，不要混进重构 PR。

## 案例

| 案例                  | 重构对象                          | 主要产出                                                                                                                                                                |
| --------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| commit `6a5ea3a`      | `kb/[id]/page.tsx` 575 行         | `kb-detail-client.tsx` / `kb-detail-header.tsx` / `kb-detail-sidebar.tsx` / `kb-detail-states.tsx` / `kb-documents-workspace.tsx` / `use-kb-detail.ts` / format & prompts |
| chat 页拆分           | `kb/[id]/chat/page.tsx` 256 行    | `page.tsx` 20 行薄壳 + `chat-client.tsx` 143 行容器 + 三个 hook（citation / conversation / kb-status）+ header / loading 视觉块 + prompts 常量                          |

需要对照具体怎么拆时，看这两个 commit 的 diff 就够，不必依赖本文档的细则。
