# dsh-file-finder

DeepSeek Harness 插件：在 DSH 里按文件名或文件内容查找工作区文件，并直接编辑文本。

## 能做什么

1. 快捷键按文件名搜索。
2. 快捷键按文件内容搜索。
3. 两个快捷键都注册到 DSH 的快捷键服务里，可以在 **设置 → 编辑快捷键** 中修改、清空或恢复默认。
4. 选中结果后在 DSH 内打开文本编辑器，保存会写回工作区文件。

侧边栏底部也有查找按钮，通用设置里有说明行。

## 默认快捷键

| 操作 | 桌面版 | 网页版 |
| --- | --- | --- |
| 按文件名 | Shift+⌘/Ctrl+P | Shift+⌘/Ctrl+P |
| 按内容 | Shift+⌘/Ctrl+F | Alt+⌘/Ctrl+F |

Linux 网页版没有默认绑定，因为该环境只接受很少几种浏览器会送达的组合。可以在快捷键面板里自己指定。⌘/Ctrl+P 仍是 DSH 自带的文件树，没有占用。

## 编辑

搜索结果回车或点击后打开编辑器。编辑器里可用 ⌘/Ctrl+S 保存。保存使用打开时读到的版本；如果文件期间被别的程序改过，会拒绝覆盖，需要先重新加载。只编辑约 1 MB 以内的 UTF-8 文本。二进制文件，以及 `node_modules`、`.git`、构建目录等，不会进入搜索。

## 安装

```sh
dsh plugin add /Library/aiProject/dsh-file-finder
```

安装后如果页面没有马上出现入口，刷新 DSH 页面。Agent 也可以调用同名能力：工具 `file_finder`。

仓库：<https://github.com/chzisnull/dsh-file-finder>

## License

MIT
