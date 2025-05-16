/**
 * Offscreen Document 处理器
 * 负责在DOM环境中执行Langchain.js操作
 */

// MOCK_MODE 定义，将传递给 adapter 中的 generateSummary
const MOCK_MODE = false; // 设置为true使用模拟模式

// 从新的 adapter 导入 generateSummary 函数
import { generateSummary } from './js/lib/langchain/langchain-adapter.js';

console.log('Offscreen Document: 初始化开始...');

// 消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Offscreen Document 收到消息, action:', message.action);

  if (message.action === 'generateSummary') {
    console.log('Offscreen Document: 收到 generateSummary 请求。');
    // 直接调用新的处理函数
    handleGenerateSummaryRequest(message, sendResponse);
    return true; // 表明将异步地发送响应
  } else {
    console.warn('Offscreen Document: 收到未知 action:', message.action);
    // 对于未知action，可以选择不响应或发送一个错误
    // sendResponse({ success: false, error: 'Unknown action' }); 
  }
  // 对于非异步响应或不需要响应的情况，可以不返回true或返回false
});

// 异步处理摘要生成请求的函数 (已简化)
async function handleGenerateSummaryRequest(message, sendResponse) {
  try {
    console.log('Offscreen Document: 开始执行 generateSummary (from adapter)...');
    
    // 准备传递给 adapter 的 options，包括 mockMode
    const options = { 
      ...(message.options || {}), // 保留来自 background.js 的其他 options
      mockMode: MOCK_MODE 
    };

    const summary = await generateSummary( // 调用导入的函数
      message.text,
      message.apiKey,
      options 
    );
    console.log('Offscreen Document: 摘要已生成，准备发送响应。');
    sendResponse({ success: true, summary: summary });
  } catch (error) {
    console.error('Offscreen Document: 在 handleGenerateSummaryRequest 中捕获到错误:', error);
    sendResponse({ success: false, error: error.message || 'Offscreen Document内部处理摘要时发生未知错误' });
  }
}

console.log('Offscreen Document: 初始化完成。等待消息...');
// 移除了原有的模块预加载逻辑，因为模块现在是静态导入的
