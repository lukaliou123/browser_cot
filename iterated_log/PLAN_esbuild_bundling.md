## 思维链记录插件 - Langchain.js 打包及代码调整计划 (使用 esbuild)

**目标：** 通过使用 esbuild 将 Langchain.js 及其相关依赖打包到项目中，解决在 Chrome 扩展的 Offscreen Document 中因 CSP 限制无法从 CDN 动态加载模块的问题。

**核心思路：**
1.  将 `js/lib/langchain/langchain-adapter.js` 中原本通过 CDN `import()` 加载的 Langchain 模块，改为从本地npm包静态导入。
2.  使用 esbuild 将 `offscreen_langchain_handler.js` (或一个新的入口文件) 及其依赖 (包括 Langchain) 打包成一个或少数几个 JS 文件。
3.  更新 `offscreen.html` 以加载打包后的 JS 文件。
4.  移除 `manifest.json` 中为 CDN 添加的 `content_security_policy` (如果后续不再需要其他 CDN 脚本)。

---

**详细步骤：**

**阶段一：环境准备与 esbuild 集成 (预计 1-2 小时)**

1.  **安装 esbuild 及相关 Langchain 包：**
    *   在项目根目录下初始化 `package.json` (如果还没有的话): `npm init -y`
    *   安装 esbuild: `npm install --save-dev esbuild`
    *   安装 Langchain 核心包及我们需要的特定模块作为本地依赖：
        ```bash
        npm install langchain @langchain/openai
        ```
        *(后续根据实际需要，可能还需要安装 `@langchain/community` 或其他特定功能的包，如 `langchain/text_splitter` 如果其未被 `langchain` 主包完全包含)*

2.  **创建 esbuild 构建脚本/命令：**
    *   在 `package.json` 的 `scripts` 中添加构建命令，例如：
        ```json
        "scripts": {
          "build:offscreen": "esbuild js/offscreen_langchain_handler.js --bundle --outfile=dist/offscreen_bundle.js --format=esm --platform=browser --sourcemap",
          "watch:offscreen": "esbuild js/offscreen_langchain_handler.js --bundle --outfile=dist/offscreen_bundle.js --format=esm --platform=browser --sourcemap --watch"
        }
        ```
        *   `js/offscreen_langchain_handler.js`: 我们的入口文件。
        *   `--bundle`: 告诉 esbuild 将所有依赖打包。
        *   `--outfile=dist/offscreen_bundle.js`: 输出打包后的文件到 `dist` 目录 (需要创建此目录)。
        *   `--format=esm`: 输出为 ES Module 格式，适用于现代浏览器和扩展。
        *   `--platform=browser`: 针对浏览器环境优化。
        *   `--sourcemap`: 生成 sourcemap 方便调试。
        *   `--watch`: (可选) 用于开发时自动重新打包。

**阶段二：代码调整 (预计 2-4 小时)**

1.  **修改 `js/lib/langchain/langchain-adapter.js` (或直接在 `offscreen_langchain_handler.js` 中实现)：**
    *   移除所有动态 `import('https://cdn.jsdelivr.net/...')` 的代码。
    *   在文件顶部使用静态 `import` 从本地 `node_modules` 导入 Langchain 类：
        ```javascript
        import { OpenAI } from "@langchain/openai"; // 注意包名和导入方式可能随版本变化
        import { loadSummarizationChain } from "langchain/chains";
        import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
        import { PromptTemplate } from "langchain/prompts";
        // ... 其他可能需要的导入
        ```
    *   确保 `initializeLangchain` 函数使用这些静态导入的模块。
    *   **注意：** Langchain 的导入路径和包结构在不同版本间可能有差异。需要查阅当前安装版本 (v0.1.x) 的文档来确定正确的导入方式。例如，一些工具类可能在 `langchain/utils` 或特定子包下。

