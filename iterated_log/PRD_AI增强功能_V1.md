# 产品需求文档 (PRD): AI 增强功能 V1

**1. 引言 (Introduction)**

*   **1.1 项目背景:**
    思维链记录插件已具备基础的记录、可视化和管理功能。为进一步提升插件的核心价值——"让灵感瞬间连接成系统知识"，本次迭代旨在引入AI能力，通过内容摘要和智能报告生成，帮助用户更深刻、高效地理解和利用其记录的思维链。
*   **1.2 本次迭代范围 (分阶段):**
    *   **阶段一 (迭代 2.1): AI单节点摘要框架**
        *   实现对单个思维节点URL内容的AI摘要功能框架。
        *   在节点悬停提示中展示AI摘要。
        *   *注：本阶段AI调用为模拟/桩代码，重点是搭建前后端数据流和UI展示。*
    *   **阶段二 (迭代 2.2): AI链总结文档框架**
        *   实现基于整个思维链节点信息生成总结性文档的AI功能框架。
        *   提供界面展示生成的总结文档。
        *   *注：本阶段AI调用为模拟/桩代码。后续考虑支持用户编辑和基于指令重新生成。*
*   **1.3 名词解释:**
    *   **AI单节点摘要 (Node AI Summary):** 由AI服务针对单个思维节点对应的URL内容生成的简短文本摘要。
    *   **AI链总结文档 (Chain Summary Document):** 由AI服务基于整个思维链的所有节点信息（包括标题、用户笔记、单节点摘要、顺序等）生成的连贯性分析报告或总结文章。

**2. 用户故事 (User Stories)**

*   **2.1 单节点摘要:**
    *   "作为一名用户，我希望在鼠标悬停查看某个思维节点时，能快速看到AI对该网页核心内容的简短总结，以便我能迅速回忆起该节点的关键信息，而无需重新打开网页阅读。"
*   **2.2 链总结文档:**
    *   "作为一名用户，我希望能一键让AI帮我分析整个思维链，并生成一篇总结性的文章或报告，它能梳理出我的思考脉络、主要发现和潜在结论，帮助我深化理解和沉淀知识。"
    *   "作为一名用户，我希望生成的思维链总结报告能与思维链绑定保存，并且我可以对它进行编辑修改，或者在提供一些新的方向后让AI重新生成。" (编辑与重新生成为后续增强点)

**3. 功能详述 (Feature Specifications) - 阶段一: AI单节点摘要框架 (迭代 2.1)**

*   **3.1 数据模型扩展 (`ThoughtNode`)**
    *   在 `js/models.js` 中定义的 `ThoughtNode` 对象结构中，增加一个新属性：
        *   `aiSummary: string` (默认为空字符串 `""` 或 `null`)
*   **3.2 存储层 (`js/storage.js`)**
    *   `addNodeToChain`: 新添加的节点，其 `aiSummary` 属性初始化为空。
    *   新增方法 `async updateNodeAISummary(chainId, nodeId, summary)`: 用于将AI生成的摘要更新到指定的节点并保存。
*   **3.3 后台逻辑 (`background.js`) - AI摘要获取 (模拟)**
    *   预留接口/消息处理，例如 `handleRequestNodeSummary(nodeId, chainId)`。
    *   在此接口内部：
        *   **模拟AI调用:** 暂时不进行真实的外部AI API调用。
        *   **模拟延迟 (可选):** 可以使用 `setTimeout` 模拟AI处理所需的时间。
        *   **返回示例摘要:** 返回一个固定的、预设的文本作为摘要，例如："这是一个AI生成的关于[节点标题]的示例摘要内容..."
        *   调用 `storageService.updateNodeAISummary()` 将此示例摘要存入对应节点。
    *   **触发时机 (暂定简单化):** 为了先搭建框架，AI摘要的生成请求可以暂时不由用户操作触发，而是在 `addNodeToChain` 成功后，由 `background.js` 内部"自动"调用（带有模拟延迟和示例摘要）。或者，在可视化加载链时，如果发现 `aiSummary` 为空，则"补充"一个示例摘要。
*   **3.4 前端显示 (`visualize.js` & `visualize.html`)**
    *   在 `visualize.js` 的 `showTooltip` 函数中：
        *   检查当前悬停的节点数据是否包含 `aiSummary` 属性并且其值不为空。
        *   如果存在，则在Tooltip现有的标题、URL、笔记下方，新增一个区域专门显示此 `aiSummary`。
        *   例如，在 `visualize.html` 中Tooltip的HTML结构模板中预留一个 `div` 给AI摘要：`<div class="tooltip-ai-summary"></div>`，然后由 `showTooltip` 填充。

