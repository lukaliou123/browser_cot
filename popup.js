/**
 * 思维链记录 - 弹出窗口脚本
 * 处理弹出窗口的UI交互和数据展示
 */

import { storageService } from './js/storage.js';

// 获取DOM元素
const currentTitle = document.getElementById('current-title');
const currentUrl = document.getElementById('current-url');
const captureBtn = document.getElementById('captureBtn');
const recentChains = document.getElementById('recent-chains');
const viewAllBtn = document.getElementById('viewAllBtn');
const noteInput = document.getElementById('noteInput');
const languageSelect = document.getElementById('language-select');

// 页面加载时获取当前标签页信息和最近的思维链
document.addEventListener('DOMContentLoaded', () => {
  // 获取当前活动标签页信息
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) {
      currentTitle.textContent = activeTab.title;
      currentUrl.textContent = activeTab.url;
    }
  });
  
  // 加载最近的思维链
  loadRecentChains();
  
  // 加载用户设置
  loadAndApplySettings();
});

/**
 * 加载并应用用户设置
 */
async function loadAndApplySettings() {
  try {
    const settings = await storageService.getSettings();
    
    // 设置语言选择
    if (settings.aiLanguage) {
      languageSelect.value = settings.aiLanguage;
    }
    
    // 监听语言选择变化
    languageSelect.addEventListener('change', async () => {
      const selectedLanguage = languageSelect.value;
      await storageService.updateSetting('aiLanguage', selectedLanguage);
      console.log(`语言偏好已更新为: ${selectedLanguage}`);
    });
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

/**
 * 安全地发送消息并处理可能的错误
 * @param {Object} message - 要发送的消息
 * @param {Function} callback - 回调函数
 */
function sendMessage(message, callback) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      // 检查runtime.lastError以防止未捕获的错误
      if (chrome.runtime.lastError) {
        console.error('消息发送错误:', chrome.runtime.lastError.message);
        if (callback) {
          callback(null);
        }
        return;
      }
      
      if (callback) {
        callback(response);
      }
    });
  } catch (error) {
    console.error('发送消息异常:', error);
    if (callback) {
      callback(null);
    }
  }
}

/**
 * 加载最近的思维链
 */
function loadRecentChains() {
  sendMessage({ action: 'getRecentChains' }, (response) => {
    if (response && response.success) {
      displayRecentChains(response.chains);
    } else {
      showEmptyState('加载失败，请重试');
    }
  });
}

/**
 * 显示最近的思维链
 * @param {Array} chains - 思维链数组
 */
function displayRecentChains(chains) {
  // 清空当前内容
  recentChains.innerHTML = '';
  
  if (!chains || chains.length === 0) {
    showEmptyState('暂无记录');
    return;
  }
  
  // 为每个思维链创建一个列表项
  chains.forEach(chain => {
    const chainItem = document.createElement('div');
    chainItem.className = 'chain-item';
    chainItem.dataset.chainId = chain.id; // 添加chainId到dataset属性
    
    // 思维链标题
    const chainTitle = document.createElement('div');
    chainTitle.className = 'chain-title';
    chainTitle.textContent = chain.name;
    
    // 思维链信息
    const chainInfo = document.createElement('div');
    chainInfo.className = 'chain-info';
    
    // 节点数量
    const nodeCount = document.createElement('span');
    nodeCount.className = 'node-count';
    nodeCount.textContent = `${chain.nodes.length} 个节点`;
    
    // 更新时间
    const updateTime = document.createElement('span');
    updateTime.className = 'update-time';
    updateTime.textContent = formatDate(chain.updatedAt);
    
    // 组装UI元素
    chainInfo.appendChild(nodeCount);
    chainInfo.appendChild(updateTime);
    
    chainItem.appendChild(chainTitle);
    chainItem.appendChild(chainInfo);
    
    // 添加点击事件，设置为当前活动的思维链
    chainItem.addEventListener('click', () => {
      setActiveChain(chain.id);
    });
    
    recentChains.appendChild(chainItem);
  });
}

/**
 * 显示空状态
 * @param {string} message - 显示的消息
 */
function showEmptyState(message) {
  recentChains.innerHTML = `<div class="empty-state">${message}</div>`;
}

/**
 * 设置活动思维链
 * @param {string} chainId - 思维链ID
 */
function setActiveChain(chainId) {
  sendMessage({ 
    action: 'setActiveChain',
    chainId: chainId
  }, (response) => {
    if (response && response.success) {
      // 可视化反馈，例如高亮选中的链
      const items = recentChains.querySelectorAll('.chain-item');
      items.forEach(item => item.classList.remove('active'));
      
      // 找到选中的项并添加active类
      const targetItem = Array.from(items).find(
        item => item.dataset.chainId === chainId
      );
      if (targetItem) {
        targetItem.classList.add('active');
      }
    }
  });
}

/**
 * 格式化日期
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化的日期字符串
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  
  // 如果是今天，显示时间
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  
  // 如果是昨天，显示"昨天"
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天';
  }
  
  // 其他情况显示日期
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 添加到思维链按钮点击事件
captureBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) {
      // 创建新的思维节点数据
      const nodeData = {
        title: activeTab.title,
        url: activeTab.url,
        notes: noteInput.value // 获取用户输入的笔记
      };
      
      // 发送添加节点请求到background脚本
      sendMessage({ 
        action: 'addNode', 
        node: nodeData 
      }, (response) => {
        if (response && response.success) {
          // 更新UI显示成功消息
          captureBtn.textContent = '✓ 已添加';
          captureBtn.disabled = true;
          // 清空笔记输入框
          noteInput.value = '';
          // 重新加载最近的思维链
          loadRecentChains();
          
          // 恢复按钮状态
          setTimeout(() => {
            captureBtn.textContent = '添加到思维链';
            captureBtn.disabled = false;
          }, 1500);
        }
      });
    }
  });
});

// 查看所有思维链按钮点击事件
viewAllBtn.addEventListener('click', (e) => {
  e.preventDefault();
  // 将在第4阶段实现可视化界面
  chrome.tabs.create({ url: 'visualize.html' });
}); 