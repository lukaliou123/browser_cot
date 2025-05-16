/**
 * 思维链记录 - 后台脚本
 * 处理扩展的后台逻辑和数据管理
 */

// 在类型=module的脚本中，需要使用完整的相对路径
import { createThoughtNode } from './js/models.js';
import { storageService } from './js/storage.js';
import { extractArticle } from './js/lib/readability/readability-adapter.js';
// 不再直接导入langchain-adapter，改为通过Offscreen Document调用
// import { generateSummary } from './js/lib/langchain/langchain-adapter.js';
import { OPENAI_API_KEY, AI_CONFIG } from './js/config.js';

// 存储初始化标志
let isInitialized = false;

// Offscreen Document 状态
let isOffscreenDocumentReady = false;

// 初始化应用
chrome.runtime.onInstalled.addListener(async () => {
  console.log('思维链记录扩展已安装');
  
  try {
    // 初始化存储
    await storageService.initialize();
    isInitialized = true;
    console.log('存储初始化成功');
  } catch (error) {
    console.error('存储初始化失败:', error);
  }
  
  // 设置每日自动分割定时器
  setupDailySplitAlarm();
});

// 插件启动时也尝试设置定时器 (以防首次安装后浏览器未立即重启或插件被禁用后重开)
chrome.runtime.onStartup.addListener(() => {
  console.log('插件启动，检查并设置每日分割定时器。');
  setupDailySplitAlarm();
});

/**
 * 设置每日凌晨4点执行的自动分割思维链的定时器
 */
async function setupDailySplitAlarm() {
  const alarmName = 'dailyChainSplitAlarm';
  try {
    const alarm = await chrome.alarms.get(alarmName);
    if (alarm) {
      console.log('每日分割定时器已存在:', alarm);
      // 可选：如果需要调整时间或周期，可以在这里清除并重新创建
      // chrome.alarms.clear(alarmName);
    } else {
      // 计算下一个凌晨4点的时间
      let next4AM = new Date();
      next4AM.setHours(4, 0, 0, 0); // 设置为当天的4:00:00.000

      if (next4AM.getTime() <= Date.now()) {
        // 如果今天的4点已过，则设置为明天的4点
        next4AM.setDate(next4AM.getDate() + 1);
      }

      chrome.alarms.create(alarmName, {
        when: next4AM.getTime(),
        periodInMinutes: 24 * 60 // 每24小时重复
      });
      console.log(`每日分割定时器已创建，下次触发时间: ${next4AM.toLocaleString()}`);
    }
  } catch (error) {
    console.error('设置每日分割定时器失败:', error);
  }
}

/**
 * 处理每日自动分割逻辑
 */
async function handleDailyChainSplit() {
  console.log(`[${new Date().toLocaleString()}] 执行每日思维链自动分割检查...`);
  await ensureInitialized(); // 确保存储服务可用

  try {
    const activeChain = await storageService.getActiveChain();
    if (!activeChain) {
      console.log('没有活动的思维链，无需分割。');
      return;
    }

    const chainCreationTime = activeChain.createdAt; // 假设 ThoughtChain 对象有 createdAt 属性
    if (!chainCreationTime) {
      console.warn(`活动链 ${activeChain.id} (${activeChain.name}) 没有 createdAt 时间戳，无法判断是否需要分割。`);
      return;
    }

    // 计算今天的凌晨4点
    let today4AM = new Date();
    today4AM.setHours(4, 0, 0, 0);

    if (chainCreationTime < today4AM.getTime()) {
      console.log(`活动链 "${activeChain.name}" (创建于: ${new Date(chainCreationTime).toLocaleString()}) 是在今天凌晨4点之前创建的，需要分割。`);
      
      // (可选) 更新旧链状态，如果实现了该功能
      // activeChain.status = 'auto-archived';
      // await storageService.updateChain(activeChain); 

      const newChainName = await storageService.generateNewChainName();
      const newChain = await storageService.createChain(newChainName);
      console.log(`自动创建了新的活动思维链: "${newChain.name}" (ID: ${newChain.id})`);

    } else {
      console.log(`活动链 "${activeChain.name}" (创建于: ${new Date(chainCreationTime).toLocaleString()}) 是在今天凌晨4点之后创建或更新的，无需分割。`);
    }
  } catch (error) {
    console.error('每日自动分割思维链失败:', error);
  }
}

// 监听定时器触发
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyChainSplitAlarm') {
    handleDailyChainSplit();
  }
});

// 确保存储已初始化
async function ensureInitialized() {
  if (!isInitialized) {
    await storageService.initialize();
    isInitialized = true;
  }
}

/**
 * 获取网页内容
 * @param {string} url - 网页URL
 * @returns {Promise<string>} HTML内容
 */
