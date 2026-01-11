# AGENTS.md - Codebase Guide for AI Agents

## Project Overview
- **Type**: Monorepo-like structure (manual orchestration, no workspaces)
- **Language**: JavaScript (ES Modules with .js extensions)
- **Node.js**: v22.20.0+ required (see .nvmrc)
- **Type Safety**: Zod schemas for runtime validation (no TypeScript)

## Build, Lint & Test Commands

### Development Commands
```bash
npm run dev                # Start all services (backend + admin + desktop) - RECOMMENDED
npm run dev:backend        # Backend server with --watch (port 5621)
npm run dev:admin          # Admin UI webpack dev server (port 9000)
npm run dev:desktop        # Electron desktop app
```

### Build Commands
```bash
npm run build              # Build all (admin-ui + core)
npm run build:core         # Build server package (esbuild)
npm run build:admin-ui      # Build admin UI (webpack → packages/web/)
npm run build:desktop       # Build desktop app (current platform)
npm run build:desktop:all   # Build desktop for all platforms (mac/win/linux)
npm run build:icons        # Build app icons
```

### Linting & Formatting
```bash
npm run lint              # Run ESLint with auto-fix
npm run lint:fix          # Run ESLint with auto-fix
npm run lint:check        # Check ESLint without fixing
npm run format            # Run Prettier to format code
npm run format:fix        # Run Prettier with auto-fix
npm run format:check      # Check formatting without changing files
```

### Test Commands
```bash
npm test                  # Run ALL tests (verification + server + integration)
npm run test:server       # Server unit tests only
npm run test:server:watch       # Watch mode for unit tests
npm run test:server:coverage    # Generate coverage report (70% threshold)
npm run test:server:integration  # Server integration tests
npm run test:e2e          # E2E tests for packaged app
npm run test:module-loading # Module loading tests
```

### Verification Commands
```bash
npm run verify             # Run comprehensive publish verification (recommended before commits)
npm run verify:publish     # Verify npm package publish readiness
npm run check:deps        # Check and install all dependencies
npm run check:env         # Check development environment
```

### System Commands
```bash
npm run fix:pty           # Rebuild node-pty native module
npm run help              # Show CLI help information
npm run setup:env         # Run pre-install environment check
```

### Single Test Execution
```bash
# Run specific test file
cd packages/server && vitest tests/unit/core.test.js

# Run tests matching pattern
cd packages/server && vitest tests/unit/terminal*

# Run single test suite by name
cd packages/server && vitest -t "WebSocketService"
```

### NPM Publish Verification
```bash
# Verify npm package publish readiness (recommended before creating tag)
npm run verify:publish
```
This command checks:
- ESLint and Prettier compliance
- All tests pass
- All files listed in package.json exist
- Version consistency across all files
- Publish readiness

### Verification (Recommended before commits/PRs)
```bash
# Run comprehensive verification
npm run verify
```
This command performs comprehensive verification:
- **Code Quality**: ESLint, Prettier, all tests
- **NPM Package**: File existence, version consistency, publish readiness

**Use this before**:
- Creating pull requests
- Pushing to main branch
- Creating version tags for release

### Dependency Management
```bash
# Check and install all missing dependencies
npm run check:deps

# Check development environment
npm run check:env
```

## Code Style Guidelines

### Imports
- **Named imports**: `import { logger } from '../utils/logger.js'`
- **Default imports**: `import fs from 'fs-extra'`
- **Explicit .js extensions**: Required for ES modules
- **Order**: Node built-ins → third-party → local modules
- **Relative paths**: Use `../` and `./` for local imports

### Formatting (Prettier + ESLint Integration)

**Integrated Configuration:**
- ESLint and Prettier are integrated via `eslint-config-prettier` and `eslint-plugin-prettier`
- `npm run lint` checks both code quality (ESLint) and formatting (Prettier)
- `npm run lint:fix` automatically fixes both issues in one command
- Formatting rules are managed by Prettier and reported as ESLint errors

**Prettier Rules:**
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Max line length**: 120 characters
- **Trailing commas**: None
- **Arrow parens**: Avoid for single parameter: `arg => expr`
- **Line endings**: LF only

**Important:** Do NOT configure formatting rules (quotes, semi, indent, etc.) in ESLint - they are managed by Prettier via `plugin:prettier/recommended`.

