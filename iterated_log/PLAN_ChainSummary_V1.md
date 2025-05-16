# AI链总结文档框架 - 开发计划 V1

本文档基于 `PRD_AI增强功能_V1.md` 中对"阶段二 (迭代 2.2): AI链总结文档框架"的定义，并结合当前项目代码的实际情况和技术选型，制定详细的开发计划。

**核心目标：** 实现基于整个思维链节点信息（包括标题、用户笔记、AI单节点摘要、顺序等）生成总结性AI报告的功能。

---

## 1. 数据模型扩展 (`js/models.js`)

*   **任务:** 在 `ThoughtChain` 类（或其创建函数）中添加新属性 `chainSummaryDoc`。
*   **实现:**
    *   `this.chainSummaryDoc = '';` (或 `null`) 作为默认值。
*   **PRD对应:** 4.1

## 2. 存储层 (`js/storage.js`)

*   **任务:** 在 `storageService` 中实现以下两个新方法：
    *   `async updateChainSummaryDoc(chainId, summaryDoc)`: 保存指定链的总结文档。
    *   `async getChainSummaryDoc(chainId)`: 获取指定链的总结文档。
*   **实现细节:**
    *   `updateChainSummaryDoc`:
        1.  调用 `this.getChains()` 获取所有链数据。
        2.  找到 `chainId` 对应的链对象。
        3.  如果找到，更新其 `chainSummaryDoc` 属性为传入的 `summaryDoc`。
        4.  调用 `chrome.storage.local.set({ thoughtChains: updatedChains })` 保存。
        5.  返回操作成功与否的标志。
    *   `getChainSummaryDoc`:
        1.  调用 `this.getChains()`。
        2.  找到 `chainId` 对应的链对象。
        3.  如果找到，返回其 `chainSummaryDoc`；否则返回 `null` 或空字符串。
*   **PRD对应:** 4.2

## 3. 用户界面 - 控件添加 (`visualize.html`)

*   **任务:** 在思维链可视化界面的控件区域添加一个新的按钮，用于触发"生成/查看总结报告"。
*   **实现:**
    *   在 `visualize.html` 中，例如在 `id="controls"` 的 `div` 内，添加：
        ```html
        <button id="generateChainSummaryBtn" title="生成/查看本链总结报告">链总结</button>
        ```
    *   （可选）为此按钮添加适当的CSS样式或图标。
*   **PRD对应:** 4.3

## 4. 用户界面 - 报告显示区域 (`visualize.html`)

*   **任务:** 在 `visualize.html` 中添加一个默认隐藏的区域，用于显示生成的链总结报告。
*   **实现:**
    *   添加类似如下的HTML结构（可以放在页面底部或一个可弹出的模态框内）：
        ```html
        <div id="chainSummaryModal" class="modal" style="display:none; /* 其他模态框样式 */">
          <div class="modal-content">
            <span class="close-button" id="closeChainSummaryModal" title="关闭">&times;</span>
            <h2>思维链总结报告</h2>
            <div id="chainSummaryContent" style="white-space: pre-wrap; max-height: 70vh; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin-top: 10px; background-color: #f9f9f9;">
              <!-- 报告内容将填充此处 -->
            </div>
            <!-- 也可以考虑使用 <textarea readonly> 代替 div -->
          </div>
        </div>
        ```
    *   需要配合一些基础的CSS来实现模态框的显示/隐藏和样式。
*   **PRD对应:** 4.6 (显示区域部分)

## 5. 前端逻辑 - 按钮交互与消息处理 (`visualize.js`)

*   **任务:** 实现点击"生成/查看总结报告"按钮后的逻辑，包括与后台通信、控制报告显示区域。
*   **实现细节:**
    *   获取 `#generateChainSummaryBtn` 和 `#closeChainSummaryModal` 的DOM引用。
    *   为 `#generateChainSummaryBtn` 添加 `click` 事件监听器：
        1.  获取当前选中的思维链 `selectedChainId`。
        2.  如果未选中链，则提示用户先选择一个链。
        3.  向 `background.js` 发送消息：`{ action: "getChainSummaryDoc", chainId: selectedChainId }`。
        4.  在消息回调中：
            *   如果 `response.success` 且 `response.summaryDoc` 存在且不为空，则调用 `showChainSummary(response.summaryDoc)` (见下一步)。
            *   否则（例如，`summaryDoc` 为空或获取失败），则准备请求生成新的总结：
                *   显示加载指示（例如，按钮文字变为"生成中..."或显示一个加载动画）。
                *   从 `currentChainData.nodes` (或类似变量) 收当前链的所有节点数据。
                *   向 `background.js` 发送消息：`{ action: "requestChainSummary", chainId: selectedChainId, nodes: nodesArray }`。
                    *   `nodesArray` 中每个节点对象应包含: `id`, `title`, `url`, `notes`, `aiSummary`。
                *   在生成请求的消息回调中：
                    *   隐藏加载指示。
                    *   如果 `response.success` 且 `response.generatedDoc` 存在，则调用 `showChainSummary(response.generatedDoc)`。
                    *   如果失败，显示错误提示（例如，在模态框内或通过 `alert`）。
    *   创建函数 `showChainSummary(summaryDoc)`:
        1.  将 `summaryDoc` 填充到 `#chainSummaryContent` 的 `innerHTML` 或 `textContent` (如果用 `textarea` 则是 `.value`)。
        2.  设置 `#chainSummaryModal` 的 `display` 为 `block` (或相应的显示样式)。
    *   为 `#closeChainSummaryModal` 添加 `click` 事件监听器，将 `#chainSummaryModal` 的 `display` 设置为 `none`。
