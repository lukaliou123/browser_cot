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
let currentChainData = null; // 当前思维链数据，用于导出

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
  
  // 检查URL参数是否有指定的思维链
  await checkURLParams();
  
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
  
  // 初始化导出功能
  initExportFeature();

  // 新增：开始新链按钮事件处理
  const startNewChainBtn = document.getElementById('start-new-chain-btn');
  if (startNewChainBtn) { // 确保按钮存在
    startNewChainBtn.addEventListener('click', async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: "manualSplitChain" });
        if (response && response.success) {
          // alert('新的思维链已成功创建！'); // 可以用更优雅的通知方式替换
          console.log('New chain created successfully, new chainId:', response.newChainId);
          // 重新加载思维链列表
          const previouslySelectedChainId = response.newChainId; // 保存新创建的链ID
          await loadChains();
          // 自动选中新的思维链
          if (previouslySelectedChainId) {
            chainSelector.value = previouslySelectedChainId;
            // 触发change事件以重新渲染
            chainSelector.dispatchEvent(new Event('change')); 
          }
        } else {
          console.error('创建新思维链失败:', response ? response.error : '未知错误');
          alert('创建新思维链失败，请查看控制台获取更多信息。');
        }
      } catch (error) {
        console.error('发送 manualSplitChain 消息时出错:', error);
        alert('操作失败，请查看控制台获取更多信息。');
      }
    });
  }

  // 新增：编辑当前思维链名称按钮事件处理
  const editChainNameBtn = document.getElementById('edit-chain-name-btn');
  if (editChainNameBtn) {
    editChainNameBtn.addEventListener('click', async () => {
      const selectedChainId = chainSelector.value;
      if (!selectedChainId) {
        alert('请先从下拉列表中选择一个思维链进行编辑。');
        return;
      }

      // 获取当前选中的链对象以得到当前名称
      const currentChain = await storageService.getChainById(selectedChainId);
      if (!currentChain) {
        alert('无法获取当前选中的思维链信息。');
        return;
      }
      const currentName = currentChain.name;

      const newName = prompt('请输入新的思维链名称：', currentName);

      if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
        try {
          const response = await chrome.runtime.sendMessage({
            action: "updateChainName",
            chainId: selectedChainId,
            newName: newName.trim()
          });

          if (response && response.success) {
            console.log(`思维链 ${selectedChainId} 名称已更新为: ${newName.trim()}`);
            // 保存当前选中的ID，因为loadChains会清空并重新填充列表
            const previouslySelectedChainId = selectedChainId; 
            await loadChains(); // 重新加载链列表以显示新名称
            // 尝试恢复之前的选中状态
            chainSelector.value = previouslySelectedChainId;
            if (chainSelector.value !== previouslySelectedChainId) { 
              // 如果ID由于某种原因在列表中找不到了(理论上不应该发生)，则尝试选中第一个有效链
              if(chainSelector.options.length > 1) chainSelector.value = chainSelector.options[1].value; 
            }
             chainSelector.dispatchEvent(new Event('change')); // 触发渲染更新

          } else {
            console.error('更新思维链名称失败:', response ? response.error : '未知错误');
            alert('更新思维链名称失败，请查看控制台获取更多信息。');
          }
        } catch (error) {
          console.error('发送 updateChainName 消息时出错:', error);
          alert('操作失败，请查看控制台获取更多信息。');
        }
      } else if (newName && newName.trim() === currentName) {
        // 名称未改变，无需操作
      } else if (newName !== null) { // 用户点击了确定，但输入为空
        alert('思维链名称不能为空。');
      }
      // 如果 newName 为 null，表示用户点击了取消，不执行任何操作
    });
  }
});

/**
 * 检查URL参数是否有指定的思维链
 */
async function checkURLParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const chainId = urlParams.get('chain');
  
  if (chainId) {
    // 检查指定的思维链是否存在
    const chain = await storageService.getChainById(chainId);
    if (chain) {
      // 如果存在，选中该思维链
      chainSelector.value = chainId;
      renderVisualization(chainId);
    } else {
      console.warn('指定的思维链不存在:', chainId);
    }
  }
}

/**
 * 初始化导出功能
 */