2.  **调整 `offscreen_langchain_handler.js`：**
    *   确保它正确导入并调用 `langchain-adapter.js` 中的 `initializeLangchain` 和 `getAIContentSummary` (或者将这些逻辑直接内联到此文件，然后让 esbuild 从这里开始打包)。
    *   如果 `langchain-adapter.js` 的逻辑被合并或重构，确保消息处理和函数调用仍然正确。

3.  **修改 `offscreen.html`：**
    *   将其 `<script>` 标签从指向原始的 `offscreen_langchain_handler.js` 和 `langchain-adapter.js` (如果之前有单独引入) 改为指向 esbuild 打包后的文件：
        ```html
        <!-- <script type="module" src="../js/lib/langchain/langchain-adapter.js"></script> -->
        <!-- <script type="module" src="../js/offscreen_langchain_handler.js"></script> -->
        <script type="module" src="../dist/offscreen_bundle.js"></script> 
        ```
        *(路径需要根据实际 `outfile` 和 `offscreen.html` 的位置进行调整)*

**阶段三：构建、测试与 CSP 调整 (预计 1-2 小时)**

1.  **运行构建命令：**
    *   `npm run build:offscreen`

2.  **测试功能：**
    *   重新加载插件。
    *   测试 AI 摘要功能，确保 Offscreen Document 能正确加载打包后的脚本并执行 Langchain 操作。
    *   检查浏览器控制台 (Service Worker 和 Offscreen Document 的控制台) 是否有错误。

3.  **调整 `manifest.json` 中的 `content_security_policy`：**
    *   由于不再从 CDN 加载脚本，可以尝试移除或简化 `extension_pages` 中的 `script-src` 关于 `cdn.jsdelivr.net` 的部分。
    *   最终的 CSP 可能是类似：`"extension_pages": "script-src 'self'; object-src 'self';"`
    *   **重要：** 确保 CSP 仍然允许 Offscreen Document 执行其需要的操作。如果打包后的代码中仍有内联脚本或 `eval` (esbuild 默认应避免，但需注意)，可能需要 `'unsafe-inline'` 或 `'unsafe-eval'` (应尽量避免)。

**阶段四：代码清理与优化 (可选，预计 1 小时)**

1.  移除不再需要的旧 CDN 加载逻辑和相关注释。
2.  整理项目结构，确保 `dist` 目录被正确处理 (例如，添加到 `.gitignore` 如果不需要提交打包文件到版本库，或者根据打包策略决定)。

---

**潜在风险与应对：**

*   **Langchain 包与浏览器兼容性：** 虽然 Langchain 提供了浏览器兼容版本，但某些深层依赖可能仍有问题。esbuild 会报告这些问题，可能需要查找替代方案或 polyfill。
*   **打包后文件大小：** Langchain 及其依赖可能导致打包文件较大。需要关注打包后的大小，评估其对插件性能的影响。esbuild 通常压缩效果不错，但如果过大，可以考虑代码分割或动态加载打包后的 chunks (更高级的 esbuild 配置)。
*   **Sourcemap 配置：** 确保 Sourcemap 在开发和生产构建中配置正确，方便调试。
*   **Node.js 特定 API：** Langchain 的某些模块或其依赖可能默认使用了 Node.js 的内置模块 (如 `fs`, `path`)。`platform: 'browser'` 应该处理大部分情况，但需留意构建错误或运行时错误。esbuild 可以配置别名来替换这些模块为空或浏览器兼容的实现。

---

**决策点：**

*   **单一入口 vs. 多个打包入口：** 目前计划是将 `offscreen_langchain_handler.js` 作为单一入口。如果未来有其他脚本也需要复杂依赖，可以考虑为它们也创建打包配置。
*   **`langchain-adapter.js` 的定位：** 是将其作为 `offscreen_langchain_handler.js` 的一个模块导入并一同打包，还是将其内容直接整合进 `offscreen_langchain_handler.js`。前者模块化更好，后者可能稍微简化构建配置。建议保持模块化。

---

此计划将作为我们后续实施的指导。在执行过程中，我们会根据实际情况进行调整。 