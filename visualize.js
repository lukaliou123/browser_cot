/**
 * 思维链记录 - 可视化脚本
 * 使用 D3.js 将思维链数据可视化为力导向图
 */

import { storageService } from './js/storage.js';

// 全局变量
let currentChainId = null;
let svg = null;
let simulation = null;
let chainSelector = null;
let currentEditingNode = null; // 当前正在编辑的节点
let selectedNodeForReorder = null; // 当前选中用于重排序的节点

// DOM 元素
let width = 0;
let height = 0;
let container = null;

// 颜色配置
const colors = {
  node: '#4285f4',
  nodeHover: '#ea4335',
  nodeSelected: '#34a853',
  link: '#cccccc',
  text: '#333333',
  delete: '#db4437',
  reorder: '#fbbc05' // 重排序模式颜色
};

// 模式设置
let editMode = false;
let reorderMode = false;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化 DOM 引用
  container = document.getElementById('visualization');
  chainSelector = document.getElementById('chain-selector');
  
  // 设置画布尺寸
  updateDimensions();
  
  // 加载可用思维链
  await loadChains();
  
  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    updateDimensions();
    if (currentChainId) {
      renderVisualization(currentChainId);
    }
  });
  
  // 监听选择器变化
  chainSelector.addEventListener('change', (e) => {
    const selectedChainId = e.target.value;
    if (selectedChainId) {
      renderVisualization(selectedChainId);
    }
  });
  
  // 编辑模式切换按钮
  const editModeBtn = document.getElementById('edit-mode-toggle');
  editModeBtn.addEventListener('click', () => {
    // 如果重排序模式开启，先关闭
    if (reorderMode) {
      reorderMode = false;
      document.getElementById('reorder-mode-toggle').textContent = '进入重排序模式';
      document.getElementById('reorder-mode-toggle').classList.remove('active');
      clearReorderSelection();
    }
    
    editMode = !editMode;
    editModeBtn.textContent = editMode ? '退出编辑模式' : '进入编辑模式';
    editModeBtn.classList.toggle('active', editMode);
    
    // 重新渲染以应用新的编辑模式
    if (currentChainId) {
      renderVisualization(currentChainId);
    }
  });
  
  // 重排序模式切换按钮
  const reorderModeBtn = document.getElementById('reorder-mode-toggle');
  reorderModeBtn.addEventListener('click', () => {
    // 如果编辑模式开启，先关闭
    if (editMode) {
      editMode = false;
      document.getElementById('edit-mode-toggle').textContent = '进入编辑模式';
      document.getElementById('edit-mode-toggle').classList.remove('active');
    }
    
    reorderMode = !reorderMode;
    reorderModeBtn.textContent = reorderMode ? '退出重排序模式' : '进入重排序模式';
    reorderModeBtn.classList.toggle('active', reorderMode);
    
    // 清除当前选择
    clearReorderSelection();
    
    // 如果进入重排序模式，显示帮助信息
    if (reorderMode) {
      showReorderHelp();
    }
    
    // 重新渲染
    if (currentChainId) {
      renderVisualization(currentChainId);
    }
  });
  
  // 初始化笔记编辑对话框
  initNoteEditModal();
  
  // 初始化重排序帮助对话框
  initReorderHelpModal();
});

/**
 * 初始化笔记编辑对话框
 */
function initNoteEditModal() {
  const modal = document.getElementById('note-edit-modal');
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.btn-cancel');
  const saveBtn = modal.querySelector('.btn-save');
  
  // 关闭按钮点击事件
  closeBtn.addEventListener('click', closeNoteEditModal);
  
  // 取消按钮点击事件
  cancelBtn.addEventListener('click', closeNoteEditModal);
  
  // 保存按钮点击事件
  saveBtn.addEventListener('click', saveNoteChanges);
  
  // 点击模态框背景关闭
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeNoteEditModal();
    }
  });
}

/**
 * 打开笔记编辑对话框
 * @param {Object} node - 节点数据
 */