async function fetchWebPageContent(url) {
  if (!url) {
    throw new Error('fetchWebPageContent: URL不能为空');
  }

  console.log(`开始获取网页内容: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`网页请求失败: HTTP ${response.status}`);
    }

    const htmlContent = await response.text();
    console.log(`成功获取网页内容: ${url}, 大小: ${htmlContent.length} 字符`);
    return htmlContent;
  } catch (error) {
    console.error(`获取网页内容失败: ${url}`, error);
    throw error;
  }
}

/**
 * 使用Readability.js提取主要内容
 * @param {string} htmlContent - HTML内容
 * @param {string} url - 网页URL (用于设置基础URL)
 * @returns {Object} 提取的文章对象，包含title和textContent
 */
async function extractMainContent(htmlContent, url) {
  if (!htmlContent) {
    throw new Error('extractMainContent: HTML内容不能为空');
  }

  console.log('开始提取网页主要内容...');
  try {
    // 首先使用Service Worker中的基础提取能力
    const basicArticle = extractArticle(htmlContent, url);
    
    // 如果可能，尝试使用更高级的提取方法
    try {
      // 检查当前活动标签页是否与目标URL匹配
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      if (activeTab && activeTab.url === url) {
        console.log('URL匹配当前活动标签页，使用内容脚本提取...');
        return await extractContentFromActiveTab(activeTab.id);
      } else {
        console.log('URL不匹配当前活动标签页，尝试使用visualize页面提取...');
        // 判断visualize页面是否打开
        const visualizeTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("visualize.html") });
        
        if (visualizeTabs.length > 0) {
          console.log('visualize页面已打开，使用其处理HTML...');
          return await sendToVisualizeForProcessing(htmlContent, url);
        } else {
          console.log('无可用的高级提取环境，使用基本提取结果');
          return basicArticle;
        }
      }
    } catch (advancedError) {
      console.warn('高级提取方法失败，回退到基本提取方法:', advancedError);
      return basicArticle;
    }
  } catch (error) {
    console.error('提取网页内容失败:', error);
    throw error;
  }
}

/**
 * 从活动标签页提取内容
 * @param {number} tabId - 标签页ID
 * @returns {Promise<Object>} 提取的文章对象
 */
async function extractContentFromActiveTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId, 
      { action: 'extractCurrentPageContent' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`与内容脚本通信失败: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        if (!response || !response.success) {
          reject(new Error(response?.error || '内容提取失败'));
          return;
        }
        
        resolve(response.data);
      }
    );
  });
}

/**
 * 发送HTML内容到visualize页面处理
 * @param {string} htmlContent - HTML内容
 * @param {string} url - 网页URL
 * @returns {Promise<Object>} 提取的文章对象
 */
