/**
 * Readability Adapter for Chrome Extension
 * This file adapts the Mozilla Readability library for use in Chrome extensions with ES modules.
 * 在Service Worker环境中使用，不再依赖全局window对象
 */

/**
 * 简单的HTML内容预处理函数
 * 当无法使用完整的Readability库时，提供基本的内容提取功能
 * @param {string} htmlString - 原始HTML内容
 * @returns {Object} - 包含title和textContent的简化文章对象
 */
function basicHTMLProcessing(htmlString) {
  // 使用正则表达式提取标题
  const titleMatch = htmlString.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : '未知标题';
  
  // 移除script、style标签和HTML注释
  let processedHTML = htmlString
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  
  // 移除所有HTML标签，保留文本内容
  const textContent = processedHTML
    .replace(/<[^>]+>/g, ' ') // 将标签替换为空格
    .replace(/\s+/g, ' ')    // 多个空格替换为单个空格
    .trim();
  
  return {
    title: title,
    textContent: textContent,
    content: textContent, // 与Readability输出保持一致
    excerpt: textContent.substring(0, 200) + '...',
    length: textContent.length,
    isBasicExtraction: true
  };
}

/**
 * 提取HTML内容的主函数
 * 在Service Worker中不能直接使用Readability，所以这里使用基本的文本提取方法
 * 更复杂的处理会转发到可以访问DOM的环境（如内容脚本或visualize.js）
 * 
 * @param {string} htmlString - HTML内容
 * @param {string} [baseUrl=''] - 可选的基础URL
 * @returns {Object} - 提取的文章对象
 */
export function extractArticle(htmlString, baseUrl = '') {
  try {
    console.log('Service Worker环境: 使用基础HTML处理（不使用Readability）');
    return basicHTMLProcessing(htmlString);
  } catch (error) {
    console.error('提取文章内容时出错:', error);
    throw error;
  }
}

export default {
  extractArticle
}; 