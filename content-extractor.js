/**
 * 思维链记录 - 内容提取脚本
 * 该脚本作为内容脚本执行，用于从当前页面提取主要内容
 */

// 监听来自后台的内容提取请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractCurrentPageContent') {
    console.log('内容提取脚本：收到提取请求');
    extractCurrentPageContent(sendResponse);
    return true; // 保持消息通道开放，以便异步返回结果
  }
});

/**
 * 从当前页面提取主要内容
 * @param {Function} sendResponse - 回调函数，用于返回结果
 */
function extractCurrentPageContent(sendResponse) {
  try {
    console.log('开始从当前页面提取内容...');
    
    // 检查页面上是否有Readability库
    if (typeof Readability === 'undefined') {
      // 如果页面上没有Readability，我们尝试注入并使用
      console.log('页面上没有Readability库，使用基础DOM提取');
      
      // 基础DOM内容提取（不使用Readability库）
      const title = document.title;
      // 尝试获取主要内容（简单版本）
      const content = extractBasicContent();
      
      sendResponse({
        success: true,
        data: {
          title: title,
          content: content,
          isBasicExtraction: true
        }
      });
    } else {
      // 使用Readability提取内容
      console.log('使用Readability提取内容');
      const documentClone = document.cloneNode(true);
      const reader = new Readability(documentClone);
      const article = reader.parse();
      
      if (!article || !article.textContent) {
        throw new Error('Readability无法从页面提取有效内容');
      }
      
      sendResponse({
        success: true,
        data: {
          title: article.title,
          content: article.textContent,
          excerpt: article.excerpt
        }
      });
    }
  } catch (error) {
    console.error('提取页面内容时出错:', error);
    sendResponse({
      success: false,
      error: error.message || '内容提取失败'
    });
  }
}

/**
 * 基础内容提取函数（当Readability不可用时使用）
 * @returns {string} 提取的文本内容
 */
function extractBasicContent() {
  // 移除可能的干扰元素
  const elementsToRemove = [
    'script', 'style', 'nav', 'footer', 'iframe',
    '[role="banner"]', '[role="navigation"]', '[role="complementary"]', '[role="contentinfo"]'
  ];
  
  // 克隆文档以避免修改原始DOM
  const docClone = document.cloneNode(true);
  
  // 移除干扰元素
  elementsToRemove.forEach(selector => {
    const elements = docClone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
  
  // 获取主要内容区域
  // 尝试找到主要内容容器
  const mainSelectors = [
    'main', 
    '[role="main"]', 
    'article', 
    '.article', 
    '.post', 
    '.content', 
    '#content',
    '.main-content'
  ];
  
  let mainContent = null;
  
  // 尝试找到主要内容容器
  for (const selector of mainSelectors) {
    const element = docClone.querySelector(selector);
    if (element) {
      mainContent = element;
      break;
    }
  }
  
  // 如果找不到特定容器，使用body
  if (!mainContent) {
    mainContent = docClone.body;
  }
  
  // 提取文本并清理
  let text = mainContent.innerText || mainContent.textContent;
  
  // 基本清理
  text = text.replace(/[\t\n]+/g, '\n').trim();
  
  return text;
} 