function openNoteEditModal(node) {
  const modal = document.getElementById('note-edit-modal');
  const textarea = document.getElementById('note-content');
  
  // 设置当前编辑节点
  currentEditingNode = node;
  
  // 设置文本域的初始值
  textarea.value = node.notes || '';
  
  // 显示模态框
  modal.style.display = 'flex';
  
  // 聚焦文本域
  textarea.focus();
}

/**
 * 关闭笔记编辑对话框
 */
function closeNoteEditModal() {
  const modal = document.getElementById('note-edit-modal');
  modal.style.display = 'none';
  currentEditingNode = null;
}

/**
 * 保存笔记更改
 */
async function saveNoteChanges() {
  if (!currentEditingNode || !currentChainId) return;
  
  const textarea = document.getElementById('note-content');
  const newNotes = textarea.value.trim();
  
  try {
    // 调用存储服务更新笔记
    const success = await storageService.updateNodeNotes(
      currentEditingNode.id,
      currentChainId,
      newNotes
    );
    
    if (success) {
      // 更新当前节点的笔记
      currentEditingNode.notes = newNotes;
      
      // 关闭模态框
      closeNoteEditModal();
      
      // 重新渲染可视化
      renderVisualization(currentChainId);
    } else {
      console.error('保存笔记失败');
      alert('保存笔记失败，请重试');
    }
  } catch (error) {
    console.error('保存笔记时出错:', error);
    alert('保存笔记时出错，请重试');
  }
}

/**
 * 更新可视化区域尺寸
 */
function updateDimensions() {
  const containerRect = container.getBoundingClientRect();
  width = containerRect.width;
  height = 500; // 固定高度或根据需要调整
  
  // 更新现有的 SVG 尺寸
  if (svg) {
    svg
      .attr('width', width)
      .attr('height', height);
    
    // 如果有活动的模拟，更新中心点
    if (simulation) {
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
      simulation.alpha(0.3).restart();
    }
  }
}

/**
 * 加载所有可用的思维链
 */
async function loadChains() {
  try {
    const chains = await storageService.getAllChains();
    
    // 清空选择器
    chainSelector.innerHTML = '';
    
    // 添加默认选项
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- 选择一个思维链 --';
    chainSelector.appendChild(defaultOption);
    
    // 添加所有思维链到选择器
    chains.forEach(chain => {
      const option = document.createElement('option');
      option.value = chain.id;
      option.textContent = `${chain.name} (${chain.nodes.length} 个节点)`;
      chainSelector.appendChild(option);
    });
    
    // 如果没有思维链，显示提示
    if (chains.length === 0) {
      document.getElementById('message').textContent = '没有可用的思维链。请先创建思维链并添加节点。';
      document.getElementById('message').style.display = 'block';
    } else {
      document.getElementById('message').style.display = 'none';
    }
    
    // 尝试获取活动链并默认选中
    const activeChain = await storageService.getActiveChain();
    if (activeChain) {
      chainSelector.value = activeChain.id;
      renderVisualization(activeChain.id);
    }
  } catch (error) {
    console.error('加载思维链失败:', error);
    document.getElementById('message').textContent = '加载思维链失败，请刷新重试。';
    document.getElementById('message').style.display = 'block';
  }
}

/**
 * 清除重排序选择
 */
function clearReorderSelection() {
  selectedNodeForReorder = null;
  
  // 重置所有节点颜色
  if (svg) {
    svg.selectAll('circle.node')
      .attr('fill', colors.node);
  }
}

/**
 * 渲染思维链可视化
 * @param {string} chainId - 思维链 ID
 */
