/**
 * 思维链记录 - 数据模型定义
 * 定义了思维节点(ThoughtNode)和思维链(ThoughtChain)的数据结构
 */

/**
 * 思维节点类型
 * @typedef {Object} ThoughtNode
 * @property {string} id - 节点唯一标识
 * @property {string} title - 页面标题
 * @property {string} url - 页面URL
 * @property {number} timestamp - 创建时间戳
 * @property {string} notes - 用户笔记
 * @property {string[]} [tags] - 标签列表(可选)
 * @property {Object} [metadata] - 元数据(可选)
 */

/**
 * 思维链类型
 * @typedef {Object} ThoughtChain
 * @property {string} id - 思维链唯一标识
 * @property {string} name - 思维链名称
 * @property {number} createdAt - 创建时间戳
 * @property {number} updatedAt - 最后更新时间戳
 * @property {ThoughtNode[]} nodes - 思维节点数组
 */

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * 创建新的思维节点
 * @param {string} title - 页面标题
 * @param {string} url - 页面URL
 * @param {string} [notes=''] - 用户笔记(可选)
 * @returns {ThoughtNode} 新的思维节点对象
 */
function createThoughtNode(title, url, notes = '') {
  return {
    id: generateId(),
    title: title,
    url: url,
    timestamp: Date.now(),
    notes: notes,
    tags: []
  };
}

/**
 * 创建新的思维链
 * @param {string} [name=null] - 思维链名称(可选)
 * @returns {ThoughtChain} 新的思维链对象
 */
function createThoughtChain(name = null) {
  const timestamp = Date.now();
  return {
    id: generateId(),
    name: name || `思维链 ${new Date(timestamp).toLocaleDateString()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    nodes: []
  };
}

// 导出模型函数
export {
  generateId,
  createThoughtNode,
  createThoughtChain
}; 