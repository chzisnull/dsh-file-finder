# 03: 媒体与不支持类型的路由 + 不可用降级

**What to build:** 图片、视频、音频、PDF、HTML、Markdown 无论 Open mode 是什么都进 Viewer（回车与 ⌘↵ 都是）；Viewer 渲染不了的类型（Office、压缩包、无法解码的二进制）优先交给 Native preview，原生也不可用时显示 Viewer 既有的「不支持」状态；选 Native 但 DSH 没有侧栏/会话时落 Viewer 并提示。

**Blocked by:** 02

**Status:** done

- [ ] 媒体类型在三种模式下都由 Viewer 打开，⌘↵ 不改变这一点
- [ ] Viewer 不能渲染的类型在原生可用时交给原生预览
- [ ] 原生不可用时用户看到明确的降级提示或 Viewer 的不支持态，不出现空白
- [ ] 浏览器矩阵检查覆盖「媒体 × 模式」「Office/二进制 × 原生可用/不可用」
