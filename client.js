window.__ModuleLoader__.load({
  id: 'dsh-file-finder',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    // DSH's Module Loader exposes the shared UI primitives as an implicit
    // baseline external. They are optional at load time so the module stays
    // loadable in a bare test harness: the fallback file chip below is used
    // when the host does not provide them.
    let primitives = null
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives') || null
    } catch {
      primitives = null
    }
    const FileTypeIcon = primitives && typeof primitives.FileTypeIcon === 'function'
      ? primitives.FileTypeIcon
      : null
    // DSH's own Markdown renderer, when the shell provides primitives. The
    // viewer falls back to plain text in harnesses without them.
    const MarkdownText = primitives && typeof primitives.MarkdownText === 'function'
      ? primitives.MarkdownText
      : null

    const dict = {
      zh: {
        title: '文件查找',
        open: '查找文件',
        name: '按文件名',
        content: '按内容',
        namePlaceholder: '搜索文件名或路径…',
        contentPlaceholder: '搜索文件内容，至少 2 个字符…',
        searching: '正在搜索…',
        idleTitle: '搜索工作区文件',
        idleHint: '输入文件名或路径片段，或切换到「按内容」搜索文件内容。',
        noResult: '没有匹配结果',
        noResultHint: '换个关键词，或者切换上面的搜索方式。',
        contentShort: '再输入一个字符',
        contentShortHint: '按内容搜索至少需要 2 个字符。',
        noRoot: '当前没有工作区',
        noRootHint: '先打开一个带工作目录的会话。',
        root: '工作区',
        chooseRoot: '切换工作区',
        truncated: '结果已截断，请缩小范围',
        close: '关闭',
        clear: '清除',
        back: '返回搜索',
        save: '保存',
        saving: '保存中…',
        reload: '重新加载',
        saved: '已保存',
        dirty: '未保存',
        conflict: '文件已被其他程序修改',
        confirmClose: '有未保存的修改，关闭将丢弃它们。',
        confirmBack: '有未保存的修改，返回搜索将丢弃它们。',
        confirmReload: '有未保存的修改，重新加载将丢弃它们。',
        discard: '丢弃并关闭',
        discardBack: '丢弃并返回',
        discardReload: '丢弃并重新加载',
        keep: '继续编辑',
        line: '第 {line} 行',
        lines: '{count} 行',
        preview: '预览',
        edit: '编辑',
        previewUnavailable: '侧栏预览不可用，已用内置编辑器打开。',
        saveBeforePreview: '有未保存的修改。保存或重新加载后，再在侧栏预览。',
        openInSidebar: '在侧栏预览',
        resultCount: '{count} 个结果',
        hintNavigate: '选择',
        hintClose: '关闭',
        hintSave: '保存',
        hintEditorBack: '返回搜索',
        settingsTitle: '文件查找',
        settingsLead: '按文件名或文件内容搜索当前工作区，并用 DSH 自带的预览或内置编辑器打开文件。',
        settingsShortcuts: '快捷键',
        settingsBody: '和 VS Code 一样：⌘/Ctrl+P 按文件名搜索，⇧⌘F / Ctrl+Shift+F 按内容搜索。也可以在「设置 → 编辑快捷键」里修改。',
        shortcutName: '按文件名搜索',
        shortcutContent: '按内容搜索',
        tryIt: '试用',
        settingsSearch: '搜索',
        settingsSearchHint: '匹配规则与结果数量。',
        defaultAction: '默认动作',
        caseSensitive: '区分大小写',
        caseSensitiveHint: '关闭时，文件名和内容都不区分大小写。',
        extraIgnore: '额外忽略的目录',
        extraIgnoreHint: '用逗号分隔目录名，例如 tmp, coverage。不要写路径。',
        nameLimit: '文件名结果上限',
        nameLimitHint: '5–100 个结果',
        contentLimit: '内容结果上限',
        contentLimitHint: '5–200 条匹配',
        increase: '增加',
        decrease: '减少',
        settingsOpen: '打开方式',
        openModePreview: '侧栏预览',
        openModeEditor: '内置编辑',
        openModePreviewHint: '回车在 DSH 右侧栏预览（只读，和文件树打开一致），⌘/Ctrl+回车改用内置编辑器。',
        openModeEditorHint: '回车在内置编辑器中打开，⌘/Ctrl+回车改用 DSH 侧栏预览。',
        openModeRowHint: '决定在搜索结果上按回车时的默认动作。',
        settingsWorkspace: '当前工作区',
        noWorkspace: '暂无工作区',
        autosave: '设置会自动保存',
        savedPrefs: '已保存',
        reset: '恢复默认设置',
        resetDone: '已恢复默认设置',
        settingsBot: 'DS Bot',
        settingsBotHint: '在 Bot 模式和经典 Agent 模式之间切换。只在检测到 DS Bot 插件时出现。',
        shortcutBot: '切换 Bot / 经典 Agent 模式',
        findPlaceholder: '在文件中查找…',
        findCase: '区分大小写',
        findPrev: '上一个匹配',
        findNext: '下一个匹配',
        findClose: '关闭查找',
        findNoResult: '无结果',
        hintFind: '查找',
        readOnly: '只读预览',
        unpreviewable: '无法预览此类型',
        editText: '编辑源码',
        previewUnsupported: '这种文件暂时不能在面板里预览',
        previewUnsupportedHint: '可以用右侧栏预览，或先把这个文件导出到别处再用系统程序打开。',
        previewHtmlNote: 'HTML 在沙箱中运行，脚本无法访问 DSH 页面。',
        kindImage: '图片',
        kindVideo: '视频',
        kindAudio: '音频',
        kindPdf: 'PDF',
        kindMarkdown: 'Markdown',
        kindHtml: 'HTML',
        kindBinary: '二进制文件',
        navBack: '返回上一处',
        intelFunction: '函数',
        intelMethod: '方法',
        intelClass: '类',
        intelInterface: '接口',
        intelType: '类型',
        intelEnum: '枚举',
        intelVariable: '变量',
        intelParameter: '参数',
        intelId: '锚点',
        intelDefinition: '定义于第 {line} 行',
        intelNoDefinition: '同文件里没有找到定义',
        plainText: '大文件·纯文本',
        plainHint: '文件超过 200 KB，已关闭语法着色以保持输入流畅',
        browsePlaceholder: '输入文件名搜索，或浏览目录…',
        browseCount: '{count} 项',
        browseDirHint: '目录',
        browseRootHint: '工作区根目录',
        browseEmpty: '空文件夹',
        browseEmptyHint: '这个目录里没有可显示的文件。',
        browseFailed: '无法读取目录',
        browseTruncated: '只显示前 {count} 项',
        browseUp: '返回上级',
      },
      en: {
        title: 'File Finder',
        open: 'Find files',
        name: 'By name',
        content: 'By content',
        namePlaceholder: 'Search file names or paths…',
        contentPlaceholder: 'Search file contents, at least 2 characters…',
        searching: 'Searching…',
        idleTitle: 'Search workspace files',
        idleHint: 'Type a file name or path fragment, or switch to content search.',
        noResult: 'No matches',
        noResultHint: 'Try another keyword, or switch the search mode above.',
        contentShort: 'One more character',
        contentShortHint: 'Content search needs at least 2 characters.',
        noRoot: 'No workspace is open',
        noRootHint: 'Start a session that has a working directory.',
        root: 'Workspace',
        chooseRoot: 'Switch workspace',
        truncated: 'Results were truncated. Narrow the query.',
        close: 'Close',
        clear: 'Clear',
        back: 'Back to search',
        save: 'Save',
        saving: 'Saving…',
        reload: 'Reload',
        saved: 'Saved',
        dirty: 'Unsaved',
        conflict: 'The file changed outside the editor',
        confirmClose: 'There are unsaved changes. Closing discards them.',
        confirmBack: 'There are unsaved changes. Going back discards them.',
        confirmReload: 'There are unsaved changes. Reloading discards them.',
        discard: 'Discard and close',
        discardBack: 'Discard and go back',
        discardReload: 'Discard and reload',
        keep: 'Keep editing',
        line: 'Line {line}',
        lines: '{count} lines',
        preview: 'Preview',
        edit: 'Edit',
        previewUnavailable: 'The sidebar preview is unavailable, so the built-in editor opened instead.',
        saveBeforePreview: 'There are unsaved changes. Save or reload before previewing in the sidebar.',
        openInSidebar: 'Preview in sidebar',
        resultCount: '{count} results',
        hintNavigate: 'select',
        hintClose: 'close',
        hintSave: 'save',
        hintEditorBack: 'back to search',
        settingsTitle: 'File Finder',
        settingsLead: 'Search the current workspace by file name or content, and open files with the DSH preview or the built-in editor.',
        settingsShortcuts: 'Shortcuts',
        settingsBody: 'Same as VS Code: Cmd/Ctrl+P searches by file name, and Cmd/Ctrl+Shift+F searches by content. You can still change them in Settings → Edit shortcuts.',
        shortcutName: 'Search files by name',
        shortcutContent: 'Search files by content',
        tryIt: 'Try',
        settingsSearch: 'Search',
        settingsSearchHint: 'Match rules and result counts.',
        defaultAction: 'Default action',
        caseSensitive: 'Case sensitive',
        caseSensitiveHint: 'When off, name and content search ignore case.',
        extraIgnore: 'Extra ignored directories',
        extraIgnoreHint: 'Comma-separated directory names, such as tmp, coverage. Do not enter paths.',
        nameLimit: 'Name result limit',
        nameLimitHint: '5–100 results',
        contentLimit: 'Content result limit',
        contentLimitHint: '5–200 matches',
        increase: 'Increase',
        decrease: 'Decrease',
        settingsOpen: 'Opening',
        openModePreview: 'Sidebar preview',
        openModeEditor: 'Built-in editor',
        openModePreviewHint: 'Enter opens DSH’s right-sidebar preview (read-only, same as the Files tree); Cmd/Ctrl+Enter uses the built-in editor.',
        openModeEditorHint: 'Enter opens the built-in editor; Cmd/Ctrl+Enter uses DSH’s right-sidebar preview.',
        openModeRowHint: 'What Enter does on a search result.',
        settingsWorkspace: 'Current workspace',
        noWorkspace: 'No workspace',
        autosave: 'Settings save automatically',
        savedPrefs: 'Saved',
        reset: 'Reset to defaults',
        resetDone: 'Defaults restored',
        settingsBot: 'DS Bot',
        settingsBotHint: 'Switches between Bot mode and classic Agent mode. This section appears only when the DS Bot plugin is installed.',
        shortcutBot: 'Toggle Bot / classic Agent mode',
        findPlaceholder: 'Find in file…',
        findCase: 'Match case',
        findPrev: 'Previous match',
        findNext: 'Next match',
        findClose: 'Close search',
        findNoResult: 'No results',
        hintFind: 'find',
        readOnly: 'Read-only preview',
        unpreviewable: 'No preview for this type',
        editText: 'Edit source',
        previewUnsupported: 'This file type cannot be previewed here yet',
        previewUnsupportedHint: 'Open it in the right-sidebar preview, or export the file and use a system app.',
        previewHtmlNote: 'HTML runs sandboxed; its scripts cannot reach the DSH page.',
        kindImage: 'Image',
        kindVideo: 'Video',
        kindAudio: 'Audio',
        kindPdf: 'PDF',
        kindMarkdown: 'Markdown',
        kindHtml: 'HTML',
        kindBinary: 'Binary file',
        navBack: 'Back to previous location',
        intelFunction: 'Function',
        intelMethod: 'Method',
        intelClass: 'Class',
        intelInterface: 'Interface',
        intelType: 'Type',
        intelEnum: 'Enum',
        intelVariable: 'Variable',
        intelParameter: 'Parameter',
        intelId: 'Anchor',
        intelDefinition: 'Defined on line {line}',
        intelNoDefinition: 'No definition in this file',
        plainText: 'Large file · plain',
        plainHint: 'Over 200 KB, so syntax colours are off to keep typing fast',
        browsePlaceholder: 'Search file names, or browse this folder…',
        browseCount: '{count} items',
        browseDirHint: 'Folder',
        browseRootHint: 'Workspace root',
        browseEmpty: 'Empty folder',
        browseEmptyHint: 'Nothing to show in this folder.',
        browseFailed: 'Cannot read this folder',
        browseTruncated: 'Showing the first {count} items',
        browseUp: 'Up one level',
      },
    }

    const DEFAULTS = { caseSensitive: false, extraIgnore: '', nameLimit: 40, contentLimit: 80, openMode: 'preview' }

    const store = {
      state: { open: false, mode: 'name', token: 0 },
      listeners: new Set(),
      snapshot() { return store.state },
      subscribe(listener) {
        store.listeners.add(listener)
        return () => store.listeners.delete(listener)
      },
      lastOpenAt: 0,
      openSearch(mode) {
        const next = mode === 'content' ? 'content' : 'name'
        // The keydown handler and a shortcut the user assigned in Settings can
        // both fire for one keystroke; collapse the duplicate.
        const now = Date.now()
        if (store.state.open && store.state.mode === next && now - store.lastOpenAt < 250) return
        store.lastOpenAt = now
        store.state = { open: true, mode: next, token: store.state.token + 1 }
        store.listeners.forEach((listener) => listener())
      },
      close() {
        store.state = { open: false, mode: store.state.mode, token: store.state.token }
        store.listeners.forEach((listener) => listener())
      },
    }

    const SETTINGS_KEY = 'dsh-file-finder.settings.v1'
    function clampSetting(value, min, max, fallback) {
      const number = Number(value)
      if (!Number.isFinite(number)) return fallback
      return Math.min(max, Math.max(min, Math.trunc(number)))
    }
    function normalizePrefs(raw) {
      const source = raw && typeof raw === 'object' ? raw : {}
      return {
        caseSensitive: Boolean(source.caseSensitive),
        extraIgnore: String(source.extraIgnore || ''),
        nameLimit: clampSetting(source.nameLimit, 5, 100, DEFAULTS.nameLimit),
        contentLimit: clampSetting(source.contentLimit, 5, 200, DEFAULTS.contentLimit),
        openMode: source.openMode === 'editor' ? 'editor' : 'preview',
      }
    }
    function readPrefs() {
      try {
        return normalizePrefs(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'))
      } catch {
        return normalizePrefs({})
      }
    }
    const prefs = {
      state: readPrefs(),
      revision: 0,
      listeners: new Set(),
      snapshot() { return prefs.state },
      subscribe(listener) {
        prefs.listeners.add(listener)
        return () => prefs.listeners.delete(listener)
      },
      save(next) {
        prefs.state = normalizePrefs(next)
        prefs.revision += 1
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs.state)) } catch { /* private mode */ }
        prefs.listeners.forEach((listener) => listener())
      },
    }

    // ── DS Bot bridge (optional) ────────────────────────────────────────────
    // DS Bot keeps its Bot / classic-Agent surface switch private: it exposes no
    // client service, so the only stable things another plugin can use are the
    // module id in the boot graph and the controls DS Bot itself renders. The
    // bridge below does exactly that, and every entry point is inert unless the
    // DS Bot client module is part of this boot — no command, no settings row,
    // no key handler, no side effects.
    const BOT_MODULE_ID = 'ds-bot'

    function botModuleLoaded() {
      try {
        if (typeof window === 'undefined' || !window.__DSH_BOOT__) return false
        const boot = window.__DSH_BOOT__
        const graph = boot.graph && typeof boot.graph === 'object' ? boot.graph : boot
        const entries = Array.isArray(graph.entries) ? graph.entries : []
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue
          const id = String(entry.id || '')
          const url = String(entry.url || '')
          if (id === BOT_MODULE_ID || id.endsWith('/' + BOT_MODULE_ID)) return true
          if (url.includes('/' + BOT_MODULE_ID + '/')) return true
        }
      } catch { /* a shell without a boot graph simply has no DS Bot */ }
      return false
    }

    function botSurfaceMode() {
      if (typeof document === 'undefined') return ''
      try {
        // DS Bot renders `.bt-return` only in classic Agent mode and `.bt-account`
        // only while its Bot shell is mounted, so one probe tells the two apart.
        if (document.querySelector('.bt-return')) return 'agent'
        if (document.querySelector('.bt-account')) return 'bot'
      } catch { /* a detached document has no surface */ }
      return ''
    }

    function pickBotMenuToggle() {
      const menu = document.querySelector('.bt-account-menu')
      if (!menu) return false
      const items = Array.from(menu.querySelectorAll('[role="menuitem"]'))
      if (!items.length) return false
      // Match the localized label when we know it, otherwise take the last item:
      // the surface switch is the only entry in the account menu's second group.
      const item = items.find((node) => /经典|classic/i.test(node.textContent || '')) || items[items.length - 1]
      item.click()
      return true
    }

    function botToAgent() {
      // The account menu may already be open (the user opened it by hand);
      // switching from it directly beats closing it with a second trigger click.
      if (pickBotMenuToggle()) return true
      const trigger = document.querySelector('.bt-account')
      if (!trigger) return false
      trigger.click()
      if (pickBotMenuToggle()) return true
      // React can flush the portal one tick after the click; retry once. If the
      // menu never shows up, close it again instead of leaving it stranded.
      setTimeout(() => {
        if (pickBotMenuToggle()) return
        const again = document.querySelector('.bt-account')
        if (again && document.querySelector('.bt-account-menu')) again.click()
      }, 0)
      return true
    }

    function botToBot() {
      const back = document.querySelector('.bt-return')
      if (!back) return false
      back.click()
      return true
    }

    const botBridge = {
      installed: false,
      lastToggleAt: 0,
      detect() {
        if (!botBridge.installed) botBridge.installed = botModuleLoaded()
        return botBridge.installed
      },
      toggle() {
        if (!botBridge.detect()) return false
        const now = Date.now()
        // The keydown handler and a shortcut the user assigned in Settings can
        // both fire for one keystroke; collapse the duplicate.
        if (now - botBridge.lastToggleAt < 300) return false
        botBridge.lastToggleAt = now
        return botSurfaceMode() === 'agent' ? botToBot() : botToAgent()
      },
    }

    function textOf(t, key, values) {
      return t(key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''))
    }

    function serviceOf(ctx, name) {
      if (!ctx) return undefined
      try {
        if (typeof ctx.get === 'function') return ctx.get(name)
      } catch { /* optional service */ }
      return ctx[name]
    }

    // One live Session gives both the workspace and the authority a
    // `dsh-resource://file/session/<id>/<path>` address needs. DSH itself
    // derives the main-view Session from `retainedBy.mainView`, walking `ids`
    // in order (ui-layout's DocumentTitle does exactly this); there is no
    // public `current` field.
    function sessionOf(ctx) {
      const sessions = serviceOf(ctx, 'sessions')
      const list = sessions && sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot()
      if (!list || !list.byId) return { id: '', cwd: '' }
      const byId = list.byId
      const ids = Array.isArray(list.ids) && list.ids.length ? list.ids : Object.keys(byId)
      for (const id of ids) {
        const row = byId[id]
        if (!row || !(Number((row.retainedBy && row.retainedBy.mainView) || 0) > 0)) continue
        return { id: typeof row.id === 'string' && row.id ? row.id : id, cwd: typeof row.cwd === 'string' ? row.cwd : '' }
      }
      // Locally known generations may be absent from `ids`.
      for (const key of Object.keys(byId)) {
        const row = byId[key]
        if (!row || !(Number((row.retainedBy && row.retainedBy.mainView) || 0) > 0)) continue
        return { id: typeof row.id === 'string' && row.id ? row.id : key, cwd: typeof row.cwd === 'string' ? row.cwd : '' }
      }
      return { id: '', cwd: '' }
    }

    function isMac() {
      try {
        const value = String(navigator.platform || '') + ' ' + String(navigator.userAgent || '')
        return /Mac|iPhone|iPad/.test(value)
      } catch {
        return false
      }
    }

    async function post(path, body, signal) {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body || {}),
        signal,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) throw new Error(data && data.error || `HTTP ${response.status}`)
      if (data.ok === false && !data.conflict) throw new Error(data.error || '请求失败')
      return data
    }

    // No default binding on purpose. DSH's shortcut registry rejects a command
    // whose default collides with any other command's default for any runtime,
    // and it does that from inside the *other* plugin's apply(), so a collision
    // here breaks unrelated plugins (for example ui-workspace owns
    // `session.fork` on Cmd+Shift+F, and its apply() throws while registering it).
    // Registering the command unbound keeps it visible and assignable in
    // Settings → Shortcuts without ever claiming a key from another plugin;
    // the VS Code keys below come from our own keydown handler.
    function shortcut(id, label, aliases, run) {
      return {
        id,
        label,
        aliases,
        defaults: {},
        regions: ['page', 'editable', 'terminal'],
        modals: [],
        resolve: () => ({ status: 'handled', run }),
      }
    }

    function isPrimary(event) {
      return event.metaKey || event.ctrlKey
    }

    function onVsCodeKey(event) {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || !isPrimary(event)) return
      const nameSearch = event.code === 'KeyP' && !event.shiftKey
      const contentSearch = event.code === 'KeyF' && event.shiftKey
      if (!nameSearch && !contentSearch) return
      event.preventDefault()
      // Cmd/Ctrl+Shift+F is the browser's own find fallback in some shells.
      event.stopPropagation()
      if (store.state.open) {
        try { window.dispatchEvent(new Event('dff-focus-search')) } catch { /* optional */ }
        return
      }
      store.openSearch(nameSearch ? 'name' : 'content')
    }

    // The DS Bot bridge owns its own key: Cmd/Ctrl+Shift+B, free of DSH's own
    // desktop defaults (`sidebar.left.toggle` is Cmd/Ctrl+B there). It is only
    // installed when DS Bot is part of this boot.
    function onBotKey(event) {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey) return
      if (!isPrimary(event) || !event.shiftKey || event.code !== 'KeyB') return
      if (!botBridge.detect()) return
      event.preventDefault()
      event.stopPropagation()
      botBridge.toggle()
    }


    // ── Same-file code intelligence (P0) ───────────────────────────────────
    // No parser yet: a language-aware declaration scan gives ⌘-hover and
    // same-file go-to-definition for every text file, and the TypeScript service
    // will plug in behind the same client contract later.
    // Budgets are byte budgets: 200 KB of UTF-8 text, which is not the same as
    // 200k UTF-16 code units once the file contains Chinese or emoji.
    const INTEL_MAX_BYTES = 200 * 1024
    const INTEL_MAX_SPANS = 15000

    // Path containment for display paths (the host may return either separator).
    function isInsidePath(root, target) {
      if (!root || !target) return false
      const base = String(root).replace(/[\\/]+$/, '')
      const value = String(target)
      return value === base || value === String(root)
        || value.startsWith(base + '/') || value.startsWith(base + '\\')
    }

    function emptyBrowseState(path) {
      return {
        path: path || '', parent: null, crumbs: [], entries: [],
        truncated: false, loading: false, error: '',
      }
    }

    function utf8Length(text) {
      let bytes = 0
      for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index)
        if (code < 0x80) bytes += 1
        else if (code < 0x800) bytes += 2
        else if (code >= 0xd800 && code <= 0xdbff) {
          bytes += 4
          index += 1
        } else bytes += 3
      }
      return bytes
    }

    // One extension table feeds every consumer: the declaration scan, the colour
    // scanner and the Markdown fence hints. The two smaller maps translate the
    // shared key into the vocabulary each consumer understands.
    const LANGUAGE_BY_EXTENSION = (() => {
      const table = new Map()
      const add = (language, extensions) => {
        for (const extension of extensions.split(' ')) table.set(extension, language)
      }
      add('js', 'js mjs cjs jsx ts mts tsx cts')
      add('vue', 'vue')
      add('svelte', 'svelte')
      add('python', 'py pyw')
      add('go', 'go')
      add('rust', 'rs')
      add('clike', 'java kt kts cs scala swift c h cpp cc cxx hpp hxx m mm')
      add('markup', 'html htm xhtml xml svg')
      add('css', 'css scss sass less')
      add('json', 'json jsonc json5 webmanifest')
      add('yaml', 'yml yaml')
      add('markdown', 'md markdown mdown mdx')
      add('shell', 'sh bash zsh fish ksh')
      add('ini', 'toml ini cfg conf')
      return table
    })()

    function languageOf(name) {
      return LANGUAGE_BY_EXTENSION.get(extOf(name)) || ''
    }

    const INTEL_LANGUAGE = {
      js: 'js', vue: 'js', svelte: 'js', python: 'python', go: 'go',
      rust: 'rust', clike: 'clike', markup: 'html',
    }

    function intelLanguageOf(name) {
      return INTEL_LANGUAGE[languageOf(name)] || 'generic'
    }

    const INTEL_RESERVED = new Set([
      'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'try',
      'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'await', 'async', 'yield',
      'const', 'let', 'var', 'class', 'interface', 'type', 'enum', 'import', 'export',
      'default', 'extends', 'implements', 'this', 'super', 'null', 'undefined', 'true', 'false',
    ])

    const INTEL_RULES = {
      js: [
        { kind: 'function', re: /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g },
        { kind: 'function', re: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)/g },
        { kind: 'class', re: /\bclass\s+([A-Za-z_$][\w$]*)/g },
        { kind: 'interface', re: /\binterface\s+([A-Za-z_$][\w$]*)/g },
        { kind: 'type', re: /\btype\s+([A-Za-z_$][\w$]*)\s*=/g },
        { kind: 'enum', re: /\benum\s+([A-Za-z_$][\w$]*)/g },
        { kind: 'method', re: /^\s+(?:public\s+|private\s+|protected\s+|static\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g },
        { kind: 'variable', re: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g },
      ],
      python: [
        { kind: 'function', re: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/g },
        { kind: 'class', re: /^\s*class\s+([A-Za-z_]\w*)/g },
        { kind: 'variable', re: /^([A-Za-z_]\w*)\s*=/g },
      ],
      go: [
        { kind: 'function', re: /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/g },
        { kind: 'type', re: /^\s*type\s+([A-Za-z_]\w*)/g },
        { kind: 'variable', re: /^\s*(?:var|const)\s+([A-Za-z_]\w*)/g },
      ],
      rust: [
        { kind: 'function', re: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/g },
        { kind: 'class', re: /^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)/g },
        { kind: 'type', re: /^\s*(?:pub\s+)?type\s+([A-Za-z_]\w*)/g },
        { kind: 'variable', re: /^\s*(?:pub\s+)?(?:const|static)\s+([A-Za-z_]\w*)/g },
      ],
      clike: [
        { kind: 'class', re: /\b(?:class|interface|enum|record|struct)\s+([A-Za-z_]\w*)/g },
        { kind: 'method', re: /^\s*(?:(?:public|private|protected|static|final|abstract|synchronized|native|default)\s+)+[\w<>\[\],.?]+\s+([A-Za-z_]\w*)\s*\(/g },
      ],
      html: [
        { kind: 'id', re: /\bid\s*=\s*["']([^"']+)["']/g },
      ],
      generic: [
        { kind: 'function', re: /\b(?:function|def|fn|func)\s+([A-Za-z_$][\w$]*)/g },
        { kind: 'class', re: /\b(?:class|struct|enum|interface|trait)\s+([A-Za-z_$][\w$]*)/g },
        { kind: 'type', re: /\btype\s+([A-Za-z_$][\w$]*)\s*=/g },
        { kind: 'variable', re: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g },
      ],
    }

    function addIntelEntry(index, entry) {
      const list = index.get(entry.name)
      if (!list) {
        index.set(entry.name, [entry])
        return
      }
      if (list.some((item) => item.offset === entry.offset && item.kind === entry.kind)) return
      list.push(entry)
    }

    // Function parameters count as variables, so hovering an argument name or a
    // parameter resolves too.
    function scanIntelParams(index, line, lineStart, lineNumber) {
      const patterns = [
        /\b(?:function|def)\s+[A-Za-z_$][\w$]*\s*\(([^)]*)\)/g,
        /\(([^)]*)\)\s*=>/g,
        /\b([A-Za-z_$][\w$]*)\s*=>/g,
      ]
      for (const pattern of patterns) {
        pattern.lastIndex = 0
        let match
        while ((match = pattern.exec(line))) {
          const source = match[1]
          if (!source) continue
          const base = match.index + match[0].indexOf(source)
          let cursor = 0
          for (const part of source.split(',')) {
            const nameMatch = /^\s*([A-Za-z_$][\w$]*)/.exec(part)
            if (nameMatch && !INTEL_RESERVED.has(nameMatch[1])) {
              addIntelEntry(index, {
                name: nameMatch[1],
                kind: 'parameter',
                offset: lineStart + base + cursor + nameMatch[0].indexOf(nameMatch[1]),
                line: lineNumber + 1,
                source: line.trim(),
              })
            }
            cursor += part.length + 1
          }
        }
      }
    }

    function buildIntelIndex(text, language) {
      const index = new Map()
      const rules = INTEL_RULES[language] || INTEL_RULES.generic
      const lines = String(text).split('\n')
      let lineStart = 0
      for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
        const line = lines[lineNumber]
        for (const rule of rules) {
          rule.re.lastIndex = 0
          let match
          while ((match = rule.re.exec(line))) {
            const name = match[1]
            if (!name || INTEL_RESERVED.has(name)) continue
            addIntelEntry(index, {
              name,
              kind: rule.kind,
              offset: lineStart + match.index + Math.max(0, match[0].lastIndexOf(name)),
              line: lineNumber + 1,
              source: line.trim(),
            })
          }
        }
        if (language === 'js' || language === 'python') scanIntelParams(index, line, lineStart, lineNumber)
        lineStart += line.length + 1
      }
      return index
    }

    function lineOfOffset(text, offset) {
      let line = 1
      for (let index = 0; index < offset && index < text.length; index += 1) {
        if (text.charCodeAt(index) === 10) line += 1
      }
      return line
    }

    // Nearest declaration before the use, then the first one after it.
    function resolveIntel(index, name, fromOffset) {
      const list = index.get(name)
      if (!list || !list.length) return null
      let before = null
      for (const item of list) {
        if (item.offset <= fromOffset && (!before || item.offset > before.offset)) before = item
      }
      return before || list[0]
    }

    function buildIntelSegments(text, index) {
      const segments = []
      const pattern = /[A-Za-z_$][\w$]*/g
      let cursor = 0
      let count = 0
      let match
      while ((match = pattern.exec(text))) {
        if (count >= INTEL_MAX_SPANS) {
          if (cursor < text.length) segments.push({ text: text.slice(cursor), start: cursor })
          return segments
        }
        if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), start: cursor })
        const name = match[0]
        const declarations = index.get(name)
        const previous = match.index > 0 ? text[match.index - 1] : ''
        const navigable = Boolean(declarations && declarations.length)
          || (previous === '#' && index.has(name))
        segments.push({ text: name, start: match.index, name, navigable })
        cursor = match.index + name.length
        count += 1
      }
      if (cursor < text.length) segments.push({ text: text.slice(cursor), start: cursor })
      return segments
    }

    // ── Lexical highlighting (P1) ──────────────────────────────────────────
    // One dependency-free scanner per language family. It is deliberately
    // lexical: no scope analysis, so a mis-coloured edge case can never break
    // the editor. Only the visible window is painted with spans, which keeps a
    // 200 KB file as cheap to render as a small one.
    const TOKEN_MAX_BYTES = 200 * 1024
    const TOKEN_WINDOW_MAX = 4000
    const TOKEN_BUFFER_LINES = 40

    function codeAt(text, index) {
      return index >= 0 && index < text.length ? text.charCodeAt(index) : 0
    }

    function isIdentStartCode(code) {
      return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
        || code === 95 || code === 36 || code > 127
    }

    function isIdentPartCode(code) {
      return isIdentStartCode(code) || (code >= 48 && code <= 57)
    }

    function isDigitCode(code) {
      return code >= 48 && code <= 57
    }

    function isSpaceCode(code) {
      return code === 32 || code === 9 || code === 10 || code === 13
    }

    function wordSet(words) {
      return new Set(words.split(/\s+/).filter(Boolean))
    }

    const TOKEN_KEYWORDS = {
      js: wordSet('as async await break case catch class const continue debugger declare default delete do else enum export extends finally for from function get if implements import in instanceof interface keyof let namespace new of private protected public readonly return satisfies set static super switch this throw true false null try type typeof var void while with yield'),
      rust: wordSet('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'),
      go: wordSet('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false'),
      clike: wordSet('abstract auto break case catch char class const continue default delete do double else enum extends final finally float for foreach friend goto if implements import instanceof int interface long namespace new operator package private protected public return short signed sizeof static struct super switch synchronized template this throw throws transient try typedef typename union unsigned using virtual void volatile while boolean bool byte null nullptr true false fn let var async await yield override inline explicit constexpr export from of'),
      python: wordSet('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None self'),
      shell: wordSet('if then elif else fi for while until do done case esac in function return exit export local readonly declare source set unset shift break continue eval exec trap wait alias unalias echo printf read cd true false'),
      json: wordSet('true false null'),
      yaml: wordSet('true false null yes no on off'),
    }

    const TOKEN_TYPES = {
      js: wordSet('string number boolean any unknown never object symbol bigint'),
      rust: wordSet('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box'),
      go: wordSet('string int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 bool byte rune error any'),
      clike: wordSet('string String Object Integer Boolean Double Float Long Short Byte Character byte short int long float double boolean bool void char size_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t'),
      python: wordSet('int float str bool list dict set tuple bytes object type complex frozenset'),
    }

    const TOKEN_SPECS = {
      js: { lineComment: '//', blockComment: ['/*', '*/'], quotes: '"\'`', keywords: TOKEN_KEYWORDS.js, types: TOKEN_TYPES.js },
      rust: { lineComment: '//', blockComment: ['/*', '*/'], quotes: '"', keywords: TOKEN_KEYWORDS.rust, types: TOKEN_TYPES.rust, rustChar: true },
      go: { lineComment: '//', blockComment: ['/*', '*/'], quotes: '"\'`', keywords: TOKEN_KEYWORDS.go, types: TOKEN_TYPES.go },
      clike: { lineComment: '//', blockComment: ['/*', '*/'], quotes: '"\'`', keywords: TOKEN_KEYWORDS.clike, types: TOKEN_TYPES.clike },
      python: { lineComment: '#', quotes: '"\'', triples: ['"""', "'''"], keywords: TOKEN_KEYWORDS.python, types: TOKEN_TYPES.python, decorators: true },
      shell: { lineComment: '#', quotes: '"\'', keywords: TOKEN_KEYWORDS.shell, variables: true },
    }

    function scanStringEnd(text, start, quote, multiline) {
      const total = text.length
      let index = start + quote.length
      while (index < total) {
        const char = text[index]
        if (char === '\\') {
          index += 2
          continue
        }
        if (quote.length > 1) {
          if (text.startsWith(quote, index)) return index + quote.length
        } else if (char === quote) {
          return index + 1
        }
        if (!multiline && char === '\n') return index
        index += 1
      }
      return total
    }

    function scanNumberEnd(text, start) {
      let index = start
      let exponent = false
      while (index < text.length) {
        const code = text.charCodeAt(index)
        if (isDigitCode(code) || code === 46 || code === 95 || code === 120 || code === 88) {
          index += 1
          continue
        }
        if (code >= 65 && code <= 90 || code >= 97 && code <= 122) {
          if (!exponent && (code === 101 || code === 69)) {
            exponent = true
            index += 1
            const sign = codeAt(text, index)
            if (sign === 43 || sign === 45) index += 1
            continue
          }
          index += 1
          continue
        }
        break
      }
      return index
    }

    // Char literal ('a', '\n') vs a Rust lifetime ('a): only the former closes
    // within a few code units without crossing a newline.
    function rustCharEnd(text, start) {
      for (let index = start + 1; index < Math.min(text.length, start + 6); index += 1) {
        const code = text.charCodeAt(index)
        if (code === 92) return scanStringEnd(text, start, "'", false)
        if (code === 39) return index + 1
        if (code === 10) return 0
      }
      return 0
    }

    function scanScriptTokens(text, spec) {
      const tokens = []
      const total = text.length
      let index = 0
      let previous = ''
      while (index < total) {
        const code = text.charCodeAt(index)
        if (isSpaceCode(code)) {
          index += 1
          continue
        }
        if (spec.blockComment && text.startsWith(spec.blockComment[0], index)) {
          const found = text.indexOf(spec.blockComment[1], index + spec.blockComment[0].length)
          const stop = found < 0 ? total : found + spec.blockComment[1].length
          tokens.push({ start: index, end: stop, type: 'comment' })
          index = stop
          previous = ';'
          continue
        }
        if (spec.lineComment && text.startsWith(spec.lineComment, index)) {
          const found = text.indexOf('\n', index)
          const stop = found < 0 ? total : found
          tokens.push({ start: index, end: stop, type: 'comment' })
          index = stop
          continue
        }
        if (spec.triples) {
          const triple = spec.triples.find((candidate) => text.startsWith(candidate, index))
          if (triple) {
            const stop = scanStringEnd(text, index, triple, true)
            tokens.push({ start: index, end: stop, type: 'string' })
            index = stop
            previous = '"'
            continue
          }
        }
        if (spec.rustChar && code === 39) {
          const stop = rustCharEnd(text, index)
          if (stop) {
            tokens.push({ start: index, end: stop, type: 'string' })
            index = stop
            previous = '"'
            continue
          }
          // A lifetime: skip the name so it is not mistaken for a declaration.
          index += 1
          while (index < total && isIdentPartCode(text.charCodeAt(index))) index += 1
          previous = "'"
          continue
        }
        if (spec.quotes && spec.quotes.includes(text[index])) {
          const quote = text[index]
          const stop = scanStringEnd(text, index, quote, quote === '`')
          tokens.push({ start: index, end: stop, type: 'string' })
          index = stop
          previous = '"'
          continue
        }
        if (spec.variables && code === 36) {
          let stop = index + 1
          const braced = text[stop] === '{'
          if (braced) stop += 1
          while (stop < total && isIdentPartCode(text.charCodeAt(stop))) stop += 1
          if (braced && text[stop] === '}') stop += 1
          tokens.push({ start: index, end: stop, type: 'property' })
          index = stop
          previous = 'a'
          continue
        }
        if ((isDigitCode(code)) || (code === 46 && isDigitCode(codeAt(text, index + 1)))) {
          const stop = scanNumberEnd(text, index)
          tokens.push({ start: index, end: stop, type: 'number' })
          index = stop
          previous = '0'
          continue
        }
        if (spec.decorators && code === 64) {
          let stop = index + 1
          while (stop < total && isIdentPartCode(text.charCodeAt(stop))) stop += 1
          if (stop > index + 1) {
            tokens.push({ start: index, end: stop, type: 'function' })
            index = stop
            previous = 'a'
            continue
          }
        }
        if (isIdentStartCode(code)) {
          let stop = index + 1
          while (stop < total && isIdentPartCode(text.charCodeAt(stop))) stop += 1
          const word = text.slice(index, stop)
          let type = ''
          if (spec.keywords && spec.keywords.has(word)) {
            type = 'keyword'
          } else if (spec.types && spec.types.has(word)) {
            type = 'type'
          } else {
            let look = stop
            while (look < total && (text[look] === ' ' || text[look] === '\t')) look += 1
            if (text[look] === '(') type = 'function'
            else if (previous === '.') type = 'property'
          }
          if (type) tokens.push({ start: index, end: stop, type })
          index = stop
          previous = 'a'
          continue
        }
        previous = text[index]
        index += 1
      }
      return tokens
    }

    function pushShiftedTokens(target, tokens, offset) {
      for (const token of tokens) {
        target.push({ start: token.start + offset, end: token.end + offset, type: token.type })
      }
    }

    // `{...}` in a Svelte template can nest and contain strings, so find the
    // matching brace instead of the next one.
    function findMatchingBrace(text, start) {
      let depth = 0
      let index = start
      while (index < text.length) {
        const char = text[index]
        if (char === '"' || char === "'" || char === '`') {
          index = scanStringEnd(text, index, char, char === '`')
          continue
        }
        if (char === '{') {
          depth += 1
        } else if (char === '}') {
          depth -= 1
          if (depth === 0) return index
        }
        index += 1
      }
      return -1
    }

    // Markup plus the languages that hide inside it: <script> runs the script
    // scanner, <style> the CSS one, and Vue `{{ }}` / directive values and
    // Svelte `{ }` run the script scanner on their expressions.
    function scanMarkupTokens(text, framework) {
      const tokens = []
      const total = text.length
      let index = 0
      while (index < total) {
        if (text.startsWith('<!--', index)) {
          const found = text.indexOf('-->', index + 4)
          const stop = found < 0 ? total : found + 3
          tokens.push({ start: index, end: stop, type: 'comment' })
          index = stop
          continue
        }
        if (text[index] === '<' && (isIdentStartCode(codeAt(text, index + 1)) || text[index + 1] === '/')) {
          const openStart = index
          let cursor = index + 1
          const closing = text[cursor] === '/'
          if (closing) cursor += 1
          const nameStart = cursor
          while (cursor < total && (isIdentPartCode(text.charCodeAt(cursor)) || text[cursor] === '-' || text[cursor] === ':' || text[cursor] === '.')) cursor += 1
          const tagName = text.slice(nameStart, cursor).toLowerCase()
          tokens.push({ start: openStart, end: cursor, type: 'tag' })
          let selfClosing = false
          while (cursor < total) {
            const code = text.charCodeAt(cursor)
            if (isSpaceCode(code)) {
              cursor += 1
              continue
            }
            if (text[cursor] === '>') {
              selfClosing = text[cursor - 1] === '/'
              cursor += 1
              break
            }
            if (text[cursor] === '/') {
              cursor += 1
              continue
            }
            if (text[cursor] === '"' || text[cursor] === "'") {
              const stop = scanStringEnd(text, cursor, text[cursor], false)
              tokens.push({ start: cursor, end: stop, type: 'string' })
              cursor = stop
              continue
            }
            if (text[cursor] === '{') {
              // Svelte spread / shorthand: {value}, {...props}
              const brace = findMatchingBrace(text, cursor)
              if (brace > cursor) {
                pushShiftedTokens(tokens, scanScriptTokens(text.slice(cursor + 1, brace), TOKEN_SPECS.js), cursor + 1)
                cursor = brace + 1
                continue
              }
              cursor += 1
              continue
            }
            if (isIdentStartCode(code) || text[cursor] === ':' || text[cursor] === '@' || text[cursor] === '#') {
              let stop = cursor + 1
              while (stop < total && (isIdentPartCode(text.charCodeAt(stop)) || text[stop] === '-' || text[stop] === ':' || text[stop] === '.' || text[stop] === '@')) stop += 1
              const attribute = text.slice(cursor, stop)
              tokens.push({ start: cursor, end: stop, type: 'attr' })
              let look = stop
              while (look < total && isSpaceCode(text.charCodeAt(look))) look += 1
              if (text[look] === '=') {
                let valueStart = look + 1
                while (valueStart < total && isSpaceCode(text.charCodeAt(valueStart))) valueStart += 1
                if (text[valueStart] === '"' || text[valueStart] === "'") {
                  const quote = text[valueStart]
                  const stopAt = scanStringEnd(text, valueStart, quote, false)
                  const innerEnd = stopAt > valueStart + 1 && text[stopAt - 1] === quote ? stopAt - 1 : stopAt
                  const directive = attribute[0] === ':' || attribute[0] === '@' || attribute[0] === '#'
                    || attribute.startsWith('v-') || attribute.startsWith('on:')
                  if (directive) {
                    pushShiftedTokens(tokens, scanScriptTokens(text.slice(valueStart + 1, innerEnd), TOKEN_SPECS.js), valueStart + 1)
                  } else {
                    tokens.push({ start: valueStart, end: stopAt, type: 'string' })
                  }
                  cursor = stopAt
                  continue
                }
                if (framework === 'svelte' && text[valueStart] === '{') {
                  const brace = findMatchingBrace(text, valueStart)
                  if (brace > valueStart) {
                    pushShiftedTokens(tokens, scanScriptTokens(text.slice(valueStart + 1, brace), TOKEN_SPECS.js), valueStart + 1)
                    cursor = brace + 1
                    continue
                  }
                }
                cursor = stop
                continue
              }
              cursor = stop
              continue
            }
            cursor += 1
          }
          const openTag = text.slice(openStart, cursor)
          index = cursor
          if (!closing && !selfClosing && (tagName === 'script' || tagName === 'style')) {
            const closePattern = new RegExp('</' + tagName + '\\s*>', 'ig')
            closePattern.lastIndex = index
            const close = closePattern.exec(text)
            const bodyEnd = close ? close.index : total
            if (bodyEnd > index) {
              const inner = text.slice(index, bodyEnd)
              const innerTokens = tagName === 'style'
                ? scanCssTokens(inner)
                : scanScriptTokens(inner, TOKEN_SPECS.js)
              pushShiftedTokens(tokens, innerTokens, index)
            }
            index = bodyEnd
            if (close) {
              tokens.push({ start: bodyEnd, end: bodyEnd + close[0].length, type: 'tag' })
              index = bodyEnd + close[0].length
            }
            continue
          }
          continue
        }
        if (framework === 'vue' && text.startsWith('{{', index)) {
          const close = text.indexOf('}}', index + 2)
          if (close > index + 2) {
            pushShiftedTokens(tokens, scanScriptTokens(text.slice(index + 2, close), TOKEN_SPECS.js), index + 2)
            index = close + 2
            continue
          }
        }
        if (framework === 'svelte' && text[index] === '{') {
          const close = findMatchingBrace(text, index)
          if (close > index + 1) {
            pushShiftedTokens(tokens, scanScriptTokens(text.slice(index + 1, close), TOKEN_SPECS.js), index + 1)
            index = close + 1
            continue
          }
        }
        index += 1
      }
      return tokens
    }

    function scanCssTokens(text) {
      const tokens = []
      const total = text.length
      let index = 0
      let depth = 0
      while (index < total) {
        const code = text.charCodeAt(index)
        if (text.startsWith('/*', index)) {
          const found = text.indexOf('*/', index + 2)
          const stop = found < 0 ? total : found + 2
          tokens.push({ start: index, end: stop, type: 'comment' })
          index = stop
          continue
        }
        if (text[index] === '"' || text[index] === "'") {
          const stop = scanStringEnd(text, index, text[index], false)
          tokens.push({ start: index, end: stop, type: 'string' })
          index = stop
          continue
        }
        if (text[index] === '{') {
          depth += 1
          index += 1
          continue
        }
        if (text[index] === '}') {
          depth = Math.max(0, depth - 1)
          index += 1
          continue
        }
        if (text[index] === '@') {
          let stop = index + 1
          while (stop < total && isIdentPartCode(text.charCodeAt(stop))) stop += 1
          tokens.push({ start: index, end: stop, type: 'keyword' })
          index = stop
          continue
        }
        if (text[index] === '#' && /[0-9a-fA-F]/.test(text[index + 1] || '')) {
          let stop = index + 1
          while (stop < total && /[0-9a-fA-F]/.test(text[stop])) stop += 1
          tokens.push({ start: index, end: stop, type: 'number' })
          index = stop
          continue
        }
        if (isDigitCode(code) || (code === 46 && isDigitCode(codeAt(text, index + 1)))) {
          const stop = scanNumberEnd(text, index)
          tokens.push({ start: index, end: stop, type: 'number' })
          index = stop
          continue
        }
        if (isIdentStartCode(code)) {
          let stop = index + 1
          while (stop < total && (isIdentPartCode(text.charCodeAt(stop)) || text[stop] === '-')) stop += 1
          let look = stop
          while (look < total && isSpaceCode(text.charCodeAt(look))) look += 1
          const word = text.slice(index, stop)
          if (word === 'important' && text[index - 1] === '!') {
            tokens.push({ start: index, end: stop, type: 'keyword' })
          } else if (depth > 0 && text[look] === ':') {
            tokens.push({ start: index, end: stop, type: 'property' })
          } else if (text[look] === '(') {
            tokens.push({ start: index, end: stop, type: 'function' })
          }
          index = stop
          continue
        }
        index += 1
      }
      return tokens
    }

    function nextSignificant(text, from) {
      let index = from
      while (index < text.length && isSpaceCode(text.charCodeAt(index))) index += 1
      return index
    }

    function scanJsonTokens(text) {
      const tokens = []
      const total = text.length
      let index = 0
      while (index < total) {
        const code = text.charCodeAt(index)
        if (isSpaceCode(code)) {
          index += 1
          continue
        }
        if (text.startsWith('//', index)) {
          const found = text.indexOf('\n', index)
          const stop = found < 0 ? total : found
          tokens.push({ start: index, end: stop, type: 'comment' })
          index = stop
          continue
        }
        if (text[index] === '"') {
          const stop = scanStringEnd(text, index, '"', false)
          const look = nextSignificant(text, stop)
          tokens.push({ start: index, end: stop, type: text[look] === ':' ? 'property' : 'string' })
          index = stop
          continue
        }
        if (isDigitCode(code) || (code === 45 && isDigitCode(codeAt(text, index + 1)))) {
          const stop = scanNumberEnd(text, index + 1)
          tokens.push({ start: index, end: stop, type: 'number' })
          index = stop
          continue
        }
        if (isIdentStartCode(code)) {
          let stop = index + 1
          while (stop < total && isIdentPartCode(text.charCodeAt(stop))) stop += 1
          const word = text.slice(index, stop)
          if (TOKEN_KEYWORDS.json.has(word)) tokens.push({ start: index, end: stop, type: 'keyword' })
          index = stop
          continue
        }
        index += 1
      }
      return tokens
    }

    function scanYamlTokens(text) {
      const tokens = []
      const total = text.length
      let index = 0
      let lineStart = true
      while (index < total) {
        const code = text.charCodeAt(index)
        if (code === 10) {
          lineStart = true
          index += 1
          continue
        }
        if (isSpaceCode(code)) {
          index += 1
          continue
        }
        if (text[index] === '#') {
          const found = text.indexOf('\n', index)
          const stop = found < 0 ? total : found
          tokens.push({ start: index, end: stop, type: 'comment' })
          index = stop
          continue
        }
        if (text[index] === '"' || text[index] === "'") {
          const stop = scanStringEnd(text, index, text[index], false)
          tokens.push({ start: index, end: stop, type: 'string' })
          index = stop
          lineStart = false
          continue
        }
        if (isDigitCode(code) || (code === 45 && isDigitCode(codeAt(text, index + 1)))) {
          const stop = scanNumberEnd(text, index + 1)
          tokens.push({ start: index, end: stop, type: 'number' })
          index = stop
          lineStart = false
          continue
        }
        if (isIdentStartCode(code) && lineStart) {
          let stop = index + 1
          while (stop < total && (isIdentPartCode(text.charCodeAt(stop)) || text[stop] === '-' || text[stop] === '.')) stop += 1
          const look = nextSignificant(text, stop)
          const word = text.slice(index, stop)
          if (text[look] === ':') tokens.push({ start: index, end: stop, type: 'property' })
          else if (TOKEN_KEYWORDS.yaml.has(word)) tokens.push({ start: index, end: stop, type: 'keyword' })
          index = stop
          lineStart = false
          continue
        }
        lineStart = false
        index += 1
      }
      return tokens
    }

    // Markdown fences name a language in prose ("javascript", "typescript"),
    // so map the common aliases onto extension names and reuse the same table.
    const FENCE_ALIASES = {
      javascript: 'js', typescript: 'js',
      python: 'py', rust: 'rs', shell: 'sh', yaml: 'yml', markdown: 'md',
    }

    function fenceLanguageOf(info) {
      return languageOf('fence.' + (FENCE_ALIASES[info] || info))
    }

    function scanMarkdownTokens(text) {
      const tokens = []
      const total = text.length
      let index = 0
      let atLineStart = true
      while (index < total) {
        if (atLineStart && text.startsWith('```', index)) {
          const fence = text.indexOf('\n', index)
          const opening = fence < 0 ? total : fence
          tokens.push({ start: index, end: opening, type: 'comment' })
          const info = text.slice(index + 3, opening).trim().split(/\s+/)[0].toLowerCase()
          const cursor = fence < 0 ? total : fence + 1
          const close = text.indexOf('\n```', cursor)
          const bodyEnd = close < 0 ? total : close + 1
          // A fenced block that names a language is scanned with that language.
          const fenceLanguage = fenceLanguageOf(info)
          if (fenceLanguage && bodyEnd > cursor) {
            pushShiftedTokens(tokens, scanTokens(text.slice(cursor, bodyEnd), fenceLanguage), cursor)
          }
          index = bodyEnd
          if (close < 0) break
          tokens.push({ start: close + 1, end: Math.min(total, close + 4), type: 'comment' })
          index = close + 4
          atLineStart = false
          continue
        }
        if (atLineStart && text[index] === '#') {
          let hashes = index
          while (hashes < total && text[hashes] === '#') hashes += 1
          if (text[hashes] === ' ' || hashes === total || text[hashes] === '\n') {
            tokens.push({ start: index, end: hashes, type: 'keyword' })
            const lineEnd = text.indexOf('\n', hashes)
            const stop = lineEnd < 0 ? total : lineEnd
            if (stop > hashes + 1) tokens.push({ start: hashes + 1, end: stop, type: 'type' })
            index = stop
            continue
          }
        }
        if (text[index] === '`') {
          const found = text.indexOf('`', index + 1)
          const stop = found < 0 ? index + 1 : found + 1
          tokens.push({ start: index, end: stop, type: 'string' })
          index = stop
          atLineStart = false
          continue
        }
        if (text[index] === ']' && text[index + 1] === '(') {
          const found = text.indexOf(')', index + 2)
          const stop = found < 0 ? total : found + 1
          tokens.push({ start: index + 2, end: stop - 1, type: 'string' })
          index = stop
          atLineStart = false
          continue
        }
        if (text[index] === '\n') {
          atLineStart = true
          index += 1
          continue
        }
        atLineStart = false
        index += 1
      }
      return tokens
    }

    function scanIniTokens(text) {
      const tokens = []
      const total = text.length
      let index = 0
      let atLineStart = true
      while (index < total) {
        const code = text.charCodeAt(index)
        if (code === 10) {
          atLineStart = true
          index += 1
          continue
        }
        if (isSpaceCode(code)) {
          index += 1
          continue
        }
        if (text[index] === '#' || text[index] === ';') {
          const found = text.indexOf('\n', index)
          const stop = found < 0 ? total : found
          tokens.push({ start: index, end: stop, type: 'comment' })
          index = stop
          continue
        }
        if (atLineStart && text[index] === '[') {
          const found = text.indexOf(']', index + 1)
          const stop = found < 0 ? total : found + 1
          tokens.push({ start: index, end: stop, type: 'keyword' })
          index = stop
          continue
        }
        if (atLineStart && isIdentStartCode(code)) {
          let stop = index + 1
          while (stop < total && (isIdentPartCode(text.charCodeAt(stop)) || text[stop] === '.' || text[stop] === '-')) stop += 1
          const look = nextSignificant(text, stop)
          if (text[look] === '=' || text[look] === ':') tokens.push({ start: index, end: stop, type: 'property' })
          index = stop
          continue
        }
        if (text[index] === '"' || text[index] === "'") {
          const stop = scanStringEnd(text, index, text[index], false)
          tokens.push({ start: index, end: stop, type: 'string' })
          index = stop
          continue
        }
        atLineStart = false
        index += 1
      }
      return tokens
    }

    function scanTokens(text, language) {
      if (!language) return []
      if (language === 'markup') return scanMarkupTokens(text, 'html')
      if (language === 'vue') return scanMarkupTokens(text, 'vue')
      if (language === 'svelte') return scanMarkupTokens(text, 'svelte')
      if (language === 'css') return scanCssTokens(text)
      if (language === 'json') return scanJsonTokens(text)
      if (language === 'yaml') return scanYamlTokens(text)
      if (language === 'markdown') return scanMarkdownTokens(text)
      if (language === 'ini') return scanIniTokens(text)
      const spec = TOKEN_SPECS[language]
      return spec ? scanScriptTokens(text, spec) : []
    }

    function extOf(name) {
      const base = String(name || '')
      const dot = base.lastIndexOf('.')
      if (dot <= 0 || dot === base.length - 1) return ''
      return base.slice(dot + 1).toLowerCase()
    }

    // ── Built-in viewer kinds ──────────────────────────────────────────────
    // Extension-driven, mirroring the host's fileKindOf. Media and documents
    // open in the viewer; everything else goes through the text editor.
    const KIND_IMAGE = /^(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/
    const KIND_VIDEO = /^(mp4|webm|mov|m4v|ogv|mkv)$/
    const KIND_AUDIO = /^(mp3|wav|ogg|oga|m4a|flac|aac|opus)$/
    const KIND_MARKDOWN = /^(md|markdown|mdown|mdx)$/
    const KIND_HTML = /^(html|htm)$/
    const KIND_PDF = /^(pdf)$/

    function previewKindOf(name) {
      const extension = extOf(name)
      if (KIND_IMAGE.test(extension)) return 'image'
      if (KIND_VIDEO.test(extension)) return 'video'
      if (KIND_AUDIO.test(extension)) return 'audio'
      if (KIND_PDF.test(extension)) return 'pdf'
      if (KIND_MARKDOWN.test(extension)) return 'markdown'
      if (KIND_HTML.test(extension)) return 'html'
      return 'text'
    }

    function base64Url(value) {
      const bytes = new TextEncoder().encode(String(value))
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }

    function rawUrlFor(rootPath, filePath) {
      const relative = relativePath(rootPath, filePath)
      if (!relative) return ''
      return '/dsh-file-finder/ws/' + base64Url(rootPath) + '/'
        + relative.split('/').map(encodeURIComponent).join('/')
    }

    function normalizeRelative(baseDir, target) {
      const value = String(target || '')
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return ''
      const stack = String(baseDir || '').split('/').filter(Boolean)
      for (const part of value.split('/')) {
        if (!part || part === '.') continue
        if (part === '..') stack.pop()
        else stack.push(part)
      }
      return stack.join('/')
    }

    // Markdown images and <img> tags with relative sources are pointed at the raw
    // route, so a README's screenshots show up inside the panel.
    function rewriteMarkdownAssets(text, rootPath, filePath) {
      const baseDir = dirOf(relativePath(rootPath, filePath))
      const token = base64Url(rootPath)
      const toUrl = (target) => {
        const resolved = normalizeRelative(baseDir, target)
        if (!resolved) return ''
        const path = '/dsh-file-finder/ws/' + token + '/' + resolved.split('/').map(encodeURIComponent).join('/')
        // DSH's Markdown renderer only draws http(s) sources; a same-origin
        // absolute URL passes that check and still hits our route.
        try { return new URL(path, location.href).href } catch { return path }
      }
      return String(text || '')
        .replace(/(!\[[^\]]*\]\()([^)\s]+)(\))/g, (whole, head, target, tail) => {
          const url = toUrl(target)
          return url ? head + url + tail : whole
        })
        .replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi, (whole, head, target, tail) => {
          const url = toUrl(target)
          return url ? head + url + tail : whole
        })
    }

    function fileAccent(name) {
      const ext = extOf(name)
      if (/^(js|mjs|cjs|jsx|ts|tsx|mts|cts)$/.test(ext)) return 'amber'
      if (/^(json|jsonc|ya?ml|toml|ini|env)$/.test(ext)) return 'amber'
      if (/^(md|mdx|txt|rst)$/.test(ext)) return 'blue'
      if (/^(css|scss|sass|less|styl)$/.test(ext)) return 'blue'
      if (/^(html|htm|vue|svelte|astro)$/.test(ext)) return 'amber'
      if (/^(png|jpe?g|gif|webp|svg|ico|avif|bmp)$/.test(ext)) return 'green'
      if (/^(sh|bash|zsh|fish|ps1)$/.test(ext)) return 'green'
      return 'neutral'
    }

    function highlight(text, query) {
      const value = String(text || '')
      const needle = String(query || '').trim()
      if (!needle) return value
      const lower = value.toLowerCase()
      const hit = needle.toLowerCase()
      const parts = []
      let from = 0
      let at = lower.indexOf(hit)
      let key = 0
      while (at >= 0) {
        if (at > from) parts.push(value.slice(from, at))
        parts.push(h('mark', { key: 'm' + String(key++), className: 'dff-hit' }, value.slice(at, at + hit.length)))
        from = at + hit.length
        at = lower.indexOf(hit, from)
      }
      if (from < value.length) parts.push(value.slice(from))
      return parts
    }

    // ── In-editor find ─────────────────────────────────────────────────────
    // One pass over the draft, with the line number derived as we go: a match
    // jump never re-walks the file, and the line number is exact for CRLF text
    // too because only `\n` (0x0a) advances the counter.
    const EDITOR_LINE_HEIGHT = 20
    const EDITOR_MATCH_CAP = 5000

    function findEditorMatches(text, query, caseSensitive, cap = EDITOR_MATCH_CAP) {
      const source = String(text || '')
      const needle = String(query || '')
      if (!needle) return { hits: [], total: 0 }
      const haystack = caseSensitive ? source : source.toLowerCase()
      const target = caseSensitive ? needle : needle.toLowerCase()
      const hits = []
      let total = 0
      let line = 1
      let scanned = 0
      let at = haystack.indexOf(target)
      while (at !== -1) {
        for (let index = scanned; index < at; index += 1) {
          if (haystack.charCodeAt(index) === 10) line += 1
        }
        scanned = at + target.length
        total += 1
        if (hits.length < cap) hits.push({ start: at, end: at + target.length, line })
        at = haystack.indexOf(target, scanned)
      }
      return { hits, total }
    }

    function parentOf(filePath) {
      const normalized = String(filePath || '').replaceAll('\\', '/')
      const slash = normalized.lastIndexOf('/')
      return slash <= 0 ? normalized : normalized.slice(0, slash)
    }

    function baseName(filePath) {
      const normalized = String(filePath || '').replaceAll('\\', '/')
      const slash = normalized.lastIndexOf('/')
      return slash < 0 ? normalized : normalized.slice(slash + 1)
    }

    function relativePath(root, target) {
      const base = String(root || '').replaceAll('\\', '/').replace(/\/+$/, '')
      const full = String(target || '').replaceAll('\\', '/')
      return base && full.startsWith(base + '/') ? full.slice(base.length + 1) : ''
    }

    /** Directory part of a workspace-relative path; '' for a file at the root. */
    function dirOf(relative) {
      const normalized = String(relative || '').replaceAll('\\', '/')
      const slash = normalized.lastIndexOf('/')
      return slash < 0 ? '' : normalized.slice(0, slash)
    }

    function bytesText(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return ''
      if (value < 1024) return value + ' B'
      if (value < 1024 * 1024) return (value / 1024).toFixed(value < 10240 ? 1 : 0) + ' KB'
      return (value / 1048576).toFixed(1) + ' MB'
    }

    function encodeSegment(segment) {
      return encodeURIComponent(segment).replace(/%3A/gi, ':')
    }

    function sessionFileAddress(sessionId, path) {
      const normalized = String(path || '').replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
      return 'dsh-resource://file/session/' + encodeSegment(sessionId) + '/' + normalized.split('/').map(encodeSegment).join('/')
    }

    /** Keep relative paths readable; absolute paths outside the root still work. */
    function fileAddressFor(sessionId, cwd, path) {
      const normalized = String(path || '').replace(/\\/g, '/')
      const root = String(cwd || '').replace(/\\/g, '/').replace(/\/+$/, '')
      if (root && normalized === root) return sessionFileAddress(sessionId, '')
      if (root && normalized.startsWith(root + '/')) return sessionFileAddress(sessionId, normalized.slice(root.length + 1))
      return sessionFileAddress(sessionId, normalized)
    }

    function usePresence(open, duration) {
      const [mounted, setMounted] = useState(open)
      const [closing, setClosing] = useState(false)
      useEffect(() => {
        if (open) {
          setMounted(true)
          setClosing(false)
          return undefined
        }
        if (!mounted) return undefined
        setClosing(true)
        const timer = setTimeout(() => {
          setMounted(false)
          setClosing(false)
        }, duration)
        return () => clearTimeout(timer)
      }, [open, mounted, duration])
      return { mounted, closing }
    }

    function Icon(props) {
      const children = props.children
      return h('svg', {
        viewBox: '0 0 16 16',
        width: props.size || 16,
        height: props.size || 16,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: props.width || 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
        className: props.className,
      }, children)
    }

    function SearchIcon(props) {
      return h(Icon, props, h('circle', { key: 'c', cx: 7.2, cy: 7.2, r: 4.6 }), h('path', { key: 'p', d: 'M10.7 10.7 14 14' }))
    }

    function CloseIcon(props) {
      return h(Icon, props, h('path', { key: 'a', d: 'M4 4l8 8' }), h('path', { key: 'b', d: 'M12 4l-8 8' }))
    }

    function FolderIcon(props) {
      return h(Icon, props, h('path', { key: 'a', d: 'M1.8 4.2c0-.6.5-1.1 1.1-1.1h3l1.3 1.5h5.9c.6 0 1.1.5 1.1 1.1v6.1c0 .6-.5 1.1-1.1 1.1H2.9c-.6 0-1.1-.5-1.1-1.1z' }))
    }

    function ChevronIcon(props) {
      return h(Icon, props, h('path', { key: 'a', d: 'M4.2 6.3 8 10l3.8-3.7' }))
    }

    function CheckIcon(props) {
      return h(Icon, props, h('path', { key: 'a', d: 'M3.2 8.4l3 2.9 6.6-6.6' }))
    }

    function BackIcon(props) {
      return h(Icon, props, h('path', { key: 'a', d: 'M9.8 3.4 5.2 8l4.6 4.6' }))
    }

    function RefreshIcon(props) {
      return h(Icon, props, h('path', { key: 'a', d: 'M13.1 6.2A5.3 5.3 0 1 0 13 9.9' }), h('path', { key: 'b', d: 'M13.3 2.7v3.6H9.7' }))
    }

    function EditIcon(props) {
      return h(Icon, props, h('path', { key: 'a', d: 'M9.6 3.2l3.2 3.2' }), h('path', { key: 'b', d: 'M3 13l1-3.6 6.8-6.8a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L6.6 12z' }))
    }

    function SidebarIcon(props) {
      return h(Icon, props, h('rect', { key: 'a', x: 2.1, y: 2.8, width: 11.8, height: 10.4, rx: 2 }), h('path', { key: 'b', d: 'M9.6 2.8v10.4' }))
    }

    function WarningIcon(props) {
      return h(Icon, props, h('path', { key: 'a', d: 'M8 2.7 14 13H2z' }), h('path', { key: 'b', d: 'M8 6.3v3.1' }), h('path', { key: 'c', d: 'M8 11.4v.1' }))
    }

    function Spinner(props) {
      return h('span', { className: props.className || 'dff-spin', 'aria-hidden': 'true' },
        h('svg', { viewBox: '0 0 16 16', width: props.size || 14, height: props.size || 14, fill: 'none', 'aria-hidden': 'true' },
          h('circle', { cx: 8, cy: 8, r: 6, stroke: 'currentColor', strokeWidth: 1.6, opacity: 0.2 }),
          h('path', { d: 'M8 2a6 6 0 0 1 6 6', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' })))
    }

    function FallbackFileChip(props) {
      const ext = extOf(props.name)
      const label = ext === 'json' ? '{}' : ext ? ext.toUpperCase().slice(0, 3) : '·'
      return h('span', {
        className: 'dff-ftyp',
        'data-accent': fileAccent(props.name),
        'aria-hidden': 'true',
      }, label)
    }

    function FileGlyph(props) {
      if (FileTypeIcon) {
        try {
          return h(FileTypeIcon, { path: props.name, size: props.size || 18 })
        } catch { /* fall through to the chip */ }
      }
      return h(FallbackFileChip, { name: props.name })
    }

    function Kbd(props) {
      return h('kbd', { className: 'dff-key', 'aria-hidden': 'true' }, props.children)
    }

    function skeletonRows(count) {
      return h('div', { className: 'dff-skeleton', 'aria-hidden': 'true' },
        Array.from({ length: count }, (_, row) => h('div', {
          key: 'skeleton-' + String(row),
          className: 'dff-skeleton-row',
          style: { animationDelay: row * 90 + 'ms' },
        },
          h('span', { className: 'dff-skeleton-glyph' }),
          h('span', { className: 'dff-skeleton-body' },
            h('span', { className: 'dff-skeleton-name' }),
            h('span', { className: 'dff-skeleton-path' })))))
    }

    function Keycaps(props) {
      return h('span', {
        className: 'dff-keys',
        role: 'img',
        'aria-label': props.keys.join(' + '),
      }, props.keys.map((key, index) => h(Kbd, { key: index }, key)))
    }

    function Toggle(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': props.checked ? 'true' : 'false',
        'aria-label': props.label,
        className: 'dff-switch',
        onClick: () => props.onChange(!props.checked),
      }, h('span', { className: 'dff-switch-knob', 'aria-hidden': 'true' }))
    }

    function Stepper(props) {
      const value = Number(props.value)
      const change = (delta) => {
        const next = Math.min(props.max, Math.max(props.min, value + delta))
        if (next !== value) props.onChange(next)
      }
      return h('div', { className: 'dff-stepper', role: 'group', 'aria-label': props.label },
        h('button', {
          type: 'button', className: 'dff-stepper-btn', disabled: value <= props.min,
          'aria-label': props.decreaseLabel, onClick: () => change(-1),
        }, h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true' }, h('path', { d: 'M3.5 8h9', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }))),
        h('span', { className: 'dff-stepper-value', 'aria-live': 'polite' }, String(value)),
        h('button', {
          type: 'button', className: 'dff-stepper-btn', disabled: value >= props.max,
          'aria-label': props.increaseLabel, onClick: () => change(1),
        }, h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true' }, h('path', { d: 'M8 3.5v9M3.5 8h9', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }))))
    }

    /** Small segmented control used by the "Opening" preference row. */
    function Segmented(props) {
      return h('div', { className: 'dff-seg', 'data-value': props.value, role: 'radiogroup', 'aria-label': props.label },
        h('span', { className: 'dff-seg-pill', 'aria-hidden': 'true' }),
        props.options.map((option) => h('button', {
          key: option.value,
          type: 'button',
          role: 'radio',
          'aria-checked': props.value === option.value ? 'true' : 'false',
          className: 'dff-seg-option',
          onClick: () => props.onChange(option.value),
        }, option.label)))
    }

    function RootPicker(props) {
      const [open, setOpen] = useState(false)
      const wrapRef = useRef(null)
      const triggerRef = useRef(null)
      const menuRef = useRef(null)
      const roots = props.roots || []
      const current = roots.find((item) => item.path === props.value) || roots[0]
      useEffect(() => {
        if (!open) return undefined
        const onPointer = (event) => {
          if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener('pointerdown', onPointer, true)
        return () => document.removeEventListener('pointerdown', onPointer, true)
      }, [open])
      useEffect(() => {
        if (!open || !menuRef.current) return undefined
        const frame = requestAnimationFrame(() => {
          const menu = menuRef.current
          const target = menu && (menu.querySelector('.dff-menu-item.is-selected') || menu.querySelector('.dff-menu-item'))
          if (target) target.focus()
        })
        return () => cancelAnimationFrame(frame)
      }, [open])
      function closeMenu(refocus) {
        setOpen(false)
        if (refocus && triggerRef.current) triggerRef.current.focus()
      }
      if (!current) return null
      const label = current.title || baseName(current.path)
      if (roots.length <= 1) {
        return h('span', { className: 'dff-root dff-root-static', title: current.path },
          h(FolderIcon, { size: 14 }), h('span', { className: 'dff-root-label' }, label))
      }
      return h('div', { className: 'dff-root-wrap', ref: wrapRef },
        h('button', {
          ref: triggerRef,
          type: 'button', className: 'dff-root', title: current.path,
          'aria-haspopup': 'listbox', 'aria-expanded': open ? 'true' : 'false', 'aria-label': props.t('chooseRoot'),
          onClick: () => setOpen((value) => !value),
          onKeyDown: (event) => {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault()
              setOpen(true)
            }
          },
        },
        h(FolderIcon, { size: 14 }),
        h('span', { className: 'dff-root-label' }, label),
        h(ChevronIcon, { size: 12, className: 'dff-root-chevron' })),
        open ? h('div', {
          ref: menuRef,
          className: 'dff-menu',
          role: 'listbox',
          'aria-label': props.t('root'),
          onKeyDown: (event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              closeMenu(true)
              return
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
            event.preventDefault()
            const items = Array.from(event.currentTarget.querySelectorAll('.dff-menu-item'))
            const index = items.indexOf(document.activeElement)
            const next = event.key === 'ArrowDown'
              ? Math.min(items.length - 1, index + 1)
              : Math.max(0, index - 1)
            if (items[next]) items[next].focus()
          },
        },
          roots.map((item) => h('button', {
            key: item.path,
            type: 'button',
            role: 'option',
            'aria-selected': item.path === current.path ? 'true' : 'false',
            className: item.path === current.path ? 'dff-menu-item is-selected' : 'dff-menu-item',
            onClick: () => { props.onChange(item.path); closeMenu(true) },
          },
          h(FolderIcon, { size: 14, className: 'dff-menu-icon' }),
          h('span', { className: 'dff-menu-label' }, item.title || baseName(item.path)),
          h('small', { className: 'dff-menu-path' }, item.path),
          item.path === current.path ? h(CheckIcon, { size: 13, className: 'dff-menu-check' }) : null))) : null)
    }

    function Palette(props) {
      const ctx = props && props.ctx
      const t = props.t
      const request = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
      const prefsState = useSyncExternalStore(prefs.subscribe, prefs.snapshot, prefs.snapshot)
      const [view, setView] = useState('search')
      const [mode, setMode] = useState('name')
      const [query, setQuery] = useState('')
      const [roots, setRoots] = useState([])
      const [root, setRoot] = useState('')
      const [results, setResults] = useState([])
      const [truncated, setTruncated] = useState(false)
      const [selected, setSelected] = useState(0)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [file, setFile] = useState(null)
      const [draft, setDraft] = useState('')
      const [status, setStatus] = useState('')
      const [confirmAction, setConfirmAction] = useState('')
      const [searchTick, setSearchTick] = useState(0)
      const [browsePath, setBrowsePath] = useState('')
      const [browseState, setBrowseState] = useState(emptyBrowseState)
      const [findOpen, setFindOpen] = useState(false)
      const [findQuery, setFindQuery] = useState('')
      const [findCase, setFindCase] = useState(false)
      const [findIndex, setFindIndex] = useState(0)
      const [findFocused, setFindFocused] = useState(false)
      const [intelArmed, setIntelArmed] = useState(false)
      const [intelHover, setIntelHover] = useState(null)
      const [composing, setComposing] = useState(false)
      const [tokenWindow, setTokenWindow] = useState(null)
      const [navStack, setNavStack] = useState([])
      const inputRef = useRef(null)
      const editorRef = useRef(null)
      const findInputRef = useRef(null)
      const mirrorRef = useRef(null)
      const gutterRef = useRef(null)
      const markerRef = useRef(null)
      const activeLineRef = useRef(1)
      const intelLayerRef = useRef(null)
      const tokenLayerRef = useRef(null)
      const editorViewRef = useRef(null)
      const panelRef = useRef(null)
      const escapeHandler = useRef(handleEscape)
      const generation = useRef(0)
      const lastFocus = useRef(null)
      const presence = usePresence(request.open, 150)
      const mac = useMemo(isMac, [])

      useEffect(() => {
        if (!request.open) return undefined
        lastFocus.current = typeof document !== 'undefined' ? document.activeElement : null
        setView('search')
        setMode(request.mode)
        setQuery('')
        setResults([])
        setSelected(0)
        setError('')
        setNotice('')
        setConfirmAction('')
        setFile(null)
        setDraft('')
        setStatus('')
        setFindOpen(false)
        setFindQuery('')
        setFindIndex(0)
        setFindFocused(false)
        setBrowsePath('')
        setBrowseState(emptyBrowseState())
        setIntelArmed(false)
        setIntelHover(null)
        setNavStack([])
        const session = sessionOf(ctx)
        if (session.cwd) setRoot(session.cwd)
        let cancelled = false
        post('/dsh-file-finder/roots', {}).then((data) => {
          if (cancelled) return
          const items = Array.isArray(data.roots) ? data.roots : []
          setRoots(items)
          setRoot((previous) => {
            const candidate = previous || session.cwd || (items[0] && items[0].path) || ''
            if (!items.length || items.some((item) => item.path === candidate)) return candidate
            return items[0].path
          })
        }).catch((reason) => {
          if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
        })
        return () => { cancelled = true }
      }, [request.open, request.token, request.mode, ctx])

      useEffect(() => {
        if (request.open) return undefined
        const target = lastFocus.current
        if (target && typeof target.focus === 'function') {
          try { target.focus({ preventScroll: true }) } catch { /* detached */ }
        }
        return undefined
      }, [request.open])

      // The overlay mounts one render after `request.open` (the presence
      // animation), and DSH's shell may move focus back to the conversation
      // composer in the same keystroke. Focus once in the layout pass, again on
      // the next frame, and retry once after the shell settles — unless the
      // user has already moved focus inside the panel.
      useLayoutEffect(() => {
        if (!presence.mounted || !request.open || view !== 'search') return undefined
        const node = inputRef.current
        if (node) {
          try { node.focus({ preventScroll: true }) } catch { /* detached */ }
        }
        return undefined
      }, [presence.mounted, request.open, request.token, view, mode])

      useEffect(() => {
        if (!presence.mounted || !request.open || view !== 'search') return undefined
        const attempt = () => {
          if (!store.state.open) return
          const node = inputRef.current
          const active = document.activeElement
          const insidePanel = panelRef.current && active && panelRef.current.contains(active)
          if (!node || insidePanel || active === node) return
          try { node.focus({ preventScroll: true }) } catch { /* detached */ }
        }
        let retryA = 0
        let retryB = 0
        const frame = requestAnimationFrame(() => {
          attempt()
          retryA = setTimeout(() => {
            attempt()
            retryB = setTimeout(attempt, 110)
          }, 70)
        })
        return () => {
          cancelAnimationFrame(frame)
          if (retryA) clearTimeout(retryA)
          if (retryB) clearTimeout(retryB)
        }
      }, [presence.mounted, request.open, request.token, view, mode])

      useEffect(() => {
        escapeHandler.current = handleEscape
      })

      // The overlay is modal, but focus can sit outside the panel: the row that
      // opened a viewer is unmounted, and an HTML/PDF iframe takes focus on
      // click. Catch Escape at the window level as a backstop; the panel's own
      // handler still wins for events that come from inside it.
      useEffect(() => {
        if (!request.open || !presence.mounted) return undefined
        function onWindowKeyDown(event) {
          if (event.key !== 'Escape' || event.defaultPrevented) return
          const panel = panelRef.current
          if (panel && event.target instanceof Node && panel.contains(event.target)) return
          event.preventDefault()
          escapeHandler.current()
        }
        window.addEventListener('keydown', onWindowKeyDown, true)
        return () => window.removeEventListener('keydown', onWindowKeyDown, true)
      }, [request.open, presence.mounted])

      // HTML and PDF previews live in an iframe; the host injects a tiny bridge
      // that posts this message when Escape is pressed inside the page.
      useEffect(() => {
        if (!request.open) return undefined
        function onViewerMessage(event) {
          const data = event.data
          if (!data || typeof data !== 'object' || data.type !== 'dsh-file-finder:escape') return
          const panel = panelRef.current
          if (!panel) return
          let fromViewer = false
          for (const frame of panel.querySelectorAll('iframe')) {
            if (frame.contentWindow === event.source) fromViewer = true
          }
          if (!fromViewer) return
          escapeHandler.current()
        }
        window.addEventListener('message', onViewerMessage)
        return () => window.removeEventListener('message', onViewerMessage)
      }, [request.open])

      useEffect(() => {
        function onFocusSearch() {
          if (view === 'search' && inputRef.current) inputRef.current.focus()
        }
        window.addEventListener('dff-focus-search', onFocusSearch)
        return () => window.removeEventListener('dff-focus-search', onFocusSearch)
      }, [view])

      useEffect(() => {
        if (!request.open || view !== 'search' || !root) return undefined
        const needle = query.trim()
        if (!needle || (mode === 'content' && needle.length < 2)) {
          generation.current += 1
          setResults([])
          setTruncated(false)
          setBusy(false)
          setError('')
          return undefined
        }
        const ticket = generation.current + 1
        generation.current = ticket
        const controller = new AbortController()
        setBusy(true)
        setError('')
        const timer = setTimeout(() => {
          const path = mode === 'content' ? '/dsh-file-finder/search-content' : '/dsh-file-finder/search-name'
          post(path, { root, query: needle, options: prefs.snapshot() }, controller.signal).then((data) => {
            if (generation.current !== ticket) return
            setResults(Array.isArray(data.results) ? data.results : [])
            setTruncated(Boolean(data.truncated))
            setSelected(0)
            setSearchTick((value) => value + 1)
          }).catch((reason) => {
            if (reason && reason.name === 'AbortError') return
            if (generation.current !== ticket) return
            setResults([])
            setError(reason instanceof Error ? reason.message : String(reason))
          }).finally(() => {
            if (generation.current === ticket) setBusy(false)
          })
        }, 170)
        return () => {
          clearTimeout(timer)
          controller.abort()
        }
      }, [request.open, request.token, view, mode, query, root, prefsState])

      // An empty name query becomes a file browser: the panel lists the current
      // directory and typing falls back to the usual search.
      const browsing = Boolean(request.open && view === 'search' && !query.trim() && root)
      useEffect(() => {
        if (!browsing || !root) return undefined
        const dir = browsePath && isInsidePath(root, browsePath) ? browsePath : root
        const controller = new AbortController()
        let cancelled = false
        setBrowseState((current) => ({ ...current, loading: current.entries.length === 0, error: '' }))
        post('/dsh-file-finder/list', { root, path: dir, options: prefs.snapshot() }, controller.signal).then((data) => {
          if (cancelled) return
          if (data && data.ok) {
            setBrowseState({
              path: data.path || dir,
              parent: data.parent || null,
              crumbs: Array.isArray(data.crumbs) ? data.crumbs : [],
              entries: Array.isArray(data.entries) ? data.entries : [],
              truncated: Boolean(data.truncated),
              loading: false,
              error: '',
            })
          } else {
            setBrowseState({ ...emptyBrowseState(dir), error: (data && data.error) || t('browseFailed') })
          }
          setSelected(0)
        }).catch((reason) => {
          if (cancelled || (reason && reason.name === 'AbortError')) return
          setBrowseState({
            ...emptyBrowseState(dir),
            error: reason instanceof Error ? reason.message : String(reason),
          })
        })
        return () => {
          cancelled = true
          controller.abort()
        }
      }, [browsing, root, browsePath, request.token, prefsState])

      useEffect(() => {
        if (!request.open || view !== 'editor' || !editorRef.current || !file) return
        const area = editorRef.current
        const line = Math.max(1, file.line || 1)
        const offset = file.text.split(/\r?\n/).slice(0, line - 1).join('\n').length
        const start = line === 1 ? 0 : offset + 1
        area.focus()
        area.setSelectionRange(start, start)
        area.scrollTop = Math.max(0, (line - 3) * EDITOR_LINE_HEIGHT)
        trackActiveLine()
        syncEditorScroll(area)
      }, [request.open, view, file])

      useEffect(() => {
        if (!request.open || view !== 'search' || !selected) return
        const list = panelRef.current && panelRef.current.querySelector('[data-dff-list]')
        const row = list && list.querySelector('[data-index="' + String(selected) + '"]')
        if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
      }, [request.open, view, selected])

      const dirty = Boolean(file && draft !== file.text)
      // Count newlines instead of splitting: the gutter needs the number, not
      // 30k line strings on every keystroke of a large file.
      const lineCount = useMemo(() => {
        if (!file) return 0
        let count = 1
        for (let index = 0; index < draft.length; index += 1) {
          if (draft.charCodeAt(index) === 10) count += 1
        }
        return count
      }, [file, draft])
      const findResult = useMemo(
        () => findEditorMatches(draft, findQuery, findCase),
        [draft, findQuery, findCase],
      )
      const mirrorOn = findOpen && findFocused && Boolean(findQuery)
      // A single text node keeps the gutter cheap even for very large files.
      const gutterText = useMemo(() => {
        const total = Math.max(1, lineCount)
        const parts = new Array(total)
        for (let index = 0; index < total; index += 1) parts[index] = String(index + 1)
        return parts.join('\n')
      }, [lineCount])
      const gutterWidth = useMemo(
        () => 'calc(' + String(String(Math.max(1, lineCount)).length) + 'ch + 26px)',
        [lineCount],
      )
      const mirrorNodes = useMemo(() => {
        if (!mirrorOn) return null
        const nodes = []
        let from = 0
        findResult.hits.forEach((hit, index) => {
          if (hit.start > from) nodes.push(draft.slice(from, hit.start))
          nodes.push(h('mark', {
            key: 'm' + String(index),
            className: index === findIndex ? 'dff-find-hit is-current' : 'dff-find-hit',
          }, draft.slice(hit.start, hit.end)))
          from = hit.end
        })
        if (from < draft.length) nodes.push(draft.slice(from))
        return nodes
      }, [draft, findResult, findIndex, mirrorOn])
      const draftBytes = useMemo(() => utf8Length(draft), [draft])
      const intel = useMemo(() => {
        if (!intelArmed || !file || file.kind !== 'text' || findOpen) return null
        if (!draft || draftBytes > INTEL_MAX_BYTES) return null
        const language = intelLanguageOf(file.path)
        const index = buildIntelIndex(draft, language)
        return { index, segments: buildIntelSegments(draft, index) }
      }, [intelArmed, file, draft, draftBytes, findOpen])

      // Lexical colours. The scanner runs once per edit (a single linear pass);
      // only the tokens inside the visible window are turned into spans, so a
      // large file stays cheap to scroll.
      const tokenLanguage = useMemo(
        () => (file && file.kind === 'text' ? languageOf(file.path) : ''),
        [file],
      )
      const tokenOn = Boolean(
        tokenLanguage && draft && draftBytes <= TOKEN_MAX_BYTES && !composing
      )
      const lineStarts = useMemo(() => {
        if (!tokenOn) return null
        const starts = [0]
        for (let index = 0; index < draft.length; index += 1) {
          if (draft.charCodeAt(index) === 10) starts.push(index + 1)
        }
        return starts
      }, [draft, tokenOn])
      const tokenList = useMemo(() => {
        if (!tokenOn) return null
        const tokens = scanTokens(draft, tokenLanguage)
        return tokens.length > TOKEN_WINDOW_MAX * 20 ? null : tokens
      }, [draft, tokenLanguage, tokenOn])
      const tokenSegments = useMemo(() => {
        if (!tokenOn || !lineStarts || !tokenList) return null
        const fromLine = tokenWindow ? Math.max(0, tokenWindow.from) : 0
        const toLine = tokenWindow ? Math.min(lineStarts.length, tokenWindow.to) : lineStarts.length
        const from = lineStarts[fromLine] === undefined ? draft.length : lineStarts[fromLine]
        const to = toLine < lineStarts.length ? lineStarts[toLine] : draft.length
        const inside = []
        for (const token of tokenList) {
          if (token.start >= from && token.end <= to) inside.push(token)
          if (token.start > to) break
        }
        // A window with nothing to colour (or too much of it) leaves the
        // textarea in charge, so the glyphs are never painted twice.
        if (!inside.length || inside.length > TOKEN_WINDOW_MAX) return null
        const segments = []
        let cursor = 0
        for (const token of inside) {
          if (token.start > cursor) segments.push({ text: draft.slice(cursor, token.start), start: cursor, type: '' })
          segments.push({ text: draft.slice(token.start, token.end), start: token.start, type: token.type })
          cursor = token.end
        }
        if (cursor < draft.length) segments.push({ text: draft.slice(cursor), start: cursor, type: '' })
        return segments
      }, [tokenOn, lineStarts, tokenList, tokenWindow, draft])
      // Only tint the textarea when the layer actually paints something; an
      // empty token list must never make the text invisible.
      const tokenPainted = useMemo(
        () => Boolean(tokenSegments && tokenSegments.some((segment) => segment.type)),
        [tokenSegments],
      )

      // Keep the current match inside the list as the draft or the query changes.
      useEffect(() => {
        if (!findOpen) return
        setFindIndex((value) => (findResult.hits.length ? Math.min(Math.max(0, value), findResult.hits.length - 1) : 0))
      }, [findOpen, findResult])

      useEffect(() => {
        if (!findOpen) return
        const input = findInputRef.current
        if (!input) return
        input.focus()
        input.select()
      }, [findOpen])

      // ⌘ (or Ctrl) arms the identifier layer: link affordances appear only while
      // the modifier is held, so ordinary clicks keep selecting text.
      useEffect(() => {
        if (view !== 'editor' || !file || file.kind !== 'text') return undefined
        function onKeyDown(event) {
          if (findOpen) return
          if (event.key === 'Meta' || event.key === 'Control' || event.metaKey || event.ctrlKey) {
            setIntelArmed(true)
          }
        }
        function onKeyUp(event) {
          if (event.key !== 'Meta' && event.key !== 'Control') return
          setIntelArmed(false)
          setIntelHover(null)
        }
        function onBlur() {
          setIntelArmed(false)
          setIntelHover(null)
        }
        window.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('keyup', onKeyUp, true)
        window.addEventListener('blur', onBlur)
        return () => {
          window.removeEventListener('keydown', onKeyDown, true)
          window.removeEventListener('keyup', onKeyUp, true)
          window.removeEventListener('blur', onBlur)
        }
      }, [view, file, findOpen])

      useEffect(() => { setIntelHover(null) }, [draft, intelArmed])

      // The coloured band depends on how much of the file is on screen, so
      // re-measure when the panel is resized (or when colours first switch on).
      // A viewer has no inner focusable control, so focus the dialog itself:
      // Escape (and the keyboard backstop) keeps working without a click.
      useEffect(() => {
        if (request.open !== true || view !== 'editor' || !file || !file.kind || file.kind === 'text') return undefined
        const panel = panelRef.current
        if (panel && typeof panel.focus === 'function') {
          try { panel.focus({ preventScroll: true }) } catch { /* detached */ }
        }
        return undefined
      }, [request.open, view, file])

      useEffect(() => {
        if (view !== 'editor' || !tokenOn) return undefined
        const area = editorRef.current
        if (!area) return undefined
        measureTokenWindow(area)
        if (typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => measureTokenWindow(area))
        observer.observe(area)
        return () => observer.disconnect()
      }, [view, tokenOn, file])

      // The identifier and colour layers are re-created after a ⌘ press, an IME
      // composition or a resize, and a fresh layer starts at scroll offset zero.
      // Push the current offset in before the browser paints, or the links and
      // colours line up with a different part of the file.
      useLayoutEffect(() => {
        if (view !== 'editor') return
        const area = editorRef.current
        if (area) syncEditorScroll(area)
      }, [view, intel, tokenPainted, mirrorOn])

      // Bring the active match into view. Horizontal alignment happens after the
      // mirror has painted, because only the rendered <mark> knows where the
      // match starts on a long, unwrapped line.
      useEffect(() => {
        if (!findOpen) return
        const area = editorRef.current
        const hit = findResult.hits[findIndex]
        if (!area || !hit) return
        const page = Math.max(EDITOR_LINE_HEIGHT, area.clientHeight - EDITOR_LINE_HEIGHT * 2)
        const top = (hit.line - 1) * EDITOR_LINE_HEIGHT
        if (top < area.scrollTop || top > area.scrollTop + page) {
          area.scrollTop = Math.max(0, top - page / 2)
        }
        syncEditorScroll(area)
        alignCurrentMark(area)
      }, [findOpen, findIndex, findQuery, findCase, mirrorOn])
      const flat = useMemo(() => results.flatMap((item) => {
        if (mode === 'name') {
          const relative = relativePath(root, item.path)
          return [{ path: item.path, name: item.name, line: 1, preview: dirOf(relative) || baseName(root) }]
        }
        return (item.hits || []).map((hit) => ({
          path: item.path,
          name: item.name,
          line: hit.line,
          preview: hit.text,
        }))
      }), [results, mode, root])
      const browseRows = useMemo(
        () => (browseState.entries || []).map((entry) => ({
          path: entry.path,
          name: entry.name,
          kind: entry.type === 'dir' ? 'dir' : 'file',
          line: 1,
        })),
        [browseState],
      )
      const rows = browsing ? browseRows : flat

      if (!presence.mounted) return null

      function closePanel() {
        if (dirty && view === 'editor') {
          setConfirmAction('close')
          return
        }
        store.close()
      }

      function leaveEditor() {
        if (dirty) {
          setConfirmAction('back')
          return
        }
        setView('search')
        setNotice('')
      }

      function openNative(item) {
        const sidebarRight = serviceOf(ctx, 'sidebarRight')
        if (!sidebarRight || typeof sidebarRight.openResource !== 'function') return false
        // Click-time read: the user may have switched conversations while the
        // palette was open, and the address is scoped to the live Session.
        const current = sessionOf(ctx)
        if (!current.id) return false
        const address = fileAddressFor(current.id, current.cwd || root, item.path)
        try {
          sidebarRight.openResource(address, item.line ? { params: { line: item.line } } : undefined)
          return true
        } catch {
          return false
        }
      }

      async function openEditor(item) {
        setBusy(true)
        setError('')
        setStatus('')
        setConfirmAction('')
        setFindOpen(false)
        setFindQuery('')
        setFindIndex(0)
        setNavStack([])
        try {
          const data = await post('/dsh-file-finder/read', { root, path: item.path })
          const text = typeof data.text === 'string' ? data.text : ''
          // The host decides the kind from the extension and decodability; media
          // and PDFs arrive without text and are rendered by the viewer.
          const kind = typeof data.kind === 'string' && data.kind ? data.kind : previewKindOf(item.path)
          setFile({
            path: data.path,
            version: data.version,
            text,
            bytes: data.bytes,
            line: item.line || 1,
            kind,
          })
          setDraft(text)
          setView('editor')
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      async function openPrimary(item) {
        if (busy) return
        // Media and documents have nothing to edit here, so they always open in
        // the built-in viewer instead of the sidebar/native split.
        if (previewKindOf(item.path) !== 'text') {
          await openEditor(item)
          return
        }
        if (prefsState.openMode === 'preview') {
          if (openNative(item)) {
            store.close()
            return
          }
          setNotice(t('previewUnavailable'))
        }
        await openEditor(item)
      }

      async function openSecondary(item) {
        if (busy) return
        if (previewKindOf(item.path) !== 'text') {
          await openEditor(item)
          return
        }
        if (prefsState.openMode === 'preview') {
          setNotice('')
          await openEditor(item)
          return
        }
        if (openNative(item)) {
          store.close()
          return
        }
        setNotice(t('previewUnavailable'))
        await openEditor(item)
      }

      function previewCurrent() {
        if (!file) return
        if (dirty) {
          setNotice(t('saveBeforePreview'))
          return
        }
        if (openNative({ path: file.path, line: file.line })) {
          store.close()
          return
        }
        setNotice(t('previewUnavailable'))
      }

      async function saveFile() {
        if (!file || !dirty) return
        setBusy(true)
        setError('')
        setStatus(t('saving'))
        try {
          const data = await post('/dsh-file-finder/write', {
            root,
            path: file.path,
            content: draft,
            version: file.version,
          })
          if (data.conflict) {
            setError(data.error || t('conflict'))
            setStatus(t('conflict'))
            return
          }
          setFile({ ...file, text: draft, version: data.version })
          setStatus(t('saved'))
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
          setStatus('')
        } finally {
          setBusy(false)
        }
      }

      async function reloadFile() {
        if (!file) return
        if (dirty) {
          setConfirmAction('reload')
          return
        }
        await openEditor({ path: file.path, line: file.line })
      }

      function moveSelection(delta) {
        setSelected((index) => {
          if (!rows.length) return 0
          const next = (index + delta + rows.length) % rows.length
          return next
        })
      }

      function enterBrowseDir(item) {
        if (!item || item.kind !== 'dir') return
        setBrowsePath(item.path)
        setSelected(0)
        setQuery('')
        if (inputRef.current) inputRef.current.focus()
      }

      function browseUp() {
        const current = browseState.path || root
        const parent = browseState.parent
        if (!parent || parent === current) return
        setBrowsePath(parent)
        setSelected(0)
        if (inputRef.current) inputRef.current.focus()
      }

      function chooseBrowseRow(item) {
        if (!item) return
        if (item.kind === 'dir') enterBrowseDir(item)
        else openPrimary(item)
      }

      // Escape walks back one screen at a time: tooltip → file view → parent
      // directory → closed. It is also reachable from a window listener, because
      // opening a viewer can leave focus on a node outside the panel.
      function handleEscape() {
        if (confirmAction) {
          setConfirmAction('')
          return
        }
        if (intelHover) {
          setIntelHover(null)
          return
        }
        if (view === 'editor') {
          if (file && file.kind && file.kind !== 'text') {
            setView('search')
            setNotice('')
            return
          }
          leaveEditor()
          return
        }
        const current = browseState.path || root
        if (browsing && browseState.parent && browseState.parent !== current) {
          browseUp()
          return
        }
        closePanel()
      }

      function onPanelKey(event) {
        if (view === 'editor' && file && file.kind === 'text' && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault()
          event.stopPropagation()
          openFind()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          handleEscape()
          return
        }
        if (event.key !== 'Tab') return
        const rootNode = panelRef.current
        if (!rootNode) return
        const nodes = Array.from(rootNode.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((node) => node.offsetParent !== null || node === document.activeElement)
        if (!nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }

      function onSearchKey(event) {
        const row = rows[selected]
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          moveSelection(event.key === 'ArrowDown' ? 1 : -1)
          return
        }
        if (browsing && event.key === 'ArrowRight' && row && row.kind === 'dir') {
          event.preventDefault()
          enterBrowseDir(row)
          return
        }
        if (browsing && event.key === 'Backspace' && !query.trim()) {
          const current = browseState.path || root
          if (browseState.parent && browseState.parent !== current) {
            event.preventDefault()
            browseUp()
          }
          return
        }
        if (event.key === 'Enter' && row) {
          event.preventDefault()
          if (browsing && row.kind === 'dir') enterBrowseDir(row)
          else if (event.metaKey || event.ctrlKey) openSecondary(row)
          else openPrimary(row)
        }
      }

      // Tokens are painted only for the visible lines plus a buffer. The window
      // advances once the view has scrolled past that buffer, so a smooth scroll
      // does not re-render the coloured band on every frame.
      function measureTokenWindow(area) {
        const view = area || editorRef.current
        if (!view) return
        const height = Math.max(view.clientHeight, EDITOR_LINE_HEIGHT)
        const first = Math.max(0, Math.floor(view.scrollTop / EDITOR_LINE_HEIGHT) - TOKEN_BUFFER_LINES)
        const last = Math.ceil((view.scrollTop + height) / EDITOR_LINE_HEIGHT) + TOKEN_BUFFER_LINES
        setTokenWindow((current) => {
          if (current && first >= current.from && last <= current.to) return current
          return { from: first, to: last }
        })
      }

      function setLayerOffset(ref, left, top) {
        if (!ref || !ref.current) return
        ref.current.style.transform = 'translate3d(' + String(-left) + 'px,' + String(-top) + 'px,0)'
      }

      function syncEditorScroll(area) {
        if (!area) return
        const top = area.scrollTop
        const left = area.scrollLeft
        setLayerOffset(mirrorRef, left, top)
        setLayerOffset(intelLayerRef, left, top)
        setLayerOffset(tokenLayerRef, left, top)
        if (gutterRef.current) {
          gutterRef.current.style.transform = 'translate3d(0,' + String(-top) + 'px,0)'
        }
        measureTokenWindow(area)
        positionActiveLine()
      }

      function positionActiveLine() {
        const marker = markerRef.current
        const area = editorRef.current
        if (!marker || !area) return
        const top = (activeLineRef.current - 1) * EDITOR_LINE_HEIGHT - area.scrollTop
        marker.style.transform = 'translate3d(0,' + String(top) + 'px,0)'
        marker.style.opacity = top <= -EDITOR_LINE_HEIGHT * 3 || top >= area.clientHeight ? '0' : '1'
      }

      // The caret line is derived from the live textarea, so it stays right while
      // the user types. Cost is O(text before the caret), only on selection or key
      // changes, never on scroll.
      function trackActiveLine() {
        const area = editorRef.current
        if (!area) return
        const caret = Math.min(area.selectionStart || 0, area.value.length)
        let line = 1
        for (let index = 0; index < caret; index += 1) {
          if (area.value.charCodeAt(index) === 10) line += 1
        }
        if (line === activeLineRef.current) return
        activeLineRef.current = line
        positionActiveLine()
      }

      function alignCurrentMark(area) {
        const mirror = mirrorRef.current
        if (!mirror || !area) return
        const mark = mirror.querySelector('mark.is-current')
        if (!mark) return
        const left = mark.offsetLeft
        const width = mark.offsetWidth || 1
        const viewLeft = area.scrollLeft
        const viewWidth = area.clientWidth
        if (left < viewLeft) area.scrollLeft = Math.max(0, left - 24)
        else if (left + width > viewLeft + viewWidth - 24) area.scrollLeft = left + width - viewWidth + 24
      }

      function onEditorScroll(event) {
        syncEditorScroll(event.currentTarget)
        if (intelHover) setIntelHover(null)
      }

      // The layer's tokens capture the pointer while ⌘ is held; a wheel over one
      // still belongs to the textarea.
      function onIntelWheel(event) {
        const area = editorRef.current
        if (!area) return
        area.scrollTop += event.deltaY
        area.scrollLeft += event.deltaX
        syncEditorScroll(area)
        if (intelHover) setIntelHover(null)
      }

      function focusFind() {
        const input = findInputRef.current
        if (!input) return
        input.focus()
        input.select()
      }

      function openFind() {
        if (findOpen) {
          focusFind()
          return
        }
        setFindOpen(true)
        setFindFocused(true)
      }

      function closeFind() {
        setFindOpen(false)
        setFindFocused(false)
        const area = editorRef.current
        if (area) area.focus()
      }

      function moveFind(delta) {
        const total = findResult.hits.length
        if (!total) return
        setFindIndex((value) => (value + delta + total) % total)
      }

      function onFindKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          closeFind()
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          moveFind(event.shiftKey ? -1 : 1)
        }
      }

      function clearIntelHover() {
        setIntelHover(null)
      }

      function intelKindLabel(kind) {
        return t('intel' + kind.charAt(0).toUpperCase() + kind.slice(1))
      }

      function onIntelEnter(event, segment) {
        if (!intel || !segment.navigable) return
        const declaration = resolveIntel(intel.index, segment.name, segment.start)
        if (!declaration) return
        const view = editorViewRef.current
        const box = event.currentTarget.getBoundingClientRect()
        const rect = view ? view.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 }
        const width = Math.max(0, rect.width)
        const height = Math.max(0, rect.height)
        const x = Math.max(8, Math.min(box.left - rect.left, Math.max(8, width - 300)))
        let y = box.bottom - rect.top + 6
        if (y + 92 > height) y = Math.max(6, box.top - rect.top - 92)
        setIntelHover({
          name: segment.name,
          kind: declaration.kind,
          line: declaration.line,
          source: declaration.source,
          x: x,
          y: y,
        })
      }

      function onIntelDown(event, segment) {
        if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) return
        if (!intel || !segment.navigable) return
        const declaration = resolveIntel(intel.index, segment.name, segment.start)
        if (!declaration || declaration.offset === segment.start) return
        event.preventDefault()
        event.stopPropagation()
        jumpIntel(declaration.offset, true, segment.start)
      }

      function jumpIntel(offset, push, fromOffset) {
        const area = editorRef.current
        if (!area) return
        if (push) {
          // Where the click happened, not where the caret happened to be: the
          // click lands on the identifier layer, so the textarea never moves.
          const origin = typeof fromOffset === 'number' ? fromOffset : (area.selectionStart || 0)
          setNavStack((stack) => stack.concat({ offset: origin }))
        }
        area.focus()
        area.setSelectionRange(offset, offset)
        const line = lineOfOffset(draft, offset)
        area.scrollTop = Math.max(0, (line - 1) * EDITOR_LINE_HEIGHT - area.clientHeight / 2)
        trackActiveLine()
        syncEditorScroll(area)
        setIntelHover(null)
      }

      function navBack() {
        if (!navStack.length) return
        const last = navStack[navStack.length - 1]
        setNavStack((stack) => stack.slice(0, -1))
        jumpIntel(last.offset, false)
      }

      // Keep the back stack pointing at the same text while the draft is edited:
      // an insertion or deletion before a saved offset shifts it by the delta.
      function adjustNavStack(previous, next) {
        if (!previous || previous === next || !navStack.length) return
        let prefix = 0
        const max = Math.min(previous.length, next.length)
        while (prefix < max && previous.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix += 1
        const delta = next.length - previous.length
        if (!delta) return
        setNavStack((stack) => stack.map((entry) => (
          entry.offset > prefix ? { offset: Math.max(0, entry.offset + delta) } : entry
        )))
      }

      function onEditorKey(event) {
        const primary = event.metaKey || event.ctrlKey
        if (primary && event.key === '[') {
          event.preventDefault()
          event.stopPropagation()
          navBack()
          return
        }
        if (primary && event.key.toLowerCase() === 's') {
          event.preventDefault()
          event.stopPropagation()
          saveFile()
          return
        }
        if (primary && event.key.toLowerCase() === 'f') {
          event.preventDefault()
          event.stopPropagation()
          openFind()
          return
        }
        // Escape closes in-file search before it means "back to search".
        if (event.key === 'Escape' && findOpen) {
          event.preventDefault()
          event.stopPropagation()
          closeFind()
        }
      }

      function modeButton(next, label) {
        return h('button', {
          type: 'button',
          role: 'tab',
          'aria-selected': mode === next ? 'true' : 'false',
          'data-dff-mode': next,
          className: 'dff-mode-tab',
          onClick: () => { setMode(next); setQuery(''); setResults([]); setError(''); setNotice('') },
        }, label)
      }

      function message() {
        const cut = view === 'search' && truncated
        if (!error && !cut && !notice) return null
        const text = error || (cut ? t('truncated') : notice)
        return h('p', {
          className: error ? 'dff-msg is-error' : (notice && !cut ? 'dff-msg is-note' : 'dff-msg'),
        }, error ? h(WarningIcon, { size: 13, className: 'dff-msg-icon' }) : null, text)
      }

      function resultRow(item, index) {
        const needle = query.trim()
        const isSelected = index === selected
        return h('button', {
          key: String(searchTick) + ':' + item.path + ':' + String(item.line) + ':' + String(index),
          type: 'button',
          role: 'option',
          id: 'dff-opt-' + String(index),
          'aria-selected': isSelected ? 'true' : 'false',
          'data-index': index,
          'data-dff-result': 'true',
          'data-selected': isSelected ? 'true' : 'false',
          tabIndex: -1,
          className: 'dff-result',
          title: mode === 'content' ? textOf(t, 'line', { line: item.line }) : item.path,
          onMouseEnter: () => setSelected(index),
          onClick: () => openPrimary(item),
          style: { animationDelay: Math.min(index, 8) * 12 + 'ms' },
        },
        h('span', { className: 'dff-result-rail', 'aria-hidden': 'true' }),
        h('span', { className: 'dff-result-glyph' }, h(FileGlyph, { name: item.name, size: 18 })),
        h('span', { className: 'dff-result-body' },
          h('span', { className: 'dff-result-line1' },
            h('span', { className: 'dff-result-name' }, mode === 'name' ? highlight(item.name, needle) : item.name),
            mode === 'content' ? h('span', { className: 'dff-result-sub' }, dirOf(relativePath(root, item.path)) || baseName(root)) : null,
            mode === 'content' ? h('span', { className: 'dff-line-badge' }, 'L' + String(item.line)) : null),
          h('span', { className: 'dff-result-line2' }, mode === 'content'
            ? highlight(item.preview, needle)
            : h('span', { className: 'dff-result-path' }, item.preview))),
        h('span', { className: 'dff-result-enter', 'aria-hidden': 'true' }, '↵'))
      }

      function browseMeta(item) {
        const relative = relativePath(root, item.path)
        return dirOf(relative) || t('browseRootHint')
      }

      function browseRow(item, index) {
        const isSelected = index === selected
        const folder = item.kind === 'dir'
        return h('button', {
          key: 'browse:' + item.path,
          type: 'button',
          role: 'option',
          id: 'dff-opt-' + String(index),
          'aria-selected': isSelected ? 'true' : 'false',
          'data-index': index,
          'data-dff-browse': 'true',
          'data-kind': item.kind,
          'data-path': item.path,
          'data-selected': isSelected ? 'true' : 'false',
          tabIndex: -1,
          className: 'dff-result dff-browse',
          title: item.path,
          onMouseEnter: () => setSelected(index),
          onClick: () => chooseBrowseRow(item),
        },
        h('span', { className: 'dff-result-rail', 'aria-hidden': 'true' }),
        h('span', { className: 'dff-result-glyph' },
          folder ? h(FolderIcon, { size: 18 }) : h(FileGlyph, { name: item.name, size: 18 })),
        h('span', { className: 'dff-result-body' },
          h('span', { className: 'dff-result-line1' },
            h('span', { className: 'dff-result-name' }, item.name)),
          h('span', { className: 'dff-result-line2' },
            h('span', { className: 'dff-result-path' }, browseMeta(item)))),
        h('span', { className: 'dff-browse-arrow', 'aria-hidden': 'true' }, folder ? '\u203a' : '\u21b5'))
      }

      function browseCrumbs() {
        const base = String(root || '').replace(/[\\/]+$/, '')
        const items = browseState.crumbs && browseState.crumbs.length
          ? browseState.crumbs
          : [{ label: baseName(base) || base, path: base }]
        const nodes = [h('span', { key: 'crumbs-glyph', className: 'dff-crumbs-glyph', 'aria-hidden': 'true' }, h(FolderIcon, { size: 13 }))]
        items.forEach((item, index) => {
          if (index) nodes.push(h('span', { key: 'sep:' + String(index), className: 'dff-crumb-sep', 'aria-hidden': 'true' }, '/'))
          nodes.push(h('button', {
            key: 'crumb:' + String(index),
            type: 'button',
            className: 'dff-crumb' + (index === items.length - 1 ? ' is-current' : ''),
            'data-dff-crumb': item.path || 'root',
            title: item.path || base,
            onClick: () => {
              setBrowsePath(item.path || base)
              setSelected(0)
              if (inputRef.current) inputRef.current.focus()
            },
          }, item.label))
        })
        return h('div', { className: 'dff-crumbs', 'data-dff-crumbs': 'true' }, nodes)
      }

      function searchView() {
        const needle = query.trim()
        const idle = !needle && !busy && !browsing
        const short = mode === 'content' && needle.length === 1
        return h('div', { className: 'dff-view', key: 'search' },
          h('div', { className: 'dff-head' },
            h('div', {
              className: 'dff-mode',
              role: 'tablist',
              'data-mode': mode,
              'aria-label': t('title'),
              onKeyDown: (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                const next = event.key === 'ArrowLeft' ? 'name' : 'content'
                if (next === mode) return
                setMode(next); setQuery(''); setResults([]); setError(''); setNotice('')
                if (inputRef.current) inputRef.current.focus()
              },
            },
              h('span', { className: 'dff-mode-pill', 'aria-hidden': 'true' }),
              modeButton('name', t('name')),
              modeButton('content', t('content'))),
            h('div', { className: 'dff-head-right' },
              h(RootPicker, {
                roots,
                value: root,
                onChange: (next) => { setRoot(next); setBrowsePath(''); setSelected(0) },
                t,
              }),
              h('button', { type: 'button', className: 'dff-icon-btn', 'aria-label': t('close'), onClick: closePanel }, h(CloseIcon, { size: 16 })))),
          h('div', { className: 'dff-search' },
            h('span', { className: 'dff-search-glyph', 'aria-hidden': 'true' }, h(SearchIcon, { size: 17 })),
            h('input', {
              ref: inputRef,
              className: 'dff-input',
              'data-dff-input': 'true',
              autoFocus: true,
              value: query,
              placeholder: browsing
                ? t('browsePlaceholder')
                : mode === 'content' ? t('contentPlaceholder') : t('namePlaceholder'),
              spellCheck: false,
              autoComplete: 'off',
              autoCorrect: 'off',
              autoCapitalize: 'off',
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: onSearchKey,
              role: 'combobox',
              'aria-expanded': 'true',
              'aria-controls': 'dff-list',
              'aria-autocomplete': 'list',
              'aria-activedescendant': rows.length && rows[selected] ? 'dff-opt-' + String(selected) : undefined,
            }),
            query ? h('button', {
              type: 'button', className: 'dff-clear', 'aria-label': t('clear'),
              onClick: () => { setQuery(''); setResults([]); if (inputRef.current) inputRef.current.focus() },
            }, h(CloseIcon, { size: 12 })) : null,
            busy || (browsing && browseState.loading)
              ? h('span', { className: 'dff-search-tail' }, h(Spinner, { size: 14 }))
              : flat.length && !browsing
                ? h('span', { className: 'dff-count', 'aria-label': textOf(t, 'resultCount', { count: flat.length }) }, String(flat.length))
                : null),
          busy || (browsing && browseState.loading) ? h('span', { className: 'dff-progress', 'aria-hidden': 'true' }, h('span', { className: 'dff-progress-bar' })) : null,
          h('span', { className: 'dff-sr', role: 'status', 'aria-live': 'polite' },
            busy ? t('searching')
              : browsing ? textOf(t, 'browseCount', { count: rows.length })
                : flat.length ? textOf(t, 'resultCount', { count: flat.length }) : (needle ? t('noResult') : '')),
          browsing ? browseCrumbs() : null,
          message(),
          h('div', { className: 'dff-list', id: 'dff-list', role: 'listbox', 'data-dff-list': 'true', 'aria-busy': busy || (browsing && browseState.loading) ? 'true' : 'false' },
            browsing
              ? browseState.error
                ? h('div', { className: 'dff-empty', 'data-dff-browse-error': 'true' },
                  h('span', { className: 'dff-empty-glyph' }, h(WarningIcon, { size: 20 })),
                  h('strong', null, t('browseFailed')),
                  h('span', null, browseState.error))
                : browseState.loading && !rows.length
                  ? skeletonRows(4)
                  : rows.length
                    ? [
                      ...rows.map((item, index) => browseRow(item, index)),
                      browseState.truncated
                        ? h('div', { key: 'truncated', className: 'dff-browse-note', 'data-dff-browse-truncated': 'true' },
                          h(WarningIcon, { size: 12 }), textOf(t, 'browseTruncated', { count: rows.length }))
                        : null,
                    ]
                    : h('div', { className: 'dff-empty', 'data-dff-browse-empty': 'true' },
                      h('span', { className: 'dff-empty-glyph' }, h(FolderIcon, { size: 20 })),
                      h('strong', null, t('browseEmpty')),
                      h('span', null, t('browseEmptyHint')))
              : flat.length
                ? flat.map((item, index) => resultRow(item, index))
                : busy
                  ? skeletonRows(3)
                  : h('div', { className: 'dff-empty' },
                    h('span', { className: 'dff-empty-glyph' }, !root ? h(FolderIcon, { size: 20 }) : short ? h(EditIcon, { size: 18 }) : h(SearchIcon, { size: 20 })),
                    h('strong', null, !root ? t('noRoot') : short ? t('contentShort') : idle ? t('idleTitle') : t('noResult')),
                    h('span', null, !root ? t('noRootHint') : short ? t('contentShortHint') : idle ? t('idleHint') : t('noResultHint')))),
          h('div', { className: 'dff-foot' },
            h('span', { className: 'dff-hints' },
              h('span', { className: 'dff-hint' }, h(Keycaps, { keys: ['↑', '↓'] }), t('hintNavigate')),
              h('span', { className: 'dff-hint' },
                h(Keycaps, { keys: ['↵'] }),
                prefsState.openMode === 'preview' ? t('preview') : t('edit')),
              h('span', { className: 'dff-hint' },
                h(Keycaps, { keys: mac ? ['⌘', '↵'] : ['Ctrl', '↵'] }),
                prefsState.openMode === 'preview' ? t('edit') : t('preview')),
              browsing && browseState.parent && browseState.parent !== (browseState.path || root)
                ? h('span', { className: 'dff-hint' }, h(Keycaps, { keys: ['⌫'] }), t('browseUp'))
                : null,
              h('span', { className: 'dff-hint' }, h(Keycaps, { keys: ['esc'] }), t('hintClose'))),
            h('span', { className: 'dff-rootpath', title: root }, h(FolderIcon, { size: 12 }), h('span', { className: 'dff-rootpath-text' }, h('bdi', null, root)))))
      }


      // ── Built-in viewer ──────────────────────────────────────────────────
      function switchToEditor() {
        if (!file || typeof file.text !== 'string' || !file.text) return
        setFile({ ...file, kind: 'text' })
        setDraft(file.text)
        setFindOpen(false)
        setFindQuery('')
        setFindIndex(0)
      }

      // Links inside a rendered Markdown file: keep external ones to the browser
      // and route workspace-relative ones back through the viewer.
      function onMarkdownClick(event) {
        const anchor = event.target && typeof event.target.closest === 'function'
          ? event.target.closest('a')
          : null
        if (!anchor || !file) return
        const href = anchor.getAttribute('href') || ''
        if (/^(?:https?:|mailto:)/i.test(href)) return
        event.preventDefault()
        const relative = normalizeRelative(dirOf(relativePath(root, file.path)), href)
        if (!relative) return
        openEditor({ path: root.replace(/\/+$/, '') + '/' + relative, line: 1 })
      }

      function viewerBody(kind) {
        const name = file ? baseName(file.path) : ''
        const src = file ? rawUrlFor(root, file.path) : ''
        if (kind === 'image') {
          return h('div', { className: 'dff-media', 'data-dff-viewer': 'image' },
            h('img', { className: 'dff-media-image', src, alt: name, draggable: false }))
        }
        if (kind === 'video') {
          return h('div', { className: 'dff-media is-dark', 'data-dff-viewer': 'video' },
            h('video', { className: 'dff-media-video', src, controls: true, preload: 'metadata', playsInline: true }))
        }
        if (kind === 'audio') {
          return h('div', { className: 'dff-media dff-media-audio', 'data-dff-viewer': 'audio' },
            h('audio', { src, controls: true, preload: 'metadata' }))
        }
        if (kind === 'pdf') {
          return h('iframe', { className: 'dff-frame', src, title: name, 'data-dff-viewer': 'pdf' })
        }
        if (kind === 'html') {
          return h('div', { className: 'dff-frame-wrap', 'data-dff-viewer': 'html' },
            h('iframe', {
              className: 'dff-frame',
              src,
              title: name,
              sandbox: 'allow-scripts',
              referrerPolicy: 'no-referrer',
            }),
            h('span', { className: 'dff-frame-note' }, t('previewHtmlNote')))
        }
        if (kind === 'markdown') {
          const source = file && typeof file.text === 'string' ? file.text : ''
          if (!source) return viewerEmpty()
          return h('div', { className: 'dff-doc-wrap', 'data-dff-viewer': 'markdown' },
            MarkdownText
              ? h('div', { className: 'dff-markdown', onClickCapture: onMarkdownClick },
                h(MarkdownText, { text: rewriteMarkdownAssets(source, root, file.path), variant: 'body' }))
              : h('pre', { className: 'dff-markdown-fallback' }, source))
        }
        return viewerEmpty()
      }

      function viewerEmpty() {
        return h('div', { className: 'dff-viewer-empty' },
          h(WarningIcon, { size: 22, className: 'dff-viewer-empty-icon' }),
          h('strong', null, t('previewUnsupported')),
          h('p', null, t('previewUnsupportedHint')))
      }

      function viewerView() {
        const name = file ? baseName(file.path) : t('title')
        const kind = file && file.kind ? file.kind : 'binary'
        const canEdit = Boolean(file && typeof file.text === 'string' && file.text.length > 0
          && (kind === 'markdown' || kind === 'html'))
        return h('div', { className: 'dff-view', key: 'viewer' },
          h('div', { className: 'dff-head dff-head-editor' },
            h('button', {
              type: 'button', className: 'dff-icon-btn', 'aria-label': t('back'),
              onClick: leaveEditor,
            }, h(BackIcon, { size: 16 })),
            h('span', { className: 'dff-editor-glyph' }, h(FileGlyph, { name, size: 20 })),
            h('span', { className: 'dff-editor-title' },
              h('strong', null, name),
              h('small', { title: file ? file.path : '' }, h('bdi', null, file ? (dirOf(relativePath(root, file.path)) || baseName(root) || parentOf(file.path)) : ''))),
            h('span', { className: 'dff-editor-state', 'data-state': 'readonly' },
              h('span', { className: 'dff-dot', 'aria-hidden': 'true' }),
              kind === 'binary' ? t('unpreviewable') : t('readOnly')),
            h('div', { className: 'dff-editor-actions' },
              canEdit ? h('button', {
                type: 'button', className: 'dff-ghost-btn', disabled: busy, onClick: switchToEditor,
              }, t('editText')) : null,
              h('button', { type: 'button', className: 'dff-icon-btn', 'aria-label': t('openInSidebar'), title: t('openInSidebar'), disabled: busy, onClick: previewCurrent }, h(SidebarIcon, { size: 16 })),
              h('button', { type: 'button', className: 'dff-icon-btn', 'aria-label': t('reload'), title: t('reload'), disabled: busy, onClick: reloadFile }, h(RefreshIcon, { size: 15 })),
              h('button', { type: 'button', className: 'dff-icon-btn', 'aria-label': t('close'), onClick: closePanel }, h(CloseIcon, { size: 16 })))),
          message(),
          h('div', { className: 'dff-viewer-body' },
            h('div', { className: 'dff-editor-meta dff-viewer-meta' },
              h('span', { className: 'dff-editor-path', title: file ? file.path : '' }, h('bdi', null, file ? file.path : '')),
              h('span', { className: 'dff-editor-stats' },
                file && file.bytes ? h('span', null, bytesText(file.bytes)) : null,
                h('span', null, t('kind' + (kind.charAt(0).toUpperCase() + kind.slice(1)))))),
            viewerBody(kind)))
      }

      function editorView() {
        const name = file ? baseName(file.path) : t('title')
        const state = dirty ? 'dirty' : status === t('conflict') ? 'conflict' : 'saved'
        return h('div', { className: 'dff-view', key: 'editor', ref: editorViewRef },
          h('div', { className: 'dff-head dff-head-editor' },
            h('button', {
              type: 'button', className: 'dff-icon-btn', 'aria-label': t('back'),
              onClick: leaveEditor,
            }, h(BackIcon, { size: 16 })),
            h('span', { className: 'dff-editor-glyph' }, h(FileGlyph, { name, size: 20 })),
            h('span', { className: 'dff-editor-title' },
              h('strong', null, name),
              h('small', { title: file ? file.path : '' }, h('bdi', null, file ? (dirOf(relativePath(root, file.path)) || baseName(root) || parentOf(file.path)) : ''))),
            h('span', { className: 'dff-editor-state', 'data-state': state },
              h('span', { className: 'dff-dot', 'aria-hidden': 'true' }),
              dirty ? t('dirty') : status === t('conflict') ? t('conflict') : status === t('saving') ? t('saving') : t('saved')),
            h('div', { className: 'dff-editor-actions' },
              navStack.length ? h('button', {
                type: 'button', className: 'dff-icon-btn', 'data-dff-nav-back': 'true',
                'aria-label': t('navBack'), title: t('navBack'), onClick: navBack,
              }, h(BackIcon, { size: 16 })) : null,
              h('button', { type: 'button', className: 'dff-icon-btn', 'aria-label': t('openInSidebar'), title: t('openInSidebar'), disabled: busy, onClick: previewCurrent }, h(SidebarIcon, { size: 16 })),
              h('button', { type: 'button', className: 'dff-icon-btn', 'aria-label': t('reload'), title: t('reload'), disabled: busy, onClick: reloadFile }, h(RefreshIcon, { size: 15 })),
              h('button', { type: 'button', className: 'dff-save', disabled: busy || !dirty, onClick: saveFile },
                h(CheckIcon, { size: 14 }), busy ? t('saving') : t('save')),
              h('button', { type: 'button', className: 'dff-icon-btn', 'aria-label': t('close'), onClick: closePanel }, h(CloseIcon, { size: 16 })))),
          confirmAction ? h('div', { className: 'dff-banner is-warn' },
            h(WarningIcon, { size: 14, className: 'dff-banner-icon' }),
            h('span', { className: 'dff-banner-text' }, t(
              confirmAction === 'back' ? 'confirmBack'
                : confirmAction === 'reload' ? 'confirmReload'
                  : 'confirmClose',
            )),
            h('button', { type: 'button', className: 'dff-banner-btn', onClick: () => setConfirmAction('') }, t('keep')),
            h('button', {
              type: 'button', className: 'dff-banner-btn is-danger',
              onClick: () => {
                if (confirmAction === 'back') {
                  setConfirmAction('')
                  setFile(null)
                  setDraft('')
                  setStatus('')
                  setView('search')
                  setNotice('')
                  return
                }
                if (confirmAction === 'reload') {
                  const target = file
                  setConfirmAction('')
                  setNotice('')
                  if (target) openEditor({ path: target.path, line: target.line })
                  return
                }
                store.close()
              },
            }, t(
              confirmAction === 'back' ? 'discardBack'
                : confirmAction === 'reload' ? 'discardReload'
                  : 'discard',
            ))) : null,
          message(),
          h('div', { className: 'dff-editor-body' },
            h('div', { className: 'dff-editor-meta' },
              h('span', { className: 'dff-editor-path', title: file ? file.path : '' }, h('bdi', null, file ? file.path : '')),
              h('span', { className: 'dff-editor-stats' },
                lineCount ? h('span', null, textOf(t, 'lines', { count: lineCount })) : null,
                file && file.bytes ? h('span', null, bytesText(file.bytes)) : null,
                tokenLanguage && draftBytes > TOKEN_MAX_BYTES
                  ? h('span', { className: 'dff-plain-chip', 'data-dff-plain': 'true', title: t('plainHint') }, t('plainText'))
                  : null,
                h('span', null, 'UTF-8'))),
            h('div', { className: 'dff-code', 'data-dff-code': 'true' },
              findOpen ? h('div', {
                className: 'dff-find', 'data-dff-find': 'true', role: 'search',
                onFocus: () => setFindFocused(true),
                onBlur: (event) => {
                  const next = event.relatedTarget
                  if (next && event.currentTarget.contains(next)) return
                  setFindFocused(false)
                },
              },
                h('input', {
                  ref: findInputRef,
                  className: 'dff-find-input',
                  type: 'text',
                  value: findQuery,
                  placeholder: t('findPlaceholder'),
                  spellCheck: false,
                  'aria-label': t('findPlaceholder'),
                  'data-dff-find-input': 'true',
                  onChange: (event) => { setFindQuery(event.target.value); setFindIndex(0) },
                  onKeyDown: onFindKey,
                }),
                h('span', {
                  className: 'dff-find-count',
                  'data-dff-find-count': 'true',
                  role: 'status',
                  'aria-live': 'polite',
                }, findQuery
                  ? (findResult.hits.length
                    ? String(findIndex + 1) + '/' + String(findResult.total) + (findResult.total > findResult.hits.length ? '+' : '')
                    : t('findNoResult'))
                  : ''),
                h('button', {
                  type: 'button', className: 'dff-find-btn', disabled: !findResult.hits.length,
                  'aria-label': t('findPrev'), title: t('findPrev'),
                  onClick: () => moveFind(-1),
                }, h(ChevronIcon, { size: 13, className: 'dff-find-up' })),
                h('button', {
                  type: 'button', className: 'dff-find-btn', disabled: !findResult.hits.length,
                  'aria-label': t('findNext'), title: t('findNext'),
                  onClick: () => moveFind(1),
                }, h(ChevronIcon, { size: 13 })),
                h('button', {
                  type: 'button', className: 'dff-find-btn dff-find-case', 'data-dff-find-case': 'true',
                  'aria-pressed': findCase ? 'true' : 'false',
                  'aria-label': t('findCase'), title: t('findCase'),
                  onClick: () => { setFindCase((value) => !value); setFindIndex(0) },
                }, 'Aa'),
                h('button', {
                  type: 'button', className: 'dff-find-btn',
                  'aria-label': t('findClose'), title: t('findClose'),
                  onClick: closeFind,
                }, h(CloseIcon, { size: 13 }))) : null,
              h('div', { className: 'dff-gutter', 'aria-hidden': 'true', style: { width: gutterWidth } },
                h('div', { ref: markerRef, className: 'dff-line-marker' }),
                h('pre', { ref: gutterRef, className: 'dff-gutter-inner', 'data-dff-gutter': 'true' }, gutterText)),
              h('div', { className: 'dff-code-pane' },
                tokenPainted ? h('pre', {
                  className: 'dff-token-layer', 'aria-hidden': 'true',
                  'data-dff-token-layer': 'true',
                },
                  h('code', { ref: tokenLayerRef, className: 'dff-token-inner' }, tokenSegments.map((segment, index) => (
                    segment.type
                      ? h('span', {
                        key: 'c' + String(index),
                        className: 'dff-tok dff-tok-' + segment.type,
                        'data-tok': segment.type,
                        'data-start': segment.start,
                      }, segment.text)
                      : segment.text
                  )))) : null,
                mirrorOn ? h('pre', {
                  className: 'dff-editor-mirror' + (tokenPainted ? ' is-tinted' : ''),
                  'aria-hidden': 'true',
                },
                  h('code', { ref: mirrorRef, className: 'dff-editor-mirror-inner' }, mirrorNodes)) : null,
                h('textarea', {
                  ref: editorRef,
                  className: 'dff-editor' + (mirrorOn ? ' is-mirrored' : tokenPainted ? ' is-tinted' : ''),
                  'data-dff-editor': 'true',
                  value: draft,
                  spellCheck: false,
                  wrap: 'off',
                  onChange: (event) => {
                    const value = event.target.value
                    adjustNavStack(draft, value)
                    setDraft(value)
                    trackActiveLine()
                  },
                  onKeyDown: onEditorKey,
                  onKeyUp: trackActiveLine,
                  onSelect: trackActiveLine,
                  onClick: trackActiveLine,
                  onScroll: onEditorScroll,
                  onCompositionStart: () => setComposing(true),
                  onCompositionEnd: () => setComposing(false),
                  'aria-label': file ? file.path : t('title'),
                }),
                intel ? h('pre', {
                  className: 'dff-intel-layer', 'aria-hidden': 'true', 'data-dff-intel-layer': 'true',
                  onWheel: onIntelWheel,
                },
                  h('code', { ref: intelLayerRef, className: 'dff-intel-inner' },
                    intel.segments.map((segment, index) => segment.name
                      ? h('span', {
                        key: 'i' + String(index),
                        className: segment.navigable ? 'dff-intel-token is-navigable' : 'dff-intel-token',
                        'data-name': segment.name,
                        'data-start': segment.start,
                        onMouseEnter: (event) => onIntelEnter(event, segment),
                        onMouseLeave: clearIntelHover,
                        onMouseDown: (event) => onIntelDown(event, segment),
                      }, segment.text)
                      : segment.text))) : null))),
          intelHover ? h('div', {
            className: 'dff-intel-tip', 'data-dff-intel-tip': 'true',
            style: { left: intelHover.x + 'px', top: intelHover.y + 'px' },
          },
            h('span', { className: 'dff-intel-kind' }, intelKindLabel(intelHover.kind)),
            h('strong', null, intelHover.name),
            intelHover.source ? h('code', null, intelHover.source) : null,
            h('span', { className: 'dff-intel-line' }, textOf(t, 'intelDefinition', { line: intelHover.line }))) : null,
          h('div', { className: 'dff-foot' },
            h('span', { className: 'dff-hints' },
              h('span', { className: 'dff-hint' }, h(Keycaps, { keys: mac ? ['⌘', 'S'] : ['Ctrl', 'S'] }), t('hintSave')),
              h('span', { className: 'dff-hint' }, h(Keycaps, { keys: mac ? ['⌘', 'F'] : ['Ctrl', 'F'] }), t('hintFind')),
              h('span', { className: 'dff-hint' }, h(Keycaps, { keys: ['esc'] }), t('hintEditorBack'))),
            h('span', { className: 'dff-rootpath', title: file ? file.path : '' }, h(FolderIcon, { size: 12 }), h('span', { className: 'dff-rootpath-text' }, h('bdi', null, file ? parentOf(file.path) : '')))))
      }

      return h('div', {
        key: 'overlay-' + String(request.token),
        className: 'dff-overlay',
        'data-state': presence.closing ? 'closing' : 'open',
        onMouseDown: (event) => { if (event.target === event.currentTarget) closePanel() },
      },
      h('div', {
        className: 'dff-scrim',
        'aria-hidden': 'true',
        onMouseDown: (event) => { if (event.target === event.currentTarget) closePanel() },
      }),
      h('style', null, css),
      h('section', {
        ref: panelRef,
        className: view === 'editor' ? 'dff-panel dff-panel-editor' : 'dff-panel',
        'data-dff-palette': 'true',
        'data-view': view,
        tabIndex: -1,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('title'),
        onKeyDown: onPanelKey,
      }, view === 'search' ? searchView() : file && file.kind && file.kind !== 'text' ? viewerView() : editorView()))
    }

    function SettingsPage(props) {
      const t = props.t
      const ctx = props.ctx
      const current = useSyncExternalStore(prefs.subscribe, prefs.snapshot, prefs.snapshot)
      const [draft, setDraft] = useState(current)
      const [savedAt, setSavedAt] = useState(0)
      const [resetAt, setResetAt] = useState(0)
      const saveTimer = useRef(0)
      const mac = useMemo(isMac, [])
      const workspace = sessionOf(ctx)
      useEffect(() => { setDraft(current) }, [current])
      useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])
      function update(patch) {
        const next = { ...draft, ...patch }
        setDraft(next)
        prefs.save(next)
        setSavedAt(Date.now())
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => setSavedAt(0), 1600)
      }
      function reset() {
        const next = { ...DEFAULTS }
        setDraft(next)
        prefs.save(next)
        setResetAt(Date.now())
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => { setSavedAt(0); setResetAt(0) }, 1600)
      }
      const ignores = useMemo(() => {
        const seen = new Set()
        return String(draft.extraIgnore || '')
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter((item) => item && !item.includes('/') && !item.includes('\\'))
          .filter((item) => (seen.has(item) ? false : (seen.add(item), true)))
          .slice(0, 40)
      }, [draft.extraIgnore])
      const shortcutName = mac ? ['⌘', 'P'] : ['Ctrl', 'P']
      const shortcutContent = mac ? ['⇧', '⌘', 'F'] : ['Ctrl', 'Shift', 'F']
      const shortcutBot = mac ? ['⇧', '⌘', 'B'] : ['Ctrl', 'Shift', 'B']
      // Shown only while DS Bot is part of this boot; `detect()` caches the answer.
      const botInstalled = botBridge.detect()

      return h('div', { className: 'dff-settings', 'data-dff-settings': 'true' },
        h('style', null, css),
        h('header', { className: 'dff-intro' },
          h('div', { className: 'dff-intro-text' },
            h('h2', { className: 'dff-intro-title' }, t('settingsTitle')),
            h('p', { className: 'dff-intro-lead' }, t('settingsLead'))),
          h('div', { className: 'dff-intro-side' },
            h('span', {
              className: 'dff-autosave',
              'data-on': savedAt || resetAt ? 'true' : 'false',
              role: 'status',
              'aria-live': 'polite',
            }, h(CheckIcon, { size: 12 }), resetAt ? t('resetDone') : t('savedPrefs')))),
        h('div', { className: 'dff-workspace' },
          h(FolderIcon, { size: 14, className: 'dff-workspace-icon' }),
          h('span', { className: 'dff-workspace-label' }, t('settingsWorkspace')),
          h('code', { className: 'dff-workspace-path', title: workspace.cwd }, h('bdi', null, workspace.cwd || t('noWorkspace')))),

        h('section', { className: 'dff-card', style: { '--i': 0 } },
          h('div', { className: 'dff-card-head' },
            h('h3', null, t('settingsShortcuts')),
            h('p', null, t('settingsBody'))),
          h('div', { className: 'dff-card-body' },
            shortcutRow(t('shortcutName'), shortcutName, 'name'),
            shortcutRow(t('shortcutContent'), shortcutContent, 'content'))),

        h('section', { className: 'dff-card', style: { '--i': 1 } },
          h('div', { className: 'dff-card-head' },
            h('h3', null, t('settingsSearch')),
            h('p', null, t('settingsSearchHint'))),
          h('div', { className: 'dff-card-body' },
            h('div', { className: 'dff-srow' },
              h('div', { className: 'dff-srow-text' },
                h('strong', null, t('caseSensitive')),
                h('small', null, t('caseSensitiveHint'))),
              h(Toggle, {
                checked: draft.caseSensitive,
                label: t('caseSensitive'),
                onChange: (value) => update({ caseSensitive: value }),
              })),
            h('div', { className: 'dff-srow dff-srow-stack' },
              h('div', { className: 'dff-srow-text' },
                h('strong', null, t('extraIgnore')),
                h('small', null, t('extraIgnoreHint'))),
              h('div', { className: 'dff-srow-control' },
                h('input', {
                  className: 'dff-text-input',
                  value: draft.extraIgnore,
                  placeholder: 'tmp, coverage',
                  spellCheck: false,
                  'aria-label': t('extraIgnore'),
                  onChange: (event) => update({ extraIgnore: event.target.value }),
                }),
                ignores.length ? h('span', { className: 'dff-chips' }, ignores.slice(0, 8).map((item) => h('span', { key: item, className: 'dff-chip' }, item)), ignores.length > 8 ? h('span', { className: 'dff-chip is-more' }, '+' + String(ignores.length - 8)) : null) : null)),
            h('div', { className: 'dff-srow' },
              h('div', { className: 'dff-srow-text' },
                h('strong', null, t('nameLimit')),
                h('small', null, t('nameLimitHint'))),
              h(Stepper, {
                value: draft.nameLimit, min: 5, max: 100, label: t('nameLimit'),
                decreaseLabel: t('decrease'), increaseLabel: t('increase'),
                onChange: (value) => update({ nameLimit: value }),
              })),
            h('div', { className: 'dff-srow' },
              h('div', { className: 'dff-srow-text' },
                h('strong', null, t('contentLimit')),
                h('small', null, t('contentLimitHint'))),
              h(Stepper, {
                value: draft.contentLimit, min: 5, max: 200, label: t('contentLimit'),
                decreaseLabel: t('decrease'), increaseLabel: t('increase'),
                onChange: (value) => update({ contentLimit: value }),
              })))),

        h('section', { className: 'dff-card', style: { '--i': 2 } },
          h('div', { className: 'dff-card-head' },
            h('h3', null, t('settingsOpen')),
            h('p', null, draft.openMode === 'preview' ? t('openModePreviewHint') : t('openModeEditorHint'))),
          h('div', { className: 'dff-card-body' },
            h('div', { className: 'dff-srow' },
              h('div', { className: 'dff-srow-text' },
                h('strong', null, t('defaultAction')),
                h('small', null, t('openModeRowHint'))),
              h(Segmented, {
                value: draft.openMode,
                label: t('settingsOpen'),
                options: [
                  { value: 'preview', label: t('openModePreview') },
                  { value: 'editor', label: t('openModeEditor') },
                ],
                onChange: (value) => update({ openMode: value }),
              })))),

        botInstalled ? h('section', { className: 'dff-card', style: { '--i': 3 }, 'data-dff-bot': 'true' },
          h('div', { className: 'dff-card-head' },
            h('h3', null, t('settingsBot')),
            h('p', null, t('settingsBotHint'))),
          h('div', { className: 'dff-card-body' },
            h('div', { className: 'dff-srow' },
              h('div', { className: 'dff-srow-text' },
                h('strong', null, t('shortcutBot')),
                h(Keycaps, { keys: shortcutBot })),
              h('button', {
                type: 'button', className: 'dff-try',
                onClick: () => { if (props.close) props.close(); botBridge.toggle() },
              }, t('tryIt'))))) : null,

        h('footer', { className: 'dff-settings-foot' },
          h('button', { type: 'button', className: 'dff-reset', onClick: reset }, t('reset')),
          h('span', { className: 'dff-settings-note' }, t('autosave'))))

      function shortcutRow(label, keys, mode) {
        return h('div', { className: 'dff-srow' },
          h('div', { className: 'dff-srow-text' },
            h('strong', null, label),
            h(Keycaps, { keys })),
          h('button', {
            type: 'button', className: 'dff-try',
            onClick: () => { if (props.close) props.close(); store.openSearch(mode) },
          }, t('tryIt')))
      }
    }

    const css = `
      /* ── Surfaces ─────────────────────────────────────────────────────── */
      .dff-overlay {
        position: fixed; inset: 0; z-index: 60;
        display: flex; align-items: flex-start; justify-content: center;
        padding: 11vh 24px 24px;
        font-family: inherit; color: var(--dsw-alias-label-primary);
        -webkit-font-smoothing: antialiased;
      }
      .dff-scrim {
        position: absolute; inset: 0;
        background: var(--dsw-alias-bg-mask-2);
        -webkit-backdrop-filter: blur(7px) saturate(1.05);
        backdrop-filter: blur(7px) saturate(1.05);
        opacity: 0;
      }
      .dff-overlay[data-state="open"] .dff-scrim { animation: dff-fade 180ms ease-out both; }
      .dff-overlay[data-state="closing"] .dff-scrim { animation: dff-fade-out 140ms ease-in both; }

      .dff-panel {
        position: relative;
        display: flex; flex-direction: column;
        width: min(720px, 100%);
        max-height: min(64vh, 620px);
        overflow: hidden;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 18px;
        background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, transparent);
        -webkit-backdrop-filter: blur(28px) saturate(1.25);
        backdrop-filter: blur(28px) saturate(1.25);
        box-shadow:
          inset 0 1px 0 color-mix(in srgb, #ffffff 55%, transparent),
          0 1px 2px color-mix(in srgb, #0f1115 6%, transparent),
          0 18px 48px -12px color-mix(in srgb, #0f1115 24%, transparent),
          0 2px 10px color-mix(in srgb, #0f1115 6%, transparent);
        transition: width 240ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .dff-panel::before {
        content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
        border-radius: inherit;
        background: radial-gradient(120% 90% at 8% -20%,
          color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent), transparent 55%);
      }
      .dff-panel > * { position: relative; z-index: 1; }
      .dff-panel-editor { width: min(980px, 100%); height: min(78vh, 780px); max-height: min(78vh, 780px); }
      .dff-overlay[data-state="open"] .dff-panel { animation: dff-pop 260ms cubic-bezier(0.16, 1, 0.3, 1) both; }
      .dff-overlay[data-state="closing"] .dff-panel { animation: dff-pop-out 140ms cubic-bezier(0.4, 0, 1, 1) both; }

      body[data-ds-dark-theme] .dff-panel {
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.06),
          0 2px 6px rgba(0, 0, 0, 0.32),
          0 24px 64px -12px rgba(0, 0, 0, 0.55);
      }

      .dff-view { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; animation: dff-view-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both; }

      /* ── Header ───────────────────────────────────────────────────────── */
      .dff-head {
        display: flex; align-items: center; gap: 10px;
        flex: none; height: 54px; padding: 0 10px 0 14px;
        border-bottom: 1px solid var(--dsw-alias-border-l1);
      }
      .dff-head-right { display: flex; align-items: center; gap: 6px; margin-left: auto; min-width: 0; }

      .dff-mode {
        position: relative; display: grid; grid-template-columns: 1fr 1fr;
        width: 170px; padding: 3px; border-radius: 11px;
        background: var(--dsw-alias-bg-module-platform);
      }
      .dff-mode-pill {
        position: absolute; top: 3px; left: 3px;
        width: calc(50% - 3px); height: calc(100% - 6px);
        border-radius: 8px;
        background: var(--dsw-alias-bg-layer-1);
        box-shadow: 0 1px 2px color-mix(in srgb, #0f1115 10%, transparent), 0 0 0 0.5px var(--dsw-alias-border-l2);
        transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .dff-mode[data-mode="content"] .dff-mode-pill { transform: translateX(100%); }
      .dff-mode-tab {
        position: relative; z-index: 1;
        height: 30px; padding: 0 8px; border: 0; border-radius: 8px;
        background: transparent; color: var(--dsw-alias-label-tertiary);
        font: inherit; font-size: 13px; line-height: 30px; letter-spacing: 0.01em;
        cursor: pointer; white-space: nowrap;
        transition: color 180ms ease;
      }
      .dff-mode-tab[aria-selected="true"] { color: var(--dsw-alias-label-primary); }
      .dff-mode-tab:hover { color: var(--dsw-alias-label-primary); }
      .dff-mode-tab:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 1px; }

      .dff-root-wrap { position: relative; min-width: 0; }
      .dff-root {
        display: inline-flex; align-items: center; gap: 6px;
        height: 30px; min-width: 0; max-width: 210px;
        padding: 0 9px; border: 1px solid transparent; border-radius: 9px;
        background: transparent; color: var(--dsw-alias-label-secondary);
        font: inherit; font-size: 12px; line-height: 18px; cursor: pointer;
        transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
      }
      .dff-root-static { cursor: default; }
      .dff-root:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .dff-root:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 1px; }
      .dff-root-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dff-root-chevron { flex: none; opacity: 0.7; }

      .dff-menu {
        position: absolute; top: calc(100% + 7px); right: 0; z-index: 6;
        width: min(340px, 62vw); max-height: 300px; overflow: auto;
        padding: 5px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
        background: var(--dsw-alias-bg-layer-1);
        box-shadow: 0 12px 32px -8px color-mix(in srgb, #0f1115 28%, transparent), 0 2px 6px color-mix(in srgb, #0f1115 8%, transparent);
        animation: dff-menu-in 150ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .dff-menu-item {
        display: grid; grid-template-columns: 16px minmax(0, 1fr) 16px; align-items: center;
        gap: 7px; width: 100%; padding: 7px 8px; border: 0; border-radius: 8px;
        background: transparent; color: inherit; text-align: left; font: inherit; cursor: pointer;
      }
      .dff-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dff-menu-item.is-selected { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent); }
      .dff-menu-item:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: -1px; }
      .dff-menu-icon { color: var(--dsw-alias-label-tertiary); }
      .dff-menu-label { font-size: 12.5px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dff-menu-path { grid-column: 2; font-size: 11px; line-height: 15px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dff-menu-check { grid-column: 3; grid-row: 1; color: var(--dsw-alias-state-business-primary); }

      .dff-icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        flex: none; width: 30px; height: 30px; padding: 0;
        border: 0; border-radius: 9px; background: transparent;
        color: var(--dsw-alias-label-secondary); cursor: pointer;
        transition: background 150ms ease, color 150ms ease, opacity 150ms ease;
      }
      .dff-icon-btn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .dff-icon-btn:active { background: var(--dsw-alias-interactive-bg-active); }
      .dff-icon-btn:disabled { opacity: 0.35; cursor: default; }
      .dff-icon-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 1px; }

      /* ── Search field ─────────────────────────────────────────────────── */
      .dff-search {
        position: relative;
        display: flex; align-items: center; gap: 9px;
        flex: none; height: 48px; margin: 12px 12px 4px; padding: 0 12px;
        border: 1px solid transparent; border-radius: 12px;
        background: var(--dsw-alias-bg-module-platform);
        transition: background 180ms ease, box-shadow 200ms ease, border-color 180ms ease;
      }
      .dff-search:focus-within {
        border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 34%, transparent);
        background: var(--dsw-alias-bg-layer-1);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary) 9%, transparent);
      }
      .dff-search-glyph { display: flex; flex: none; color: var(--dsw-alias-label-tertiary); transition: color 180ms ease; }
      .dff-search:focus-within .dff-search-glyph { color: var(--dsw-alias-label-secondary); }
      .dff-input {
        flex: 1; min-width: 0; height: 100%;
        border: 0; outline: 0; background: transparent;
        color: var(--dsw-alias-label-primary);
        font: inherit; font-size: 14px; line-height: 22px; letter-spacing: 0.005em;
      }
      .dff-input::placeholder { color: var(--dsw-alias-label-tertiary); }
      .dff-clear {
        display: inline-flex; align-items: center; justify-content: center; flex: none;
        width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%;
        background: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary);
        cursor: pointer; transition: background 140ms ease, color 140ms ease;
      }
      .dff-clear:hover { background: var(--dsw-alias-border-l3); color: var(--dsw-alias-label-primary); }
      .dff-clear:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 1px; }
      .dff-search-tail { display: flex; flex: none; color: var(--dsw-alias-label-tertiary); }
      .dff-count {
        flex: none; min-width: 18px; text-align: right;
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums;
      }
      .dff-spin { display: inline-flex; animation: dff-rotate 900ms linear infinite; }

      .dff-progress {
        position: relative; display: block; flex: none; height: 2px; margin: 2px 14px 0;
        overflow: hidden; border-radius: 2px; background: transparent;
      }
      .dff-progress-bar {
        position: absolute; inset: 0 auto 0 0; width: 38%;
        border-radius: 2px;
        background: linear-gradient(90deg, transparent,
          color-mix(in srgb, var(--dsw-alias-state-business-primary) 75%, transparent), transparent);
        animation: dff-indeterminate 1100ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }

      /* ── Messages ─────────────────────────────────────────────────────── */
      .dff-msg {
        display: flex; align-items: center; gap: 6px;
        margin: 8px 16px 0; color: var(--dsw-alias-label-tertiary);
        font-size: 12px; line-height: 18px;
        animation: dff-fade 160ms ease-out both;
      }
      .dff-msg.is-error { color: var(--dsw-alias-state-error-primary); }
      .dff-msg.is-note { color: var(--dsw-alias-state-business-primary); }
      .dff-msg-icon { flex: none; }

      /* ── Results ──────────────────────────────────────────────────────── */
      .dff-list {
        display: flex; flex-direction: column;
        flex: 1; min-height: 180px; overflow: auto;
        padding: 8px 6px 10px; overscroll-behavior: contain;
        scrollbar-gutter: stable;
      }
      .dff-result {
        position: relative;
        display: flex; align-items: center; gap: 10px;
        width: 100%; min-height: 46px; flex: none; padding: 6px 12px 6px 10px;
        border: 0; border-radius: 10px; background: transparent;
        color: inherit; font: inherit; text-align: left; cursor: pointer;
        animation: dff-row-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
        transition: background 130ms ease;
      }
      .dff-result:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dff-result[data-selected="true"] {
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, var(--dsw-alias-bg-layer-1));
      }
      .dff-result:active { transform: scale(0.998); }
      .dff-result:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: -2px; }
      .dff-result-rail {
        position: absolute; left: 3px; top: 12px; bottom: 12px; width: 2px;
        border-radius: 2px; background: var(--dsw-alias-state-business-primary);
        opacity: 0; transform: scaleY(0.4);
        transition: opacity 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .dff-result[data-selected="true"] .dff-result-rail { opacity: 1; transform: scaleY(1); }
      .dff-result-glyph {
        display: inline-flex; align-items: center; justify-content: center;
        flex: none; width: 26px; height: 26px;
      }
      .dff-result-body { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
      .dff-result-line1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .dff-result-name {
        flex: 0 1 auto;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: 13px; line-height: 19px; color: var(--dsw-alias-label-primary);
      }
      .dff-result-sub {
        flex: 1 1 auto; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px; line-height: 16px;
      }
      .dff-line-badge {
        flex: none; padding: 0 6px; border-radius: 999px;
        background: var(--dsw-alias-bg-module-platform);
        color: var(--dsw-alias-label-secondary);
        font-size: 10px; line-height: 16px; font-variant-numeric: tabular-nums;
      }
      .dff-result-line2 {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px; line-height: 17px;
      }
      .dff-result-path { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dff-result-dir { opacity: 0.92; }
      .dff-result-enter {
        flex: none; padding-left: 6px;
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px; opacity: 0;
        transform: translateX(-3px);
        transition: opacity 150ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .dff-result[data-selected="true"] .dff-result-enter { opacity: 0.85; transform: none; }
      .dff-hit {
        padding: 0 1px; border-radius: 3px;
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent);
        color: inherit;
        box-decoration-break: clone; -webkit-box-decoration-break: clone;
      }
      body[data-ds-dark-theme] .dff-hit { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 26%, transparent); }

      /* Fallback file chip when the host primitives are unavailable. */
      .dff-ftyp {
        display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px; border-radius: 7px;
        background: var(--dsw-alias-bg-module-platform);
        border: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-tertiary);
        font-size: 8.5px; font-weight: 600; letter-spacing: 0.03em;
      }
      .dff-ftyp[data-accent="blue"] { color: var(--dsw-static-blue-600); background: color-mix(in srgb, var(--dsw-static-blue-500) 10%, transparent); border-color: transparent; }
      .dff-ftyp[data-accent="amber"] { color: var(--dsw-static-amber-600); background: color-mix(in srgb, var(--dsw-static-amber-500) 12%, transparent); border-color: transparent; }
      .dff-ftyp[data-accent="green"] { color: var(--dsw-static-green-500); background: color-mix(in srgb, var(--dsw-static-green-500) 11%, transparent); border-color: transparent; }
      body[data-ds-dark-theme] .dff-ftyp[data-accent="blue"] { color: var(--dsw-static-blue-300); }
      body[data-ds-dark-theme] .dff-ftyp[data-accent="amber"] { color: var(--dsw-static-amber-400); }

      /* ── Empty & loading ──────────────────────────────────────────────── */
      /* ── Browse mode (empty query lists the directory) ─────────────────── */
      .dff-crumbs {
        display: flex; align-items: center; gap: 1px; flex: none;
        margin: 0 4px 6px; padding: 0;
        color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 18px;
        overflow: hidden; white-space: nowrap;
      }
      .dff-crumbs-glyph { display: inline-flex; margin-right: 5px; color: var(--dsw-alias-label-caption); }
      .dff-crumb {
        max-width: 190px; overflow: hidden; text-overflow: ellipsis;
        padding: 1px 5px; border: 0; border-radius: 5px; background: transparent;
        color: var(--dsw-alias-label-caption); font: inherit; font-size: 11px; cursor: pointer;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .dff-crumb:hover { background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-primary); }
      .dff-crumb.is-current { color: var(--dsw-alias-label-secondary); font-weight: 500; }
      .dff-crumb-sep { color: var(--dsw-alias-label-tertiary); opacity: 0.65; }
      .dff-browse-arrow { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 18px; }
      .dff-browse .dff-result-glyph { color: var(--dsw-alias-label-secondary); }
      .dff-browse-note {
        display: flex; align-items: center; gap: 6px;
        padding: 8px 10px 2px; color: var(--dsw-alias-label-tertiary); font-size: 11px;
      }

      .dff-empty {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 5px; flex: 1; min-height: 210px; padding: 36px 24px;
        color: var(--dsw-alias-label-tertiary); text-align: center;
        animation: dff-fade 220ms ease-out both;
      }
      .dff-empty-glyph {
        display: inline-flex; align-items: center; justify-content: center;
        width: 46px; height: 46px; margin-bottom: 6px;
        border-radius: 50%; background: var(--dsw-alias-bg-module-platform);
        color: var(--dsw-alias-label-tertiary);
      }
      .dff-empty strong { color: var(--dsw-alias-label-secondary); font-size: 13px; font-weight: 500; line-height: 20px; }
      .dff-empty span { font-size: 12px; line-height: 18px; }

      .dff-skeleton { padding: 4px 6px; }
      .dff-skeleton-row { display: flex; align-items: center; gap: 10px; padding: 8px 4px; animation: dff-fade 260ms ease-out both; }
      .dff-skeleton-glyph {
        flex: none; width: 24px; height: 24px; border-radius: 7px;
        background: linear-gradient(90deg, var(--dsw-alias-bg-skeleton) 25%, color-mix(in srgb, var(--dsw-alias-bg-skeleton) 40%, var(--dsw-alias-bg-layer-1)) 50%, var(--dsw-alias-bg-skeleton) 75%);
        background-size: 300% 100%; animation: dff-shimmer 1300ms ease-in-out infinite;
      }
      .dff-skeleton-body { display: flex; flex-direction: column; gap: 6px; flex: 1; }
      .dff-skeleton-name, .dff-skeleton-path {
        height: 9px; border-radius: 5px;
        background: linear-gradient(90deg, var(--dsw-alias-bg-skeleton) 25%, color-mix(in srgb, var(--dsw-alias-bg-skeleton) 40%, var(--dsw-alias-bg-layer-1)) 50%, var(--dsw-alias-bg-skeleton) 75%);
        background-size: 300% 100%; animation: dff-shimmer 1300ms ease-in-out infinite;
      }
      .dff-skeleton-name { width: 38%; animation-delay: 60ms; }
      .dff-skeleton-path { width: 64%; height: 7px; animation-delay: 110ms; }

      /* ── Footer ───────────────────────────────────────────────────────── */
      .dff-foot {
        display: flex; align-items: center; gap: 14px;
        flex: none; min-height: 38px; padding: 7px 14px;
        border-top: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-secondary);
        font-size: 11px; line-height: 16px;
      }
      .dff-hints { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; min-width: 0; }
      .dff-hint { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
      .dff-keys { display: inline-flex; align-items: center; gap: 2px; }
      .dff-key {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 4px;
        border: 1px solid var(--dsw-alias-border-l2); border-bottom-width: 2px;
        border-radius: 5px;
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-secondary);
        font-family: inherit; font-size: 10px; line-height: 14px; font-weight: 500;
        box-shadow: 0 1px 0 color-mix(in srgb, #0f1115 5%, transparent);
      }
      body[data-ds-dark-theme] .dff-key { background: var(--dsw-alias-bg-layer-2); box-shadow: none; }
      .dff-rootpath {
        display: inline-flex; align-items: center; gap: 5px;
        margin-left: auto; max-width: 44%; min-width: 0;
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
      }
      .dff-rootpath-text {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        direction: rtl; text-align: left;
        -webkit-mask-image: linear-gradient(90deg, transparent, #000 16px);
        mask-image: linear-gradient(90deg, transparent, #000 16px);
      }
      .dff-rootpath-text > bdi { direction: ltr; unicode-bidi: isolate; }

      /* ── Editor ───────────────────────────────────────────────────────── */
      .dff-head-editor { height: 58px; padding: 0 10px 0 8px; gap: 8px; }
      .dff-editor-glyph { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 26px; height: 26px; }
      .dff-editor-title { display: flex; flex-direction: column; gap: 0; min-width: 0; flex: 1; }
      .dff-editor-title strong {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 500; line-height: 18px;
      }
      .dff-editor-title small {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px;
        direction: rtl; text-align: left;
      }
      .dff-editor-title small > bdi { direction: ltr; unicode-bidi: isolate; }
      .dff-editor-state {
        display: inline-flex; align-items: center; gap: 5px; flex: none;
        padding: 0 8px; height: 22px; border-radius: 999px;
        background: var(--dsw-alias-bg-module-platform);
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px; line-height: 16px; white-space: nowrap;
      }
      .dff-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.8; }
      .dff-editor-state[data-state="dirty"] { color: var(--dsw-alias-state-warn-label); }
      .dff-editor-state[data-state="dirty"] .dff-dot { background: var(--dsw-alias-state-warn-primary); opacity: 1; animation: dff-pulse 1600ms ease-in-out infinite; }
      .dff-editor-state[data-state="saved"] { color: var(--dsw-alias-label-tertiary); }
      .dff-editor-state[data-state="conflict"] { color: var(--dsw-alias-state-error-primary); }
      .dff-editor-actions { display: flex; align-items: center; gap: 4px; flex: none; }
      .dff-save {
        display: inline-flex; align-items: center; justify-content: center; gap: 5px;
        height: 30px; padding: 0 13px; border: 0; border-radius: 15px;
        background: var(--dsw-alias-button-primary-fill);
        color: var(--dsw-alias-label-primary-foreground);
        font: inherit; font-size: 12px; line-height: 18px; cursor: pointer;
        transition: opacity 150ms ease, transform 150ms ease, background 150ms ease;
      }
      .dff-save:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
      .dff-save:active:not(:disabled) { transform: scale(0.98); }
      .dff-save:disabled { opacity: 0.35; cursor: default; }
      .dff-save:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 2px; }

      .dff-editor-body { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 10px 12px 12px; }
      .dff-editor-meta {
        display: flex; align-items: center; gap: 10px;
        flex: none; min-width: 0; padding: 0 2px 8px;
        color: var(--dsw-alias-label-caption); font-size: 11px; line-height: 16px;
      }
      .dff-editor-path {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        direction: rtl; text-align: left; min-width: 0; flex: 1;
      }
      .dff-editor-path > bdi { direction: ltr; unicode-bidi: isolate; }
      .dff-editor-stats { display: inline-flex; align-items: center; gap: 10px; flex: none; font-variant-numeric: tabular-nums; }
      .dff-code {
        position: relative; display: flex; flex: 1; min-height: 0;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
        background: var(--dsw-alias-markdown-code-block);
        overflow: hidden;
        transition: border-color 160ms ease, box-shadow 180ms ease;
      }
      .dff-code:focus-within {
        border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 45%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
      }
      .dff-gutter {
        position: relative; flex: none; overflow: hidden;
        padding: 14px 8px 14px 12px;
        border-right: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-tertiary);
        font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 12.5px; line-height: 20px; tab-size: 2;
        text-align: right; user-select: none;
      }
      .dff-gutter-inner {
        margin: 0; padding: 0;
        font: inherit; line-height: inherit; tab-size: inherit;
        white-space: pre; will-change: transform;
      }
      .dff-line-marker {
        position: absolute; left: 0; right: 0; top: 14px; height: 20px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 9%, transparent);
        opacity: 0; pointer-events: none;
        transition: opacity 120ms ease;
        will-change: transform;
      }
      .dff-code-pane { position: relative; flex: 1; min-width: 0; }
      .dff-editor {
        position: absolute; inset: 0; box-sizing: border-box;
        width: 100%; height: 100%;
        margin: 0; padding: 14px 16px;
        border: 0; outline: 0; resize: none;
        background: transparent;
        color: var(--dsw-alias-label-primary);
        font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 12.5px; line-height: 20px; tab-size: 2;
      }
      .dff-editor.is-mirrored { color: transparent; caret-color: var(--dsw-alias-label-primary); }

      /* ── Lexical colours ──────────────────────────────────────────────────
         One palette per DSH theme. The textarea keeps the caret, selection and
         IME; the layer below only paints coloured spans for the visible lines. */
      .dff-code {
        --dff-syn-keyword: #7c3aed;
        --dff-syn-type: #0e7490;
        --dff-syn-string: #1a7f4b;
        --dff-syn-number: #b45309;
        --dff-syn-comment: #767b84;
        --dff-syn-function: #2563eb;
        --dff-syn-property: #5f6b7a;
        --dff-syn-tag: #c2410c;
        --dff-syn-attr: #b45309;
      }
      body[data-ds-dark-theme] .dff-code {
        --dff-syn-keyword: #c9a6ff;
        --dff-syn-type: #6fd8e8;
        --dff-syn-string: #8fe0a9;
        --dff-syn-number: #f7c56b;
        --dff-syn-comment: #7c828c;
        --dff-syn-function: #8ab4ff;
        --dff-syn-property: #a9b4c2;
        --dff-syn-tag: #ff9e75;
        --dff-syn-attr: #f7c56b;
      }
      .dff-token-layer {
        position: absolute; inset: 0; z-index: 1;
        margin: 0; padding: 14px 16px;
        overflow: hidden; pointer-events: none;
        color: var(--dsw-alias-label-primary);
        font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 12.5px; line-height: 20px; tab-size: 2;
        white-space: pre;
      }
      .dff-token-inner { display: block; font: inherit; line-height: inherit; tab-size: inherit; will-change: transform; }
      .dff-tok-keyword { color: var(--dff-syn-keyword); }
      .dff-tok-type { color: var(--dff-syn-type); }
      .dff-tok-string { color: var(--dff-syn-string); }
      .dff-tok-number { color: var(--dff-syn-number); }
      .dff-tok-comment { color: var(--dff-syn-comment); font-style: italic; }
      .dff-tok-function { color: var(--dff-syn-function); }
      .dff-tok-property { color: var(--dff-syn-property); }
      .dff-tok-tag { color: var(--dff-syn-tag); }
      .dff-tok-attr { color: var(--dff-syn-attr); }
      .dff-editor.is-tinted { color: transparent; caret-color: var(--dsw-alias-label-primary, CanvasText); }
      .dff-editor.is-tinted::selection {
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 26%, transparent);
        color: transparent;
      }
      .dff-plain-chip {
        padding: 1px 7px; border-radius: 999px;
        background: var(--dsw-alias-bg-module-platform);
        color: var(--dsw-alias-label-tertiary);
        font-size: 10.5px; line-height: 15px; white-space: nowrap;
      }
      /* While find is open the mirror only draws the hit backgrounds; the
         colour layer below still paints the glyphs, so syntax colours survive
         a search. Without colours the mirror keeps its own visible text. */
      .dff-editor-mirror.is-tinted { color: transparent; }
      .dff-editor-mirror {
        position: absolute; inset: 0; margin: 0; padding: 14px 16px;
        overflow: hidden; pointer-events: none;
        color: var(--dsw-alias-label-primary);
        font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 12.5px; line-height: 20px; tab-size: 2;
        white-space: pre;
      }
      .dff-editor-mirror-inner { display: block; font: inherit; line-height: inherit; will-change: transform; }
      .dff-find-hit {
        border-radius: 2px;
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 20%, transparent);
        color: inherit;
      }
      .dff-find-hit.is-current {
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 42%, transparent);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent);
      }
      .dff-find {
        position: absolute; z-index: 4; top: 8px; right: 10px;
        display: flex; align-items: center; gap: 4px;
        padding: 4px 5px 4px 6px;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;
        background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 94%, transparent);
        -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
        box-shadow: 0 10px 28px -18px color-mix(in srgb, #0f1115 55%, transparent);
        animation: dff-find-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes dff-find-in {
        from { opacity: 0; transform: translateY(-4px) scale(0.98); }
        to { opacity: 1; transform: none; }
      }
      .dff-find-input {
        width: 176px; height: 26px; padding: 0 8px;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
        background: var(--dsw-alias-bg-module-platform);
        color: var(--dsw-alias-label-primary);
        font: inherit; font-size: 12px; outline: 0;
      }
      .dff-find-input::placeholder { color: var(--dsw-alias-label-tertiary); }
      .dff-find-input:focus {
        border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 50%, transparent);
      }
      .dff-find-count {
        min-width: 46px; padding: 0 2px; text-align: center;
        color: var(--dsw-alias-label-caption);
        font-size: 11px; line-height: 24px; font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .dff-find-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px; padding: 0;
        border: 0; border-radius: 6px; background: transparent;
        color: var(--dsw-alias-label-secondary);
        font: inherit; font-size: 11px; cursor: pointer;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .dff-find-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-primary); }
      .dff-find-btn:disabled { opacity: 0.35; cursor: default; }
      .dff-find-btn[aria-pressed="true"] {
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
        color: var(--dsw-alias-state-business-primary);
      }
      .dff-find-up { transform: rotate(180deg); }
      .dff-editor::-webkit-scrollbar { width: 10px; height: 10px; }
      .dff-editor::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 10px; background-clip: content-box; background-color: var(--dsw-alias-scrollbar-bg-l1); }
      .dff-editor::-webkit-scrollbar-thumb:hover { background-color: var(--dsw-alias-scrollbar-hover-l1); }



      /* ── ⌘ identifier layer ───────────────────────────────────────────── */
      .dff-intel-layer {
        position: absolute; inset: 0; z-index: 2;
        margin: 0; padding: 14px 16px;
        overflow: hidden; pointer-events: none; color: transparent;
        font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 12.5px; line-height: 20px; tab-size: 2;
        white-space: pre;
      }
      .dff-intel-inner { display: block; font: inherit; line-height: inherit; tab-size: inherit; will-change: transform; }
      .dff-intel-token { color: transparent; }
      .dff-intel-token.is-navigable { pointer-events: auto; cursor: pointer; }
      .dff-intel-token.is-navigable:hover {
        text-decoration: underline dotted;
        text-decoration-color: var(--dsw-alias-state-business-primary);
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
        border-radius: 3px;
      }
      .dff-intel-tip {
        position: absolute; z-index: 8; display: flex; flex-direction: column; gap: 3px;
        max-width: 300px; padding: 9px 11px;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;
        background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 96%, transparent);
        -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
        box-shadow: 0 12px 30px -18px color-mix(in srgb, #0f1115 55%, transparent);
        pointer-events: none;
      }
      .dff-intel-kind { font-size: 10px; line-height: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--dsw-alias-state-business-primary); }
      .dff-intel-tip strong { font-size: 12.5px; line-height: 17px; color: var(--dsw-alias-label-primary); }
      .dff-intel-tip code {
        font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 11px; line-height: 15px; color: var(--dsw-alias-label-secondary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 276px;
      }
      .dff-intel-line { font-size: 10px; line-height: 14px; color: var(--dsw-alias-label-tertiary); }

      /* ── Built-in viewer ──────────────────────────────────────────────── */
      .dff-viewer-body { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 10px 12px 12px; }
      .dff-viewer-meta { padding-bottom: 8px; }
      .dff-media {
        flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
        padding: 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
        background: var(--dsw-alias-bg-module-platform); overflow: hidden;
      }
      .dff-media.is-dark { background: #0b0d12; }
      .dff-media-image { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
      .dff-media-video { max-width: 100%; max-height: 100%; border-radius: 8px; background: #000; }
      .dff-media-audio { padding: 40px; }
      .dff-media-audio audio { width: min(520px, 100%); }
      .dff-frame-wrap { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .dff-frame { flex: 1; min-height: 0; width: 100%; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: #fff; }
      .dff-frame-note { flex: none; padding: 8px 2px 0; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
      .dff-doc-wrap { flex: 1; min-height: 0; display: flex; }
      .dff-markdown {
        flex: 1; min-height: 0; overflow: auto; padding: 20px 26px;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
        background: var(--dsw-alias-markdown-code-block);
        color: var(--dsw-alias-label-primary);
      }
      .dff-markdown img { max-width: 100%; height: auto; border-radius: 8px; }
      .dff-markdown-fallback {
        flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 18px 20px;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
        background: var(--dsw-alias-markdown-code-block);
        color: var(--dsw-alias-label-primary);
        font: 12.5px/20px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        white-space: pre-wrap; word-break: break-word;
      }
      .dff-viewer-empty {
        flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
        border: 1px dashed var(--dsw-alias-border-l2); border-radius: 12px;
        color: var(--dsw-alias-label-secondary); text-align: center; padding: 24px;
      }
      .dff-viewer-empty strong { font-size: 14px; color: var(--dsw-alias-label-primary); }
      .dff-viewer-empty p { margin: 0; max-width: 420px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
      .dff-viewer-empty-icon { color: var(--dsw-alias-label-tertiary); }
      .dff-editor-state[data-state="readonly"] { color: var(--dsw-alias-label-tertiary); }
      .dff-editor-state[data-state="readonly"] .dff-dot { background: var(--dsw-alias-label-tertiary); opacity: 0.6; animation: none; }
      .dff-ghost-btn {
        height: 28px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
        background: transparent; color: var(--dsw-alias-label-secondary);
        font: inherit; font-size: 12px; cursor: pointer;
      }
      .dff-ghost-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-primary); }
      .dff-ghost-btn:disabled { opacity: 0.4; cursor: default; }

      .dff-banner {
        display: flex; align-items: center; gap: 8px;
        margin: 8px 12px 0; padding: 9px 12px;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;
        background: var(--dsw-alias-state-warn-tertiary);
        color: var(--dsw-alias-label-primary);
        font-size: 12px; line-height: 18px;
        animation: dff-banner-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .dff-banner-icon { flex: none; color: var(--dsw-alias-state-warn-label); }
      .dff-banner-text { flex: 1; min-width: 0; }
      .dff-banner-btn {
        flex: none; height: 26px; padding: 0 10px;
        border: 1px solid var(--dsw-alias-border-l3); border-radius: 13px;
        background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
        font: inherit; font-size: 11px; cursor: pointer;
      }
      .dff-banner-btn.is-danger { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent); color: var(--dsw-alias-state-error-primary); }
      .dff-banner-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dff-banner-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 1px; }

      .dff-sr {
        position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
        overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
      }

      /* ── Settings page ────────────────────────────────────────────────── */
      .dff-settings {
        display: flex; flex-direction: column; gap: 18px;
        width: 100%; max-width: 720px; padding: 4px 0 32px;
        color: var(--dsw-alias-label-primary);
        font-family: inherit;
      }
      .dff-intro { display: flex; align-items: flex-start; gap: 16px; padding: 0 2px; }
      .dff-intro-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
      .dff-intro-title { margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -0.015em; }
      .dff-intro-lead { margin: 0; max-width: 60ch; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 20px; }
      .dff-intro-side { flex: none; padding-top: 6px; }
      .dff-autosave {
        display: inline-flex; align-items: center; gap: 4px;
        color: var(--dsw-alias-state-success-primary);
        font-size: 11px; line-height: 16px;
        opacity: 0; transform: translateY(-2px);
        transition: opacity 200ms ease, transform 200ms ease;
      }
      .dff-autosave[data-on="true"] { opacity: 1; transform: none; }

      .dff-workspace {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
        background: var(--dsw-alias-bg-module-platform);
        color: var(--dsw-alias-label-tertiary); font-size: 11.5px; line-height: 17px;
      }
      .dff-workspace-icon { flex: none; }
      .dff-workspace-label { flex: none; }
      .dff-workspace-path {
        min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        direction: rtl; text-align: left;
        color: var(--dsw-alias-label-secondary);
        font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 11px;
      }
      .dff-workspace-path > bdi { direction: ltr; unicode-bidi: isolate; }

      .dff-card {
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 16px;
        background: var(--dsw-alias-bg-layer-1);
        overflow: hidden;
        box-shadow: 0 1px 2px color-mix(in srgb, #0f1115 4%, transparent);
        animation: dff-card-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
        animation-delay: calc(var(--i, 0) * 55ms);
      }
      body[data-ds-dark-theme] .dff-card { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28); }
      .dff-card-head { display: flex; flex-direction: column; gap: 3px; padding: 15px 20px 13px; }
      .dff-card-head h3 { margin: 0; font-size: 14px; line-height: 22px; font-weight: 600; }
      .dff-card-head p { margin: 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
      .dff-card-body { display: flex; flex-direction: column; }
      .dff-srow {
        display: flex; align-items: center; justify-content: space-between; gap: 18px;
        min-height: 58px; padding: 12px 20px;
        border-top: 1px solid var(--dsw-alias-border-l1);
        transition: background 150ms ease;
      }
      .dff-srow:hover { background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 55%, transparent); }
      .dff-srow-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
      .dff-srow-text strong { font-size: 13.5px; line-height: 21px; font-weight: 500; color: var(--dsw-alias-label-primary); }
      .dff-srow-text small { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
      .dff-srow-stack { align-items: stretch; flex-direction: column; gap: 10px; }
      .dff-srow-control { display: flex; flex-direction: column; gap: 8px; min-width: 0; }

      .dff-text-input {
        width: 100%; height: 34px; box-sizing: border-box;
        padding: 0 11px;
        border: 1px solid var(--dsw-alias-border-l3); border-radius: 9px;
        outline: 0; background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        font: inherit; font-size: 13px; line-height: 20px;
        transition: border-color 160ms ease, box-shadow 180ms ease;
      }
      .dff-text-input::placeholder { color: var(--dsw-alias-label-caption); }
      .dff-text-input:focus {
        border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 48%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary) 11%, transparent);
      }
      .dff-chips { display: flex; flex-wrap: wrap; gap: 5px; }
      .dff-chip {
        display: inline-flex; align-items: center; height: 21px; padding: 0 8px;
        border-radius: 6px; background: var(--dsw-alias-bg-module-platform);
        color: var(--dsw-alias-label-secondary);
        font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
        font-size: 10.5px; line-height: 16px;
      }
      .dff-chip.is-more { color: var(--dsw-alias-label-tertiary); background: transparent; }

      .dff-switch {
        position: relative; flex: none;
        width: 38px; height: 22px; padding: 2px;
        border: 0; border-radius: 11px;
        background: var(--dsw-alias-border-l3);
        cursor: pointer;
        transition: background 200ms ease;
      }
      .dff-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary); }
      .dff-switch:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 2px; }
      .dff-switch-knob {
        display: block; width: 18px; height: 18px; border-radius: 50%;
        background: var(--dsw-alias-bg-layer-1);
        box-shadow: 0 1px 2px color-mix(in srgb, #0f1115 22%, transparent);
        transition: transform 240ms cubic-bezier(0.2, 1.25, 0.4, 1);
      }
      .dff-switch[aria-checked="true"] .dff-switch-knob { transform: translateX(16px); }

      .dff-stepper {
        display: inline-flex; align-items: center; flex: none;
        height: 34px; border: 1px solid var(--dsw-alias-border-l3); border-radius: 9px;
        background: var(--dsw-alias-bg-layer-1); overflow: hidden;
      }
      .dff-stepper-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 32px; height: 100%; padding: 0; border: 0;
        background: transparent; color: var(--dsw-alias-label-secondary);
        cursor: pointer; transition: background 140ms ease, color 140ms ease;
      }
      .dff-stepper-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .dff-stepper-btn:disabled { opacity: 0.3; cursor: default; }
      .dff-stepper-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: -2px; }
      .dff-stepper-value {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 40px; height: 100%; padding: 0 2px;
        border-left: 1px solid var(--dsw-alias-border-l1); border-right: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-primary);
        font-size: 13px; line-height: 20px; font-variant-numeric: tabular-nums;
      }

      .dff-seg {
        position: relative; display: grid; grid-template-columns: 1fr 1fr; flex: none;
        padding: 3px; border-radius: 10px; background: var(--dsw-alias-bg-module-platform);
      }
      .dff-seg-pill {
        position: absolute; top: 3px; left: 3px;
        width: calc(50% - 3px); height: calc(100% - 6px);
        border-radius: 7px; background: var(--dsw-alias-bg-layer-1);
        box-shadow: 0 1px 2px color-mix(in srgb, #0f1115 10%, transparent), 0 0 0 0.5px var(--dsw-alias-border-l2);
        transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .dff-seg[data-value="editor"] .dff-seg-pill { transform: translateX(100%); }
      .dff-seg-option {
        position: relative; z-index: 1; height: 28px; padding: 0 12px;
        border: 0; border-radius: 7px; background: transparent;
        color: var(--dsw-alias-label-tertiary);
        font: inherit; font-size: 12px; line-height: 18px; white-space: nowrap; cursor: pointer;
        transition: color 180ms ease;
      }
      .dff-seg-option[aria-checked="true"] { color: var(--dsw-alias-label-primary); }
      .dff-seg-option:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 1px; }

      .dff-try {
        flex: none; height: 30px; padding: 0 13px;
        border: 1px solid var(--dsw-alias-border-l3); border-radius: 15px;
        background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
        font: inherit; font-size: 12px; line-height: 18px; cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
      }
      .dff-try:hover { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-border-l4); }
      .dff-try:active { transform: scale(0.98); }
      .dff-try:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 2px; }

      .dff-settings-foot {
        display: flex; align-items: center; justify-content: space-between; gap: 16px;
        padding: 2px 4px; color: var(--dsw-alias-label-caption); font-size: 11px; line-height: 16px;
      }
      .dff-reset {
        padding: 4px 2px; border: 0; background: transparent;
        color: var(--dsw-alias-label-tertiary); font: inherit; font-size: 12px; line-height: 18px;
        cursor: pointer; transition: color 150ms ease;
      }
      .dff-reset:hover { color: var(--dsw-alias-state-error-primary); }
      .dff-reset:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 65%, transparent); outline-offset: 2px; border-radius: 4px; }
      .dff-settings-note { color: var(--dsw-alias-label-caption); }

      /* ── Motion ───────────────────────────────────────────────────────── */
      @keyframes dff-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes dff-fade-out { from { opacity: 1; } to { opacity: 0; } }
      @keyframes dff-pop {
        from { opacity: 0; transform: translateY(10px) scale(0.985); }
        to { opacity: 1; transform: none; }
      }
      @keyframes dff-pop-out {
        from { opacity: 1; transform: none; }
        to { opacity: 0; transform: translateY(-5px) scale(0.992); }
      }
      @keyframes dff-view-in {
        from { opacity: 0; transform: translateY(3px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes dff-row-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes dff-card-in {
        from { opacity: 0; transform: translateY(7px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes dff-menu-in {
        from { opacity: 0; transform: translateY(-4px) scale(0.99); }
        to { opacity: 1; transform: none; }
      }
      @keyframes dff-banner-in {
        from { opacity: 0; transform: translateY(-3px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes dff-indeterminate {
        0% { transform: translateX(-110%); }
        100% { transform: translateX(360%); }
      }
      @keyframes dff-shimmer {
        0% { background-position: 140% 0; }
        100% { background-position: -40% 0; }
      }
      @keyframes dff-rotate { to { transform: rotate(360deg); } }
      @keyframes dff-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

      @media (max-width: 720px) {
        .dff-overlay { padding: 8vh 12px 16px; }
        .dff-panel { border-radius: 16px; max-height: min(72vh, 640px); }
        .dff-mode { width: 150px; }
        .dff-root { max-width: 130px; }
        .dff-hint:nth-child(3) { display: none; }
        .dff-srow { flex-wrap: wrap; align-items: flex-start; }
        .dff-srow-control, .dff-srow > .dff-stepper, .dff-srow > .dff-seg, .dff-srow > .dff-switch { margin-left: auto; }
        .dff-rootpath { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .dff-scrim, .dff-panel, .dff-view, .dff-result, .dff-card, .dff-menu, .dff-banner,
        .dff-empty, .dff-msg, .dff-skeleton-row, .dff-spin, .dff-progress-bar, .dff-find,
        .dff-editor-state[data-state="dirty"] .dff-dot {
          animation: none !important;
        }
        .dff-mode-pill, .dff-seg-pill, .dff-switch-knob, .dff-result-rail,
        .dff-result-enter, .dff-result, .dff-autosave, .dff-find-btn, .dff-line-marker {
          transition-duration: 1ms !important;
        }
      }
    `

    const bound = (Component, t) => function Bound(props) {
      return h(Component, { ...props, t })
    }

    return {
      // Only services every Web shell always provides: a missing optional one
      // must never hold up (or take down) the rest of the boot.
      inject: ['slots', 'locale'],
      apply(ctx) {
        try {
          start(ctx)
        } catch (error) {
          console.error('dsh-file-finder could not start; the panel stays closed', error)
        }
        function start(ctx) {
          ctx.effect(() => ctx.locale.register('fileFinder', dict))
          const t = ctx.locale.bind('fileFinder')
          // Optional integration: without DS Bot's client module in this boot,
          // nothing below is registered or installed.
          const botReady = botBridge.detect()
          if (typeof ctx.inject === 'function') {
            ctx.inject(['shortcuts'], (scoped) => {
              const register = (command) => {
                try {
                  return scoped.shortcuts.register(command)
                } catch (error) {
                  console.error('dsh-file-finder shortcut was not registered', error)
                  return () => {}
                }
              }
              scoped.effect(() => register(shortcut(
                'files.searchName',
                () => t('shortcutName'),
                ['find file', 'go to file', 'quick open'],
                () => store.openSearch('name'),
              )))
              scoped.effect(() => register(shortcut(
                'files.searchContent',
                () => t('shortcutContent'),
                ['search file content', 'find in files'],
                () => store.openSearch('content'),
              )))
              if (botReady) {
                scoped.effect(() => register(shortcut(
                  'files.toggleBotMode',
                  () => t('shortcutBot'),
                  ['bot mode', 'classic agent mode', 'toggle bot'],
                  () => { botBridge.toggle() },
                )))
              }
            })
          }
          ctx.effect(() => {
            document.addEventListener('keydown', onVsCodeKey, true)
            return () => document.removeEventListener('keydown', onVsCodeKey, true)
          })
          if (botReady) {
            ctx.effect(() => {
              document.addEventListener('keydown', onBotKey, true)
              return () => document.removeEventListener('keydown', onBotKey, true)
            })
          }
          const Search = bound(Palette, t)
          const Settings = (props) => h(SettingsPage, { ...props, t, ctx })
          ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay', id: 'file-finder', order: 40,
          }, (props) => h(Search, { ...props, ctx })))
          ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section', id: 'file-finder', order: 18, label: () => t('settingsTitle'),
          }, Settings))
        }
      },
    }
  },
})
