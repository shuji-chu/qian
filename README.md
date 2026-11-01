# DomainHub 独立管理后台

本仓库主分支已转为 DomainHub 管理控制台，部署目标为 Cloudflare Pages 项目 \`domainhub-admin-ui\`，域名 \`admin.lynli.me\`。

## 技术栈
- React + TypeScript + Vite
- Cloudflare Pages 静态托管
- DomainHub Worker API：\`https://domainhub-api.chulingli1988.workers.dev\`
- 管理员身份由 Worker 的 \`/admin/*\` 路由在服务端校验，前端隐藏入口不构成权限边界。

## 功能
- 管理员邮箱/密码登录
- 用户列表、账户暂停/恢复、配额调整
- DNSHE 域名库存查看与同步
- 管理员账户 Droplet 操作
- DigitalOcean 账户余额及账单查询

## 本地开发
\`\`\`bash
npm install
npm run dev
npm run build
\`\`\`

## 数据迁移说明
SOCKS5 静态商品数据已保留在本仓库的 \`socks5-data\` 分支。SOCKS5 前端回退数据地址已更新到该分支；原有 \`https://api.lynli.me/static/qian/\` 镜像地址保持不变。


最近一次部署触发：Cloudflare Pages GitHub 集成已连接至 `main` 分支。每次推送主分支都会自动构建管理后台。