async function sendToVisualizeForProcessing(htmlContent, url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ url: chrome.runtime.getURL("visualize.html") }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        reject(new Error('visualize页面未打开'));
        return;
      }
      
      const visualizeTab = tabs[0];
      chrome.tabs.sendMessage(
        visualizeTab.id,
        { action: 'processHTMLContent', html: htmlContent, url: url },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`发送消息到visualize页面失败: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (!response || !response.success) {
            reject(new Error(response?.error || 'visualize页面处理失败'));
            return;
          }
          
          resolve(response.data);
        }
      );
    });
  });
}

/**
 * 处理提取的文本内容
 * @param {string} textContent - 提取的文本内容
 * @returns {string} 处理后的文本
 */
function preprocessTextContent(textContent) {
  // 简单预处理：移除多余的空白字符，替换多个换行为一个
  if (typeof textContent !== 'string') return '';
  return textContent.replace(/\s+/g, ' ').replace(/ (\r?\n)+ /g, '\n').trim();
}

/**
 * 使用AI生成节点摘要并更新存储
 * @param {ThoughtNode} node - 刚添加的思维节点对象 (应包含id和title和url)
 * @param {string} chainId - 节点所属的思维链ID
 */
async function generateRealNodeAISummaryAndUpdateStorage(node, chainId) {
  await ensureInitialized();
  console.log(`开始为节点 ${node.id} (${node.title}) 生成真实AI摘要...`);

  try {
    // --- 开始：避免重复生成摘要的检查 ---
    const currentNodeState = await storageService.getNodeById(chainId, node.id);
    if (currentNodeState && currentNodeState.aiSummary && 
        !currentNodeState.aiSummary.startsWith('AI摘要生成失败') && 
        currentNodeState.aiSummary.trim() !== '') {
      console.log(`节点 ${node.id} (${node.title}) 已存在有效AI摘要，跳过生成。摘要:`, currentNodeState.aiSummary.substring(0,100) + "...");
      return; // 直接返回，不继续执行
    }
    // --- 结束：避免重复生成摘要的检查 ---

    // 1. 获取网页内容
    const htmlContent = await fetchWebPageContent(node.url);
    
    // 2. 提取主要内容（使用混合策略）
    console.log(`提取主要内容...`);
    const article = await extractMainContent(htmlContent, node.url);
    
    // 3. 预处理文本（如果尚未处理）
    console.log(`预处理文本...`);
    const processedText = article.content || preprocessTextContent(article.textContent);
    
    // 4. 通过Offscreen Document调用LangChain.js生成摘要
    console.log(`通过Offscreen Document调用LangChain.js生成摘要...`);
    const userNotes = node.notes || '';
    
    // 根据配置创建调用选项
    const options = {
      userNotes: userNotes,
      maxLength: AI_CONFIG.summary.chunkSize,
      maxTokens: AI_CONFIG.summary.maxTokens,
      temperature: AI_CONFIG.summary.temperature
    };
    
    // 使用Offscreen Document生成摘要
    let summary;
    try {
      summary = await callOffscreenToGenerateSummary(processedText, OPENAI_API_KEY, options);
      console.log(`AI摘要生成成功，长度: ${summary.length} 字符`);
    } catch (aiError) {
      console.error(`AI摘要生成失败:`, aiError);
      // 失败后生成一个基础摘要作为回退
      summary = `无法生成AI摘要: ${aiError.message}。页面标题: ${node.title}`;
    }
    
    // 5. 将摘要保存到存储
    const success = await storageService.updateNodeAISummary(chainId, node.id, summary);
    if (success) {
      console.log(`节点 "${node.title}" (ID: ${node.id}) 的AI摘要已成功存储。`);
    } else {
      console.warn(`存储节点 "${node.title}" (ID: ${node.id}) 的AI摘要失败。`);
    }
    
    return { success, summary };
  } catch (error) {
    console.error(`为节点 "${node.title}" (ID: ${node.id}) 生成或更新AI摘要时出错:`, error);
    
    // 尝试保存错误信息作为摘要
    try {
      const errorSummary = `摘要生成失败: ${error.message}`;
      await storageService.updateNodeAISummary(chainId, node.id, errorSummary);
    } catch (storageError) {
      console.error('保存错误摘要时也失败了:', storageError);
    }
    
    return { success: false, error };
  }
}

/**
 * 创建并确保Offscreen Document已准备就绪
 * @returns {Promise<boolean>} 是否成功创建/准备Offscreen Document
 */
async function ensureOffscreenDocumentReady() {
  // 如果之前已确认模块加载完毕，则直接返回true
  if (isOffscreenDocumentReady) { // isOffscreenDocumentReady 现在表示模块也加载好了
    console.log('Offscreen Document 及其模块已准备就绪');
    return true;
  }

  console.log('准备或检查Offscreen Document...');
  
  try {
    // 检查是否已存在Offscreen Document，使用hasDocument而不是getContexts
    const hasExistingDocument = await chrome.offscreen.hasDocument();
    console.log('检查是否存在Offscreen Document:', hasExistingDocument);
    
    if (hasExistingDocument) {
      console.log('检测到Offscreen Document已存在。');
      // 虽然存在，但我们仍需确认其内部模块是否已加载
      // isOffscreenDocumentReady 为 false 意味着上次可能只加载了html或模块加载失败
    } else {
      console.log('没有活动的Offscreen Document，尝试创建...');
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['IFRAME_SCRIPTING'],
        justification: '用于执行LangChain.js API调用'
      });
      console.log('Offscreen Document创建指令已发送。');
      // 创建后需要等待它的 'offscreenReady' status: 'loading' 或 'loaded' 消息
    }

    // 等待Offscreen Document发送模块加载完成的消息
    return new Promise((resolve) => {
      const messageListener = (message, sender) => {
        // 确保消息来自Offscreen Document
        if (sender.url && sender.url.endsWith('/offscreen.html')) {
          if (message.action === 'offscreenReady') {
            if (message.status === 'loaded') {
              chrome.runtime.onMessage.removeListener(messageListener);
              isOffscreenDocumentReady = true; // 现在表示模块已加载
              console.log('Offscreen Document报告：模块已加载就绪。');
              resolve(true);
            } else if (message.status === 'loading') {
              console.log('Offscreen Document报告：正在加载中...');
              // 继续等待 'loaded' 状态
            }
          } else if (message.action === 'offscreenError') {
            chrome.runtime.onMessage.removeListener(messageListener);
            console.error('Offscreen Document报告错误:', message.error);
            isOffscreenDocumentReady = false; // 明确标记为未就绪
            resolve(false);
          }
        }
      };
      chrome.runtime.onMessage.addListener(messageListener);
      
      // 设置总超时，防止无限等待
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        if (!isOffscreenDocumentReady) { // 只有当仍未就绪时才报告超时
            console.error('等待Offscreen Document模块加载就绪超时。');
            isOffscreenDocumentReady = false;
            resolve(false);
        }
      }, 15000); // 增加超时时间，因为CDN加载可能需要时间
    });
  } catch (error) {
    console.error('创建或检查Offscreen Document失败:', error);
    isOffscreenDocumentReady = false;
    return false;
  }
}

/**
 * 通过Offscreen Document调用LangChain生成摘要
 * @param {string} text - 要摘要的文本
 * @param {string} apiKey - OpenAI API密钥
 * @param {Object} options - 其他选项
 * @returns {Promise<string>} 生成的摘要
 */
async function callOffscreenToGenerateSummary(text, apiKey, options = {}) {
  // 确保Offscreen Document存在，不再等待ready状态
  try {
    // 检查是否已存在Offscreen Document
    const hasDocument = await chrome.offscreen.hasDocument();
    console.log('检查是否存在Offscreen Document:', hasDocument);
    
    if (!hasDocument) {
      console.log('需要创建Offscreen Document...');
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['IFRAME_SCRIPTING'],
        justification: '用于执行LangChain.js API调用'
      });
      console.log('Offscreen Document创建完成');
      
      // 等待一小段时间让Offscreen Document完成初始化
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log('Offscreen Document已存在，直接使用');
    }
    
    // 直接发送生成摘要请求到Offscreen Document，不再等待ready状态
    console.log('向Offscreen Document发送摘要请求...');
    return new Promise((resolve, reject) => {
      // 设置一个较长的超时时间
      const timeoutId = setTimeout(() => {
        reject(new Error('摘要请求超时，可能是Offscreen Document无响应'));
      }, 30000); // 30秒超时，给予充分时间响应
      
      chrome.runtime.sendMessage(
        {
          action: 'generateSummary',
          text: text,
          apiKey: apiKey,
          options: options
        },
        (response) => {
          clearTimeout(timeoutId); // 清除超时定时器
          
          if (chrome.runtime.lastError) {
            console.error('摘要请求发送失败:', chrome.runtime.lastError);
            reject(new Error(`与Offscreen Document通信失败: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (!response) {
            reject(new Error('Offscreen Document没有返回响应'));
            return;
          }
          
          if (!response.success) {
            console.error('摘要生成失败:', response.error);
            reject(new Error(response.error || '生成摘要失败'));
            return;
          }
          
          console.log('成功收到摘要响应!');
          resolve(response.summary);
        }
      );
    });
  } catch (error) {
    console.error('调用Offscreen Document失败:', error);
    // 返回一个模拟摘要，作为最后的降级处理
    return `[降级摘要] 由于技术原因无法生成真实摘要。错误: ${error.message}`;
  }
}

