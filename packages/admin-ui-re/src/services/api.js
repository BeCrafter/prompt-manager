const API_HOST = 'http://localhost:5621';
const API_BASE = `${API_HOST}/adminapi`;
const API_SURGE = `${API_HOST}/surge/`;

let requireAuth = false;
let currentToken = localStorage.getItem('prompt-admin-token');

export const api = {
  async checkAuthRequirement() {
    try {
      const response = await fetch(`${API_BASE}/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const config = await response.json();
        requireAuth = config.requireAuth !== false;
      } else {
        requireAuth = false;
      }
    } catch (error) {
      console.warn('无法获取服务器配置，使用默认认证设置:', error);
      requireAuth = false;
    }
    
    return requireAuth;
  },

  async call(endpoint, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (requireAuth && currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      
      if (response.status === 401 && requireAuth) {
        localStorage.removeItem('prompt-admin-token');
        currentToken = null;
        throw new Error('登录已过期，请重新登录');
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || '请求失败');
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('网络请求失败:', error);
        throw new Error('网络连接失败，请检查服务器是否运行');
      } else {
        const handledError = error instanceof Error ? error : new Error(error?.message || '请求失败');
        console.error('API请求错误:', handledError);
        throw handledError;
      }
    }
  },

  async login(username, password) {
    const result = await this.call('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    currentToken = result.token;
    localStorage.setItem('prompt-admin-token', currentToken);
    return result;
  },

  async fetchToken() {
    const result = await this.call('/login', {
      method: 'POST',
      body: JSON.stringify({ username: '', password: '' })
    });
    
    currentToken = result.token;
    localStorage.setItem('prompt-admin-token', currentToken);
    return result;
  },

  async getPrompts(search = '', enabledOnly = false, group = null) {
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (enabledOnly) queryParams.append('enabled', 'true');
    if (group) queryParams.append('group', group);
    
    return this.call(`/prompts?${queryParams}`);
  },

  async getPrompt(name, path) {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append('path', path);
    
    return this.call(`/prompts/${name}?${queryParams}`);
  },

  async savePrompt(promptData) {
    return this.call('/prompts', {
      method: 'POST',
      body: JSON.stringify(promptData)
    });
  },

  async deletePrompt(name, path) {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append('path', path);
    
    return this.call(`/prompts/${name}?${queryParams}`, {
      method: 'DELETE'
    });
  },

  async togglePrompt(name, path) {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append('path', path);
    
    return this.call(`/prompts/${name}/toggle?${queryParams}`, {
      method: 'POST'
    });
  },

  async getGroups() {
    return this.call('/groups');
  },

  async createGroup(groupData) {
    return this.call('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData)
    });
  },

  async renameGroup(oldPath, newPath) {
    return this.call('/groups/rename', {
      method: 'PATCH',
      body: JSON.stringify({ oldPath, newPath })
    });
  },

  async updateGroupStatus(path, enabled) {
    return this.call('/groups/status', {
      method: 'PATCH',
      body: JSON.stringify({ path, enabled })
    });
  },

  async deleteGroup(path) {
    const queryParams = new URLSearchParams();
    queryParams.append('path', path);
    
    return this.call(`/groups?${queryParams}`, {
      method: 'DELETE'
    });
  },

  get requireAuth() {
    return requireAuth;
  }
};