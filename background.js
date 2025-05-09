// 初始化应用
chrome.runtime.onInstalled.addListener(() => {
  console.log('思维链记录扩展已安装');
  
  // 初始化存储
  chrome.storage.local.get(['thoughtChains', 'activeChainId'], (result) => {
    if (!result.thoughtChains) {
      chrome.storage.local.set({
        thoughtChains: [], // 所有思维链数组
        activeChainId: null // 当前活动的思维链ID
      });
    }
  });
});

// 监听来自popup或content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addNode') {
    // 添加新的思维节点
    addNode(message.node, sendResponse);
    // 保持消息通道开放，以便异步返回结果
    return true;
  }
});

// 添加新节点
function addNode(node, callback) {
  chrome.storage.local.get(['thoughtChains', 'activeChainId'], (result) => {
    let { thoughtChains, activeChainId } = result;
    
    // 如果没有激活的链，创建一个新链
    if (!activeChainId || !thoughtChains.some(chain => chain.id === activeChainId)) {
      const newChain = {
        id: generateId(),
        name: `思维链 ${new Date().toLocaleDateString()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodes: []
      };
      
      activeChainId = newChain.id;
      thoughtChains.push(newChain);
    }
    
    // 找到当前活动的链
    const activeChain = thoughtChains.find(chain => chain.id === activeChainId);
    
    // 添加节点
    node.id = generateId();
    activeChain.nodes.push(node);
    activeChain.updatedAt = Date.now();
    
    // 更新存储
    chrome.storage.local.set({ thoughtChains, activeChainId }, () => {
      if (callback) {
        callback({ success: true, chainId: activeChainId, nodeId: node.id });
      }
    });
  });
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
} 