/**
 * 工具手册生成服务
 *
 * 职责：
 * 1. 生成格式化的工具手册（manual模式）
 * 2. 生成错误帮助信息（execute模式出错时）
 * 3. 统一工具文档的格式和样式
 */

/**
 * 生成工具手册（完整版）
 * @param {string} toolName - 工具名称
 * @param {object} tool - 工具对象（包含 metadata, schema, businessErrors）
 * @returns {string} Markdown格式的手册
 */
export function generateManual(toolName, tool) {
  const { metadata, schema, businessErrors } = tool;

  let manual = '';

  // 标题和基本信息
  manual += `# 📚 ${metadata.name || toolName}\n\n`;

  if (metadata.description) {
    manual += `## 📋 工具描述\n\n${metadata.description}\n\n`;
  }

  // 基本信息卡片
  manual += '## ℹ️ 基本信息\n\n';
  if (metadata.version) {
    manual += `- **版本**: ${metadata.version}\n`;
  }
  if (metadata.author) {
    manual += `- **作者**: ${metadata.author}\n`;
  }
  if (metadata.tags && metadata.tags.length > 0) {
    manual += `- **标签**: ${metadata.tags.map(t => `\`${t}\``).join(', ')}\n`;
  }
  manual += '\n';

  // 使用场景
  if (metadata.scenarios && metadata.scenarios.length > 0) {
    manual += '## 🎯 使用场景\n\n';
    metadata.scenarios.forEach(scenario => {
      manual += `- ✅ ${scenario}\n`;
    });
    manual += '\n';
  }

  // 参数说明
  if (schema.parameters) {
    manual += '## 📝 参数说明\n\n';

    const props = schema.parameters.properties || {};
    const required = schema.parameters.required || [];

    // 必需参数
    if (required.length > 0) {
      manual += '### ✅ 必需参数\n\n';
      for (const key of required) {
        const prop = props[key];
        if (prop) {
          manual += `- **\`${key}\`** (${prop.type || '未指定类型'})`;
          if (prop.enum) {
            manual += ` - 可选值: ${prop.enum.map(v => `\`${v}\``).join(', ')}`;
          }
          manual += '\n';
          if (prop.description) {
            manual += `  > ${prop.description}\n`;
          }
          if (prop.default !== undefined) {
            manual += `  > 💡 默认值: \`${prop.default}\`\n`;
          }
          manual += '\n';
        }
      }
    }

    // 可选参数
    const optional = Object.keys(props).filter(k => !required.includes(k));
    if (optional.length > 0) {
      manual += '### 📌 可选参数\n\n';
      for (const key of optional) {
        const prop = props[key];
        if (prop) {
          manual += `- **\`${key}\`** (${prop.type || '未指定类型'})`;
          if (prop.default !== undefined) {
            manual += ` - 默认值: \`${prop.default}\``;
          }
          if (prop.enum) {
            manual += ` - 可选值: ${prop.enum.map(v => `\`${v}\``).join(', ')}`;
          }
          manual += '\n';
          if (prop.description) {
            manual += `  > ${prop.description}\n`;
          }
          manual += '\n';
        }
      }
    }
  }

  // 环境变量
  if (schema.environment && schema.environment.properties) {
    manual += '## ⚙️ 环境变量配置\n\n';
    const envProps = schema.environment.properties;
    for (const [key, value] of Object.entries(envProps)) {
      manual += `### \`${key}\`\n\n`;
      if (value.description) {
        manual += `**说明**: ${value.description}\n\n`;
      }
      if (value.default) {
        manual += `**默认值**: \`${value.default}\`\n\n`;
      }
    }

    manual += '> 💡 使用 `mode: configure` 可以配置这些环境变量\n\n';
  }

  // 错误处理
  if (businessErrors && businessErrors.length > 0) {
    manual += '## ⚠️ 常见错误处理\n\n';
    businessErrors.forEach(error => {
      manual += `### ${error.code}\n\n`;
      manual += `- **描述**: ${error.description}\n`;
      manual += `- **解决方案**: ${error.solution}\n`;
      manual += `- **可重试**: ${error.retryable ? '✅ 是' : '❌ 否'}\n\n`;
    });
  }

  // 限制说明
  if (metadata.limitations && metadata.limitations.length > 0) {
    manual += '## ⚠️ 限制说明\n\n';
    metadata.limitations.forEach(limitation => {
      manual += `- ⚠️ ${limitation}\n`;
    });
    manual += '\n';
  }

  // 使用示例
  manual += '## 💡 使用示例\n\n';
  manual += '### 基础使用\n\n';
  manual += '```yaml\n';
  manual += `tool: tool://${toolName}\n`;
  manual += 'mode: execute\n';
  manual += 'parameters:\n';

  // 生成示例参数
  if (schema.parameters && schema.parameters.properties) {
    const props = schema.parameters.properties;
    const required = schema.parameters.required || [];

    // 添加必需参数示例
    for (const key of required.slice(0, 3)) {
      // 最多显示3个必需参数
      const prop = props[key];
      if (prop) {
        const exampleValue = generateExampleValue(key, prop);
        manual += `  ${key}: ${exampleValue}  # ${prop.description || ''}\n`;
      }
    }

    // 添加可选参数示例（最多2个）
    const optional = Object.keys(props).filter(k => !required.includes(k));
    for (const key of optional.slice(0, 2)) {
      const prop = props[key];
      if (prop && prop.default !== undefined) {
        const defaultValue = typeof prop.default === 'string' ? `"${prop.default}"` : prop.default;
        manual += `  # ${key}: ${defaultValue}  # ${prop.description || ''} (可选)\n`;
      }
    }
  }

  manual += '```\n\n';

  return manual;
}

