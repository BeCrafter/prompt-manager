/**
 * ToolX 沙箱工具库 - 真实 Filesystem 工具调用示例
 * 
 * 该示例演示了如何使用 ToolX 沙箱库真实调用 filesystem 工具
 * 展示了运行时注入、依赖加载、工具帮助输出以及多个文件操作方法的真实调用
 */

import { ToolX } from '../index.js';
import path from 'path';
import fs from 'fs/promises';

async function runRealFilesystemExample() {
  console.log('📁 ToolX 沙箱工具库 - 真实 Filesystem 工具调用示例');
  console.log('================================================');

  // 1. 初始化 ToolX 实例
  console.log('\n🔧 1. 初始化 ToolX 实例...');
  const toolx = new ToolX();
  console.log('   ✓ ToolX 实例创建成功');

  // 2. 设置工具目录为包含真实 filesystem 工具的目录
  console.log('\n\ud83d\uddc2 2. 设置工具目录...');
  try {
    // 使用项目中的真实工具目录 - packages/toolx/resources/tools
    const toolsDir = path.join(process.cwd(), 'packages', 'toolx', 'resources', 'tools');
    toolx.setToolsDirectory(toolsDir);
    console.log('   ✓ 工具目录设置完成:', toolsDir);
  } catch (error) {
    console.log('   ⚠ 工具目录设置出错:', error.message);
    // 尝试使用项目根目录的工具目录
    try {
      const toolsDir = path.join(process.cwd(), '..', '..', 'packages', 'toolx', 'resources', 'tools');
      toolx.setToolsDirectory(toolsDir);
      console.log('   ✓ 工具目录设置完成 (备用路径):', toolsDir);
    } catch (error2) {
      console.log('   ⚠ 工具目录设置出错 (备用路径):', error2.message);
      // 最后的尝试：使用绝对路径
      try {
        const toolsDir = '~/code/Github/BeCrafter/prompt-server/packages/toolx/resources/tools';
        toolx.setToolsDirectory(toolsDir);
        console.log('   ✓ 工具目录设置完成 (绝对路径):', toolsDir);
      } catch (error3) {
        console.log('   ✗ 工具目录设置失败:', error3.message);
        return;
      }
    }
  }

  // 3. 验证工具发现
  console.log('\n🔍 3. 发现工具...');
  try {
    const tools = await toolx.discoverTools();
    console.log('   ✓ 发现工具数量:', tools.length);
    
    const filesystemTool = tools.find(tool => tool.name === 'filesystem');
    if (filesystemTool) {
      console.log('   ✓ 找到 filesystem 工具');
      console.log('   - 名称:', filesystemTool.metadata?.name || filesystemTool.name);
      console.log('   - 描述:', filesystemTool.metadata?.description || '无描述');
      console.log('   - 版本:', filesystemTool.metadata?.version || '未知');
    } else {
      console.log('   ⚠ 未找到 filesystem 工具');
      console.log('   可用工具:', tools.map(t => t.name).join(', '));
      return;
    }
  } catch (error) {
    console.log('   ✗ 工具发现失败:', error.message);
    return;
  }

  // 4. 创建测试目录
  console.log('\n📁 4. 准备测试环境...');
  const testDir = './test-real-output';
  const testFile = `${testDir}/test.txt`;
  
  try {
    // 确保测试目录存在
    await fs.mkdir(testDir, { recursive: true });
    console.log('   ✓ 测试目录创建完成:', testDir);
  } catch (error) {
    console.log('   ⚠ 测试目录创建提示:', error.message);
  }

  // 5. 真实调用 filesystem 工具方法
  console.log('\n🧪 5. 真实调用 filesystem 工具方法...');

  try {
    // 方法 1: create_directory - 创建目录
    console.log('\n📁 方法 1: create_directory');
    try {
      const createResult = await toolx.executeTool(
        'filesystem',
        'nodejs',
        {
          runtime: { workingDir: process.cwd() },
          security: {
            blockedCommands: ['rm', 'mv', 'dangerous_command'],
            fileAccessWhitelist: ['/tmp', './test-real-output']
          },
          limits: {
            maxMemory: '256MB',
            maxExecutionTime: 15000
          }
        },
        {
          method: 'create_directory',
          path: './test-real-output/real-test-dir'
        }
      );
      console.log('   ✓ 目录创建成功:', createResult);
    } catch (error) {
      console.log('   ⚠ 目录创建提示:', error.message);
    }

    // 方法 2: write_file - 写入文件
    console.log('\n📝 方法 2: write_file');
    try {
      const writeResult = await toolx.executeTool(
        'filesystem',
        'nodejs',
        {
          runtime: { workingDir: process.cwd() },
          security: {
            blockedCommands: ['rm', 'mv', 'dangerous_command'],
            fileAccessWhitelist: ['/tmp', './test-real-output']
          },
          limits: {
            maxMemory: '256MB',
            maxExecutionTime: 15000
          }
        },
        {
          method: 'write_file',
          path: './test-real-output/real-test.txt',
          content: `Hello Real ToolX Filesystem Tool!\nThis is a real test file created on ${new Date().toISOString()}\n\nReal content for demonstration.`
        }
      );
      console.log('   ✓ 文件写入成功:', writeResult);
    } catch (error) {
      console.log('   ⚠ 文件写入提示:', error.message);
    }

    // 方法 3: get_file_info - 获取文件信息
    console.log('\n🔍 方法 3: get_file_info');
    try {
      const infoResult = await toolx.executeTool(
        'filesystem',
        'nodejs',
        {
          runtime: { workingDir: process.cwd() },
          security: {
            blockedCommands: ['rm', 'mv', 'dangerous_command'],
            fileAccessWhitelist: ['/tmp', './test-real-output']
          },
          limits: {
            maxMemory: '256MB',
            maxExecutionTime: 15000
          }
        },
        {
          method: 'get_file_info',
          path: './test-real-output/real-test.txt'
        }
      );
      console.log('   ✓ 文件信息获取成功:', {
        size: infoResult.size,
        isFile: infoResult.isFile,
        isDirectory: infoResult.isDirectory,
        modified: new Date(infoResult.mtimeMs).toISOString()
      });
    } catch (error) {
      console.log('   ⚠ 文件信息获取提示:', error.message);
    }

    // 方法 4: read_text_file - 读取文件内容
    console.log('\n📖 方法 4: read_text_file');
    try {
      const readResult = await toolx.executeTool(
        'filesystem',
        'nodejs',
        {
          runtime: { workingDir: process.cwd() },
          security: {
            blockedCommands: ['rm', 'mv', 'dangerous_command'],
            fileAccessWhitelist: ['/tmp', './test-real-output']
          },
          limits: {
            maxMemory: '256MB',
            maxExecutionTime: 15000
          }
        },
        {
          method: 'read_text_file',
          path: './test-real-output/real-test.txt'
        }
      );
      console.log('   ✓ 文件读取成功 (前100字符):', readResult.substring(0, 100) + '...');
    } catch (error) {
      console.log('   ⚠ 文件读取提示:', error.message);
    }

    // 额外方法: list_directory - 列出目录内容
    console.log('\n📋 额外方法: list_directory');
    try {
      const listResult = await toolx.executeTool(
        'filesystem',
        'nodejs',
        {
          runtime: { workingDir: process.cwd() },
          security: {
            blockedCommands: ['rm', 'mv', 'dangerous_command'],
            fileAccessWhitelist: ['/tmp', './test-real-output']
          },
          limits: {
            maxMemory: '256MB',
            maxExecutionTime: 15000
          }
        },
        {
          method: 'list_directory',
          path: './test-real-output'
        }
      );
      console.log('   ✓ 目录列表获取成功:', listResult);
    } catch (error) {
      console.log('   ⚠ 目录列表获取提示:', error.message);
    }

  } catch (error) {
    console.log('   ✗ 方法执行失败:', error.message);
    console.log('   💡 错误可能是由于安全策略限制或工具实现问题');
  }

  // 6. 显示工具元信息
  console.log('\n📚 6. 工具元信息...');
  try {
    const toolList = await toolx.getToolList();
    const filesystemTool = toolList.find(tool => tool.name === 'filesystem');
    
    if (filesystemTool) {
      console.log('   ✓ filesystem 工具信息:');
      console.log('   - ID:', filesystemTool.id);
      console.log('   - 名称:', filesystemTool.name);
      console.log('   - 描述:', filesystemTool.description);
      console.log('   - 版本:', filesystemTool.version);
      console.log('   - 分类:', filesystemTool.category);
      console.log('   - 标签:', filesystemTool.tags?.join(', '));
    } else {
      console.log('   ⚠ 无法获取 filesystem 工具信息');
    }
  } catch (error) {
    console.log('   ⚠ 工具信息获取提示:', error.message);
  }

  // 7. 显示工具依赖信息
  console.log('\n📦 7. 工具依赖信息...');
  try {
    const tools = await toolx.discoverTools();
    const filesystemTool = tools.find(tool => tool.name === 'filesystem');
    
    if (filesystemTool && filesystemTool.dependencies) {
      console.log('   ✓ filesystem 工具依赖:');
      Object.entries(filesystemTool.dependencies).forEach(([dep, version]) => {
        console.log('     -', dep + ':', version);
      });
    } else {
      console.log('   ⚠ 无法获取工具依赖信息');
    }
  } catch (error) {
    console.log('   ⚠ 工具依赖信息获取提示:', error.message);
  }

  // 8. 显示运行时需求
  console.log('\n⚡ 8. 运行时需求...');
  try {
    const tools = await toolx.discoverTools();
    const filesystemTool = tools.find(tool => tool.name === 'filesystem');
    
    if (filesystemTool && filesystemTool.runtimeRequirements) {
      console.log('   ✓ filesystem 工具运行时需求:');
      const reqs = filesystemTool.runtimeRequirements;
      console.log('     - Node.js 版本要求:', reqs.nodeVersion);
      console.log('     - 支持平台:', reqs.platform?.join(', '));
      console.log('     - 必需命令:', reqs.requiredCommands?.join(', '));
      console.log('     - 最大内存:', reqs.maxMemory);
      console.log('     - 最大执行时间:', reqs.maxExecutionTime, 'ms');
    } else {
      console.log('   ⚠ 无法获取运行时需求信息');
    }
  } catch (error) {
    console.log('   ⚠ 运行时需求信息获取提示:', error.message);
  }

  // 9. 清理测试文件
  console.log('\n🧹 9. 清理测试文件...');
  try {
    await fs.rm('./test-real-output', { recursive: true, force: true });
    console.log('   ✓ 测试文件清理完成');
  } catch (error) {
    console.log('   ⚠ 测试文件清理提示:', error.message);
  }

  console.log('\n✅ 真实 Filesystem 工具调用示例执行完成！');
  console.log('\n💡 本示例展示了：');
  console.log('   - 🔧 ToolX 沙箱工具库的真实工具调用');
  console.log('   - 📂 真实 filesystem 工具的加载和发现');
  console.log('   - 📚 工具元信息和依赖信息获取');
  console.log('   - ⚡ 运行时需求信息展示');
  console.log('   - 🧪 5个主要方法的真实调用 (create_directory, write_file, get_file_info, read_text_file, list_directory)');
  console.log('   - 🧹 测试环境清理');
}

// 执行真实 filesystem 示例
runRealFilesystemExample().catch(error => {
  console.error('❌ 真实 Filesystem 示例执行出错:', error);
  console.error('堆栈:', error.stack);
  process.exit(1);
});