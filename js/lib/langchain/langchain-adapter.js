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
 * @returns {Promise<string>} - The generated summary
 */
export async function generateSummary(text, apiKey, options = {}) {
  try {
    // Default options and parameters from options
    const {
      userNotes = '',
      // For text splitter - chunkSize was previously maxLength
      chunkSize = options.chunkSize || 1000, // Default chunkSize for text splitter
      chunkOverlap = options.chunkOverlap || 50, // Default chunkOverlap for text splitter
      mockMode = false,
      // For OpenAI model - allow overriding from options
      modelName = options.modelName || 'gpt-4o-mini', // Default model if not provided in options
      temperature = options.temperature !== undefined ? options.temperature : 0.3, // Default temp if not in options
      maxTokens = options.maxTokens || 500 // Default maxTokens if not in options
    } = options;

    // console.log('generateSummary options received:', options);
    // console.log('Using modelName:', modelName, 'temp:', temperature, 'maxTokens:', maxTokens, 'chunkSize:', chunkSize);

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
    
    // Create OpenAI model instance with the provided API key and resolved parameters
    const model = new currentOpenAI({ 
      openAIApiKey: apiKey,
      temperature: temperature,
      modelName: modelName,
      maxTokens: maxTokens // Pass maxTokens to the model if supported/needed by the specific model class
    });
    
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