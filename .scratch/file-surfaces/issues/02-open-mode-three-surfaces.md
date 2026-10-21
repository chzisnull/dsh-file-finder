# 02: Open mode——Viewer 成为可选全局默认

**What to build:** 设置里的「打开方式」变成三选一（Native preview / Viewer / Editor），默认仍是 Native。选 Viewer 后文本文件在插件自己的只读 Viewer 里打开；选 Editor 直接进编辑器；⌘/Ctrl+Enter 永远是「另一侧」（看 ↔ 编辑）。旧设置值 `preview` 迁移为 `native`，重置回 native。原生不可用时按规格降级并提示。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 设置存储三种值，默认 native，旧 preview → native、未知值 → native，重置 → native
- [ ] 设置页出现三选一控件与各自的一行说明，行说明写明「全局生效、媒体始终走 Viewer」
- [ ] 文本文件：native 回车原生、⌘↵ 编辑；viewer 回车 Viewer、⌘↵ 编辑；editor 回车编辑、⌘↵ 原生（不可用落 Viewer + 提示）
- [ ] 选择与迁移有源码契约检查；浏览器矩阵检查覆盖三种模式 × 回车/⌘↵
- [ ] 不注册任何 DSH 注册表；只调用文档化的 sidebar 打开方法
