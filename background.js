/**
 * 思维链记录 - 后台脚本
 * 处理扩展的后台逻辑和数据管理
 */

// 在类型=module的脚本中，需要使用完整的相对路径
import { createThoughtNode } from './js/models.js';
import { storageService } from './js/storage.js';

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
    }
  } catch (error) {
    console.error('处理消息时出错:', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

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
        await storageService.addNodeToChain(node);
        // 可选：通知用户已记录（如使用chrome.notifications）
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: 'images/icon48.png',
          title: 'Thought Captured',
          message: 'Current page has been added to your thought chain.'
        });
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