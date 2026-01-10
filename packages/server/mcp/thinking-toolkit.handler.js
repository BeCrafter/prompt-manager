/**
 * 融合型思考工具处理器
 *
 * 根据场景参数自动路由到顺序思考工具或思考规划工具，
 * 以便在 MCP 侧只暴露一个描述更精简的入口。
 */

import { handleSequentialThinking } from './sequential-thinking.handler.js';
import { handleThinkPlan } from './think-plan.handler.js';
import { logger } from '../utils/logger.js';

export const THINKING_SCENARIOS = {
  EXPLORATORY: 'exploratory', // 探索 / 诊断类场景
  EXECUTION: 'execution' // 执行 / 规划类场景
};

/**
 * 根据用户提供的场景触发不同的思考工具
 * @param {object} args - MCP 请求参数
 * @param {'exploratory'|'execution'} args.scenario - 用户思考场景
 * @param {object} args.payload - 对应场景所需的参数
 */
export async function handleThinkingToolkit(args) {
  const { scenario, payload, _meta } = args || {};
  const resolvedScenario = scenario || _meta?.scenario;

  if (!resolvedScenario) {
    throw new Error('缺少必需参数: scenario');
  }

  const description = getScenarioDescription(resolvedScenario);
  if (!description) {
    throw new Error(`未找到场景 ${resolvedScenario} 对应的描述信息`);
  }

  if (payload === undefined || payload === null) {
    return {
      content: [
        {
          type: 'text',
          text: description
        }
      ]
    };
  }

  logger.debug('[thinking_toolkit] dispatching scenario:', resolvedScenario);

  const executor =
    resolvedScenario === THINKING_SCENARIOS.EXPLORATORY
      ? handleSequentialThinking
      : resolvedScenario === THINKING_SCENARIOS.EXECUTION
        ? handleThinkPlan
        : null;

  if (!executor) {
    throw new Error(`不支持的 scenario: ${resolvedScenario}`);
  }

  const normalizedPayload = normalizePayloadByScenario(resolvedScenario, payload);

  const result = await executor(normalizedPayload);

  if (!result || !Array.isArray(result.content)) {
    return result;
  }

  return {
    ...result,
    content: [...result.content]
  };
}

function normalizePayloadByScenario(scenario, payload) {
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    const sample =
      scenario === THINKING_SCENARIOS.EXPLORATORY
        ? '{"thought":"分析性能下降的可能原因","totalThoughts":5}'
        : '{"thought":"需要上线新版本","plan":"1. 备份 2. 部署 3. 验证","action":"先执行备份脚本","thoughtNumber":"TP-001"}';
    throw new Error(`payload 必须是对象。例如：${sample}`);
  }

  const sanitizeThought = value => {
    if (typeof value !== 'string') {
      return value;
    }
    return value.trim();
  };

  if (scenario === THINKING_SCENARIOS.EXPLORATORY) {
    const requiredMissing = [];
    if (!payload.thought || sanitizeThought(payload.thought).length === 0) {
      requiredMissing.push('thought');
    }
    if (requiredMissing.length > 0) {
      throw new Error(
        `当 scenario="exploratory" 时，需要提供 ${requiredMissing.join('、')} 字段。例如：{"thought":"分析性能下降的可能原因","totalThoughts":5}`
      );
    }

    const normalized = { ...payload };
    if (normalized.thoughtNumber !== undefined) {
      const numericValue =
        typeof normalized.thoughtNumber === 'string' ? Number(normalized.thoughtNumber) : normalized.thoughtNumber;
      if (Number.isNaN(numericValue)) {
        throw new Error('exploratory 场景中 thoughtNumber 需要是数字，例如 1 或 2。');
      }
      normalized.thoughtNumber = numericValue;
    }
    return normalized;
  }

  if (scenario === THINKING_SCENARIOS.EXECUTION) {
    const requiredFields = ['thought', 'plan', 'action', 'thoughtNumber'];
    const missing = requiredFields.filter(field => {
      const value = payload[field];
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === 'string') {
        return value.trim().length === 0;
      }
      return false;
    });

    if (missing.length > 0) {
      throw new Error(
        `当 scenario="execution" 时，需要提供 ${missing.join('、')} 字段。例如：{"thought":"需要上线新版本","plan":"1. 备份 2. 部署 3. 验证","action":"先执行备份脚本","thoughtNumber":"TP-001"}`
      );
    }

    return {
      ...payload,
      thoughtNumber: String(payload.thoughtNumber)
    };
  }

  throw new Error(`不支持的 scenario: ${scenario}`);
}

