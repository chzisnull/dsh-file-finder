/**
 * One session dataset for every preview surface.
 *
 * `mount.js` (screenshot harness) and `session-board-check.html` (browser
 * checks) used to carry their own copies, which drifted. Both load this file as
 * a classic script and call `dffSessionFixture.create({ lang })`.
 *
 * The dataset is built to exercise the interesting cases, not to look tidy:
 * three awaiting flavours, an idle session kept running by two subagents, an
 * idle session kept awaiting by a subagent, an orphan subagent, a blank row and
 * an archived row.
 */
(function () {
  var WORKSPACES = [
    {
      workspaceId: 'ws_file_finder',
      path: '/workspace/dsh-file-finder',
      zh: '文件查找插件',
      en: 'File Finder',
    },
    {
      workspaceId: 'ws_api',
      path: '/workspace/api-server',
      zh: '接口服务',
      en: 'API server',
    },
    {
      workspaceId: 'ws_video',
      path: '/workspace/dsh-file-finder-video',
      zh: '宣传视频',
      en: 'Promo video',
    },
    {
      workspaceId: 'ws_site',
      path: '/workspace/marketing-site',
      zh: '官网',
      en: 'Marketing site',
    },
  ]

  // own: the session's own Agent is running
  // pending: a pending interaction on this session itself
  // unread: finished in the background and not looked at yet
  var ROWS = [
    { id: 'p1', workspace: 'ws_file_finder', minutes: 4, zh: '重构 auth 中间件', en: 'Refactor the auth middleware', pending: 'approval' },
    { id: 'p2', workspace: 'ws_file_finder', minutes: 11, zh: '发布 0.12.0 收尾', en: 'Finish the 0.12.0 release', pending: 'question' },
    { id: 'p3', workspace: 'ws_api', minutes: 26, zh: '数据库迁移方案', en: 'Database migration plan', pending: 'plan-review' },
    { id: 'p4', workspace: 'ws_api', minutes: 5, zh: '依赖审计', en: 'Dependency audit' },
    { id: 'r1', workspace: 'ws_file_finder', minutes: 2, zh: '会话看板：区域计数', en: 'Session board: sidebar counts', own: true, main: true },
    { id: 'r2', workspace: 'ws_video', minutes: 6, zh: '视频素材裁剪', en: 'Trim the video footage', own: true },
    // Its own Agent is idle; sa1/sa2 keep it running.
    { id: 'r3', workspace: 'ws_api', minutes: 9, zh: 'CI 流水线排障', en: 'Pipelines: find the flaky job' },
    { id: 'r4', workspace: 'ws_site', minutes: 13, zh: '价格页文案', en: 'Pricing page copy', own: true },
    { id: 'r5', workspace: 'ws_file_finder', minutes: 18, zh: '依赖升级评估', en: 'Dependency upgrade review', own: true },
    { id: 'd1', workspace: 'ws_file_finder', minutes: 3, zh: '截图重采', en: 'Re-shoot the screenshots', unread: true },
    { id: 'd2', workspace: 'ws_file_finder', minutes: 12, zh: 'npm 安装验证', en: 'Verify the npm install', unread: true },
    { id: 'blank', workspace: 'ws_file_finder', minutes: 1, zh: '', en: '', blank: true },
    // An orphan subagent: it has no parent to roll into and must create no row.
    { id: 'sub', workspace: 'ws_file_finder', minutes: 1, zh: 'Subagent: read files', en: 'Subagent: read files', origin: 'subagent', own: true },
    { id: 'sa1', workspace: 'ws_api', minutes: 5, zh: 'Subagent: grep logs', en: 'Subagent: grep logs', origin: 'subagent', parentId: 'r3', own: true },
    { id: 'sa2', workspace: 'ws_api', minutes: 4, zh: 'Subagent: rerun job', en: 'Subagent: rerun job', origin: 'subagent', parentId: 'r3', own: true },
    { id: 'sa3', workspace: 'ws_api', minutes: 3, zh: 'Subagent: audit lockfile', en: 'Subagent: audit lockfile', origin: 'subagent', parentId: 'p4', pending: 'approval' },
    { id: 'old', workspace: 'ws_file_finder', minutes: 240, zh: '旧的一次实验', en: 'An old experiment', unread: true },
  ]

  var ARCHIVED = ['old']

  function create(options) {
    var lang = (options && options.lang) === 'zh' ? 'zh' : 'en'
    var now = (options && options.now) || Date.now()
    var byId = {}
    var statuses = new Map()
    for (var index = 0; index < ROWS.length; index += 1) {
      var row = ROWS[index]
      var workspace = WORKSPACES.filter(function (item) { return item.workspaceId === row.workspace })[0]
      byId[row.id] = {
        id: row.id,
        displayTitle: row[lang] || row.en || row.zh || '',
        cwd: workspace ? workspace.path : '',
        updatedAt: now - row.minutes * 60_000,
        blank: Boolean(row.blank),
        origin: row.origin,
        parentId: row.parentId,
        running: Boolean(row.own),
        retainedBy: { mainView: row.main ? 1 : 0 },
      }
      statuses.set(row.id, {
        running: Boolean(row.own),
        pendingInteraction: row.pending ? { kind: row.pending } : undefined,
        completionUnread: Boolean(row.unread),
      })
    }
    return {
      list: {
        current: 'r1',
        phase: 'ready',
        ids: ROWS.map(function (row) { return row.id }),
        byId: byId,
      },
      statuses: statuses,
      workspaces: {
        archivedSessionIds: ARCHIVED.slice(),
        items: WORKSPACES.map(function (workspace) {
          return {
            workspaceId: workspace.workspaceId,
            path: workspace.path,
            title: workspace[lang] || workspace.en,
            sessionIds: ROWS.filter(function (row) { return row.workspace === workspace.workspaceId })
              .map(function (row) { return row.id }),
          }
        }),
      },
      // The numbers the dataset must always produce; the checks assert them.
      expected: { pending: 4, running: 5, finished: 2 },
    }
  }

  window.dffSessionFixture = { create: create }
})()