### Type Definitions (Zod)
```javascript
import { z } from 'zod';

const SchemaName = z.object({
  field: z.string().min(1, 'Error message'),
  optionalField: z.string().optional(),
  enumField: z.enum(['value1', 'value2']).default('value1'),
  nested: z.object({ subfield: z.number() })
});
```

### Naming Conventions
- **Classes**: PascalCase (e.g., `PromptManager`, `Logger`)
- **Functions**: camelCase (e.g., `loadPrompts`, `handleGetPrompt`)
- **Variables**: camelCase (e.g., `promptsDir`, `sessionId`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `PROMPT_NAME_REGEX`, `GROUP_META_FILENAME`)
- **Files**: kebab-case (e.g., `template.service.js`, `admin.routes.js`)
- **Handlers**: Prefix with `handle` (e.g., `handleToolM`, `handleSearchPrompts`)

### Error Handling
```javascript
try {
  // logic here
  logger.info('Operation successful');
} catch (error) {
  logger.error('Operation failed:', error);
  // For API routes: res.status(500).json({ error: error.message });
  // For services: throw error (after logging)
}
```
- Always log errors with `logger.error(message, error)`
- Include context in error messages (Chinese and English both used)
- Re-throw after logging for services, return 500 for API routes

### File Organization
- **Services**: `packages/server/services/{name}.service.js`
- **Handlers**: `packages/server/mcp/{name}.handler.js`
- **API Routes**: `packages/server/api/{name}.routes.js`
- **Utils**: `packages/server/utils/{name}.js`
- **Tests**: `packages/server/tests/unit/{name}.test.js`

### Testing Patterns
```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('FeatureName', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new Service();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it('should do something', () => {
    expect(service.method()).toBe(expected);
  });
});
```
- Vitest globals enabled (no need to import test functions)
- Mock modules before importing: `vi.mock('module-name')`
- Use `beforeEach`/`afterEach` for setup/cleanup
- Test both success and error paths

### Key Configuration Files
- ESLint: `packages/server/.eslintrc.cjs` - Integrated with Prettier via `plugin:prettier/recommended`
- ESLint Ignore: `packages/server/.eslintignore` - Files to exclude from linting
- Prettier: `packages/server/.prettierrc` - Formatting rules (managed by ESLint integration)
- Prettier Ignore: `packages/server/.prettierignore` - Files to exclude from formatting
- Vitest: `packages/server/vitest.config.js`
- Webpack: `packages/admin-ui/webpack.config.js`

### Git Hooks (Husky)
- **Pre-commit**: Runs `lint-staged` (eslint + prettier) + tests
- **Pre-push**: Runs full test suite with coverage + build verification

### Project Structure
```
├── packages/
│   ├── server/        # Core backend (@becrafter/prompt-manager-core)
│   ├── admin-ui/     # React admin UI (webpack)
│   ├── web/          # Built admin UI assets
│   └── resources/    # Tool sandbox resources
├── app/
│   └── desktop/      # Electron desktop app
└── test/             # Integration and E2E tests
```

### Important Notes
- **No TypeScript**: Uses JavaScript with JSDoc for documentation
- **Async/await**: Use for all async operations
- **Console**: Only use `console.log` in scripts (warned elsewhere)
- **Zod validation**: Preferred runtime type checking
- **MCP Protocol**: This project implements Model Context Protocol
- **WebSocket Dynamic Port**: WebSocket service MUST use dynamic port allocation (port 0), fixed ports are NOT allowed

## NPM Publish Workflow

### Publish Process
Triggered by pushing a version tag (e.g., `v0.1.21`) to GitHub. GitHub Actions workflow (`.github/workflows/npm-publish.yml`) will:

1. **Checkout** repository (main branch)
2. **Setup** Node.js 22.x with NPM registry
3. **Install** dependencies (`npm ci`)
4. **Rebuild** native modules (node-pty)
5. **Build** Admin UI (`npm run build:admin-ui`)
6. **Update** version in:
   - `package.json` (root)
   - `package-lock.json` (root)
   - `app/desktop/package.json`
   - `app/desktop/package-lock.json`
   - `env.example` (MCP_SERVER_VERSION)
   - `README.md` (version table)
   - `packages/server/utils/config.js` (default version)
7. **Commit** version updates to main branch
8. **Publish** to NPM (public access)

### Before Publishing
```bash
# 1. Verify all checks pass
npm run verify

# 2. Update version if needed
npm version <major|minor|patch> -m "Release version %s"

# 3. Push the commit
git push origin main

# 4. Create and push tag
git tag v<version>
git push origin v<version>
```