async function renderVisualization(chainId) {
  if (!chainId) return;
  
  currentChainId = chainId;
  
  try {
    // 获取思维链数据
    const chain = await storageService.getChainById(chainId);
    if (!chain || !chain.nodes || chain.nodes.length === 0) {
      document.getElementById('message').textContent = '该思维链没有节点数据。';
      document.getElementById('message').style.display = 'block';
      return;
    }
    
    document.getElementById('message').style.display = 'none';
    
    // 清空现有可视化
    container.innerHTML = '';
    
    // 清除重排序选择
    clearReorderSelection();
    
    // 准备数据
    const nodes = chain.nodes.map((node, index) => ({
      id: node.id,
      title: node.title,
      url: node.url,
      timestamp: node.timestamp,
      notes: node.notes,
      position: index // 添加位置索引
    }));
    
    // 创建节点间的连接（按时间顺序连接）
    const links = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      links.push({
        source: nodes[i].id,
        target: nodes[i + 1].id
      });
    }
    
    // 创建 SVG
    svg = d3.select('#visualization')
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    // 创建箭头定义
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', colors.link)
      .style('stroke', 'none');
    
    // 创建连接线
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', colors.link)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');
    
    // 创建节点
    const nodeGroup = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group');
    
    // 添加圆形节点
    const node = nodeGroup.append('circle')
      .attr('r', 10)
      .attr('fill', colors.node)
      .attr('class', 'node')
      .on('mouseover', function(event, d) {
        if (!reorderMode || !selectedNodeForReorder || selectedNodeForReorder.id === d.id) {
          d3.select(this).attr('fill', colors.nodeHover);
        }
        showTooltip(d, event);
      })
      .on('mouseout', function(event, d) {
        if (reorderMode && selectedNodeForReorder && selectedNodeForReorder.id === d.id) {
          d3.select(this).attr('fill', colors.selected);
        } else {
          d3.select(this).attr('fill', colors.node);
        }
        hideTooltip();
      })
      .on('click', function(event, d) {
        if (!editMode && !reorderMode) {
          // 普通模式：打开节点对应的 URL
          window.open(d.url, '_blank');
        } else if (editMode) {
          // 编辑模式：打开笔记编辑对话框
          openNoteEditModal(d);
        } else if (reorderMode) {
          // 重排序模式：选择节点或移动节点
          handleReorderNodeClick(d);
        }
      });
    
    // 如果在编辑模式下，添加删除和编辑按钮
    if (editMode) {
      // 添加删除按钮
      nodeGroup.append('circle')
        .attr('r', 6)
        .attr('cx', 14)
        .attr('cy', -14)
        .attr('fill', colors.delete)
        .attr('class', 'delete-btn')
        .style('cursor', 'pointer')
        .on('mouseover', function() {
          d3.select(this).attr('r', 8);
        })
        .on('mouseout', function() {
          d3.select(this).attr('r', 6);
        })
        .on('click', function(event, d) {
          event.stopPropagation();
          deleteNode(d.id);
        });
      
      // 添加删除按钮中的 X 符号
      nodeGroup.append('text')
        .attr('x', 14)
        .attr('y', -14)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 8)
        .attr('fill', 'white')
        .attr('pointer-events', 'none')
        .text('×');
      
      // 添加编辑按钮
      nodeGroup.append('circle')
        .attr('r', 6)
        .attr('cx', -14)
        .attr('cy', -14)
        .attr('fill', '#34a853') // 绿色
        .attr('class', 'edit-btn')
        .style('cursor', 'pointer')
        .on('mouseover', function() {
          d3.select(this).attr('r', 8);
        })
        .on('mouseout', function() {
          d3.select(this).attr('r', 6);
        })
        .on('click', function(event, d) {
          event.stopPropagation();
          openNoteEditModal(d);
        });
      
      // 添加编辑按钮中的铅笔符号
      nodeGroup.append('text')
        .attr('x', -14)
        .attr('y', -14)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 8)
        .attr('fill', 'white')
        .attr('pointer-events', 'none')
        .text('✎');
    }
    
    // 在重排序模式下，显示位置编号
    if (reorderMode) {
      nodeGroup.append('text')
        .text(d => d.position + 1) // 显示从1开始的位置索引
        .attr('class', 'position-label')
        .attr('x', 0)
        .attr('y', -20)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('font-weight', 'bold')
        .attr('fill', colors.reorder);
    }
    
    // 创建节点标签
    const label = nodeGroup.append('text')
      .text(d => truncateText(d.title, 20))
      .attr('font-size', 12)
      .attr('dx', 15)
      .attr('dy', 4)
      .attr('fill', colors.text);
    
    // 创建力导向模拟
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink().id(d => d.id).links(links).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', () => {
        // 更新连接线位置
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        
        // 更新节点组位置
        nodeGroup
          .attr('transform', d => `translate(${d.x}, ${d.y})`);
      });
    
    // 添加拖拽行为
    nodeGroup.call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));
  } catch (error) {
    console.error('渲染可视化失败:', error);
    document.getElementById('message').textContent = '渲染可视化失败，请重试。';
    document.getElementById('message').style.display = 'block';
  }
}

