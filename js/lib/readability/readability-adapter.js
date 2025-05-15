/**
 * Readability Adapter for Chrome Extension
 * This file adapts the Mozilla Readability library for use in Chrome extensions with ES modules.
 */

// Import from global scope (these will be loaded via script tags in our extension)
// Note: This assumes JSDOMParser.js and Readability.js are loaded before this file
const { Readability } = window;

/**
 * Extract the main content from a HTML string using Readability
 * @param {string} htmlString - The HTML content to parse
 * @param {string} [baseUrl=''] - Optional base URL for the document
 * @returns {Object} - The extracted article with title, content, textContent, etc.
 */
export function extractArticle(htmlString, baseUrl = '') {
  try {
    // Create a DOM document from the HTML string
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    
    // Set the document.baseURI if a baseUrl is provided
    if (baseUrl) {
      const baseElement = document.createElement('base');
      baseElement.href = baseUrl;
      doc.head.appendChild(baseElement);
    }
    
    // Create a new Readability object and parse
    const reader = new Readability(doc);
    const article = reader.parse();
    
    return article;
  } catch (error) {
    console.error('Error extracting article with Readability:', error);
    throw error;
  }
}

export default {
  extractArticle
}; 