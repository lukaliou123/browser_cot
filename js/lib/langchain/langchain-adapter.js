/**
 * LangChain Adapter for Chrome Extension
 * 
 * This file provides an adapter for using LangChain.js in a Chrome extension.
 * It now uses statically imported Langchain modules that will be bundled.
 */

import { ChatOpenAI } from "@langchain/openai";
import { loadSummarizationChain } from "langchain/chains";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PromptTemplate } from "@langchain/core/prompts";

// We'll use CDN imports for LangChain to avoid bundling complexity
// These will be dynamically imported when needed

/**
 * Generate a summary for the given text using LangChain and the specified API key
 * 
 * @param {string} text - The text to summarize
 * @param {string} apiKey - The OpenAI API key
 * @param {Object} options - Additional options
 * @param {string} [options.userNotes=''] - Optional user notes to guide the summarization
 * @param {number} [options.chunkSize=1000] - Maximum length of text to summarize per chunk
 * @param {number} [options.chunkOverlap=50] - Overlap between chunks
 * @param {boolean} [options.mockMode=false] - Explicitly pass mockMode
 * @param {string} [options.modelName='gpt-4o-mini'] - Model name to use
 * @param {number} [options.temperature=0.3] - Temperature for the model
 * @param {number} [options.maxTokens=500] - Maximum number of tokens to generate
 * @param {string} [options.targetLanguage='zh-CN'] - Target language for the summary
 * @returns {Promise<string>} - The generated summary
 */
export async function generateSummary(text, apiKey, options = {}) {
  try {
    // Default options and parameters from options
    const {
      userNotes = '',
      chunkSize = options.chunkSize || 1000, 
      chunkOverlap = options.chunkOverlap || 50, 
      mockMode = false,
      modelName = options.modelName || 'gpt-4o-mini', 
      temperature = options.temperature !== undefined ? options.temperature : 0.3, 
      maxTokens = options.maxTokens || 500, 
      targetLanguage = options.targetLanguage || 'zh-CN' 
    } = options;

    console.log('[langchain-adapter] Received options:', JSON.stringify(options)); // 打印接收到的完整options
    console.log(`[langchain-adapter] Generating summary with language: ${targetLanguage}, model: ${modelName}`); // 修改日志，更清晰
    
    // 增强调试 - 明确检查系统提示语言
    if (options.systemPrompt) {
      console.log(`[langchain-adapter] System prompt contains language instruction: ${options.systemPrompt.includes(targetLanguage)}`);
      console.log(`[langchain-adapter] System prompt: ${options.systemPrompt.substring(0, 100)}...`);
    } else {
      console.log(`[langchain-adapter] No system prompt provided, will use language: ${targetLanguage} in chain prompts`);
    }

    let currentOpenAI;
    let currentLoadSummarizationChain;
    let currentRecursiveCharacterTextSplitter;
    let currentPromptTemplate;

    if (mockMode) {
      console.log('Offscreen Document: 使用模拟的Langchain实现...');
      currentOpenAI = MockOpenAI;
      currentLoadSummarizationChain = mockLoadSummarizationChain;
      currentRecursiveCharacterTextSplitter = MockTextSplitter;
    } else {
      console.log('Offscreen Document: 使用真实的Langchain实现 (statically imported)...');
      currentOpenAI = ChatOpenAI;
      currentLoadSummarizationChain = loadSummarizationChain;
      currentRecursiveCharacterTextSplitter = RecursiveCharacterTextSplitter;
      currentPromptTemplate = PromptTemplate;
    }
    
    // Create OpenAI model instance with the provided API key and resolved parameters
    const modelParams = {
      openAIApiKey: apiKey,
      temperature: temperature,
      modelName: modelName,
      maxTokens: maxTokens
    };
    
    // For the most recent versions of LangChain, the proper way to set a system message
    // might vary, so let's try a more compatible approach
    const model = new currentOpenAI(modelParams);
    
    // Store the system prompt in the chain options for direct use in chain creation
    let systemPromptForChain = null;
    if (options.systemPrompt) {
      console.log(`[langchain-adapter] Will use system prompt in chain configuration`);
      systemPromptForChain = options.systemPrompt;
    }
    
    // Split the text into chunks if it's too long
    const textSplitter = new currentRecursiveCharacterTextSplitter({
      chunkSize: chunkSize, // Use resolved chunkSize
      chunkOverlap: chunkOverlap // Use resolved chunkOverlap
    });
    
    // Prepare the text with user notes if available
    let processedText = text;
    if (userNotes && userNotes.trim().length > 0) {
      processedText = `用户笔记（提供了重要的背景信息或关注点）：\n${userNotes}\n\n正文内容：\n${text}`;
    }
    
    // Create documents from the text
    const docs = await textSplitter.createDocuments([processedText]);
    
    // 为map_reduce类型的总结创建针对特定语言的提示模板
    const chainOptions = { 
      type: "map_reduce",
      verbose: true  // Enable verbose mode to see what's happening in the chain
    };
    
    // 如果不是mock模式且提供了目标语言，则创建自定义的prompt templates
    if (!mockMode && targetLanguage) {
      // Enhanced map prompt with stronger language instruction
      let mapTemplate = '';
      if (targetLanguage === 'zh-CN') {
        mapTemplate = `请用中文对以下文本进行简明扼要的总结:\n\n{text}\n\n中文简明总结:`;
      } else {
        mapTemplate = `Write a concise summary of the following text in ${targetLanguage}:\n\n{text}\n\nCONCISE SUMMARY IN ${targetLanguage}:`;
      }
      
      const mapPrompt = new currentPromptTemplate({
        template: mapTemplate,
        inputVariables: ["text"],
      });
      
      // Enhanced combine prompt with stronger language instruction
      let combineTemplate = '';
      if (targetLanguage === 'zh-CN') {
        combineTemplate = `以下是一系列摘要内容:\n\n{text}\n\n请将这些摘要整合为一份全面、连贯的中文总结。请确保完全用中文撰写，并加入你对要点和见解的综合分析。`;
      } else {
        combineTemplate = `The following is a set of summaries:\n\n{text}\n\nTake these and combine them into a final, comprehensive summary in ${targetLanguage}. Add your synthesis of the key points and insights.`;
      }
      
      const combinePrompt = new currentPromptTemplate({
        template: combineTemplate,
        inputVariables: ["text"],
      });
      
      chainOptions.map_prompt = mapPrompt;
      chainOptions.combine_prompt = combinePrompt;
    }
    
    // Load and use the summarization chain with language-specific prompts
    const chain = currentLoadSummarizationChain(model, chainOptions);
    
    // Create call parameters with documents
    const callParams = {
      input_documents: docs
    };
    
    // If we have a system prompt, add it as a parameter
    if (systemPromptForChain) {
      callParams.prompt = systemPromptForChain;
    }
    
    console.log(`[langchain-adapter] Calling chain with params:`, JSON.stringify(callParams, null, 2));
    const result = await chain.call(callParams);
    
    return result.text;
  } catch (error) {
    console.error('Error generating summary with LangChain:', error);
    throw error;
  }
}

export default {
  generateSummary
}; 