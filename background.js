/**
 * 思维链记录 - 后台脚本
 * 处理扩展的后台逻辑和数据管理
 */

// 在类型=module的脚本中，需要使用完整的相对路径
import { createThoughtNode } from './js/models.js';
import { storageService } from './js/storage.js';
import { extractArticle } from './js/lib/readability/readability-adapter.js';

// 存储初始化标志
let isInitialized = false;

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
    const article = extractArticle(htmlContent, url);
    
    if (!article || !article.textContent) {
      throw new Error('无法从网页提取有效内容');
    }
    
    console.log(`成功提取内容，标题: "${article.title}", 正文长度: ${article.textContent.length} 字符`);
    return article;
  } catch (error) {
    console.error('提取网页内容失败:', error);
    throw error;
  }
}

/**
 * 处理提取的文本内容
 * @param {string} textContent - 提取的文本内容
 * @returns {string} 处理后的文本
 */
function preprocessTextContent(textContent) {
  if (!textContent) {
    return '';
  }

  // 移除多余的空行
  let processed = textContent.replace(/\n{3,}/g, '\n\n');
  
  // 移除行首行尾的空白
  processed = processed.split('\n')
    .map(line => line.trim())
    .join('\n');
  
  // 截断过长的文本 (临时方案，后续会由LangChain的分割器更好地处理)
  const maxLength = 10000;
  if (processed.length > maxLength) {
    processed = processed.substring(0, maxLength) + '...';
    console.log(`文本过长，已截断至 ${maxLength} 字符`);
  }
  
  return processed;
}

/**
 * 模拟生成节点AI摘要并更新存储
 * @param {ThoughtNode} node - 刚添加的思维节点对象 (应包含id和title)
 * @param {string} chainId - 节点所属的思维链ID
 */
async function simulateAndUpdateNodeAISummary(node, chainId) {
  if (!node || !node.id || !node.title || !chainId) {
    console.warn('simulateAndUpdateNodeAISummary: 缺少必要的node信息或chainId。', { node, chainId });
    return;
  }

  console.log(`开始为节点 "${node.title}" (ID: ${node.id}) 模拟生成AI摘要...`);

  // 模拟AI处理延迟
  await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟2秒延迟

  const sampleSummary = `这是一个AI生成的关于【${node.title}】的示例摘要内容...`;
  
  try {
    const success = await storageService.updateNodeAISummary(chainId, node.id, sampleSummary);
    if (success) {
      console.log(`节点 "${node.title}" (ID: ${node.id}) 的模拟AI摘要已成功存储。`);
    } else {
      console.warn(`存储节点 "${node.title}" (ID: ${node.id}) 的模拟AI摘要失败。`);
    }
  } catch (error) {
    console.error(`为节点 "${node.title}" (ID: ${node.id}) 更新AI摘要时出错:`, error);
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
    const processedText = preprocessTextContent(article.textContent);
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
      
      // 2. 提取主要内容
      console.log('步骤2: 提取主要内容...');
      const article = await extractMainContent(htmlContent, url);
      
      // 3. 处理文本
      console.log('步骤3: 文本预处理...');
      const processedText = preprocessTextContent(article.textContent);
      
      // 4. 模拟结果
      console.log('完整处理流程测试完成!');
      console.log('文章标题:', article.title);
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
    const htmlContent = await fetchWebPageContent(url);
    const article = await extractMainContent(htmlContent, url);
    const processedText = preprocessTextContent(article.textContent);
    
    callback({
      success: true,
      data: {
        title: article.title,
        content: processedText,
        excerpt: processedText.substr(0, 200) + '...' // 返回部分内容作为预览
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
          // 成功添加节点后，为其模拟生成AI摘要
          // node 对象在 createThoughtNode 时已经有了 title，在 addNodeToChain 内部被赋予了id
          // result.chainId 是节点所属的链ID
          simulateAndUpdateNodeAISummary(node, result.chainId);

          // 可选：通知用户已记录（如使用chrome.notifications）
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: 'Thought Captured & AI Summary Pending', // 更新通知标题
            message: `Page added to chain. Simulated AI summary for "${node.title}" will be generated.` // 更新通知消息
          });
        } else {
          // 添加失败的通知 (可选)
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: 'Capture Failed',
            message: 'Failed to add page to thought chain.'
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
      // 成功添加节点后，为其模拟生成AI摘要
      simulateAndUpdateNodeAISummary(node, result.chainId);
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