function initExportFeature() {
  const exportBtn = document.getElementById('export-btn');
  const exportDropdown = document.getElementById('export-dropdown');
  const exportImage = document.getElementById('export-image');
  const exportJSON = document.getElementById('export-json');
  const copyLink = document.getElementById('copy-link');
  const importJSON = document.getElementById('import-json');
  
  // 导出按钮点击切换下拉菜单
  exportBtn.addEventListener('click', () => {
    const exportControls = document.querySelector('.export-controls');
    exportControls.classList.toggle('active');
    
    // 点击其他地方关闭下拉菜单
    const closeDropdown = (e) => {
      if (!exportControls.contains(e.target)) {
        exportControls.classList.remove('active');
        document.removeEventListener('click', closeDropdown);
      }
    };
    
    // 延迟添加事件监听，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', closeDropdown);
    }, 0);
  });
  
  // 导出为图片
  exportImage.addEventListener('click', () => {
    exportAsImage();
    document.querySelector('.export-controls').classList.remove('active');
  });
  
  // 导出为JSON
  exportJSON.addEventListener('click', () => {
    exportAsJSON();
    document.querySelector('.export-controls').classList.remove('active');
  });
  
  // 复制分享链接
  copyLink.addEventListener('click', () => {
    copyShareLink();
    document.querySelector('.export-controls').classList.remove('active');
  });
  
  // 导入JSON文件
  importJSON.addEventListener('click', () => {
    importJSONFile();
    document.querySelector('.export-controls').classList.remove('active');
  });
}

/**
 * 导出为图片
 */
function exportAsImage() {
  if (!svg || !currentChainId) {
    alert('请先选择一个思维链');
    return;
  }
  
  try {
    // 准备SVG
    const svgClone = svg.node().cloneNode(true);
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    // 创建图片
    const img = new Image();
    img.onload = function() {
      // 创建画布
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = 'white';
      context.fillRect(0, 0, width, height);
      context.drawImage(img, 0, 0);
      
      // 转换为PNG并下载
      const imgURL = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = imgURL;
      a.download = `思维链_${currentChainId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  } catch (error) {
    console.error('导出图片失败:', error);
    alert('导出图片失败，请重试');
  }
}

/**
 * 导出为JSON
 */
async function exportAsJSON() {
  if (!currentChainId) {
    alert('请先选择一个思维链');
    return;
  }
  
  try {
    const chain = await storageService.getChainById(currentChainId);
    if (!chain) {
      alert('无法获取思维链数据');
      return;
    }
    
    // 转换为JSON字符串
    const jsonStr = JSON.stringify(chain, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 下载JSON文件
    const a = document.createElement('a');
    a.href = url;
    a.download = `思维链_${chain.name || currentChainId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('导出JSON失败:', error);
    alert('导出JSON失败，请重试');
  }
}

/**
 * 复制分享链接
 */
function copyShareLink() {
  if (!currentChainId) {
    alert('请先选择一个思维链');
    return;
  }
  
  // 创建带有思维链ID的URL
  const shareUrl = `${window.location.origin}${window.location.pathname}?chain=${currentChainId}`;
  
  // 复制到剪贴板
  navigator.clipboard.writeText(shareUrl)
    .then(() => {
      // 显示成功消息
      const exportBtn = document.getElementById('export-btn');
      const originalText = exportBtn.textContent;
      exportBtn.textContent = '链接已复制!';
      
      // 恢复原始文本
      setTimeout(() => {
        exportBtn.textContent = originalText;
      }, 2000);
    })
    .catch(err => {
      console.error('复制链接失败:', err);
      alert('复制链接失败，请手动复制:\n' + shareUrl);
    });
}

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
    
    // 保存当前思维链数据，用于导出
    currentChainData = chain;
    
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

/**
 * 导入JSON文件
 */
function importJSONFile() {
  // 创建隐藏的文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  
  // 监听文件选择事件
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      document.body.removeChild(fileInput);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        await importThoughtChain(jsonData);
      } catch (error) {
        console.error('解析JSON失败:', error);
        alert('无法解析JSON文件，请确认文件格式正确');
      }
      document.body.removeChild(fileInput);
    };
    
    reader.onerror = () => {
      alert('读取文件失败');
      document.body.removeChild(fileInput);
    };
    
    reader.readAsText(file);
  });
  
  // 触发文件选择对话框
  fileInput.click();
}

/**
 * 导入思维链数据
 * @param {Object} chainData - 思维链数据
 */
async function importThoughtChain(chainData) {
  try {
    // 验证数据格式
    if (!chainData.id || !Array.isArray(chainData.nodes)) {
      alert('无效的思维链数据格式');
      return;
    }
    
    // 生成新的ID，避免覆盖现有思维链
    const originalId = chainData.id;
    chainData.id = generateImportId(originalId);
    chainData.name = chainData.name ? `${chainData.name} (导入)` : `导入的思维链`;
    
    // 保存到存储
    const allChains = await storageService.getAllChains();
    allChains.push(chainData);
    await storageService.setData({ thoughtChains: allChains });
    
    // 重新加载思维链列表
    await loadChains();
    
    // 选择导入的思维链
    chainSelector.value = chainData.id;
    renderVisualization(chainData.id);
    
    alert('思维链导入成功！');
  } catch (error) {
    console.error('导入思维链失败:', error);
    alert('导入思维链失败，请重试');
  }
}

/**
 * 生成导入ID
 * @param {string} originalId - 原始ID
 * @returns {string} 新ID
 */
function generateImportId(originalId) {
  const timestamp = Date.now().toString(36);
  return `import_${timestamp}_${originalId.substring(0, 8)}`;
} 