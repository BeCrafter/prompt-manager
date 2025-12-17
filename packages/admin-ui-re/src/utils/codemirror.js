import CodeMirror from 'codemirror';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/yaml/yaml';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/markdown-fold';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/jump-to-line';
import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/display/placeholder';

// 导入 CSS
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/dialog/dialog.css';
import 'codemirror/theme/xq-light.css';

export function initCodeMirror(element, options = {}) {
  const defaultOptions = {
    lineNumbers: true,
    lineWrapping: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    extraKeys: {
      'Ctrl-F': 'findPersistent',
      'Cmd-F': 'findPersistent',
      'Ctrl-G': 'findNext',
      'Cmd-G': 'findNext',
      'Shift-Ctrl-G': 'findPrev',
      'Shift-Cmd-G': 'findPrev',
      'Ctrl-S': false, // 禁用保存快捷键
      'Cmd-S': false
    },
    theme: 'xq-light'
  };

  const editor = CodeMirror(element, {
    ...defaultOptions,
    ...options
  });

  return editor;
}

export function setEditorMode(editor, mode) {
  if (!editor) return;
  
  const modeMap = {
    'markdown': 'markdown',
    'javascript': 'javascript',
    'js': 'javascript',
    'python': 'python',
    'py': 'python',
    'yaml': 'yaml',
    'yml': 'yaml'
  };

  const editorMode = modeMap[mode.toLowerCase()] || 'markdown';
  editor.setOption('mode', editorMode);
}

export function setEditorTheme(editor, theme) {
  if (!editor) return;
  editor.setOption('theme', theme);
}

export function formatContent(editor) {
  if (!editor) return;
  
  const content = editor.getValue();
  try {
    // 简单的格式化逻辑
    const formatted = content
      .replace(/\n{3,}/g, '\n\n') // 移除多余的空行
      .replace(/^\s+|\s+$/g, ''); // 移除首尾空白
    
    editor.setValue(formatted);
  } catch (error) {
    console.error('格式化失败:', error);
  }
}