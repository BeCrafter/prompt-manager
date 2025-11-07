import { config } from '../utils/config.js';

/**
     * 管理员API中间件
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     * @returns 
     */
export function adminAuthMiddleware(req, res, next) {
    // 检查是否启用了管理员功能
    if (!config.adminEnable) {
        return res.status(404).json({ error: 'Admin功能未启用' });
    }

    // 如果不需要认证，直接通过
    if (!config.adminRequireAuth) {
        next();
        return;
    }

    // 检查Authorization请求头是否存在且格式正确
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    // 提取Bearer token
    const token = authHeader.substring(7);

    // 验证令牌是否在配置的管理员列表中
    const admin = config.admins.find(a => a.token === token);
    if (!admin) {
        return res.status(401).json({ error: '无效的认证令牌' });
    }

    // 将管理员信息附加到请求对象，供后续中间件使用
    req.admin = admin;
    next();
}