### Version Consistency
When updating versions, ensure consistency across:
- `package.json` (root) - main version
- `packages/server/package.json` - core library
- `app/desktop/package.json` - desktop app
- `env.example` - MCP_SERVER_VERSION
- `packages/server/utils/config.js` - default server version
- `README.md` - version table in documentation

### Publish Verification
Use `npm run publish:verify` before creating tags to catch:
- Linting/formatting issues
- Test failures
- Missing files
- Unbuilt admin UI
- Version inconsistencies

## Common Pitfalls & Critical Issues

### ES Module vs CommonJS Conflicts

**Problem**: Scripts using `require()` in ES Module project fail with:
```
ReferenceError: require is not defined in ES module scope
```

**Root Cause**: Root `package.json` has `"type": "module"`, which enforces ES Module syntax globally.

**Affected Files**:
- Scripts in `scripts/` directory
- Any `.js` files loaded via Node.js

**How to Avoid**:
1. Always check root `package.json` type before creating scripts
2. Use `import` syntax for all `.js` files:
   ```javascript
   // ❌ Wrong
   const packageJson = require('../package.json');

   // ✅ Correct
   import { readFileSync } from 'fs';
   import { fileURLToPath } from 'url';
   const packageJson = JSON.parse(readFileSync('../package.json', 'utf-8'));
   ```

3. For CommonJS-only scripts, rename to `.cjs` extension

**Example Fix** (`scripts/preinstall-check.js`):
```javascript
// Convert from CommonJS to ES Module
import { readFileSync } from 'fs';
import { fileURLToPath, dirname } from 'path';
import { fileURLToPath as urlFileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
```

### Import Path Issues in Tests

**Problem**: Import path errors like:
```
Error: Failed to load url ./tool-loader.service.js
```

**Root Cause**: Test files and target modules are in different directory levels.

**Affected Files**:
- All integration test files
- Any test files importing from `../../toolm/` or similar

**How to Avoid**:
1. Always verify relative path count based on file location
2. Use the actual file structure as reference:

```
packages/server/
├── tests/
│   └── integration/
│       └── tools.test.js  (3 levels deep)
└── toolm/
    └── tool-loader.service.js  (1 level deep)
```

3. Import path calculation: `../` (test) → `../` (tests) → `../` (server) → `toolm/` = `../../toolm/`

**Correct Import**:
```javascript
// ❌ Wrong
import { toolLoaderService } from './tool-loader.service.js';

// ✅ Correct
import { toolLoaderService } from '../../toolm/tool-loader.service.js';
```

### Mock Configuration Completeness

**Problem**: Missing mock exports cause:
```
Error: No "WebSocketServer" export is defined on "ws" mock
```

**Root Cause**: Code uses both `WebSocket` and `WebSocketServer` but only one is mocked.

**Affected Files**:
- All integration tests using external modules
- Any test file with `vi.mock()`

**How to Avoid**:
1. Search code for all exports used from the module
2. Mock all exports, not just the obvious ones:

```javascript
// ❌ Incomplete mock
vi.mock('ws', () => ({
  WebSocket: vi.fn().mockImplementation(() => ({...}))
}));

// ✅ Complete mock
vi.mock('ws', () => ({
  WebSocket: vi.fn().mockImplementation(() => ({...})),
  WebSocketServer: vi.fn().mockImplementation(() => ({...})),
  close: vi.fn()
}));
```

### Test Logic & Operator Precedence

**Problem**: Test assertions failing due to logical errors:
```javascript
// ❌ Returns object, not boolean
expect(error.message).toContain('permission') || expect(error.message).toContain('denied');

// ✅ Returns boolean as expected
expect(
  errorMsg.includes('permission') || errorMsg.includes('denied')
).toBe(true);
```

**Root Cause**: JavaScript operator precedence: `||` returns the first truthy value, not a boolean.

**Affected Files**:
- All test files with compound assertions
- Any logic using `||` with `expect()`

**How to Avoid**:
1. Always wrap logical expressions in parentheses when using with `expect()`
2. Use `expect.toBe(true)` for boolean assertions
3. Consider using `expect.stringContaining()` for multiple string checks

### Direct Property Modification vs Public Methods

**Problem**: Modifying object properties directly doesn't trigger internal logic:

