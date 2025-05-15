# 产品需求文档 (PRD): AI单节点摘要 - 真实API实现 V1

**1. 引言 (Introduction)**

*   **1.1 项目背景:**
    *   基于 `PRD_AI增强功能_V1.md` 中定义的AI单节点摘要功能，我们已完成了模拟AI调用的前端框架和数据流。
    *   为了验证核心技术、提升用户体验并为后续AI链总结功能奠定基础，本次迭代的目标是将模拟AI摘要替换为使用 Langchain.js 和真实 LLM API (如 OpenAI) 的实际调用。
*   **1.2 本次迭代目标:**
    *   实现对单个思维节点URL内容的真实AI摘要功能。
    *   用户添加新节点后，自动在后台获取网页内容，调用AI服务生成摘要，并将摘要存储。
    *   用户在可视化界面悬停节点时，能看到AI生成的真实摘要。
*   **1.3 范围:**
    *   修改 `background.js` 中处理节点摘要的逻辑，集成 Langchain.js。
    *   实现网页主要内容的提取。
    *   实现基本的API密钥管理机制（初期为本地测试方案）。
    *   实现必要的错误处理和重试机制。
    *   进行基础的性能和用户体验优化。
    *   *注：本阶段不包含复杂的用户界面让用户主动触发摘要或选择模型等功能。*

**2. 核心功能详述 (Feature Specifications)**

