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
  text: '#333333'
};

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
});

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
    
    // 准备数据
    const nodes = chain.nodes.map(node => ({
      id: node.id,
      title: node.title,
      url: node.url,
      timestamp: node.timestamp,
      notes: node.notes
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
    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', 10)
      .attr('fill', colors.node)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('fill', colors.nodeHover);
        showTooltip(d, event);
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill', colors.node);
        hideTooltip();
      })
      .on('click', function(event, d) {
        // 打开节点对应的 URL
        window.open(d.url, '_blank');
      });
    
    // 创建节点标签
    const label = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
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
        
        // 更新节点位置
        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
        
        // 更新标签位置
        label
          .attr('x', d => d.x)
          .attr('y', d => d.y);
      });
    
    // 添加拖拽行为
    node.call(d3.drag()
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