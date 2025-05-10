/**
 * 思维链记录 - 存储服务
 * 处理思维链和思维节点的存储、检索和管理
 */

import { generateId, createThoughtChain } from './models.js';

// 存储键名
const STORAGE_KEYS = {
  THOUGHT_CHAINS: 'thoughtChains',
  ACTIVE_CHAIN_ID: 'activeChainId'
};

/**
 * 存储服务类
 */
class StorageService {
  /**
   * 初始化存储
   * @returns {Promise} 初始化完成的Promise
   */
  async initialize() {
    const data = await this.getData();
    
    // 如果存储为空，初始化默认值
    if (!data.thoughtChains) {
      await this.setData({
        thoughtChains: [],
        activeChainId: null
      });
    }
    
    return true;
  }
  
  /**
   * 获取存储的所有数据
   * @returns {Promise<Object>} 包含存储数据的Promise
   */
  getData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.THOUGHT_CHAINS, STORAGE_KEYS.ACTIVE_CHAIN_ID], (result) => {
        resolve(result);
      });
    });
  }
  
  /**
   * 设置存储数据
   * @param {Object} data - 要存储的数据
   * @returns {Promise} 完成存储的Promise
   */
  setData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => {
        resolve(true);
      });
    });
  }
  
  /**
   * 获取所有思维链
   * @returns {Promise<ThoughtChain[]>} 思维链数组Promise
   */
  async getAllChains() {
    const data = await this.getData();
    return data.thoughtChains || [];
  }
  
  /**
   * 获取当前活动的思维链
   * @returns {Promise<ThoughtChain|null>} 当前活动的思维链Promise
   */
  async getActiveChain() {
    const data = await this.getData();
    
    if (!data.activeChainId || !data.thoughtChains) {
      return null;
    }
    
    return data.thoughtChains.find(chain => chain.id === data.activeChainId) || null;
  }
  
  /**
   * 通过ID获取思维链
   * @param {string} chainId - 思维链ID
   * @returns {Promise<ThoughtChain|null>} 思维链Promise
   */
  async getChainById(chainId) {
    const chains = await this.getAllChains();
    return chains.find(chain => chain.id === chainId) || null;
  }
  
  /**
   * 设置活动思维链
   * @param {string} chainId - 思维链ID
   * @returns {Promise<boolean>} 操作结果Promise
   */
  async setActiveChain(chainId) {
    await this.setData({ [STORAGE_KEYS.ACTIVE_CHAIN_ID]: chainId });
    return true;
  }
  
  /**
   * 创建新的思维链
   * @param {string} [name=null] - 思维链名称(可选)
   * @returns {Promise<ThoughtChain>} 新创建的思维链Promise
   */
  async createChain(name = null) {
    const data = await this.getData();
    const newChain = createThoughtChain(name);
    
    const chains = data.thoughtChains || [];
    chains.push(newChain);
    
    await this.setData({
      [STORAGE_KEYS.THOUGHT_CHAINS]: chains,
      [STORAGE_KEYS.ACTIVE_CHAIN_ID]: newChain.id
    });
    
    return newChain;
  }
  
  /**
   * 添加思维节点到思维链
   * @param {ThoughtNode} node - 思维节点
   * @param {string} [chainId=null] - 思维链ID(可选，默认添加到活动链)
   * @returns {Promise<Object>} 包含操作结果的Promise
   */
  async addNodeToChain(node, chainId = null) {
    const data = await this.getData();
    let chains = data.thoughtChains || [];
    let targetChainId = chainId || data.activeChainId;
    
    // 如果没有目标链或找不到目标链，创建新链
    if (!targetChainId || !chains.some(chain => chain.id === targetChainId)) {
      const newChain = createThoughtChain();
      chains.push(newChain);
      targetChainId = newChain.id;
    }
    
    // 找到目标链并添加节点
    const targetChain = chains.find(chain => chain.id === targetChainId);
    
    // 确保节点有ID
    if (!node.id) {
      node.id = generateId();
    }
    
    targetChain.nodes.push(node);
    targetChain.updatedAt = Date.now();
    
    await this.setData({
      [STORAGE_KEYS.THOUGHT_CHAINS]: chains,
      [STORAGE_KEYS.ACTIVE_CHAIN_ID]: targetChainId
    });
    
    return {
      success: true,
      chainId: targetChainId,
      nodeId: node.id
    };
  }
  
  /**
   * 从思维链中删除节点
   * @param {string} nodeId - 节点ID
   * @param {string} chainId - 思维链ID
   * @returns {Promise<boolean>} 操作结果Promise
   */
  async removeNodeFromChain(nodeId, chainId) {
    const chain = await this.getChainById(chainId);
    if (!chain) return false;
    
    const nodeIndex = chain.nodes.findIndex(node => node.id === nodeId);
    if (nodeIndex === -1) return false;
    
    chain.nodes.splice(nodeIndex, 1);
    chain.updatedAt = Date.now();
    
    const chains = await this.getAllChains();
    const chainIndex = chains.findIndex(c => c.id === chainId);
    chains[chainIndex] = chain;
    
    await this.setData({ [STORAGE_KEYS.THOUGHT_CHAINS]: chains });
    return true;
  }
  
  /**
   * 删除思维链
   * @param {string} chainId - 思维链ID
   * @returns {Promise<boolean>} 操作结果Promise
   */
  async deleteChain(chainId) {
    const data = await this.getData();
    const chains = data.thoughtChains.filter(chain => chain.id !== chainId);
    
    // 如果删除的是当前活动链，重置活动链
    let activeChainId = data.activeChainId;
    if (activeChainId === chainId) {
      activeChainId = chains.length > 0 ? chains[0].id : null;
    }
    
    await this.setData({
      [STORAGE_KEYS.THOUGHT_CHAINS]: chains,
      [STORAGE_KEYS.ACTIVE_CHAIN_ID]: activeChainId
    });
    
    return true;
  }
  
  /**
   * 获取最近的思维链
   * @param {number} [limit=5] - 返回的最大链数量
   * @returns {Promise<ThoughtChain[]>} 最近的思维链数组Promise
   */
  async getRecentChains(limit = 5) {
    const chains = await this.getAllChains();
    
    // 按更新时间排序
    return chains
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }
  
  /**
   * 获取最近的思维节点
   * @param {number} [limit=10] - 返回的最大节点数量
   * @returns {Promise<Object[]>} 包含节点和所属链信息的数组Promise
   */
  async getRecentNodes(limit = 10) {
    const chains = await this.getAllChains();
    const nodes = [];
    
    // 从所有链中提取节点
    chains.forEach(chain => {
      chain.nodes.forEach(node => {
        nodes.push({
          node: node,
          chainId: chain.id,
          chainName: chain.name
        });
      });
    });
    
    // 按时间戳排序并限制数量
    return nodes
      .sort((a, b) => b.node.timestamp - a.node.timestamp)
      .slice(0, limit);
  }
  
  /**
   * 更新节点笔记
   * @param {string} nodeId - 节点ID
   * @param {string} chainId - 思维链ID
   * @param {string} notes - 新的笔记内容
   * @returns {Promise<boolean>} 操作结果Promise
   */
  async updateNodeNotes(nodeId, chainId, notes) {
    const chain = await this.getChainById(chainId);
    if (!chain) return false;
    
    const nodeIndex = chain.nodes.findIndex(node => node.id === nodeId);
    if (nodeIndex === -1) return false;
    
    chain.nodes[nodeIndex].notes = notes;
    chain.updatedAt = Date.now();
    
    const chains = await this.getAllChains();
    const chainIndex = chains.findIndex(c => c.id === chainId);
    chains[chainIndex] = chain;
    
    await this.setData({ [STORAGE_KEYS.THOUGHT_CHAINS]: chains });
    return true;
  }
  
  /**
   * 重排序思维链中的节点
   * @param {string} chainId - 思维链ID
   * @param {string} nodeId - 要移动的节点ID
   * @param {number} newPosition - 新位置索引
   * @returns {Promise<boolean>} 操作结果Promise
   */
  async reorderNodes(chainId, nodeId, newPosition) {
    const chain = await this.getChainById(chainId);
    if (!chain) return false;
    
    const nodeIndex = chain.nodes.findIndex(node => node.id === nodeId);
    if (nodeIndex === -1) return false;
    
    // 边界检查
    if (newPosition < 0) newPosition = 0;
    if (newPosition >= chain.nodes.length) newPosition = chain.nodes.length - 1;
    
    // 如果位置相同则不需要变动
    if (nodeIndex === newPosition) return true;
    
    // 从数组中移除节点
    const node = chain.nodes.splice(nodeIndex, 1)[0];
    
    // 在新位置插入节点
    chain.nodes.splice(newPosition, 0, node);
    
    // 更新时间戳
    chain.updatedAt = Date.now();
    
    // 保存更改
    const chains = await this.getAllChains();
    const chainIndex = chains.findIndex(c => c.id === chainId);
    chains[chainIndex] = chain;
    
    await this.setData({ [STORAGE_KEYS.THOUGHT_CHAINS]: chains });
    return true;
  }
}

// 导出一个单例实例
export const storageService = new StorageService(); 