/**
 * 测试内容获取和提取功能 
 * 这个函数仅用于开发测试，可以通过开发者工具调用
 * @param {string} url - 测试URL
 */
async function testContentFetchAndExtraction(url) {
  if (!url) {
    console.error('请提供有效的URL进行测试');
    return;
  }
  
  console.log(`开始测试内容获取和提取: ${url}`);
  try {
    // 1. 获取网页内容
    const htmlContent = await fetchWebPageContent(url);
    console.log(`已获取HTML内容，长度: ${htmlContent.length} 字符`);
    
    // 2. 提取主要内容
    const article = await extractMainContent(htmlContent, url);
    console.log('提取的文章对象:', {
      title: article.title,
      textLength: article.textContent.length,
      excerpt: article.textContent.substr(0, 150) + '...' // 只打印前150个字符作为预览
    });
    
    // 3. 文本预处理
    const processedText = article.content || preprocessTextContent(article.textContent);
    console.log(`处理后的文本长度: ${processedText.length} 字符`);
    console.log('处理后的文本预览:', processedText.substr(0, 150) + '...');
    
    return {
      originalHtml: htmlContent,
      extractedArticle: article,
      processedText: processedText
    };
  } catch (error) {
    console.error('测试内容获取和提取失败:', error);
    throw error;
  }
}

