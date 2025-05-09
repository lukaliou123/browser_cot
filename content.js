// content.js
// 在网页中注入的脚本
// 在MVP阶段，暂时只实现最基本的功能

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageInfo') {
    // 返回当前页面的信息
    sendResponse({
      title: document.title,
      url: window.location.href,
      // 可以在这里扩展，添加更多页面信息，如meta标签内容、选中的文本等
    });
  }
}); 