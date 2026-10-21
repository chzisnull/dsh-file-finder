# 01: 预重构——抽出 File surface resolver 与工装里的 sidebar 假服务

**What to build:** 用户看不到变化。把现在散在两次打开处理里的分支收拢成一个纯 resolver（`kind × Open mode × 主/备`），设置读取统一走 normalize；浏览器工装能得到一个会记录 `openResource` 调用的假 `sidebarRight`，并在挂载前注入设置。完成时项目自己的全部检查（单元测试、六个浏览器检查、截图）保持全绿。

**Blocked by:** None（可立即开始）

**Status:** ready-for-agent

- [ ] 打开路径只经由一个 resolver 决定 File surface，现有两种模式的行为逐项不变
- [ ] resolver 对未来三种 Open mode 有明确分支，未知值按默认处理
- [ ] 浏览器工装的假 ctx 提供可记录的 sidebar 服务，能判断「原生预览是否被请求」
- [ ] 浏览器工装能在挂载前写入设置，供后续票据按模式驱动
- [ ] `npm test`、六个浏览器检查、23 张截图全绿，无用户可见变化
