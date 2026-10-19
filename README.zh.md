# dsh-file-finder

DeepSeek Harness 插件：在 DSH 里按文件名或文件内容查找工作区文件，用 DSH 自带的右侧栏预览打开，需要修改时再切到内置编辑器。

[English](README.md)

## 能做什么

- **按文件名搜索**，也可以直接搜路径片段，例如 `src/view`。
- **按文件内容搜索**，每一条命中单独一行，显示行号和上下文。
- **用 DSH 原生预览打开**：回车后在 DSH 右侧栏的文档预览里打开文件——和文件树点开文件是同一个界面；内容搜索会直接跳到命中行。
- **需要时再编辑**：⌘/Ctrl+回车打开内置编辑器，保存通过 DSH 的工作区文件系统写回；文件在打开后被别的程序改过时会拒绝覆盖。
- **VS Code 习惯的快捷键**：⌘/Ctrl+P 与 ⌘/Ctrl+Shift+F，但不占用 DSH 快捷键注册表的默认键位。
- **重新设计的设置页**：卡片分组、键帽、步进器和开关，并新增「打开方式」选择，决定回车是预览还是编辑。
- **更细腻的交互**：磨砂质感的命令面板、弹性切换动画、选中行指示条、加载骨架，以及 reduced-motion 支持。

## 文件系统：本来就用的是 DSH 自带的

插件里没有另一套文件系统：

| 操作 | 归属 |
| --- | --- |
| 遍历、读取、写入工作区文件 | DSH 的 `ctx.fs` 文件系统接口（`index.js`） |
| 搜索与排序 | 本插件（DSH 没有对外暴露可复用的搜索服务） |
| 打开与预览文件 | DSH 右侧栏文档预览：`ctx.sidebarRight.openResource()` + `dsh-resource://file/session/<sessionId>/<path>` 地址 |
| 编辑与冲突检查 | 本插件的编辑器，同样走 `ctx.fs` |

如果原生预览不可用（没有活动会话，或当前界面没有右侧栏），文件查找会自动回退到内置编辑器并给出提示。也可以在 **设置 → 文件查找 → 打开方式** 里把「内置编辑」设为默认动作。

## 默认快捷键

| 操作 | 桌面版 | 网页版 |
| --- | --- | --- |
| 按文件名 | ⌘/Ctrl+P | ⌘/Ctrl+P |
| 按内容 | ⇧⌘F / Ctrl+Shift+F | ⇧⌘F / Ctrl+Shift+F |

两个命令都注册到 DSH 的快捷键服务里，可以在 **设置 → 编辑快捷键** 中另外指定键位，但**不声明默认值**。DSH 的快捷键注册表在检测到默认键位撞车时会在*对方*插件里抛错，会把整个界面启动搞崩（`Conflicting shortcut defaults: session.fork and files.searchContent`）。所以上面的 VS Code 键位由插件自己的按键监听实现。

> 注意：⇧⌘F 在 DSH 里原本是「fork 会话」，本插件按 VS Code 习惯把它用于内容搜索。需要原来的 fork 的话，在「设置 → 编辑快捷键」里给 fork 换一个键即可。

## 设置

**设置 → 文件查找** 包含：

- 快捷键参考和一键试用
- 区分大小写
- 额外忽略的目录（输入时实时显示为标签）
- 文件名 / 内容结果数量上限（步进器）
- 回车默认动作：**侧栏预览** 或 **内置编辑**
- 恢复默认设置；修改后自动保存

## 编辑

选中结果后按 ⌘/Ctrl+回车（或把「内置编辑」设为默认动作）打开编辑器。⌘/Ctrl+S 保存；保存使用打开时读到的版本，如果文件期间被别的程序改过，会拒绝覆盖，需要先重新加载。只编辑约 1 MB 以内的 UTF-8 文本。二进制文件，以及 `node_modules`、`.git`、构建目录等，不会进入搜索。

## 安装

```sh
dsh plugin add /Library/aiProject/dsh-file-finder
```

安装后如果页面没有马上出现入口，刷新 DSH 页面。Agent 也可以调用同名能力：工具 `file_finder`。

仓库：<https://github.com/chzisnull/dsh-file-finder>

## 开发

```sh
node --check index.js
node --check client.js
npm test
```

`npm test` 覆盖搜索函数、快捷键默认值的防回归测试，以及 UI 契约（原生预览地址、面板钩子、reduced-motion 规则）。

原生集成的调研结论——地址语法、会话推导、服务获取方式、HMR 行为以及「保留 / 委托」矩阵——记录在 [docs/native-integration.md](docs/native-integration.md)。

`preview/` 是只在开发时使用的预览工程：用真实的 DSH 主题变量在 DSH 之外渲染命令面板与设置页，并用 Playwright 生成明暗两套截图：

```sh
node preview/screenshot.mjs
```

它不会被打进发布包。

## License

MIT