*   **PRD对应:** 4.4, 4.6 (交互部分)

## 6. 后台逻辑 - 消息处理 (`background.js`)

*   **任务:** 在 `background.js` 的主消息监听器中，添加对新 `action` 的处理：
    *   `getChainSummaryDoc`: 处理来自前端的获取已存总结的请求。
    *   `requestChainSummary`: 处理来自前端的生成新总结的请求。
*   **实现细节 (`getChainSummaryDoc`):**
    1.  接收 `message.chainId`。
    2.  调用 `storageService.getChainSummaryDoc(message.chainId)`。
    3.  通过 `sendResponse({ success: true, summaryDoc: docFromStorage })` 返回结果。
    4.  添加 `try...catch` 块处理潜在错误。
*   **实现细节 (`requestChainSummary`) - AI调用前的准备:**
    1.  接收 `message.chainId` 和 `message.nodes`。
    2.  **构造输入文本：** 遍历 `message.nodes` 数组（按原始顺序）。对每个节点，提取其 `title`, `notes`, `aiSummary` (单节点AI摘要), `url`。
    3.  将这些信息整合成一个大的字符串。例如，每个节点信息块以分隔符 `---` 分隔。
        ```
        节点 1: [节点1标题]
        用户笔记: [节点1用户笔记内容 或 "无"]
        AI单节点摘要: [节点1AI摘要内容 或 "无"]
        原始链接: [节点1URL]
        ---
        节点 2: [节点2标题]
        用户笔记: [节点2用户笔记内容 或 "无"]
        AI单节点摘要: [节点2AI摘要内容 或 "无"]
        原始链接: [节点2URL]
        ---
        ...
        ```
    4.  **设计Prompt:** 创建一个引导LLM进行链总结的Prompt。
        ```
        "请仔细分析以下按顺序排列的思维链节点信息。每个节点代表用户浏览和思考的一个步骤，可能包含用户笔记和AI对该节点内容的初步摘要。请基于所有这些信息，生成一篇连贯、深入的总结性报告。这份报告应能清晰地梳理出用户的思考脉络，总结主要观点和发现，探讨不同节点之间的内在联系，并尝试提炼出潜在的结论、洞见或后续值得探索的方向。

以下是详细的节点信息：

[此处嵌入上面构造的节点信息汇总字符串]

请根据以上全部内容，生成一份结构清晰、内容丰富的总结报告："
        ```
*   **PRD对应:** 4.5 (后台逻辑部分)

## 7. 后台逻辑 - AI链总结生成与存储 (`background.js`)

*   **任务:** 在 `handleRequestChainSummary` 中，调用AI服务生成总结，并将结果存储。
*   **实现细节:**
    1.  获取 `OPENAI_API_KEY` 和 `AI_CONFIG` (可能需要为链总结设定特定的配置，如更长的 `maxOutputTokens`，或不同的模型)。
    2.  调用 `callOffscreenToGenerateSummary` (或为此功能创建一个新的类似函数，例如 `callOffscreenToGenerateChainSummary`)，将整合后的文本和设计的Prompt作为输入，传递给Offscreen Document。
        *   可能需要修改 `offscreen_langchain_handler.js` 和 `js/lib/langchain/langchain-adapter.js` 以支持更长的文本处理或不同的链类型（如果 `map_reduce` 不足以处理极长的链）。
        *   或者，如果文本过长，考虑在 `background.js` 中对整合后的节点信息进行初步分块，然后多次调用Offscreen Document，最后再整合各个部分的摘要（这将更复杂，初期可先尝试直接传递整个文本）。
    3.  在收到 Offscreen Document 返回的成功摘要后，调用 `storageService.updateChainSummaryDoc(message.chainId, generatedSummaryDoc)`。
    4.  通过 `sendResponse({ success: true, generatedDoc: generatedSummaryDoc })` 将新生成的总结返回给前端。
    5.  **错误处理:**
        *   如果AI调用失败，捕获错误。
        *   调用 `storageService.updateChainSummaryDoc(message.chainId, "AI链总结生成失败: " + error.message)` 将错误信息存入。
        *   通过 `sendResponse({ success: false, error: error.message })` 返回错误。
