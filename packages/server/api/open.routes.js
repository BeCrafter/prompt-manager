/**
 * 开放数据接口
 */
import express from 'express';
import { logger } from '../utils/logger.js';
import { util } from '../utils/util.js';

const router = express.Router();

router.get('/prompts', (req, res) => {
    try {
        const prompts = util.getPromptsFromFiles();

        // 过滤出启用的提示词
        const filtered = prompts.filter(prompt => {
            const groupActive = prompt.groupEnabled !== false;
            const promptActive = prompt.enabled === true;
            return groupActive && promptActive;
        });
        logger.debug(`filtered prompts: ${JSON.stringify(filtered)}`);

        // 判断是否有搜索参数，且搜索参数名为search
        if (req.query.search) {
            const search = req.query.search;

            // 实现相似度匹配算法
            const searchResults = filtered.map(prompt => {
                const score = util.calculateSimilarityScore(search, prompt);
                return {
                    prompt: {
                        id: prompt.uniqueId,
                        name: prompt.name,
                        description: prompt.description || `Prompt: ${prompt.name}`,
                        metadata: {
                            // fileName: prompt.fileName,
                            fullPath: prompt.relativePath
                        }
                    },
                    score: score
                };
            })
                .filter(result => result.score > 0) // 只返回有匹配的结果
                .sort((a, b) => b.score - a.score); // 按相似度得分降序排列

            // 只返回prompt字段
            res.json(searchResults.map(result => result.prompt));
        } else {
            // 无搜索参数时，返回精简信息
            const simplifiedPrompts = filtered.map(prompt => ({
                id: prompt.uniqueId,
                name: prompt.name,
                description: prompt.description || `Prompt: ${prompt.name}`,
                metadata: {
                    // fileName: prompt.fileName,
                    fullPath: prompt.relativePath
                }
            }));

            res.json(simplifiedPrompts);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 查看提示词内容
router.post('/process', async (req, res) => {
    try {
        const { promptName, arguments: args } = req.body;

        if (!promptName) {
            return res.status(400).json({ error: 'Missing promptName' });
        }

        const prompts = util.getPromptsFromFiles();
        const prompt = prompts.find(p => p.name === promptName);

        if (!prompt) {
            return res.status(404).json({ error: `Prompt "${promptName}" not found` });
        }

        const processedPrompt = await util.processPromptContent(prompt, args);
        res.json({ processedText: processedPrompt });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export const openRouter = router;