```javascript
// ❌ May not work
session.isActive = false;
timeoutService.cleanupInactiveSessions();

// ✅ Uses public method that triggers cleanup
session.terminate();
timeoutService.cleanupInactiveSessions();
```

**Root Cause**: Internal cleanup logic may check specific conditions or call methods that property setting doesn't trigger.

**Affected Files**:
- All tests manipulating service/session objects
- Integration tests testing lifecycle methods

**How to Avoid**:
1. Always use public methods over direct property modification
2. Check object's API for lifecycle methods (`terminate()`, `close()`, `shutdown()`)
3. If no appropriate method exists, only then consider direct property modification

### Dependency Cleanup Strategy

**Problem**: Incomplete dependency cleanup causes cache issues or version conflicts.

**Root Cause**: This is a monorepo-like structure with multiple node_modules.

**Locations to Clean**:
```
├── node_modules/              (root dependencies)
├── package-lock.json          (root lockfile)
├── packages/
│   ├── server/
│   │   ├── node_modules/   (server-specific dependencies)
│   │   └── package-lock.json
│   └── admin-ui/
│       ├── node_modules/   (admin-ui dependencies)
│       └── package-lock.json
└── app/
    └── desktop/
        ├── node_modules/   (desktop app dependencies)
        └── package-lock.json
```

**Complete Cleanup Command**:
```bash
# Remove all node_modules and lockfiles
rm -rf node_modules package-lock.json
rm -rf packages/server/node_modules packages/server/package-lock.json
rm -rf packages/admin-ui/node_modules packages/admin-ui/package-lock.json
rm -rf app/desktop/node_modules app/desktop/package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall all dependencies
npm install
cd packages/admin-ui && npm install
```

**How to Avoid Cache Issues**:
1. Always run `npm run check:deps` to ensure all dependencies are installed
2. Run `npm cache clean --force` before major dependency changes
3. Use `--no-audit --no-fund` for faster installs in CI/CD

### Pre-Verification Checklist

**Before verifying any scripts or running tests, check these critical points:**

#### Script Validation Checklist
- [ ] Check `package.json` type field (ES Module vs CommonJS)
- [ ] Verify all imports use correct module syntax
- [ ] Check relative import paths are accurate
- [ ] Ensure all mocks are complete for required exports
- [ ] Verify test assertions use proper operator precedence

#### Dependency Validation Checklist
- [ ] Run `npm run check:deps` to verify all dependencies installed
- [ ] Run `npm run fix:pty` if node-pty issues occur
- [ ] Clean npm cache if unexpected errors occur: `npm cache clean --force`

#### Test Environment Checklist
- [ ] No conflicting services running on required ports
- [ ] Sufficient timeouts configured for long-running tests
- [ ] Mock configurations include all required exports
- [ ] Test assertions properly wrapped with parentheses for logical operations

#### Code Quality Checklist
- [ ] Run `npm run format:fix` before committing
- [ ] Run `npm run lint:fix` before committing
- [ ] No `console.log` in production code (use `logger` instead)
- [ ] No `require()` in ES Module files (use `import`)

#### Desktop App Issues

**Problem**: `dev:desktop` fails with:
```
Error: Electron failed to install correctly, please delete node_modules/electron and try installing again
```

**Root Cause**: Electron package installation corrupted or incomplete (missing critical files like `path.txt`, `dist` directory).

**How to Fix**:
```bash
# 1. COMPLETELY remove corrupted electron package
cd app/desktop && rm -rf node_modules/electron

# 2. Reinstall electron with CORRECT VERSION
cd app/desktop && npm install electron@39.2.7

# 3. Verify installation completeness
cd app/desktop && ls node_modules/electron/
# Should include: cli.js, dist/, index.js, package.json, path.txt, etc.

# 4. Then run dev:desktop
npm run dev:desktop
```

**Prevention**: Run `npm run check:deps` to ensure all dependencies are correctly installed before desktop commands.

**IMPORTANT: When reinstalling Electron, ALWAYS specify the correct version**:
```bash
cd app/desktop && rm -rf node_modules/electron
cd app/desktop && npm install electron@39.2.7  # MUST match desktop package.json version!
```

---

**Problem**: `build:desktop` or `dev:desktop` takes very long time or fails silently

**Root Cause**: 
- Previous build artifacts interfering
- npm cache issues
- Incomplete dependency installation

