# dsh-file-finder 发布文案

## 一句话

给 DeepSeek Harness 装上一个 VS Code 式的文件搜索、预览与内置编辑器。

---

## 长文案（小红书 / 公众号 / 即刻）

**标题：给 DeepSeek Harness 装一个 VS Code 式的文件搜索**

用 DSH 的时候，找一个文件要翻文件树，看内容要先打开，改几行又得换窗口。于是我把这套动作收进了一个命令面板：**dsh-file-finder**。

🔍 **两种搜索**
- `⌘/Ctrl+P` 按文件名或路径片段搜，比如 `src/api`
- `⇧⌘F` 按文件内容搜，一条命中一行，回车直接跳到那一行

👀 **两种打开方式**
- 结果可以直接在 DSH 右侧栏的**原生预览**里打开（和文件树点开是同一个界面）
- 也可以进插件**内置的编辑器**；默认动作在设置里互换

👉 小建议：装好后在「设置 → 文件查找」里把默认动作切成「内置编辑」，回车就能直接改，不用再切窗口。

✍️ **内置编辑器**
- 行号栏 + 当前行高亮
- `⌘/Ctrl+F` 文件内查找：全部命中高亮、`1/38` 计数、上一个/下一个、`Aa` 区分大小写
- `⌘/Ctrl+S` 保存，保存前校验版本：打开后文件被别的程序改过，会拒绝覆盖并提示重新加载

⚙️ **还顺手做了**
- 设置页：区分大小写、额外忽略目录、结果数量上限、默认打开方式
- 装了 DS Bot 的话，`⇧⌘B` 在 Bot 模式和经典 Agent 模式之间来回切；没装就不显示、也不生效

📦 **安装**
已发布 npm。DSH 里打开「设置 → 插件 → 添加插件」，输入 `dsh-file-finder`，点安装即可（安装源用默认的镜像就行）。
命令行：`dsh plugin add dsh-file-finder`
GitHub：github.com/chzisnull/dsh-file-finder

MIT 协议，纯 JS，没有构建步骤；已在 DSH Desktop 0.2.1-rc.2 上验证。

---

## 短文案（X / 群聊）

给 DSH 写了个文件查找插件 **dsh-file-finder**：`⌘P` 按名搜、`⇧⌘F` 按内容搜，结果能用 DSH 原生右侧栏预览打开，也能进内置编辑器（行号 + `⌘F` 查找 + 保存带版本校验）。装了 DS Bot 还能 `⇧⌘B` 一键切 Bot / 经典模式。

已发布 npm：设置 → 插件 → 添加插件 → `dsh-file-finder`
github.com/chzisnull/dsh-file-finder

---

## English version

**dsh-file-finder — a VS Code-style file finder for DeepSeek Harness**

- `Cmd/Ctrl+P` searches file names and path fragments; `Cmd/Ctrl+Shift+F` searches file contents, one row per matching line.
- Results open in DSH's own right-sidebar preview, or in the plugin's built-in editor — pick the default in Settings.
- The editor has line numbers, a caret-line highlight, in-file find (`Cmd/Ctrl+F`) with match count and case toggle, and version-checked saves that refuse to overwrite a file changed outside.
- With DS Bot installed, `Cmd/Ctrl+Shift+B` flips between Bot mode and classic Agent mode; without it, the shortcut and its settings card do not exist.

Install: Settings → Plugins → Add plugin → `dsh-file-finder` (or `dsh plugin add dsh-file-finder`). MIT, plain JS, no build step.

---

## 配图

- `dsh-file-finder-cover.jpg` — 六张实拍合并图（2400×3169 逻辑尺寸，2x 导出 4800×6338，3:4 竖图），适合直接发送；小红书/公众号的竖图比例正好，X 里会按 16:9 预览裁切、点开可看全。
- 原图素材：命令面板、内置编辑器、安装对话框、设置页、默认动作指引、DS Bot 模式切换。
