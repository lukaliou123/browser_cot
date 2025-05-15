/**
 * LangChain Adapter for Chrome Extension
 * 
 * This file provides an adapter for using LangChain.js in a Chrome extension.
 * It loads the necessary LangChain components from CDN and provides a simple API
 * for generating summaries.
 */

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
 * @returns {Promise<string>} - The generated summary
 */
export async function generateSummary(text, apiKey, options = {}) {
  try {
    // Default options
    const { 
      userNotes = '', 
      maxLength = 1000
    } = options;
    
    // Dynamically import LangChain modules from CDN
    const { OpenAI } = await import('https://cdn.jsdelivr.net/npm/@langchain/openai@0.0.14/+esm');
    const { loadSummarizationChain } = await import('https://cdn.jsdelivr.net/npm/langchain@0.1.16/+esm');
    const { RecursiveCharacterTextSplitter } = await import('https://cdn.jsdelivr.net/npm/langchain@0.1.16/text_splitter/+esm');
    
    // Create OpenAI model instance with the provided API key
    const model = new OpenAI({ 
      openAIApiKey: apiKey,
      temperature: 0.3,
      modelName: 'gpt-3.5-turbo'
    });
    
    // Split the text into chunks if it's too long
    const textSplitter = new RecursiveCharacterTextSplitter({
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
    const chain = loadSummarizationChain(model, { type: "map_reduce" });
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