## 技能包上传功能实现计划

### 目标
实现技能包上传功能，支持两种格式：
1. **格式1**：ZIP 解压后直接包含文件（如 SKILL.md）
2. **格式2**：ZIP 解压后包含根目录（如 my-skill/SKILL.md）

### 实现步骤

#### 1. 添加 multer 配置
在 `packages/server/api/admin.routes.js` 中添加：
- multer 中间件配置
- 文件存储到临时目录
- 文件类型过滤（只允许 .zip）
- 文件大小限制（10MB）

#### 2. 实现技能包上传路由
在 `packages/server/api/admin.routes.js` 中添加 `POST /adminapi/skills/upload` 路由：
- 接收 ZIP 文件
- 解压到临时目录
- 检测根目录结构
- 提取技能名称（优先使用根目录名）
- 验证必需文件（SKILL.md）
- 验证技能元数据（使用 Zod Schema）
- 检查是否已存在（覆盖确认）
- 复制到目标目录（`~/.prompt-manager/skills/{技能名称}/`）
- 重新加载技能列表
- 返回成功响应

#### 3. 根目录检测逻辑
```javascript
// 检测 ZIP 解压后的结构
const files = fs.readdirSync(extractedDir);
let skillRootDir = extractedDir;
let skillName = null;

if (files.length === 1 && fs.statSync(path.join(extractedDir, files[0])).isDirectory()) {
  // 格式2：包含根目录
  skillRootDir = path.join(extractedDir, files[0]);
  skillName = files[0];
} else {
  // 格式1：直接包含文件
  skillName = extractSkillNameFromSKILLMD(skillRootDir);
}
```

#### 4. 技能名称提取逻辑
- **格式2**：直接使用根目录名
- **格式1**：从 SKILL.md 的 YAML frontmatter 中提取 `name` 字段
- 验证技能名称格式（字母、数字、连字符、中文）

#### 5. 文件验证
- 检查 SKILL.md 是否存在
- 验证 SKILL.md 格式（YAML frontmatter + Markdown 内容）
- 验证必需字段（name, description）
- 验证文件大小限制（单文件 10MB，总大小 100MB）
- 验证文件数量限制（最多 50 个文件）

#### 6. 存储结构
```
~/.prompt-manager/skills/
└── {技能名称}/
    ├── SKILL.md
    ├── reference.md
    └── scripts/
        └── helper.sh
```

#### 7. 错误处理
- 文件格式错误
- 文件大小超限
- 缺少必需文件
- 元数据验证失败
- 技能已存在（返回确认信息）
- 解压失败

### 技术实现要点

1. **使用 adm-zip 解压 ZIP 文件**
2. **使用 js-yaml 解析 SKILL.md 的 frontmatter**
3. **使用 Zod 验证元数据格式**
4. **使用 fs-extra 复制文件**
5. **临时文件清理**

### 预期效果

- ✅ 支持两种格式的技能包上传
- ✅ 自动检测和处理根目录
- ✅ 智能提取技能名称
- ✅ 完整的验证和错误提示
- ✅ 覆盖确认机制
- ✅ 上传进度显示