/**
 * 生成错误帮助信息
 * @param {string} toolName - 工具名称
 * @param {Error} error - 错误对象
 * @param {object} tool - 工具对象（包含 metadata, schema）
 * @param {object} parameters - 当前参数
 * @param {object} businessError - 业务错误信息（可选）
 * @returns {string} Markdown格式的帮助信息
 */
export function generateHelpInfo(toolName, error, tool, parameters = {}, businessError = null) {
  const { metadata, schema } = tool;

  let helpText = '';

  // 错误提示
  helpText += '# ⚠️ 工具执行错误\n\n';
  helpText += `**工具**: ${metadata.name || toolName}\n\n`;
  helpText += `**错误信息**: \`${error.message}\`\n\n`;

  if (businessError) {
    helpText += `**错误类型**: ${businessError.description}\n\n`;
    helpText += `**解决方案**: ${businessError.solution}\n\n`;
  }

  helpText += '---\n\n';

  // 工具基本信息
  helpText += '## 📋 工具信息\n\n';
  if (metadata.description) {
    helpText += `**描述**: ${metadata.description}\n\n`;
  }

  // 当前参数
  if (parameters && Object.keys(parameters).length > 0) {
    helpText += '## 📥 当前参数\n\n';
    helpText += `\`\`\`json\n${JSON.stringify(parameters, null, 2)}\n\`\`\`\n\n`;
  }

  // 参数说明
  if (schema.parameters) {
    helpText += '## 📝 参数说明\n\n';

    const props = schema.parameters.properties || {};
    const required = schema.parameters.required || [];

    // 必需参数
    if (required.length > 0) {
      helpText += '### ✅ 必需参数\n\n';
      for (const key of required) {
        const prop = props[key];
        if (prop) {
          helpText += `- **\`${key}\`** (${prop.type || '未指定类型'})`;
          if (prop.enum) {
            helpText += ` - 可选值: ${prop.enum.map(v => `\`${v}\``).join(', ')}`;
          }
          helpText += '\n';
          if (prop.description) {
            helpText += `  > ${prop.description}\n`;
          }
        }
      }
      helpText += '\n';
    }

    // 可选参数
    const optional = Object.keys(props).filter(k => !required.includes(k));
    if (optional.length > 0) {
      helpText += '### 📌 可选参数\n\n';
      for (const key of optional) {
        const prop = props[key];
        if (prop) {
          helpText += `- **\`${key}\`** (${prop.type || '未指定类型'})`;
          if (prop.default !== undefined) {
            helpText += ` - 默认值: \`${prop.default}\``;
          }
          if (prop.enum) {
            helpText += ` - 可选值: ${prop.enum.map(v => `\`${v}\``).join(', ')}`;
          }
          helpText += '\n';
          if (prop.description) {
            helpText += `  > ${prop.description}\n`;
          }
        }
      }
      helpText += '\n';
    }
  }

  // 使用示例
  helpText += '## 💡 使用示例\n\n';

  // 根据错误类型生成不同的示例
  if (error.message.includes('不支持的方法')) {
    // 方法错误，显示所有支持的方法
    if (schema.parameters && schema.parameters.properties && schema.parameters.properties.method) {
      const methodEnum = schema.parameters.properties.method.enum || [];
      if (methodEnum.length > 0) {
        helpText += '### ❌ 错误：不支持的方法\n\n';
        helpText += '**支持的方法列表**：\n\n';
        methodEnum.forEach(method => {
          helpText += `- \`${method}\`\n`;
        });
        helpText += '\n';
      }
    }
  }

  if (error.message.includes('缺少必需参数') || error.message.includes('缺少参数')) {
    // 提取缺失的参数名
    const missingMatch = error.message.match(/缺少.*参数[：:]\s*([^\n]+)/i);
    if (missingMatch) {
      const missingParams = missingMatch[1].split(',').map(p => p.trim());
      helpText += '### ❌ 错误：缺少必需参数\n\n';
      helpText += `**缺失的参数**：${missingParams.map(p => `\`${p}\``).join(', ')}\n\n`;
      helpText += '**这些参数是必需的，必须提供**\n\n';
    }
  }

  // 生成正确的使用示例
  helpText += '### ✅ 正确使用方式\n\n';
  helpText += '```yaml\n';
  helpText += `tool: tool://${toolName}\n`;
  helpText += 'mode: execute\n';
  helpText += 'parameters:\n';

  // 根据schema生成示例参数
  if (schema.parameters && schema.parameters.properties) {
    const props = schema.parameters.properties;
    const required = schema.parameters.required || [];

    // 先添加必需参数
    for (const key of required) {
      const prop = props[key];
      if (prop) {
        const exampleValue = generateExampleValue(key, prop);
        helpText += `  ${key}: ${exampleValue}  # ${prop.description || ''}\n`;
      }
    }

    // 添加一些常用的可选参数（最多3个）
    const optional = Object.keys(props).filter(k => !required.includes(k));
    let shownOptional = 0;
    for (const key of optional) {
      if (shownOptional >= 3) break;
      const prop = props[key];
      if (prop) {
        if (prop.default !== undefined) {
          const defaultValue = typeof prop.default === 'string' ? `"${prop.default}"` : prop.default;
          helpText += `  # ${key}: ${defaultValue}  # ${prop.description || ''} (可选，默认值: ${prop.default})\n`;
          shownOptional++;
        } else if (prop.enum && prop.enum.length > 0) {
          helpText += `  # ${key}: ${prop.enum[0]}  # ${prop.description || ''} (可选)\n`;
          shownOptional++;
        }
      }
    }
  }

  helpText += '```\n\n';

  // 查看完整手册的提示
  helpText += '---\n\n';
  helpText += '## 🔍 需要更多帮助？\n\n';
  helpText += '使用以下命令查看完整的工具手册：\n\n';
  helpText += '```yaml\n';
  helpText += `tool: tool://${toolName}\n`;
  helpText += 'mode: manual\n';
  helpText += '```\n\n';

  return helpText;
}

/**
 * 生成参数示例值
 * @param {string} key - 参数名
 * @param {object} prop - 参数属性
 * @returns {string} 示例值字符串
 */
function generateExampleValue(key, prop) {
  if (prop.enum && prop.enum.length > 0) {
    return prop.enum[0];
  }

  if (prop.type === 'string') {
    // 根据参数名提供更合适的示例值
    if (key.includes('path') || key.includes('url') || key.includes('file')) {
      return key.includes('url') ? '"https://example.com/file.txt"' : '"~/.prompt-manager/file.txt"';
    } else if (key.includes('method')) {
      return prop.enum ? prop.enum[0] : '"method_name"';
    }
    return '"示例值"';
  }

  if (prop.type === 'number') {
    return '0';
  }

  if (prop.type === 'boolean') {
    return 'true';
  }

  if (prop.type === 'array') {
    return '[]';
  }

  if (prop.type === 'object') {
    return '{}';
  }

  return '# 请填写';
}