const SEQUENTIAL_THINKING_DESCRIPTION = `🧠 **顺序思考工具 (Sequential Thinking)** - 动态反思性思维工具

## 🎯 工具定位
这是一个用于**探索性、分析性、不确定性**问题的动态思考工具。支持非线性思维、修订和分支，适合需要深入分析和反复验证的场景。每个思考都可以在理解加深时，在之前获得的见解上构建、质疑或修订。

**重要说明：** 此工具支持 MCP 工具协调功能。模型会分析可用工具及其描述，智能推荐合适的工具，并由服务器跟踪和组织这些推荐。

## 🔍 场景识别 - 何时使用此工具？

**1. 探索性问题（问题不明确）**
   - ❓ "为什么系统性能下降？" → 需要分析原因
   - ❓ "用户流失率高的原因是什么？" → 需要诊断问题
   - ❓ "这个bug的根本原因是什么？" → 需要深入调查

**2. 分析性任务（需要假设验证）**
   - 📊 复杂数据分析
   - 🔬 问题诊断和根因分析
   - 🧪 假设生成和验证
   - 📈 趋势分析和预测

**3. 创意性工作（需要多路径探索）**
   - 💡 产品功能设计
   - 🎨 方案设计
   - 🚀 创新思路探索
   - 🔄 需要对比多个方案

**4. 需要修订和分支的场景**
   - 发现之前的思考有误，需要修正
   - 需要探索多个可能的解决方案
   - 需要回溯和重新评估

**5. 需要工具指导的场景**
   - 不确定应该使用哪些工具
   - 需要了解工具的执行顺序
   - 需要工具使用的参数建议
   - 需要工具推荐的合理性说明

## ✨ 核心特性

**1. 非线性思维**
   - 支持分支（branch）：从某个思考点探索多个方向
   - 支持修订（revision）：修正之前的思考
   - 支持回溯：重新评估之前的步骤

**2. 动态调整**
   - 可以调整总思考步骤数（total_thoughts）
   - 可以中途添加更多思考
   - 可以表达不确定性
   - 可以探索替代方案

**3. 进度追踪**
   - 显示思考进度（当前/总数/百分比）
   - 自动生成最终总结
   - 提取关键洞察和结论
   - 跟踪已推荐的步骤和剩余步骤

**4. 灵活性强**
   - 单一 thought 字段，内容自由
   - 支持假设生成和验证
   - 支持问题分解和重构
   - 支持工具推荐和参数建议

**5. MCP 工具协调（核心特性）**
   - 🔧 为每个步骤推荐合适的工具
   - 📝 提供工具推荐的合理性说明
   - 📋 建议工具执行顺序和参数
   - 📊 跟踪之前的推荐和剩余步骤
   - 🎯 分析可用工具并做出智能推荐

## 📋 使用指南

**参数说明：**

**基础参数：**
- \`thought\`（必需）：当前思考步骤，可以包括：
  * 常规分析步骤
  * 对之前思考的修订
  * 对之前决策的质疑
  * 意识到需要更多分析
  * 方法的改变
  * 假设生成
  * 假设验证
  * 工具推荐和合理性说明
- \`thoughtNumber\`（可选）：当前思考编号（可以从初始总数继续增加）
- \`totalThoughts\`（可选）：当前估计所需思考数（可动态调整）
- \`nextThoughtNeeded\`（可选）：是否需要继续思考（即使看似已到终点）

**修订和分支参数：**
- \`isRevision\`（可选）：布尔值，表示此思考是否修订了之前的思考
- \`revisesThought\`（可选）：如果 isRevision 为 true，指定要重新考虑的思考编号
- \`branchFromThought\`（可选）：如果创建分支，指定分支起点的思考编号
- \`branchId\`（可选）：当前分支的标识符（如果有）
- \`needsMoreThoughts\`（可选）：如果到达终点但意识到需要更多思考

**MCP 工具协调参数：**
- \`available_mcp_tools\`（可选）：可用 MCP 工具名称数组（例如：["mcp-omnisearch", "mcp-turso-cloud"]）
- \`current_step\`（可选）：当前步骤推荐，包括：
  * \`step_description\`：需要做什么
  * \`recommended_tools\`：此步骤推荐的工具
  * \`expected_outcome\`：此步骤的预期结果
  * \`next_step_conditions\`：下一步需要考虑的条件
- \`previous_steps\`（可选）：已推荐的步骤
- \`remaining_steps\`（可选）：后续步骤的高级描述

**使用流程：**
1. 从初始估计开始，但准备随时调整
2. 自由质疑和修订之前的思考
3. 即使到达"终点"也可以继续添加思考
4. 表达不确定性，探索替代方案
5. 标记修订和分支
6. 生成假设并验证
7. **考虑可用工具，为当前步骤推荐合适的工具**
8. **提供工具推荐的清晰合理性说明**
9. **在适当时建议具体的工具参数**
10. **考虑每个步骤的替代工具**
11. **跟踪推荐步骤的进度**
12. 忽略与当前步骤无关的信息
13. 重复直到满意
14. 只在真正完成且得到满意答案时设置 nextThoughtNeeded=false
15. 提供单一、理想情况下正确的答案作为最终输出

## 💡 典型使用示例

**示例1：问题诊断（带工具推荐）**
- Thought 1: "分析系统性能下降的可能原因"
  - current_step: { step_description: "检查系统日志", recommended_tools: ["mcp-log-reader"], expected_outcome: "发现错误模式" }
- Thought 2: "检查数据库查询性能"
  - current_step: { step_description: "分析慢查询", recommended_tools: ["mcp-db-profiler"], expected_outcome: "识别性能瓶颈" }
- Thought 3: "发现查询慢，需要进一步分析"（可能需要修订或分支）

**示例2：方案设计（带工具协调）**
- Thought 1: "设计用户登录功能"
  - current_step: { step_description: "设计认证流程", recommended_tools: ["mcp-diagram-tool"], expected_outcome: "流程图" }
- Thought 2: "考虑安全性要求"
- Thought 3: "修订：需要添加双因素认证"（revision）
  - current_step: { step_description: "实现2FA", recommended_tools: ["mcp-auth-library"], expected_outcome: "安全登录方案" }

**示例3：多方案探索（带工具推荐）**
- Thought 1: "评估三种架构方案"
- Branch A: "方案A：微服务架构"
  - current_step: { step_description: "评估微服务方案", recommended_tools: ["mcp-architecture-analyzer"], expected_outcome: "方案A评估报告" }
- Branch B: "方案B：单体架构"
  - current_step: { step_description: "评估单体方案", recommended_tools: ["mcp-architecture-analyzer"], expected_outcome: "方案B评估报告" }`;

