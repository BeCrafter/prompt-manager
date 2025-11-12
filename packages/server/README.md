# @becrafter/prompt-manager-core

Core library for managing prompts with MCP (Model Context Protocol) support.

## Installation

```bash
npm install @becrafter/prompt-manager-core
```

## Usage

### Basic Usage

```javascript
import { startServer, stopServer, config } from '@becrafter/prompt-manager-core';

// Start the server with default configuration
const server = await startServer();

console.log('Server is running!');
```

### Advanced Usage with Configuration

```javascript
import { startServer, stopServer, config } from '@becrafter/prompt-manager-core';

// Start the server with custom configuration
const server = await startServer({
  configOverrides: {
    promptsDir: './my-prompts',
    port: 3000,
    adminEnable: true,
    adminRequireAuth: false
  }
});

// Stop the server when needed
// await stopServer();
```

### Using the Express App Instance

```javascript
import { app, config } from '@becrafter/prompt-manager-core';

// You can use the app instance to add custom routes
app.get('/custom-endpoint', (req, res) => {
  res.json({ message: 'Hello from custom endpoint!' });
});

// Then start the server
import { startServer } from '@becrafter/prompt-manager-core';
await startServer();
```

### Accessing Prompt Manager

```javascript
import { promptManager, util } from '@becrafter/prompt-manager-core';

// Load prompts
await promptManager.loadPrompts();

// Get all prompts
const prompts = promptManager.getPrompts();
console.log('Loaded prompts:', prompts);

// Get a specific prompt by ID
const prompt = promptManager.getPrompt('prompt-id');
console.log('Prompt:', prompt);

// Search prompts
const searchTerm = 'search term';
const searchResults = prompts.filter(prompt => 
  prompt.name.includes(searchTerm) || 
  (prompt.description && prompt.description.includes(searchTerm))
);
```

## API Reference

### Functions

- `startServer(options = {})` - Starts the prompt manager server
- `stopServer()` - Stops the prompt manager server
- `getServerState()` - Gets the current server state
- `getServerAddress()` - Gets the server address
- `isServerRunning()` - Checks if the server is running

### Objects

- `app` - Express application instance
- `config` - Configuration object
- `logger` - Logger instance
- `util` - Utility functions
- `promptManager` - Prompt manager instance

### MCP Related

- `getMcpServer()` - Gets the MCP server instance
- `handleGetPrompt`, `handleSearchPrompts`, `handleReloadPrompts` - MCP handlers

### Routes

- `adminRouter` - Admin API routes
- `openRouter` - Open API routes

### Middleware

- `adminAuthMiddleware` - Admin authentication middleware

## Configuration Options

You can override default configuration using the `configOverrides` option:

```javascript
{
  promptsDir: './prompts',        // Directory for prompt files
  port: 5621,                     // Server port
  serverName: 'prompt-manager',   // Server name
  serverVersion: '0.0.19',        // Server version
  logLevel: 'info',               // Log level
  maxPrompts: 1000,               // Max prompt count
  recursiveScan: true,            // Recursive scan for prompts
  adminEnable: true,              // Enable admin functionality
  adminPath: '/admin',            // Admin path
  adminRequireAuth: true,         // Require admin authentication
  admins: [                       // Admin accounts
    {
      username: 'admin',
      password: 'admin',
      token: '...'
    }
  ]
}
```

## License

MIT