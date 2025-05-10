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