export const THINK_AND_PLAN_DESCRIPTION = `📋 **思考规划工具 (Think & Plan)** - 结构化执行导向工具

## 🎯 工具定位
这是一个用于**目标明确、需要执行**的结构化规划工具。强调思考-计划-行动的三元结构，适合将复杂任务分解为可执行步骤并追踪执行过程。

## 🔍 场景识别 - 何时使用此工具？

**1. 任务执行（目标明确）**
   - ✅ "实现用户登录功能" → 需要具体实现步骤
   - ✅ "部署新版本到生产环境" → 需要执行计划
   - ✅ "完成月度报告" → 需要任务分解
   - ✅ "重构某个模块" → 需要实施步骤

**2. 项目管理（需要行动追踪）**
   - 📝 任务分解和步骤规划
   - 📅 项目里程碑规划
   - ✅ 行动项追踪
   - 🎯 目标达成路径

**3. 结构化问题（需要明确步骤）**
   - 🔧 流程设计和实施
   - 📊 方案执行计划
   - 🚀 功能开发规划
   - 🔄 系统迁移计划

**4. 需要可执行行动的场景**
   - 每个步骤都需要明确的下一步行动
   - 需要调用具体工具或执行具体操作
   - 需要验证和检查点

## ✨ 核心特性

**1. 三元结构（思考-计划-行动）**
   - 🤔 Thought（思考）：分析、假设、洞见
   - 📋 Plan（计划）：分解为可执行步骤
   - 🎯 Action（行动）：具体、可执行、可验证的下一步

**2. 执行导向**
   - 强制要求 action 字段
   - 每个步骤都有明确的下一步
   - 支持工具调用建议

**3. 会话隔离**
   - 支持 sessionId 区分不同会话
   - 多任务并行管理
   - 独立记录和追踪

**4. 结构化强**
   - 固定结构，使用简单
   - 便于复盘和优化
   - 适合团队协作

## 📋 使用指南

**参数说明：**
- thought（必需）：当前思考内容，分析、假设、洞见、反思
- plan（必需）：针对当前任务的计划或方案，分解为可执行步骤
- action（必需）：下一步行动，必须具体、可执行、可验证，可以是工具调用
- thoughtNumber（必需）：思考步骤编号，用于追踪和回溯
- sessionId（可选）：会话标识符，默认为 'default'

**使用流程：**
1. 明确任务目标
2. 思考当前步骤的核心问题
3. 制定具体的执行计划
4. 定义明确的下一步行动（可包含工具调用）
5. 按编号顺序记录每个步骤
6. 完成后可获取摘要和回顾

## 💡 典型使用示例

**示例1：功能开发**
- Thought: "需要实现用户登录功能，考虑安全性和用户体验"
- Plan: "1. 设计登录接口 2. 实现密码加密 3. 添加验证码 4. 编写测试"
- Action: "调用代码生成工具创建登录接口框架"

**示例2：部署任务**
- Thought: "需要将新版本安全部署到生产环境"
- Plan: "1. 备份当前版本 2. 执行数据库迁移 3. 部署新代码 4. 验证功能"
- Action: "执行备份脚本，检查备份是否成功"

**示例3：报告编写**
- Thought: "需要完成月度业务分析报告"
- Plan: "1. 收集数据 2. 分析趋势 3. 编写报告 4. 审核发布"
- Action: "调用数据分析工具提取本月业务数据"
`;

const descriptionMap = {
  exploratory: SEQUENTIAL_THINKING_DESCRIPTION,
  execution: THINK_AND_PLAN_DESCRIPTION
};

function getScenarioDescription(scenario) {
  return descriptionMap[scenario] || '';
}