**How to Fix**:
```bash
# 1. Clean npm cache
npm cache clean --force

# 2. Remove all build artifacts
rm -rf dist/

# 3. Clean and reinstall all dependencies
npm run clean-reinstall

# 4. Rebuild icons
npm run build:icons

# 5. Then try build:desktop
npm run build:desktop
```

**Prevention**: Always run `npm run verify` before building to catch issues early.

#### MANDATORY DESKTOP-RELATED COMMANDS VERIFICATION ⚠️

**CRITICAL RULE**: Any changes that may affect desktop functionality MUST verify these commands:

```bash
# 1. Build desktop app
npm run build:desktop

# 2. Start desktop in dev mode
npm run dev:desktop

# 3. Run installation test
npm run test:install
```

**When to verify**: Run ALL THREE commands after any of:
- ✅ Changes to `app/desktop/` directory
- ✅ Changes to `packages/server/` (core library)
- ✅ Changes to electron-builder configuration
- ✅ Changes to build scripts (`scripts/build.sh`)
- ✅ Changes to `packages/resources/tools/` (tool sandbox)
- ✅ Changes to package.json dependencies affecting desktop
- ✅ Changes to any desktop-related configuration files

**Verification Requirements**:
- [ ] `npm run build:desktop` completes without errors
- [ ] `npm run dev:desktop` starts successfully (check logs for errors)
- [ ] `npm run test:install` passes all installation checks

**Failure Protocol**: If ANY of these commands fail:
1. **STOP** all further work
2. **IDENTIFY** the root cause
3. **FIX** the issue completely
4. **RE-VERIFY** all three commands pass
5. Only then proceed with other work

**Rationale**: Desktop app depends on:
- Core library (`packages/server/`)
- Tool sandbox (`packages/resources/tools/`)
- Build configuration (`electron-builder`)
- Dependency installation correctness

Changes to any of these areas can break desktop functionality if not properly verified.

**Full Pre-Verification Command**:
```bash
# Run complete pre-verification
npm run check:deps
npm run format:fix
npm run lint:fix
npm run setup:env
```

---

## End-to-End (E2E) Verification

### Verification Strategy
The project uses a **multi-layered verification approach** to ensure npm package and desktop app packaging work correctly:

1. **Unit Tests** (`npm run test:server`) - Component-level testing
2. **Integration Tests** (`npm run test:server:integration`) - Module interaction testing
3. **Module Loading Tests** (`npm run test:module-loading`) - Dependency resolution testing
4. **E2E Tests** (`npm run test:e2e`) - Packaged app functionality testing
5. **Comprehensive Verification** (`npm run verify`) - Full-stack verification

### Running E2E Verification

#### Comprehensive Parallel Verification
```bash
# Run all verification checks in parallel (RECOMMENDED)
npm run verify
```
This performs parallel checks across:
- Code quality (lint, format, tests)
- Dependencies (all packages)
- Build artifacts (admin UI, core, desktop)
- NPM package (files, versions, publish readiness)
- Desktop app (config, Electron, packable)
- Module loading (dev & production)

#### Module Loading Check
```bash
# Verify module loading and prevent dependency conflicts
npm run test:module-loading
```
Tests:
- packages/server dependencies exist
- Build scripts include server dependencies
- Desktop config references local server package
- Development app starts without module errors

#### Packaged App E2E Test
```bash
# Test actual packaged application (requires build first)
npm run desktop:build
npm run test:e2e
```
Tests:
- Packaged app launches successfully
- Backend service starts correctly
- Health check endpoint responds
- Web interface is accessible

#### Desktop App Verification
```bash
# Legacy verification (manual test)
npm run desktop:verify
```
**Note**: This runs `desktop:dev` which requires manual exit. Use `verify` instead.

### Verification Coverage

The verification ensures:

#### NPM Package Coverage
- ✅ All files listed in `package.json` exist
- ✅ Dependencies are installed and accessible
- ✅ Version consistency across all package.json files
- ✅ Admin UI assets are built
- ✅ Core library is buildable
- ✅ Package passes npm publish checks

#### Desktop App Coverage
- ✅ Desktop uses `file:` protocol for local core package
- ✅ Electron is installed and rebuildable
- ✅ Desktop build configuration is valid
- ✅ Module loading works in dev environment
- ✅ Packaged app launches and starts services
- ✅ Services respond correctly (health check, web access)
- ✅ No dependency conflicts between npm package and desktop app

#### Workflow Integration

The verification is designed to catch issues at each stage:

