// 获取DOM元素
const currentTitle = document.getElementById('current-title');
const currentUrl = document.getElementById('current-url');
const captureBtn = document.getElementById('captureBtn');
const recentChains = document.getElementById('recent-chains');
const viewAllBtn = document.getElementById('viewAllBtn');

// 页面加载时获取当前标签页信息
document.addEventListener('DOMContentLoaded', () => {
  // 获取当前活动标签页信息
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) {
      currentTitle.textContent = activeTab.title;
      currentUrl.textContent = activeTab.url;
    }
  });
  
  // 加载最近的思维链(暂未实现数据存储，留空)
});

// 添加到思维链按钮点击事件
captureBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) {
      // 创建新的思维节点
      const node = {
        title: activeTab.title,
        url: activeTab.url,
        timestamp: Date.now(),
        notes: '' // 暂不支持添加笔记
      };
      
      // 在后台脚本中处理数据存储
      chrome.runtime.sendMessage({ 
        action: 'addNode', 
        node: node 
      }, (response) => {
        if (response && response.success) {
          // 更新UI显示成功消息
          captureBtn.textContent = '✓ 已添加';
          captureBtn.disabled = true;
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