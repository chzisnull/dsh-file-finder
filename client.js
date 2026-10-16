window.__ModuleLoader__.load({
  id: 'dsh-file-finder',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    const dict = {
      zh: {
        title: '文件查找',
        open: '查找文件',
        name: '按文件名',
        content: '按内容',
        namePlaceholder: '搜索文件名，例如 parser 或 src/view',
        contentPlaceholder: '搜索文件内容，至少 2 个字符',
        searching: '正在搜索…',
        noResult: '没有匹配结果',
        noRoot: '当前没有工作区。先打开一个带工作目录的会话。',
        root: '工作区',
        truncated: '结果已截断，请缩小范围',
        close: '关闭',
        back: '返回搜索',
        save: '保存',
        saving: '保存中…',
        reload: '重新加载',
        saved: '已保存',
        dirty: '未保存',
        conflict: '文件已被其他程序修改',
        confirmClose: '有未保存的修改。关闭将丢弃它们。',
        discard: '丢弃并关闭',
        keep: '继续编辑',
        line: '第 {line} 行',
        settingsTitle: '文件查找',
        settingsBody: '按文件名和按内容各有一个快捷键，可在「设置 → 编辑快捷键」中修改。桌面版默认是 Shift+⌘/Ctrl+P 与 Shift+⌘/Ctrl+F；网页版默认是 Shift+⌘/Ctrl+P 与 Alt+⌘/Ctrl+F。',
        shortcutName: '按文件名搜索',
        shortcutContent: '按内容搜索',
        footer: '查找文件',
      },
      en: {
        title: 'File Finder',
        open: 'Find files',
        name: 'By name',
        content: 'By content',
        namePlaceholder: 'Search file names, such as parser or src/view',
        contentPlaceholder: 'Search file contents, at least 2 characters',
        searching: 'Searching…',
        noResult: 'No matches',
        noRoot: 'No workspace is open. Start a session that has a working directory.',
        root: 'Workspace',
        truncated: 'Results were truncated. Narrow the query.',
        close: 'Close',
        back: 'Back to search',
        save: 'Save',
        saving: 'Saving…',
        reload: 'Reload',
        saved: 'Saved',
        dirty: 'Unsaved',
        conflict: 'The file changed outside the editor',
        confirmClose: 'There are unsaved changes. Closing discards them.',
        discard: 'Discard and close',
        keep: 'Keep editing',
        line: 'Line {line}',
        settingsTitle: 'File Finder',
        settingsBody: 'Name search and content search each have a shortcut. Change them in Settings → Edit shortcuts. Desktop defaults are Shift+Cmd/Ctrl+P and Shift+Cmd/Ctrl+F. Web defaults are Shift+Cmd/Ctrl+P and Alt+Cmd/Ctrl+F.',
        shortcutName: 'Search files by name',
        shortcutContent: 'Search files by content',
        footer: 'Find files',
      },
    }

    const store = {
      state: { open: false, mode: 'name', token: 0 },
      listeners: new Set(),
      snapshot() { return store.state },
      subscribe(listener) {
        store.listeners.add(listener)
        return () => store.listeners.delete(listener)
      },
      openSearch(mode) {
        store.state = { open: true, mode: mode === 'content' ? 'content' : 'name', token: store.state.token + 1 }
        store.listeners.forEach((listener) => listener())
      },
      close() {
        store.state = { open: false, mode: store.state.mode, token: store.state.token }
        store.listeners.forEach((listener) => listener())
      },
    }

    function textOf(t, key, values) {
      return t(key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''))
    }

    function currentCwd(ctx) {
      const list = ctx.sessions && ctx.sessions.list && ctx.sessions.list.getSnapshot && ctx.sessions.list.getSnapshot()
      if (!list || !list.byId) return ''
      const current = Object.values(list.byId).find((row) => row && row.retainedBy && Number(row.retainedBy.mainView || 0) > 0)
      return current && typeof current.cwd === 'string' ? current.cwd : ''
    }

    async function post(path, body) {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body || {}),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) throw new Error(data && data.error || `HTTP ${response.status}`)
      if (data.ok === false && !data.conflict) throw new Error(data.error || '请求失败')
      return data
    }

    function shortcut(id, label, aliases, desktop, web, mode) {
      return {
        id,
        label,
        aliases,
        defaults: {
          'desktop:macos': desktop,
          'desktop:windows': desktop,
          'desktop:linux': desktop,
          'web:macos': web,
          'web:windows': web,
        },
        regions: ['page', 'editable'],
        modals: [],
        resolve: () => ({ status: 'handled', run: () => store.openSearch(mode) }),
      }
    }

    function Palette(props) {
      const ctx = props && props.ctx
      const t = props.t
      const request = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
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
      const [file, setFile] = useState(null)
      const [draft, setDraft] = useState('')
      const [status, setStatus] = useState('')
      const [confirmClose, setConfirmClose] = useState(false)
      const inputRef = useRef(null)
      const editorRef = useRef(null)
      const generation = useRef(0)

      useEffect(() => {
        if (!request.open) return
        setView('search')
        setMode(request.mode)
        setError('')
        setConfirmClose(false)
        const cwd = currentCwd(ctx)
        if (cwd) setRoot(cwd)
        let cancelled = false
        post('/dsh-file-finder/roots', {}).then((data) => {
          if (cancelled) return
          const items = Array.isArray(data.roots) ? data.roots : []
          setRoots(items)
          setRoot((previous) => previous || cwd || (items[0] && items[0].path) || '')
        }).catch((reason) => {
          if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
        })
        return () => { cancelled = true }
      }, [request.open, request.token, request.mode, ctx])

      useEffect(() => {
        if (!request.open || view !== 'search') return
        inputRef.current && inputRef.current.focus()
      }, [request.open, view, mode])

      useEffect(() => {
        if (!request.open || view !== 'search' || !root) return undefined
        const needle = query.trim()
        if (!needle || (mode === 'content' && needle.length < 2)) {
          setResults([])
          setTruncated(false)
          setBusy(false)
          return undefined
        }
        const ticket = generation.current + 1
        generation.current = ticket
        setBusy(true)
        setError('')
        const timer = setTimeout(() => {
          const path = mode === 'content' ? '/dsh-file-finder/search-content' : '/dsh-file-finder/search-name'
          post(path, { root, query: needle }).then((data) => {
            if (generation.current !== ticket) return
            setResults(Array.isArray(data.results) ? data.results : [])
            setTruncated(Boolean(data.truncated))
            setSelected(0)
          }).catch((reason) => {
            if (generation.current !== ticket) return
            setResults([])
            setError(reason instanceof Error ? reason.message : String(reason))
          }).finally(() => {
            if (generation.current === ticket) setBusy(false)
          })
        }, 180)
        return () => clearTimeout(timer)
      }, [request.open, view, mode, query, root])

      const dirty = file && draft !== file.text
      const flat = useMemo(() => results.flatMap((item) => {
        if (mode === 'name') return [{ path: item.path, name: item.name, line: 1, preview: item.path }]
        return (item.hits || []).map((hit) => ({
          path: item.path,
          name: item.name,
          line: hit.line,
          preview: hit.text,
        }))
      }), [results, mode])

      if (!request.open) return null

      function closePanel() {
        if (dirty) {
          setConfirmClose(true)
          return
        }
        store.close()
      }

      async function openFile(item) {
        setBusy(true)
        setError('')
        setStatus('')
        try {
          const data = await post('/dsh-file-finder/read', { root, path: item.path })
          setFile({ path: data.path, version: data.version, text: data.text, line: item.line || 1 })
          setDraft(data.text)
          setView('editor')
          setConfirmClose(false)
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      async function saveFile() {
        if (!file) return
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
        await openFile({ path: file.path, line: file.line })
      }

      function onSearchKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault()
          closePanel()
          return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setSelected((index) => {
            if (!flat.length) return 0
            const next = event.key === 'ArrowDown' ? index + 1 : index - 1
            return (next + flat.length) % flat.length
          })
          return
        }
        if (event.key === 'Enter' && flat[selected]) {
          event.preventDefault()
          openFile(flat[selected])
        }
      }

      function onEditorKey(event) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          event.stopPropagation()
          saveFile()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setView('search')
        }
      }

      useEffect(() => {
        if (view !== 'editor' || !editorRef.current || !file) return
        const area = editorRef.current
        const line = Math.max(1, file.line || 1)
        const offset = file.text.split(/\r?\n/).slice(0, line - 1).join('\n').length
        const start = line === 1 ? 0 : offset + 1
        area.focus()
        area.setSelectionRange(start, start)
        const lineHeight = 20
        area.scrollTop = Math.max(0, (line - 3) * lineHeight)
      }, [view, file])

      return h('div', { className: 'dff-backdrop', onMouseDown: (event) => { if (event.target === event.currentTarget) closePanel() } },
        h('style', null, css),
        h('section', {
          className: view === 'editor' ? 'dff-panel dff-panel-editor' : 'dff-panel',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('title'),
        },
        view === 'search' ? searchView() : editorView()))

      function searchView() {
        return h(React.Fragment, null,
          header(t('title'), closePanel),
          h('div', { className: 'dff-modes' },
            modeButton('name', t('name')),
            modeButton('content', t('content'))),
          roots.length > 1 ? h('label', { className: 'dff-root' },
            t('root'),
            h('select', {
              value: root,
              onChange: (event) => setRoot(event.target.value),
            }, roots.map((item) => h('option', { key: item.path, value: item.path }, item.title || item.path)))) : null,
          h('input', {
            ref: inputRef,
            className: 'dff-input',
            value: query,
            placeholder: mode === 'content' ? t('contentPlaceholder') : t('namePlaceholder'),
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: onSearchKey,
          }),
          message(),
          h('div', { className: 'dff-results', role: 'listbox' },
            flat.length ? flat.map((item, index) => h('button', {
              key: `${item.path}:${item.line}:${index}`,
              type: 'button',
              role: 'option',
              'aria-selected': index === selected,
              className: index === selected ? 'dff-result is-selected' : 'dff-result',
              onMouseEnter: () => setSelected(index),
              onClick: () => openFile(item),
            },
            h('span', { className: 'dff-result-name' }, item.name),
            h('span', { className: 'dff-result-meta' }, mode === 'content' ? textOf(t, 'line', { line: item.line }) : parentOf(item.path)),
            mode === 'content' ? h('span', { className: 'dff-result-preview' }, item.preview) : null))
            : h('p', { className: 'dff-empty' }, busy ? t('searching') : root ? t('noResult') : t('noRoot'))))
      }

      function editorView() {
        return h(React.Fragment, null,
          header(file ? file.path : t('title'), () => setView('search')),
          h('div', { className: 'dff-editor-bar' },
            h('span', { className: dirty ? 'dff-badge is-dirty' : 'dff-badge' }, dirty ? t('dirty') : status || t('saved')),
            h('button', { type: 'button', onClick: () => setView('search') }, t('back')),
            h('button', { type: 'button', onClick: reloadFile, disabled: busy }, t('reload')),
            h('button', { type: 'button', className: 'dff-primary', onClick: saveFile, disabled: busy || !dirty }, busy ? t('saving') : t('save'))),
          confirmClose ? h('div', { className: 'dff-confirm' },
            h('span', null, t('confirmClose')),
            h('button', { type: 'button', onClick: () => setConfirmClose(false) }, t('keep')),
            h('button', { type: 'button', className: 'dff-danger', onClick: () => store.close() }, t('discard'))) : null,
          message(),
          h('textarea', {
            ref: editorRef,
            className: 'dff-editor',
            value: draft,
            spellCheck: false,
            onChange: (event) => setDraft(event.target.value),
            onKeyDown: onEditorKey,
          }))
      }

      function header(title, onClose) {
        return h('div', { className: 'dff-header' },
          h('strong', null, title),
          h('button', { type: 'button', className: 'dff-icon', 'aria-label': t('close'), onClick: onClose }, '×'))
      }

      function modeButton(next, label) {
        return h('button', {
          type: 'button',
          className: mode === next ? 'dff-mode is-selected' : 'dff-mode',
          onClick: () => { setMode(next); setQuery(''); setResults([]); setError('') },
        }, label)
      }

      function message() {
        return h(React.Fragment, null,
          error ? h('p', { className: 'dff-error' }, error) : null,
          truncated ? h('p', { className: 'dff-note' }, t('truncated')) : null)
      }
    }

    function parentOf(filePath) {
      const normalized = String(filePath || '').replaceAll('\\', '/')
      const slash = normalized.lastIndexOf('/')
      return slash <= 0 ? normalized : normalized.slice(0, slash)
    }

    function FooterButton(props) {
      return h('button', {
        type: 'button',
        className: 'dff-footer',
        title: props.t('footer'),
        'aria-label': props.t('footer'),
        onClick: () => store.openSearch('name'),
      }, h('style', null, css), '⌕')
    }

    function SettingsRow(props) {
      const t = props.t
      return h('div', { className: 'dff-settings' },
        h('style', null, css),
        h('div', null,
          h('strong', null, t('settingsTitle')),
          h('p', null, t('settingsBody'))),
        h('button', { type: 'button', onClick: () => store.openSearch('name') }, t('open')))
    }

    function bound(Component, t) {
      return function Bound(props) {
        return h(Component, { ...props, t })
      }
    }

    const css = `
      .dff-backdrop { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-start; justify-content: center; padding: 10vh 24px 24px; background: color-mix(in srgb, var(--dsw-alias-label-primary) 28%, transparent); }
      .dff-panel { width: min(720px, 100%); max-height: min(70vh, 640px); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); box-shadow: 0 18px 48px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent); }
      .dff-panel-editor { width: min(920px, 100%); height: min(78vh, 760px); max-height: min(78vh, 760px); }
      .dff-header, .dff-editor-bar, .dff-confirm, .dff-settings { display: flex; align-items: center; gap: 8px; }
      .dff-header { justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .dff-header strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
      .dff-modes, .dff-root, .dff-input, .dff-note, .dff-error { margin: 10px 14px 0; }
      .dff-modes { display: flex; gap: 6px; }
      .dff-mode, .dff-panel button, .dff-settings button, .dff-footer { border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
      .dff-mode, .dff-panel button, .dff-settings button { padding: 6px 10px; font: inherit; cursor: pointer; }
      .dff-mode.is-selected, .dff-primary { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); border-color: transparent; }
      .dff-icon { width: 28px; height: 28px; padding: 0; font-size: 18px; line-height: 1; }
      .dff-root { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .dff-root select, .dff-input, .dff-editor { width: 100%; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; }
      .dff-input, .dff-root select { padding: 8px 10px; }
      .dff-results { overflow: auto; margin-top: 10px; padding: 0 8px 8px; }
      .dff-result { display: grid; width: 100%; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 12px; margin: 0; padding: 8px 10px; text-align: left; background: transparent; border-color: transparent; }
      .dff-result.is-selected { background: var(--dsw-alias-bg-layer-2); }
      .dff-result-name, .dff-result-preview { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dff-result-name { grid-column: 1; font-size: 13px; }
      .dff-result-meta, .dff-result-preview, .dff-empty, .dff-note { color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .dff-result-preview { grid-column: 1 / -1; }
      .dff-empty { padding: 18px 8px; text-align: center; }
      .dff-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; }
      .dff-editor-bar, .dff-confirm { padding: 8px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .dff-badge { margin-right: auto; color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .dff-badge.is-dirty { color: var(--dsw-alias-state-warn-primary); }
      .dff-danger { color: var(--dsw-alias-state-error-primary); }
      .dff-editor { flex: 1; min-height: 240px; margin: 12px 14px 14px; padding: 12px; resize: none; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 20px; }
      .dff-footer { width: 32px; height: 32px; padding: 0; font-size: 16px; cursor: pointer; }
      .dff-settings { justify-content: space-between; gap: 16px; padding: 4px 0; }
      .dff-settings p { margin: 4px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.5; }
      .dff-panel button:disabled { cursor: default; opacity: 0.55; }
    `

    return {
      inject: ['slots', 'locale', 'sessions'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('fileFinder', dict))
        const t = ctx.locale.bind('fileFinder')
        if (typeof ctx.inject === 'function') {
          ctx.inject(['shortcuts'], (scoped) => {
            scoped.effect(() => scoped.shortcuts.register(shortcut(
              'files.searchName',
              () => t('shortcutName'),
              ['find file', 'go to file', 'search file name'],
              { code: 'KeyP', modifiers: ['primary', 'shift'] },
              { code: 'KeyP', modifiers: ['primary', 'shift'] },
              'name',
            )))
            scoped.effect(() => scoped.shortcuts.register(shortcut(
              'files.searchContent',
              () => t('shortcutContent'),
              ['search file content', 'find in files'],
              { code: 'KeyF', modifiers: ['primary', 'shift'] },
              { code: 'KeyF', modifiers: ['primary', 'alt'] },
              'content',
            )))
          })
        }
        const Search = bound(Palette, t)
        const Foot = bound(FooterButton, t)
        const Settings = bound(SettingsRow, t)
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'file-finder', order: 40,
        }, (props) => h(Search, { ...props, ctx })))
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: 'file-finder', order: 20, label: () => t('footer'),
        }, Foot))
        ctx.slots.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item', id: 'file-finder', order: 40, label: () => t('settingsTitle'),
        }, Settings))
      },
    }
  },
})
