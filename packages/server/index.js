/**
 * Prompt Manager Core Library
 * 
 * This is the main entry point for the Prompt Manager core library.
 * It exports the main server functionality and utility functions.
 */

// Export the main server functionality
export { startServer, stopServer, getServerState, getServerAddress, isServerRunning } from './server.js';

// Export the application instance
export { default as app } from './app.js';

// Export utility functions
export { config } from './utils/config.js';
export { logger } from './utils/logger.js';
export { util } from './utils/util.js';

// Export services
export { promptManager } from './services/manager.js';

// Export MCP functionality
export { getMcpServer } from './mcp/mcp.server.js';
export { 
  handleGetPrompt, 
  handleSearchPrompts, 
  handleReloadPrompts 
} from './mcp/prompt.handler.js';
export { handleSequentialThinking } from './mcp/sequential-thinking.handler.js';
export { handleThinkPlan } from './mcp/think-plan.handler.js';
export { handleToolM } from './toolm/index.js';

// Export API routes
export { adminRouter } from './api/admin.routes.js';
export { openRouter } from './api/open.routes.js';
export { surgeRouter } from './api/surge.routes.js';

// Export middlewares
export { adminAuthMiddleware } from './middlewares/auth.middleware.js';