```
Code Changes → [Pre-commit Hook] → [Unit Tests] → [Integration Tests]
     ↓
[verify] (Full Verification)
     ↓
[NPM Publish or Desktop Build]
     ↓
[Final E2E Test on Packaged App]
```

### Required for Release

Before any release or major commit:

```bash
# 1. Run comprehensive E2E verification
npm run verify

# 2. If all checks pass, proceed with release flow
# For NPM publish:
npm run publish:verify
npm version <major|minor|patch>
git push origin main
git tag v<version>
git push origin v<version>

# For desktop build:
npm run desktop:build
npm run test:e2e
```

### Troubleshooting

#### Dependency Conflicts
**Symptom**: Module loading fails with `ERR_MODULE_NOT_FOUND`
**Solution**: Run `npm run check:deps` to reinstall dependencies
**Check**: Verify `app/desktop/package.json` uses `file:` protocol for `@becrafter/prompt-manager-core`

#### Build Failures
**Symptom**: Desktop build fails with missing files
**Solution**: Run `npm run build:admin-ui` before building desktop
**Check**: Verify `packages/web/` directory exists and contains `index.html`

#### Version Inconsistencies
**Symptom**: Version mismatch warnings in verification
**Solution**: Update version in all package.json files using `npm version`
**Check**: Ensure version matches in: root, server, desktop, env.example, config.js

#### Module Loading Issues
**Symptom**: Desktop app fails to load core library
**Solution**: Rebuild node-pty and reinstall dependencies
```bash
npm run fix:pty
npm run check:deps
```

#### E2E Test Failures
**Symptom**: Packaged app fails E2E tests
**Solution**: Ensure all previous checks pass first
```bash
npm run verify
npm run desktop:build
npm run test:e2e
```

### Continuous Verification

To ensure ongoing quality:

1. **Pre-commit**: Husky runs `lint-staged` + tests automatically
2. **Pre-push**: Husky runs full test suite + build verification
3. **Manual**: Run `npm run verify` before major changes
4. **CI/CD**: GitHub Actions run full verification on all PRs and main branch pushes

## Documentation Maintenance

### When to Update Documentation

Update documentation **immediately** when any of the following changes occur:

#### **1. Project Architecture Changes**
- ✅ New packages added (e.g., new `packages/*` directory)
- ✅ Package structure reorganized (e.g., moving services to different location)
- ✅ Build tools changed (e.g., Webpack → Vite, esbuild changes)
- ✅ Dependency management changes (e.g., switching to workspaces)
- ✅ New technologies adopted (e.g., TypeScript, new frameworks)

**Affected Files**:
- `AGENTS.md` - Project Overview, Project Structure
- `README.md` - Architecture diagrams, package descriptions
- `.github/workflows/*` - Build/deployment workflows

#### **2. Command Changes**
- ✅ New npm scripts added/removed/renamed in `package.json`
- ✅ Command behavior changed (e.g., different flags or parameters)
- ✅ Environment variables added/changed
- ✅ CLI interface modified

**Affected Files**:
- `AGENTS.md` - Build, Lint & Test Commands sections
- `README.md` - Quick start, usage examples
- `package.json` - Scripts section must stay in sync with documentation

#### **3. New Features Added**
- ✅ New services created (e.g., WebSocket service, terminal service)
- ✅ New API endpoints added
- ✅ New MCP tools implemented
- ✅ New UI components added
- ✅ Configuration options added

**Affected Files**:
- `AGENTS.md` - Code Style Guidelines, File Organization, Testing Patterns
- `README.md` - Features list, usage examples
- `packages/server/configs/**/*.yaml` - Configuration documentation
- Inline JSDoc comments for public APIs

#### **4. Build/Deploy Changes**
- ✅ Build process modified
- ✅ Deployment workflow updated
- ✅ NPM publish process changed
- ✅ Desktop packaging updated

**Affected Files**:
- `AGENTS.md` - Build Commands, NPM Publish Workflow, E2E Verification
- `.github/workflows/*` - CI/CD workflows
- `scripts/build.sh` - Build process documentation

#### **5. Code Style Changes**
- ✅ ESLint/Prettier rules updated
- ✅ Naming conventions changed
- ✅ Import patterns modified
- ✅ Testing framework changed or configured differently

