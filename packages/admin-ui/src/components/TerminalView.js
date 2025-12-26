export class TerminalView {
  static getHTML() {
    return `
      <div id="terminalArea" class="terminal-area" style="display: none;">
        <!-- 终端内容区域 -->
        <div class="terminal-content">
          <div class="terminal-output" id="terminalOutput">
            <div class="terminal-welcome">
              <div class="welcome-icon">🚀</div>
              <div class="welcome-text">欢迎使用终端</div>
              <div class="welcome-hint">输入命令并按回车键执行</div>
            </div>
          </div>
          <div class="terminal-input-area">
            <div class="terminal-prompt">
              <span class="prompt-symbol">~/ $</span>
              <input type="text" id="terminalInput" placeholder="输入命令..." autocomplete="off" />
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