// 将测试函数暴露到全局作用域，方便在控制台调用
if (typeof self !== 'undefined') {
  // 测试内容获取和提取
  self.testContentFetchAndExtraction = testContentFetchAndExtraction;
  
  // 完整的内容处理测试函数
  self.testCompleteContentProcessing = async function(url, userNotes = '') {
    console.group('完整内容处理测试');
    console.log(`URL: ${url}`);
    console.log(`用户笔记: ${userNotes || '(无)'}`);
    
    try {
      // 1. 获取网页内容
      console.log('步骤1: 获取网页内容...');
      const htmlContent = await fetchWebPageContent(url);
      
      // 2. 提取主要内容（使用混合策略）
      console.log('步骤2: 使用混合策略提取主要内容...');
      const article = await extractMainContent(htmlContent, url);
      
      // 3. 处理文本（如果尚未处理）
      console.log('步骤3: 文本预处理...');
      const processedText = article.content || preprocessTextContent(article.textContent);
      
      // 4. 显示结果
      console.log('完整处理流程测试完成!');
      console.log('文章标题:', article.title);
      console.log('提取方法:', article.isBasicExtraction ? '基础HTML处理' : '高级提取（Readability）');
      console.log('处理后文本长度:', processedText.length, '字符');
      console.log('处理后文本预览:', processedText.substring(0, 200) + '...');
      
      if (userNotes) {
        console.log('用户笔记将影响摘要生成的方向:', userNotes);
      }
      
      // 模拟AI摘要结果
      const mockSummary = `这是一个关于"${article.title}"的测试摘要。该文章长度为${processedText.length}字符。${
        userNotes ? `考虑到用户笔记中提到: "${userNotes.substring(0, 50)}${userNotes.length > 50 ? '...' : ''}"` : ''
      }`;
      
      console.log('模拟AI摘要结果:', mockSummary);
      
      return {
        success: true,
        title: article.title,
        processedText,
        extractionMethod: article.isBasicExtraction ? 'basic' : 'advanced',
        mockSummary
      };
    } catch (error) {
      console.error('完整内容处理测试失败:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      console.groupEnd();
    }
  };
  
  // 测试混合提取策略
  self.testMixedExtractionStrategy = async function(url) {
    console.group('混合提取策略测试');
    console.log(`测试URL: ${url}`);
    
    try {
      // 检查URL是否为当前活动标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      console.log('当前活动标签页:', activeTab ? activeTab.url : '无');
      
      if (activeTab && activeTab.url === url) {
        console.log('✅ URL匹配当前活动标签页，将使用内容脚本提取');
        
        try {
          const contentScriptResult = await extractContentFromActiveTab(activeTab.id);
          console.log('内容脚本提取结果:', {
            title: contentScriptResult.title,
            contentLength: contentScriptResult.content?.length || 0,
            extractionMethod: contentScriptResult.isBasicExtraction ? 'basic DOM' : 'Readability'
          });
        } catch (error) {
          console.error('内容脚本提取失败:', error);
        }
      } else {
        console.log('❌ URL不匹配当前活动标签页');
      }
      
      // 检查visualize页面是否打开
      const visualizeTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("visualize.html") });
      if (visualizeTabs.length > 0) {
        console.log('✅ visualize页面已打开，可用于处理HTML');
        
        try {
          // 获取HTML用于测试
          const htmlContent = await fetchWebPageContent(url);
          console.log(`已获取HTML内容，大小: ${htmlContent.length} 字符`);
          
          const visualizeResult = await sendToVisualizeForProcessing(htmlContent, url);
          console.log('visualize页面处理结果:', {
            title: visualizeResult.title,
            contentLength: visualizeResult.content?.length || 0
          });
        } catch (error) {
          console.error('visualize页面处理失败:', error);
        }
      } else {
        console.log('❌ visualize页面未打开');
      }
      
      // 测试基础提取能力
      console.log('测试Service Worker基础提取能力...');
      const htmlContent = await fetchWebPageContent(url);
      const basicResult = extractArticle(htmlContent, url);
      console.log('基础提取结果:', {
        title: basicResult.title,
        contentLength: basicResult.textContent?.length || 0
      });
      
      // 运行完整的混合策略测试
      console.log('运行完整的混合策略测试...');
      const fullResult = await extractMainContent(htmlContent, url);
      console.log('最终选择的提取方法:', fullResult.isBasicExtraction ? '基础提取' : '高级提取');
      console.log('提取结果:', {
        title: fullResult.title,
        contentLength: fullResult.content?.length || fullResult.textContent?.length || 0
      });
      
      return {
        success: true,
        activeTabMatch: activeTab && activeTab.url === url,
        visualizeAvailable: visualizeTabs.length > 0,
        finalMethod: fullResult.isBasicExtraction ? 'basic' : 'advanced',
        title: fullResult.title
      };
    } catch (error) {
      console.error('混合提取策略测试失败:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      console.groupEnd();
    }
  };
  
  // 测试真实AI摘要生成
  self.testRealAISummary = async function(url, userNotes = '') {
    console.group('真实AI摘要生成测试');
    console.log(`URL: ${url}`);
    console.log(`用户笔记: ${userNotes || '(无)'}`);
    
    try {
      // 1. 获取网页内容
      console.log('步骤1: 获取网页内容...');
      const htmlContent = await fetchWebPageContent(url);
      
      // 2. 提取主要内容（使用混合策略）
      console.log('步骤2: 使用混合策略提取主要内容...');
      const article = await extractMainContent(htmlContent, url);
      
      // 3. 处理文本（如果尚未处理）
      console.log('步骤3: 文本预处理...');
      const processedText = article.content || preprocessTextContent(article.textContent);
      
      console.log('文章标题:', article.title);
      console.log('提取方法:', article.isBasicExtraction ? '基础HTML处理' : '高级提取（Readability）');
      console.log('处理后文本长度:', processedText.length, '字符');
      console.log('处理后文本预览:', processedText.substring(0, 150) + '...');
      
      // 4. 调用真实AI生成摘要 (通过 Offscreen Document)
      console.log('步骤4: 调用真实AI生成摘要 (通过 Offscreen Document)...');
      console.log('使用API密钥:', OPENAI_API_KEY.substring(0, 10) + '...' + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 5));
      console.log('使用模型:', AI_CONFIG.summary.defaultModel);
      
      const options = {
        userNotes: userNotes,
        maxLength: AI_CONFIG.summary.chunkSize,
        maxTokens: AI_CONFIG.summary.maxTokens,
        temperature: AI_CONFIG.summary.temperature,
        model: AI_CONFIG.summary.defaultModel // 确保传递模型名称
      };
      
      // 修改为调用 Offscreen Document
      const startTime = Date.now();
      const summary = await callOffscreenToGenerateSummary(processedText, OPENAI_API_KEY, options);
      const duration = Date.now() - startTime;
      
      console.log('AI摘要生成完成!');
      console.log('摘要长度:', summary.length, '字符');
      console.log('生成耗时:', (duration / 1000).toFixed(2), '秒');
      console.log('AI摘要内容:');
      console.log(summary);
      
      return {
        success: true,
        title: article.title,
        extractionMethod: article.isBasicExtraction ? 'basic' : 'advanced',
        summary: summary,
        duration: duration
      };
    } catch (error) {
      console.error('AI摘要生成测试失败:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      console.groupEnd();
    }
  };
}

