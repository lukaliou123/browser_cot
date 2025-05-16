/**
 * 思维链记录 - 配置文件
 * 包含API密钥和其他配置参数
 * 注意: 本文件仅用于开发测试，不应提交到版本控制系统
 */

// OpenAI API密钥 (仅供本地测试使用)
// 重要: 请不要将您的API密钥直接提交到版本库！
// 请用户自行配置此密钥。
// 推荐方式：
// 1. 创建一个 `js/config.local.js` 文件 (此文件应被添加到 .gitignore 中)。
// 2. 在 `js/config.local.js` 中写入: export const USER_OPENAI_API_KEY = '你的真实API密钥';
// 3. 在需要使用密钥的地方，尝试从 `js/config.local.js` 导入 USER_OPENAI_API_KEY。
//    或者，在应用初始化时，提供一个界面让用户输入。
// 此处提供一个占位符，实际应用中应通过上述方式获取。
export const OPENAI_API_KEY = null; // 或者 'YOUR_API_KEY_GOES_HERE_AND_DO_NOT_COMMIT';

// AI模型配置
export const AI_CONFIG = {
  // 摘要生成配置
  summary: {
    // 默认模型，可以是 'gpt-3.5-turbo' 或 'gpt-4'
    defaultModel: 'gpt-4.1-nano',
    
    // 温度参数 (0-1)，较低的值使输出更确定性，较高的值使输出更多样化
    temperature: 0.3,
    
    // 最大token数量
    maxTokens: 500,
    
    // 摘要的最大长度(字符数)
    maxSummaryLength: 300,
    
    // 用于分割长文本的块大小
    chunkSize: 1000,
    
    // 块重叠大小
    chunkOverlap: 50
  },
  // 新增：链总结配置
  chainSummary: {
    defaultModel: 'gpt-4.1-mini', // 建议的模型，可以根据API支持和效果调整为 gpt-4.1-nano 或其他
    temperature: 0.7,        // 可能需要更有创造性的输出
    maxTokens: 2000,         // 需要更大的输出以生成报告
    // chunkSize 和 chunkOverlap 可以根据需要添加，以覆盖adapter中的默认值
    // chunkSize: 2000, 
    // chunkOverlap: 100 
  }
};

export default {
  OPENAI_API_KEY,
  AI_CONFIG
}; 