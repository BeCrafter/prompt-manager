export class LoginView {
  static getHTML() {
    return `
      <div id="login" class="login-container" style="display: none;">
        <form id="loginForm" class="login-form">
          <div class="login-box">
            <h2>Prompt Manager</h2>
            <div class="input-group username">
              <input type="text" id="username" name="username" placeholder="用户名" autocomplete="username" />
            </div>
            <div class="input-group password">
              <input type="password" id="password" name="password" placeholder="密码" autocomplete="current-password" />
            </div>
            <button type="submit" id="loginBtn" class="btn btn-primary">登&nbsp;&nbsp;&nbsp;&nbsp;录</button>
            <div id="loginError" class="error-msg" style="display: none; margin-top: 15px;"></div>
          </div>
        </form>
      </div>
    `;
  }
}