// 监听来自popup或content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 使用try-catch包装所有消息处理，防止未捕获的异常
  try {
    if (message.action === 'addNode') {
      // 添加新的思维节点
      handleAddNode(message.node, sendResponse);
      // 保持消息通道开放，以便异步返回结果
      return true;
    } else if (message.action === 'getRecentChains') {
      // 获取最近的思维链
      handleGetRecentChains(sendResponse);
      return true;
    } else if (message.action === 'getActiveChain') {
      // 获取当前活动的思维链
      handleGetActiveChain(sendResponse);
      return true;
    } else if (message.action === 'setActiveChain') {
      // 设置活动思维链
      handleSetActiveChain(message.chainId, sendResponse);
      return true;
    } else if (message.action === 'manualSplitChain') {
      handleManualSplitChain(sendResponse);
      return true;
    } else if (message.action === 'updateChainName') {
      handleUpdateChainName(message.chainId, message.newName, sendResponse);
      return true;
    } else if (message.action === 'deleteChain') {
      handleDeleteChain(message.chainId, sendResponse);
      return true;
    } else if (message.action === 'extractContent') {
      // 提取URL内容
      handleExtractContent(message.url, sendResponse);
      return true;
    } else if (message.action === 'getChainSummaryDoc') {
      handleGetChainSummaryDoc(message.chainId, sendResponse);
      return true;
    } else if (message.action === 'requestChainSummary') {
      handleRequestChainSummary(message.chainId, message.nodes, sendResponse, message.customGuidance);
      return true;
    }
  } catch (error) {
    console.error('处理消息时出错:', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

/**
 * 处理内容提取请求
 * @param {string} url - 网页URL
 * @param {Function} callback - 回调函数
 */
async function handleExtractContent(url, callback) {
  if (!url) {
    callback({ success: false, error: 'URL不能为空' });
    return;
  }

  try {
    console.log(`开始处理内容提取请求: ${url}`);
    
    // 1. 获取HTML内容
    const htmlContent = await fetchWebPageContent(url);
    
    // 2. 使用混合策略提取主要内容
    const article = await extractMainContent(htmlContent, url);
    
    // 3. 预处理文本内容（如果还未处理）
    const processedText = article.content || preprocessTextContent(article.textContent);
    
    callback({
      success: true,
      data: {
        title: article.title,
        content: processedText,
        excerpt: article.excerpt || processedText.substr(0, 200) + '...',
        isBasicExtraction: article.isBasicExtraction // 标记是否使用了基础提取方法
      }
    });
  } catch (error) {
    console.error('处理内容提取请求失败:', error);
    callback({
      success: false,
      error: error.message || '内容提取失败'
    });
  }
}

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'capture-thought') {
    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (activeTab) {
        // 创建思维节点对象
        const node = createThoughtNode(activeTab.title, activeTab.url, '');
        // 添加到当前活动的思维链
        const result = await storageService.addNodeToChain(node);
        
        if (result && result.success) {
          // 成功添加节点后，为其生成真实AI摘要
          generateRealNodeAISummaryAndUpdateStorage(node, result.chainId);

          // 通知用户已记录
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: '页面已添加并正在生成AI摘要',
            message: `页面 "${node.title}" 已添加到思维链。AI摘要正在生成中，请稍后在可视化界面查看。`
          });
        } else {
          // 添加失败的通知
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: '添加失败',
            message: '无法将页面添加到思维链。'
          });
        }
      }
    });
  }
});