*   **2.1 内容获取与预处理 (Content Fetching & Preprocessing)**
    *   **2.1.1 网页内容抓取:**
        *   在 `background.js` 中，当需要为新节点生成摘要时，使用 `fetch` API 异步获取节点 URL 对应的 HTML 内容。
        *   需要确保扩展拥有目标网站的 `host_permissions`（如果URL是跨域的，需要在 `manifest.json` 中配置，初期可先针对 `http://*/*` 和 `https://*/*` 进行测试，后续可细化）。
    *   **2.1.2 主要内容提取:**
        *   **首选方案:** 集成 [Mozilla's Readability.js](https://github.com/mozilla/readability) 库（或其纯JS版本）。将获取到的 HTML 字符串传递给 Readability.js 解析，提取文章标题、主要文本内容，去除广告、导航、评论等无关元素。
        *   **辅助输入 - 用户笔记:** 获取节点关联的用户笔记 (`node.notes`)。如果笔记内容不为空，可将其作为附加信息。
            *   **Prompt 增强:** 将用户笔记内容（或其摘要）融入到传递给 LLM 的 prompt 中，例如："请根据以下主要内容和用户笔记，生成一段摘要。用户笔记可能包含希望关注的重点或上下文：\n主要内容：{extracted_content}\n用户笔记：{user_notes}"。
    *   **2.1.3 文本预处理:**
        *   对 Readability.js 提取的文本内容进行基础清理，例如移除过多连续空行。

*   **2.2 Langchain.js 集成与摘要生成 (Langchain.js Integration & Summary Generation)**
    *   **2.2.1 依赖与环境:**
        *   项目需要能够引入 `langchain` (核心) 和 `@langchain/openai` (或所选 LLM 的对应包)。由于是 Chrome 扩展，可能需要通过构建工具（如 Webpack, esbuild）或直接使用 ES Modules (ESM) 分发版本（如果 Langchain.js 提供且扩展环境支持）。
        *   *初期探索：尝试直接在 `background.js` (service worker) 中引入 ESM 版本的 Langchain.js。*
    *   **2.2.2 模型与摘要链初始化:**
        *   在 `background.js` 中，初始化 `OpenAI` LLM 实例（或其他选定模型）。
        *   初始化 `RecursiveCharacterTextSplitter` 用于处理长文本。
        *   使用 `loadSummarizationChain` (推荐 `map_reduce` 或 `stuff` 类型，根据文本长度和模型能力选择) 构建摘要链。
    *   **2.2.3 Prompt 设计:**
        *   设计简洁明了的摘要 prompt。
        *   如 2.1.2 所述，将用户笔记中的关键信息融入 prompt，以引导摘要方向。
        *   示例 Prompt 片段: `"请为以下文本生成一段简洁的摘要，突出其核心观点和关键信息。如果用户笔记部分提供了重点，请侧重参考：\n\n主要文本：\n{text}\n\n用户笔记（参考）：\n{user_notes_if_any}"`
    *   **2.2.4 摘要生成逻辑:**
        *   创建一个新的异步函数，例如 `generateRealNodeAISummary(nodeData)`，替换原有的 `simulateAndUpdateNodeAISummary` 的调用点。
        *   该函数将执行内容获取、预处理、调用 Langchain.js 摘要链的完整流程。
        *   成功获取摘要后，调用 `storageService.updateNodeAISummary()` 将摘要保存。

*   **2.3 API 密钥管理 (API Key Management)**
    *   **2.3.1 初期方案 (本地测试):**
        *   在 `background.js` 中定义一个常量或变量来存储 OpenAI API 密钥。
        *   **重要提示:** 此方案仅用于开发者本地测试，代码提交到版本库前必须移除或将其置于 `.gitignore` 配置文件中。文档中明确指出此为临时方案。
    *   **2.3.2 后续迭代考虑:**
        *   在扩展的选项页面提供输入字段，允许用户配置和保存自己的API密钥到 `chrome.storage.local`。
        *   对存储的密钥进行适当的模糊处理或提示其安全风险。

*   **2.4 错误处理与重试机制 (Error Handling & Retry Mechanisms)**
    *   **2.4.1 内容获取失败:**
        *   `fetch` 失败（网络问题、URL无效、CORS策略等）：捕获错误，记录日志。
        *   Readability.js 解析失败或未提取到有效内容：记录日志。
        *   **降级处理:** 若无法获取或解析主要内容，可尝试仅基于节点标题和用户笔记（如果有）生成一个非常简短的提示性摘要（例如，"无法获取页面内容。基于标题的提示：{node.title}"），或者将节点的 `aiSummary` 更新为一个特定的错误提示字符串。
    *   **2.4.2 Langchain.js/LLM API 调用失败:**
        *   无效API密钥、网络问题、API服务本身错误：捕获错误，记录详细日志。
        *   速率限制/配额用尽：捕获特定错误码/消息，记录日志，短期内可停止对该用户的自动摘要。
        *   **简单重试:** 对网络波动或可恢复的API错误，可实现1-2次简单重试逻辑（例如，延迟几秒后重试）。
    *   **2.4.3 Token 限制:**
        *   文本分割器 (`RecursiveCharacterTextSplitter`) 会将长文本切块。
        *   如果单块文本依然过长或总 token 数超出所选模型的上下文窗口，`loadSummarizationChain` 的某些策略（如 `map_reduce`）能较好处理。需关注 Langchain.js 的错误输出。
        *   **降级处理:** 若依然发生 Token 超限错误，记录日志，并考虑截断部分输入文本或更新 `aiSummary` 为错误提示。
    *   **2.4.4 通用错误捕获:** 在主要的异步函数流程中使用 `try...catch` 块确保所有未预料的错误被捕获，防止扩展脚本崩溃。

*   **2.5 性能与用户体验优化 (Performance & UX Optimization)**
    *   **2.5.1 异步执行:** 所有网络请求、文件I/O（如果未来有）、AI调用必须是完全异步的，不应阻塞 Service Worker 或影响浏览器性能。
    *   **2.5.2 用户反馈:**
        *   当节点被添加，后台开始处理AI摘要时，可以更新 `chrome.notifications` 的文本，例如："【节点标题】已添加，正在获取内容并生成AI摘要..."。
        *   摘要成功生成或失败（有明确提示信息）后，可以再次通知或依赖用户在可视化界面查看。
    *   **2.5.3 避免重复生成 (简单检查):** 在尝试为节点生成摘要前，可以先检查该节点的 `aiSummary` 是否已有有效内容（非空或非错误提示），避免不必要的重复调用。
    *   **2.5.4 资源消耗:** 注意真实API调用可能带来的网络和计算资源消耗，尤其是在用户快速添加多个节点时。短期内按顺序处理，未来可考虑任务队列和并发控制。

**3. 验收标准 (Acceptance Criteria)**

*   **AC1:** 当用户通过插件UI或快捷键添加新节点后，`background.js` 能够自动触发真实的AI摘要生成流程。
*   **AC2:** `background.js` 能够成功使用 `fetch` 获取目标网页的HTML内容。
*   **AC3:** Mozilla's Readability.js (或类似库) 被成功集成，并能从HTML中提取主要文本内容。
*   **AC4:** Langchain.js (`langchain` 和 `@langchain/openai`) 被成功引入到 `background.js` 环境。
*   **AC5:** 使用有效的（测试）API密钥，能够通过 Langchain.js 成功调用 OpenAI API 并返回文本摘要。
*   **AC6:** 生成的真实AI摘要被正确保存到对应节点的 `aiSummary` 属性中，并通过 `storageService` 持久化。
*   **AC7:** 在 `visualize.html` 页面，当鼠标悬停在新添加的节点上时，Tooltip中能够正确显示由真实AI生成的摘要。
*   **AC8:** 核心错误场景（如API密钥无效、无法获取网页内容、网络请求失败）有基本的日志记录，并且不会导致扩展崩溃。`aiSummary` 字段在这些情况下能被更新为适当的提示信息。
*   **AC9:** 结合用户笔记增强Prompt的功能得到初步实现和验证。

**4. 对现有代码的预期影响 (Impact on Existing Code)**

*   **`background.js`:**
    *   需要重大修改。原 `simulateAndUpdateNodeAISummary` 函数将被替换或重构为 `generateRealNodeAISummaryAndUpdateStorage` (或类似名称)。
    *   引入新的外部库 (Readability.js, Langchain.js)。
    *   增加内容获取、文本处理、API调用、错误处理等逻辑。
*   **`manifest.json`:**
    *   可能需要在 `host_permissions` 中添加通用权限 (如 `"<all_urls>"` 或 `https://*/*`, `http://*/*`) 以允许 `fetch` 任意网页内容。出于安全考虑，发布前应尽可能收紧此权限。
    *   如果使用 ES Modules 且 Service Worker 需要特定配置，可能需要调整 `background`部分的声明。
*   **`js/lib/` (或类似目录):**
    *   如果 Readability.js 或 Langchain.js 的某些部分需要作为本地文件引入，会在此处添加。
*   **构建脚本 (如果使用如 Webpack/esbuild):**
    *   需要配置以正确打包新引入的 npm 模块 (Langchain.js)。
*   **其他文件 (`js/models.js`, `js/storage.js`, `visualize.js`, `visualize.html`):**
    *   预计在此次迭代中几乎不需要或只需微小调整（例如，`visualize.js` 中 `showTooltip` 可能需要根据真实摘要的长度或错误提示做细微格式调整）。

**5. 未来展望 (Out of Scope for this Iteration)**

*   完善的API密钥管理界面和安全存储。
*   用户可选择不同的LLM模型或摘要策略。
*   手动触发已存在节点的摘要重新生成。
*   更高级的缓存机制。
*   复杂的任务队列和并发控制。
*   UI上更详细的摘要生成状态反馈。

**6. 开发顺序建议 (Development Order Proposal)**

基于PRD中的内容和Langchain.js的集成特性，建议按照以下顺序进行开发：

*   **6.1 环境准备与基础设施 (对应AC4):**
    *   **任务1:** 解决在Chrome扩展中引入和使用 Readability.js 和 Langchain.js (`langchain`核心及`@langchain/openai`) 的模块化问题。这可能涉及调研和选择合适的打包工具（如esbuild, Webpack）或确认ESM版本的可用性和配置方法。
    *   **任务2:** 根据内容获取需求，在 `manifest.json` 中添加必要的 `host_permissions` (初期可以是较宽松的 `http://*/*`, `https://*/*` 用于测试，后续根据实际情况收紧)。
    *   **验收:** 能够成功在 `background.js` 中 `import` 相关模块而不报错；`manifest.json` 权限更新。

*   **6.2 内容获取与预处理 (对应AC2, AC3):**
    *   **任务1:** 在 `background.js` 中实现异步函数，使用 `fetch` API 获取给定URL的HTML内容。
    *   **任务2:** 集成Readability.js，将获取的HTML传递给它，提取主要文本内容和标题。
    *   **任务3:** 实现简单的文本预处理逻辑（如移除多余空行）。
    *   **验收:** 能够针对不同测试网页成功获取HTML，并提取出质量较高的主要文本内容；控制台能打印提取结果。

*   **6.3 API密钥管理实现 (初期方案，影响AC5):**
    *   **任务1:** 在 `background.js` 中临时定义一个常量或变量来存储OpenAI API密钥。
    *   **任务2:** （非编码任务）在 `.gitignore` 中添加该密钥变量所在的配置文件或直接声明该文件不应提交，并在代码注释和本文档中强调此为临时方案及其风险。
    *   **验收:** API密钥能被后续Langchain.js代码访问到。

*   **6.4 Langchain.js摘要生成核心功能 (对应AC5, AC9):**
    *   **任务1:** 初始化 `OpenAI` LLM实例、`RecursiveCharacterTextSplitter` 和 `loadSummarizationChain` (例如，使用 `map_reduce` 类型)。
    *   **任务2:** 实现将提取的文本（结合用户笔记，如 `node.notes`）构造成合适的输入文档，并调用摘要链生成摘要。
    *   **任务3:** 设计并应用初步的Prompt，包含对用户笔记的引导（如果存在）。
    *   **验收:** 对于给定的测试文本（可先用固定文本，再用真实提取文本），能成功调用Langchain.js并从OpenAI API获取到摘要文本；结合用户笔记时，摘要内容能体现笔记的引导方向。

*   **6.5 结果存储与显示 (对应AC6, AC7):**
    *   **任务1:** 将Langchain.js生成的真实摘要通过 `storageService.updateNodeAISummary()` 保存到对应节点的 `aiSummary` 属性中。
    *   **任务2:** （验证）确保 `visualize.js` 中 `showTooltip` 功能能够正确显示从 `node.aiSummary` 读取到的真实摘要。
    *   **验收:** 通过Chrome开发者工具查看 `chrome.storage.local`，确认真实摘要已存储；在可视化界面悬停节点时，Tooltip能正确显示AI生成的摘要。

*   **6.6 错误处理与优化 (对应AC8及部分2.5节内容):**
    *   **任务1:** 为内容获取、Readability.js解析、Langchain.js调用等关键步骤添加 `try...catch` 块。
    *   **任务2:** 实现对常见错误（网络错误、API密钥无效、内容提取失败）的捕获，并在控制台记录日志。
    *   **任务3:** 实现降级处理逻辑：当无法获取内容或摘要生成失败时，更新 `aiSummary` 为特定的错误提示字符串（例如，"AI摘要生成失败：无法访问网页"）。
    *   **任务4:** 调整 `chrome.notifications` 的文本，以反馈摘要正在生成或生成失败的状态。
    *   **验收:** 主动模拟错误场景（如提供无效URL、临时移除API密钥、网络断开），观察控制台日志和 `aiSummary` 的变化是否符合预期；扩展在错误发生时不崩溃；通知内容正确更新。

*   **6.7 完整流程集成与测试 (对应AC1及整体功能):**
    *   **任务1:** 将 `background.js` 中原有的 `simulateAndUpdateNodeAISummary` 的调用点，替换为调用新的真实摘要生成函数（例如 `generateRealNodeAISummaryAndUpdateStorage`）。
    *   **任务2:** 全面测试：通过插件UI和快捷键添加新节点，覆盖不同类型的网页，验证从节点添加到摘要显示的完整流程。
    *   **验收:** 所有AC1-AC9标准均得到满足，用户添加节点后，后台自动、稳定地生成真实AI摘要并正确显示。

**7. 验收标准实施方案 (Acceptance Criteria Implementation Plan)**

针对PRD中定义的各项验收标准(AC1-AC9)，建议以下具体实施和验证方法：

*   **AC1 (自动触发真实摘要流程):**
    *   **验证:** 添加新节点（通过UI和快捷键分别测试），通过 `background.js` 的控制台日志（应有明确的开始生成真实摘要的日志）确认流程被触发，而不是模拟流程。
    *   **工具:** 浏览器开发者工具（控制台）。

*   **AC2 (成功获取网页HTML):**
    *   **验证:** 在内容获取函数中添加日志，打印部分获取到的HTML字符串。测试不同协议(HTTP/HTTPS)和结构的网页。
    *   **工具:** 控制台日志。

*   **AC3 (Readability.js成功提取内容):**
    *   **验证:** 在Readability.js处理后，打印提取出的主要文本内容。对比原文，判断提取质量（是否主要是正文，而非导航、广告等）。
    *   **工具:** 控制台日志。

*   **AC4 (Langchain.js等库成功引入):**
    *   **验证:** 扩展加载时不出现模块引入相关的错误。在 `background.js` 中尝试调用Langchain.js的基础功能（如实例化一个LLM对象）并打印结果，确认无报错。
    *   **工具:** 控制台日志，扩展管理页面。

*   **AC5 (成功调用OpenAI API并返回摘要):**
    *   **验证:** 使用有效的测试API密钥，对一段标准测试文本（可先不经过网页提取）调用摘要链，打印API的响应或生成的摘要文本。
    *   **工具:** 控制台日志。

*   **AC6 (真实摘要正确保存):**
    *   **验证:** 成功生成摘要后，通过开发者工具查看 `chrome.storage.local` 中对应思维链和节点的 `aiSummary` 字段是否已更新为真实摘要文本。
    *   **工具:** 开发者工具（Application -> Storage -> Local Storage）。

*   **AC7 (Tooltip正确显示真实摘要):**
    *   **验证:** 在可视化页面，对已生成真实摘要的节点进行悬停操作，检查Tooltip中是否按预期格式显示了"AI 摘要:"及其内容。
    *   **工具:** 插件可视化界面。

*   **AC8 (核心错误场景处理):**
    *   **模拟与验证:**
        *   **API密钥无效:** 修改代码中的API密钥为无效值，添加节点，观察控制台是否有相应错误日志，`aiSummary` 是否更新为错误提示。
        *   **无法获取网页内容:** 提供一个无法访问的URL或网络不通畅时添加节点，观察日志和 `aiSummary`。
        *   **扩展不崩溃:** 在上述错误测试中，确保插件核心功能（如浏览历史记录、基础的链管理）不受影响，Service Worker 不会因未捕获异常而崩溃。
    *   **工具:** 控制台日志，插件可视化界面，网络模拟工具（可选）。

*   **AC9 (用户笔记增强Prompt验证):**
    *   **验证:** 选择一个测试网页，先不加笔记添加一次节点生成摘要A；然后为同一网页（或新节点指向同URL）添加包含明确指示性关键词的笔记，再次添加节点生成摘要B。对比摘要A和摘要B，看后者是否体现了笔记的引导。
    *   **工具:** 插件UI（添加笔记），可视化界面（查看摘要）。

**补充测试建议:**
*   **渐进式测试:** 每完成一个开发小任务（如仅内容获取、仅API密钥设置）就进行单元测试或集成测试。
*   **测试数据多样性:** 准备不同语言、不同内容长度、包含特殊字符的网页进行测试。
*   **日志级别:** 在开发阶段使用详细日志，发布前调整为仅记录关键信息和错误。
*   **性能初步评估:** 记录从添加节点到摘要显示的大致时间，确保在可接受范围内。

---
我已将上述内容写入 `iterated_log/PRD_AI单节点摘要_真实API实现_V1.md`。 