**Affected Files**:
- `AGENTS.md` - Code Style Guidelines, Testing Patterns
- `packages/server/.eslintrc.cjs` - Rule documentation
- `packages/server/.prettierrc` - Formatting rules
- `packages/server/.prettierignore` - Ignore patterns
- `packages/server/vitest.config.js` - Test configuration

### Documentation Update Checklist

When making any of the changes above, complete this checklist:

#### **AGENTS.md Checklist**
- [ ] Update `Project Overview` if structure changed
- [ ] Update `Build, Lint & Test Commands` if commands changed
- [ ] Update `Code Style Guidelines` if patterns changed
- [ ] Update `File Organization` if structure changed
- [ ] Update `Testing Patterns` if test framework changed
- [ ] Update `Key Configuration Files` if configs changed
- [ ] Update `NPM Publish Workflow` if publishing changed
- [ ] Update `E2E Verification` if verification process changed
- [ ] **Run verification commands** to ensure they still work:
  ```bash
  npm run verify
  npm run verify:publish
  ```

#### **README.md Checklist**
- [ ] Update project description if scope changed
- [ ] Update installation instructions if dependencies changed
- [ ] Update usage examples if commands changed
- [ ] Update feature list if features added/removed
- [ ] Update version table if new version released
- [ ] Update configuration section if env variables changed

#### **package.json Checklist**
- [ ] Add new scripts if commands added
- [ ] Remove old scripts if commands removed
- [ ] Update script names if commands renamed
- [ ] Update dependencies if new packages required
- [ ] Update `files` array if new files need publishing
- [ ] Update version if releasing new version

#### **JSDoc Comments Checklist**
- [ ] Add JSDoc comments for new public functions/classes
- [ ] Update JSDoc comments if function signatures changed
- [ ] Add usage examples for complex functions
- [ ] Document parameters and return types
- [ ] Run `npm run docs` to verify JSDoc generation

### Maintaining Documentation Consistency

#### **1. Update-First Principle**
Always update documentation **before** or **at the same time** as code changes:
- ✅ Update AGENTS.md first, then write code
- ✅ Update package.json scripts, then update AGENTS.md
- ✅ Add JSDoc comments as you write functions

#### **2. Verification Commands**
After updating documentation, verify commands still work:
```bash
# Verify all npm scripts are valid
npm run verify

# Verify specific command categories
npm run dev
npm run build
npm run test
npm run lint
npm run verify:publish

# Check for typos in command documentation
npm run help
```

#### **3. Code Review Checklist**
When reviewing PRs, check for:
- [ ] AGENTS.md updated if commands/architecture changed
- [ ] README.md updated if features/usage changed
- [ ] JSDoc comments added for new public APIs
- [ ] Package.json scripts match documentation
- [ ] Configuration files documented
- [ ] Verification commands pass after changes

#### **4. Documentation Testing**
Test documentation instructions work:
```bash
# Test installation instructions
npm install
npm run check:deps

# Test build instructions
npm run build

# Test development instructions
npm run dev

# Test verification commands
npm run verify
```

#### **5. Automated Verification**
Leverage existing verification tools:
- **Pre-commit hooks**: Ensure code quality before commits
- **CI/CD workflows**: Run `npm run verify` on all PRs
- **Documentation checks**: Add script to verify documentation consistency (optional)

### Documentation Files Summary

| File | Purpose | Update Triggers |
|------|---------|-----------------|
| `AGENTS.md` | AI agent guide | Commands, architecture, testing, verification |
| `README.md` | User guide | Features, installation, usage, configuration |
| `package.json` | Project metadata | Scripts, dependencies, version, files |
| `JSDoc comments` | API documentation | New functions, changed signatures |
| `.github/workflows/*` | CI/CD | Build, test, deploy processes |
| `packages/server/configs/**/*.yaml` | Configuration | New config options, changed defaults |

### Quick Reference

**When in doubt, update:**
1. **Commands changed** → Update `AGENTS.md` + `package.json`
2. **Architecture changed** → Update `AGENTS.md` + `README.md`
3. **Features added** → Update `AGENTS.md` + `README.md` + JSDoc
4. **Build changed** → Update `AGENTS.md` + `.github/workflows/*`
5. **Any change** → Run `npm run verify` to verify

**Before committing documentation:**
```bash
# 1. Verify documentation consistency
npm run verify

# 2. Verify specific commands work
npm run build
npm run test
npm run verify:publish

# 3. Commit with clear message
git add AGENTS.md README.md package.json
git commit -m "docs: update documentation for [change]"
```