/**
 * 显示节点提示框
 * @param {Object} node - 节点数据
 * @param {Event} event - 鼠标事件
 */
function showTooltip(node, event) {
  const tooltip = document.getElementById('tooltip');
  tooltip.innerHTML = `
    <div class="tooltip-title">${node.title}</div>
    <div class="tooltip-url">${node.url}</div>
    ${node.notes ? `<div class="tooltip-notes">${node.notes}</div>` : ''}
    <div class="tooltip-time">${new Date(node.timestamp).toLocaleString()}</div>
  `;
  
  tooltip.style.display = 'block';
  tooltip.style.left = `${event.pageX + 10}px`;
  tooltip.style.top = `${event.pageY + 10}px`;
}

/**
 * 隐藏提示框
 */
function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

/**
 * 截断文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 拖拽开始事件处理
 */
function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

/**
 * 拖拽中事件处理
 */
function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

/**
 * 拖拽结束事件处理
 */
function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

/**
 * 删除节点并刷新可视化
 * @param {string} nodeId - 要删除的节点ID
 */
async function deleteNode(nodeId) {
  try {
    if (!currentChainId) return;
    
    // 显示确认对话框
    if (!confirm('确定要删除这个节点吗？此操作不可撤销。')) {
      return;
    }
    
    // 调用存储服务删除节点
    const success = await storageService.removeNodeFromChain(nodeId, currentChainId);
    
    if (success) {
      // 重新加载思维链列表和当前思维链
      await loadChains();
      renderVisualization(currentChainId);
    } else {
      alert('删除节点失败');
    }
  } catch (error) {
    console.error('删除节点时出错:', error);
    alert('删除节点时发生错误');
  }
}

/**
 * 处理重排序模式下的节点点击
 * @param {Object} node - 被点击的节点
 */
async function handleReorderNodeClick(node) {
  // 如果没有选中的节点，则选中当前节点
  if (!selectedNodeForReorder) {
    selectedNodeForReorder = node;
    
    // 将选中节点标记为选中状态
    svg.selectAll('circle.node')
      .filter(d => d.id === node.id)
      .attr('fill', colors.selected);
    
    return;
  }
  
  // 如果点击的是已选中的节点，取消选择
  if (selectedNodeForReorder.id === node.id) {
    clearReorderSelection();
    return;
  }
  
  // 移动节点到新的位置
  try {
    const success = await storageService.reorderNodes(
      currentChainId,
      selectedNodeForReorder.id,
      node.position
    );
    
    if (success) {
      // 清除选择
      clearReorderSelection();
      
      // 重新渲染可视化
      renderVisualization(currentChainId);
    } else {
      console.error('重排序失败');
      alert('重排序失败，请重试');
    }
  } catch (error) {
    console.error('重排序时出错:', error);
    alert('重排序时出错，请重试');
  }
}

/**
 * 初始化重排序帮助对话框
 */
function initReorderHelpModal() {
  const modal = document.getElementById('reorder-help-modal');
  const closeBtn = modal.querySelector('.modal-close');
  const gotItBtn = document.getElementById('reorder-help-got-it');
  
  // 关闭按钮点击事件
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // 知道了按钮点击事件
  gotItBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // 点击模态框背景关闭
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
}

/**
 * 显示重排序帮助
 */
function showReorderHelp() {
  const modal = document.getElementById('reorder-help-modal');
  modal.style.display = 'flex';
} 