*   **PRD对应:** 4.5 (AI调用与存储部分)

---

## 开发顺序建议 (Development Order Proposal)

1.  **后端数据层准备 (1-2小时):**
    *   **步骤 1.1:** 修改 `js/models.js` 中的 `ThoughtChain`，添加 `chainSummaryDoc` 属性。
    *   **步骤 1.2:** 在 `js/storage.js` 中实现 `updateChainSummaryDoc` 和 `getChainSummaryDoc` 方法。
    *   **测试:** 编写简单的单元测试或在Service Worker控制台手动调用验证这两个存储方法。

2.  **UI骨架搭建 (1-2小时):**
    *   **步骤 2.1:** 在 `visualize.html` 中添加"生成/查看总结报告"按钮 (`#generateChainSummaryBtn`)。
    *   **步骤 2.2:** 在 `visualize.html` 中添加用于显示报告的模态框结构 (`#chainSummaryModal`, `#chainSummaryContent`, `#closeChainSummaryModal`) 并设置基础CSS使其默认隐藏。

3.  **后台消息处理框架 (2-3小时):**
    *   **步骤 3.1:** 在 `background.js` 的消息监听器中添加对 `getChainSummaryDoc` action的处理。使其能正确调用 `storageService.getChainSummaryDoc` 并返回结果。
    *   **步骤 3.2:** 在 `background.js` 的消息监听器中添加对 `requestChainSummary` action的处理框架。先实现接收 `chainId` 和 `nodesData`，并能将 `nodesData` 按预想格式打印到控制台。AI调用部分暂时返回一个固定的模拟总结字符串。

4.  **前端交互逻辑 - 获取与显示已存报告 (2-3小时):**
    *   **步骤 4.1:** 在 `visualize.js` 中为 `#generateChainSummaryBtn` 添加点击事件。
    *   **步骤 4.2:** 实现点击后，向 `background.js` 发送 `getChainSummaryDoc` 消息的逻辑。
    *   **步骤 4.3:** 实现 `showChainSummary(summaryDoc)` 函数，用于将内容填充到 `#chainSummaryContent` 并显示模态框。
    *   **步骤 4.4:** 实现关闭模态框的逻辑。
    *   **测试:** 手动在 `storageService` 中为某个链预设一个 `chainSummaryDoc`，然后通过UI按钮触发，看是否能正确显示。

5.  **核心AI集成 - 链总结生成 (4-6小时，最具挑战性):**
    *   **步骤 5.1:** 在 `background.js` 的 `handleRequestChainSummary` 中，实现将 `nodesData` 构造成长文本输入和设计链总结Prompt的逻辑。
    *   **步骤 5.2:** 调整或创建新的函数 (如 `callOffscreenToGenerateChainSummary`)，使其能够将此长文本和新Prompt传递给Offscreen Document进行AI处理。
        *   这可能需要评估 `langchain-adapter.js` 中现有摘要链（如 `map_reduce`）对这种超长、结构化文本的适应性，或者研究Langchain是否有更适合此类任务的链或方法。
        *   关注Offscreen Document处理长文本的潜在性能和内存限制。
    *   **步骤 5.3:** 在 `background.js` 中处理来自Offscreen Document的AI总结结果，并调用 `storageService.updateChainSummaryDoc` 进行存储。
    *   **测试:** 使用包含多个节点（其中一些有用户笔记和AI单节点摘要）的真实思维链进行测试。重点评估生成总结的质量、连贯性和是否能体现思考脉络。根据结果迭代优化Prompt和节点信息整合方式。

6.  **前端交互逻辑 - 请求生成新报告与错误处理 (2-3小时):**
    *   **步骤 6.1:** 在 `visualize.js` 中，完善 `#generateChainSummaryBtn` 点击事件：当 `getChainSummaryDoc` 返回空或失败时，触发向 `background.js` 发送 `requestChainSummary` 消息的逻辑。
    *   **步骤 6.2:** 实现请求生成时的加载状态提示。
    *   **步骤 6.3:** 处理 `requestChainSummary` 返回的结果，无论是成功生成的文档还是错误信息，都能在UI上恰当显示 (例如，成功则调用 `showChainSummary`，失败则在模态框内显示错误或用 `alert`)。

7.  **端到端测试、错误处理完善与细节优化 (3-4小时):**
    *   全面测试各种情况：空链、只有一个节点的链、节点很多的长链、节点信息不完整（如无笔记或无单节点摘要）等。
    *   完善 `background.js` 中AI调用链条上的错误捕获和传递。
    *   优化UI反馈和模态框的交互体验。

**预估总工作量 (粗略):** 约 15-26 小时。核心AI集成部分的不确定性较大，可能需要更多时间进行调试和优化。

---

这份计划文档应该能为我们接下来的开发提供清晰的指引。 