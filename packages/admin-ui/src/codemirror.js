// src/codemirror.js - CodeMirror 初始化和配置

import CodeMirror from "codemirror"
import "codemirror/mode/markdown/markdown"
import "codemirror/addon/edit/closebrackets"
import "codemirror/addon/edit/matchbrackets"
import yaml from "js-yaml"

// 将 js-yaml 挂载到 window 对象上，以便其他地方可以访问
window.jsyaml = yaml

// 初始化 CodeMirror 编辑器
function initCodeMirror() {
  const editorElement = document.getElementById('editor')
  const initialValue = editorElement.value || '' // 改为空字符串，使编辑器初始化时为空白
  
  const editor = CodeMirror.fromTextArea(editorElement, {
    mode: 'markdown',
    theme: 'xq-light',
    lineNumbers: false,
    lineWrapping: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    fontSize: '14px',
    height: '100%',
    viewportMargin: Infinity
  })
  
  // 设置初始值
  editor.setValue(initialValue)
  
  // 监听内容变化以更新预览
  editor.on('change', function() {
    // 延迟更新预览以避免过于频繁的更新
    clearTimeout(window.previewUpdateTimer)
    window.previewUpdateTimer = setTimeout(() => {
      if (typeof updatePreview === 'function') {
        updatePreview()
      }
    }, 300)
  })

  // 将 editor 对象暴露出去，以便可以获取内容
  // 不需要重写 getValue 和 setValue 方法，因为 CodeMirror 已经提供了它们
  // editor.getValue = () => editor.getValue()
  // editor.setValue = (value) => editor.setValue(value)

  return editor
}

export { initCodeMirror }