**4. 功能详述 (Feature Specifications) - 阶段二: AI链总结文档框架 (迭代 2.2)**

*   **4.1 数据模型扩展 (`ThoughtChain`)**
    *   在 `js/models.js` 中定义的 `ThoughtChain` 对象结构中，增加一个新属性：
        *   `chainSummaryDoc: string` (默认为空字符串 `""` 或 `null`)
        *   *(后续可扩展为对象: `{ content: "", version: 1, lastGenerated: timestamp, userEdits: "" }`)*
*   **4.2 存储层 (`js/storage.js`)**
    *   新增方法 `async updateChainSummaryDoc(chainId, summaryDoc)`: 用于保存AI生成的或用户编辑后的链总结文档。
    *   新增方法 `async getChainSummaryDoc(chainId)`: 用于获取指定链的总结文档。
*   **4.3 用户界面 (`visualize.html`)**
    *   在 "思维链可视化" 界面的控件区域，添加一个新按钮，例如 "生成/查看总结报告"。
*   **4.4 前端逻辑 (`visualize.js`)**
    *   为 "生成/查看总结报告" 按钮添加事件监听。
    *   点击时：
        *   获取当前选中的 `chainId`。
        *   从 `storageService.getChainSummaryDoc(chainId)` 尝试加载已有的总结报告。
        *   如果已存在，则直接显示。
        *   如果不存在，则收集当前思维链的所有节点数据（包括标题、URL、用户笔记，以及阶段一实现的 `aiSummary`），然后发送消息给 `background.js` 请求生成，例如 `{ action: "requestChainSummary", chainId: selectedChainId, nodesData: [...] }`。
*   **4.5 后台逻辑 (`background.js`) - AI链总结生成 (模拟)**
    *   预留接口/消息处理，例如 `handleRequestChainSummary(chainId, nodesData)`。
    *   在此接口内部：
        *   **模拟AI调用:** 不进行真实调用。
        *   **返回示例总结:** 基于 `nodesData` 的数量或内容，返回一个固定的、预设的总结性文本。例如："这是基于您思维链中 X 个节点生成的AI总结报告。它探讨了从 [第一个节点标题] 到 [最后一个节点标题] 的思考过程..."
        *   调用 `storageService.updateChainSummaryDoc()` 将示例总结存入对应思维链。
*   **4.6 前端显示与交互 (`visualize.js` & `visualize.html`)**
    *   **显示区域：**
        *   可以考虑在 `visualize.html` 中添加一个新的、默认隐藏的 `div` 区域（例如，一个简单的文本区域 `textarea` 或者一个 `div` 设置 `contenteditable="true"`），用于显示和（未来）编辑总结报告。
        *   当总结报告生成或加载后，将其内容填充到此区域并显示它。
    *   **初步交互:**
        *   显示报告。
        *   提供一个"关闭"按钮隐藏报告区域。
        *   *(编辑、保存编辑、重新生成等功能作为此阶段之后的需求)*

**5. 非功能性需求 (初步考虑)**

*   **响应性:** 即便AI调用是模拟的，也应确保UI在请求"生成"时不冻结（例如，显示加载状态）。
*   **错误处理:** 对模拟的AI调用失败（虽然不太可能，但可以预留）或数据不存在的情况进行适当提示。

**6. 验收标准 (针对每个阶段的模拟实现)**

*   **阶段一 (单节点摘要):**
    *   `ThoughtNode` 数据结构已更新。
    *   `storageService` 能保存和更新节点的 `aiSummary`。
    *   当鼠标悬停在节点上时，Tooltip中能正确显示（固定的）示例AI摘要。
*   **阶段二 (链总结文档):**
    *   `ThoughtChain` 数据结构已更新。
    *   `storageService` 能保存和更新链的 `chainSummaryDoc`。
    *   可视化界面有 "生成/查看总结报告" 按钮。
    *   点击按钮后，能获取并显示（固定的）示例总结报告。
    *   报告显示区域可以被关闭。

**7. 未来展望 (本PRD范围之外的后续增强)**

*   集成真实的AI服务API进行内容摘要和报告生成。
*   优化AI摘要和报告的质量与相关性。
*   实现链总结报告的用户编辑和保存功能。
*   实现基于用户指令的链总结报告重新生成功能。
*   考虑AI请求的配额、成本和性能优化。
*   UI/UX 优化，例如更丰富的报告展示界面。 