/**
 * 处理添加节点请求
 * @param {Object} nodeData - 节点数据
 * @param {Function} callback - 回调函数
 */
async function handleAddNode(nodeData, callback) {
  try {
    await ensureInitialized();
    
    // 创建思维节点对象
    const node = createThoughtNode(nodeData.title, nodeData.url, nodeData.notes);
    
    // 添加到当前活动的思维链
    const result = await storageService.addNodeToChain(node);
    
    if (result && result.success) {
      // 成功添加节点后，为其生成真实AI摘要
      generateRealNodeAISummaryAndUpdateStorage(node, result.chainId);
    }

    if (callback) {
      callback(result);
    }
  } catch (error) {
    console.error('添加节点失败:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
}

/**
 * 处理获取最近思维链请求
 * @param {Function} callback - 回调函数
 */
async function handleGetRecentChains(callback) {
  try {
    await ensureInitialized();
    
    const recentChains = await storageService.getRecentChains();
    if (callback) {
      callback({ success: true, chains: recentChains });
    }
  } catch (error) {
    console.error('获取最近思维链失败:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
}

/**
 * 处理获取当前活动思维链请求
 * @param {Function} callback - 回调函数
 */
async function handleGetActiveChain(callback) {
  try {
    await ensureInitialized();
    
    const activeChain = await storageService.getActiveChain();
    if (callback) {
      callback({ success: true, chain: activeChain });
    }
  } catch (error) {
    console.error('获取活动思维链失败:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
}

/**
 * 处理设置活动思维链请求
 * @param {string} chainId - 思维链ID
 * @param {Function} callback - 回调函数
 */
async function handleSetActiveChain(chainId, callback) {
  try {
    await ensureInitialized();
    
    await storageService.setActiveChain(chainId);
    if (callback) {
      callback({ success: true });
    }
  } catch (error) {
    console.error('设置活动思维链失败:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
}

/**
 * 处理手动分割思维链请求
 * @param {Function} sendResponse - 回调函数，用于向调用方发送响应
 */
async function handleManualSplitChain(sendResponse) {
  try {
    await ensureInitialized(); // 确保存储服务已初始化

    // 1. 生成新思维链的名称 (遵循 PRD 3.2.1)
    const newChainName = await storageService.generateNewChainName();

    // 2. 创建新的思维链并将其设为活动链
    //    storageService.createChain 已经处理了ID生成、节点初始化、设置活动状态等
    const newChain = await storageService.createChain(newChainName);

    if (newChain && newChain.id) {
      console.log(`新思维链已创建: ${newChain.name} (ID: ${newChain.id})`);
      sendResponse({ success: true, newChainId: newChain.id, newChainName: newChain.name });
    } else {
      throw new Error('未能创建新的思维链或获取其ID。');
    }

  } catch (error) {
    console.error('手动分割思维链失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理更新思维链名称请求
 * @param {string} chainId - 思维链ID
 * @param {string} newName - 新的思维链名称
 * @param {Function} sendResponse - 回调函数
 */
async function handleUpdateChainName(chainId, newName, sendResponse) {
  try {
    await ensureInitialized(); // 确保存储服务已初始化
    const success = await storageService.updateChainName(chainId, newName);
    if (success) {
      sendResponse({ success: true });
    } else {
      // storageService.updateChainName 内部已经打印了错误，这里可以简单返回失败
      sendResponse({ success: false, error: '更新链名称失败，详情请查看后台日志。' });
    }
  } catch (error) {
    console.error('处理更新链名称请求失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理删除思维链请求
 * @param {string} chainId - 要删除的思维链ID
 * @param {Function} sendResponse - 回调函数
 */
async function handleDeleteChain(chainId, sendResponse) {
  try {
    await ensureInitialized();
    const success = await storageService.deleteChain(chainId);
    if (success) {
      // 获取删除后可能的新活动链ID，以便前端可以尝试选中它
      const newActiveChain = await storageService.getActiveChain(); 
      sendResponse({ success: true, newActiveChainId: newActiveChain ? newActiveChain.id : null });
    } else {
      sendResponse({ success: false, error: '删除思维链失败，可能是因为链不存在。' });
    }
  } catch (error) {
    console.error('处理删除思维链请求失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// --- 新增函数：处理获取链总结文档 --- 
async function handleGetChainSummaryDoc(chainId, sendResponse) {
  if (!chainId) {
    sendResponse({ success: false, error: 'Chain ID 不能为空' });
    return;
  }
  try {
    await ensureInitialized();
    const summaryDoc = await storageService.getChainSummaryDoc(chainId);
    sendResponse({ success: true, summaryDoc: summaryDoc });
  } catch (error) {
    console.error(`获取链总结文档失败 (Chain ID: ${chainId}):`, error);
    sendResponse({ success: false, error: error.message });
  }
}

// --- 新增函数：处理请求生成链总结 --- 
async function handleRequestChainSummary(chainId, nodes, sendResponse, customGuidance = '') {
  if (!chainId || !nodes || !Array.isArray(nodes)) {
    sendResponse({ success: false, error: 'Chain ID 或节点数据无效' });
    return;
  }
  try {
    await ensureInitialized();
    console.log(`收到生成链总结请求 (Chain ID: ${chainId}), 节点数量: ${nodes.length}, 自定义指导: "${customGuidance}"`);
    
    // 打印节点数据结构以供调试
    // console.log('接收到的节点数据:', nodes);

    // --- AI调用前的准备 (步骤 6 from PLAN_ChainSummary_V1.md) ---
    let inputText = "";
    nodes.forEach((node, index) => {
      inputText += `节点 ${index + 1}: ${node.title || '无标题'}\n`;
      inputText += `用户笔记: ${node.notes || '无'}\n`;
      inputText += `AI单节点摘要: ${node.aiSummary || '无'}\n`;
      inputText += `原始链接: ${node.url || '无'}\n`;
      inputText += `---\n`;
    });

    // 根据有无 customGuidance 调整 Prompt
    let systemPrompt = `请仔细分析以下按顺序排列的思维链节点信息。每个节点代表用户浏览和思考的一个步骤，可能包含用户笔记和AI对该节点内容的初步摘要。请基于所有这些信息，生成一篇连贯、深入的总结性报告。这份报告应能清晰地梳理出用户的思考脉络，总结主要观点和发现，探讨不同节点之间的内在联系，并尝试提炼出潜在的结论、洞见或后续值得探索的方向。
`;

    if (customGuidance && customGuidance.trim() !== '') {
      systemPrompt += `
用户为本次总结提供了以下额外的指导说明，请在生成报告时重点参考：
"${customGuidance.trim()}"
`;
    }

    systemPrompt += `
以下是详细的节点信息：

${inputText}

请根据以上全部内容（并特别关注用户提供的额外指导，如有），生成一份结构清晰、内容丰富、**并使用Markdown格式进行排版的总结报告**。报告中应适当使用标题 (例如 ## 标题, ### 副标题)、列表 (例如 - 项目符号) 和重点强调 (例如 **粗体文本**) 等Markdown元素来增强可读性。请直接输出Markdown文本，不要包含任何额外的解释或开头结尾的客套话：`;
    
    console.log("最终构造的AI输入 (部分预览):\n", systemPrompt.substring(0, 900) + "...");

    // --- 开始真实AI调用 --- 
    const chainSummaryConfig = AI_CONFIG.chainSummary;
    const options = {
      modelName: chainSummaryConfig.defaultModel,
      temperature: chainSummaryConfig.temperature,
      maxTokens: chainSummaryConfig.maxTokens,
      // 如果需要在adapter中覆盖默认的chunkSize和chunkOverlap，可以在这里从chainSummaryConfig中读取并传入
      // chunkSize: chainSummaryConfig.chunkSize, 
      // chunkOverlap: chainSummaryConfig.chunkOverlap,
      // userNotes: "", // 对于链总结，核心内容已在systemPrompt中，userNotes可能不需要或有其他用途
    };

    console.log(`准备调用AI进行链总结，使用模型: ${options.modelName}, 温度: ${options.temperature}, 最大Token: ${options.maxTokens}`);

    const generatedDoc = await callOffscreenToGenerateSummary(systemPrompt, OPENAI_API_KEY, options);
    
    console.log(`AI链总结已生成，长度: ${generatedDoc.length}。内容 (部分预览):`, generatedDoc.substring(0, 200) + "...");
    
    await storageService.updateChainSummaryDoc(chainId, generatedDoc);
    sendResponse({ success: true, generatedDoc: generatedDoc });

  } catch (error) {
    const errorMessage = error.message || '生成链总结时发生未知错误';
    console.error(`生成链总结失败 (Chain ID: ${chainId}):`, errorMessage, error);
    try {
      await storageService.updateChainSummaryDoc(chainId, `AI链总结生成失败: ${errorMessage}`);
    } catch (storageErr) {
      console.error(`存储链总结错误信息时也发生错误 (Chain ID: ${chainId}):`, storageErr);
    }
    sendResponse({ success: false, error: errorMessage });
  }
} 