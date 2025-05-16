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
 * @param {number} [options.maxLength=1000] - Maximum length of text to summarize per chunk
 * @param {boolean} [options.mockMode=false] - Explicitly pass mockMode
 * @returns {Promise<string>} - The generated summary
 */
export async function generateSummary(text, apiKey, options = {}) {
  try {
    // Default options
    const { 
      userNotes = '', 
      maxLength = 1000,
      mockMode = false
    } = options;
    
    let currentOpenAI;
    let currentLoadSummarizationChain;
    let currentRecursiveCharacterTextSplitter;

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
    }
    
    // Create OpenAI model instance with the provided API key
    const model = new currentOpenAI({ 
      openAIApiKey: apiKey,
      temperature: 0.3,
      modelName: 'gpt-4o-mini'
    });
    
    // Split the text into chunks if it's too long
    const textSplitter = new currentRecursiveCharacterTextSplitter({
      chunkSize: maxLength,
      chunkOverlap: 50
    });
    
    // Prepare the text with user notes if available
    let processedText = text;
    if (userNotes && userNotes.trim().length > 0) {
      processedText = `用户笔记（提供了重要的背景信息或关注点）：\n${userNotes}\n\n正文内容：\n${text}`;
    }
    
    // Create documents from the text
    const docs = await textSplitter.createDocuments([processedText]);
    
    // Load and use the summarization chain
    const chain = currentLoadSummarizationChain(model, { type: "map_reduce" });
    const result = await chain.call({
      input_documents: docs
    });
    
    return result.text;
  } catch (error) {
    console.error('Error generating summary with LangChain:', error);
    throw error;
  }
}

export default {
  generateSummary
}; 