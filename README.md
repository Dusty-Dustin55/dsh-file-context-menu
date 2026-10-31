# 右键选项 · DSH 文件右键菜单

在 DeepSeek Harness（DSH）的对话区**右键文件引用**，弹出操作菜单：

| 菜单项 | 作用 |
|---|---|
| 打开（预览） | 在右侧边栏预览文件 |
| 引用该文件 | 把 `@路径` 文件引用插入输入框（等价于输入框的 `@` 选择） |
| 用默认应用打开 | 交给系统默认程序打开 |
| 打开文件夹 | 在系统文件管理器中定位文件 |
| 另存为… | 复制一份到自选位置（不可用时回退浏览器下载） |

支持右键的三种文件形态：

1. 正文里的文件链接（`dsh-resource://file/...` 地址或路径式 `href`）
2. 交付/改动文件卡片（带 `title` 路径的元素）
3. 行内代码路径文本（如 `工作底稿/设计.md`、`tools/qca.py`）

## 安装

在 DSH 的 **插件页** 安装，或用命令行：

```powershell
dsh plugin --profile desktop add dsh-file-context-menu
```

安装后**完全退出并重新启动 DSH**（客户端模块在启动时加载）。

要求：DSH `0.2.1-rc.1` 及以上（由包内 `engines.dsh` 声明）。

## 隐私

- 插件不上传任何数据，也不访问网络（除了保存副本时读取本机会话文件）。
- 诊断上报默认关闭；只有你主动在开发者工具执行
  `localStorage.setItem('dsh-file-context-menu.diag', '1')` 后，才会把右键命中信息
  写入**本机内存**的诊断接口（`/file-actions/diag`），不会发送到任何服务器。

## 卸载

```powershell
dsh plugin --profile desktop remove dsh-file-context-menu
```

## 已知限制

- 只处理对话区（`[data-chat-flow]`）内的文件引用；普通网页链接、侧边栏文件树不拦截。
- 「另存为」受 `/api/file` 的字节上限约束（约 10 MB）。
- 相对路径依赖当前会话解析；无法解析出绝对路径时只提供「打开（预览）」和「引用」。
- 依赖 DSH 0.2.x 的客户端服务（`remote.session`、`remote.workspaceFiles`、`sidebarRight`、
  `shell.overlay`、`conversation.input`）；大版本升级后需复核。

## English

A right-click menu for file references in the DeepSeek Harness chat: preview in the
sidebar, insert an `@file` reference into the composer, open with the default
application, reveal in the file manager, or save a copy. Works on file links,
deliverable cards, and inline code paths. Install with
`dsh plugin --profile desktop add dsh-file-context-menu` and restart DSH
(requires DSH 0.2.1-rc.1 or newer). No network access; diagnostics are opt-in and
stay in local memory.

## License

MIT
