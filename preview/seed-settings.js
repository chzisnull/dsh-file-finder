/**
 * Seeds the plugin's persisted settings before client.js reads localStorage.
 *
 * The preview harnesses are plain script pages, so this is the one shared
 * helper they all load instead of each carrying a copy of the settings blob.
 * It is preview-only and never published with the plugin.
 *
 *   <script src="./seed-settings.js"></script>
 *   <script>window.seedFileFinderSettings({ openMode: 'editor' })</script>
 *
 * `openMode` accepts the stored values verbatim, including the legacy
 * `preview` that the client migrates to `native`.
 */
;(function () {
  'use strict'

  var SETTINGS_KEY = 'dsh-file-finder.settings.v1'
  var DEFAULTS = {
    caseSensitive: false,
    extraIgnore: '',
    nameLimit: 40,
    contentLimit: 80,
    openMode: 'native',
  }

  window.seedFileFinderSettings = function seedFileFinderSettings(overrides) {
    try {
      var source = overrides && typeof overrides === 'object' ? overrides : {}
      var settings = Object.assign({}, DEFAULTS, source)
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch (error) {
      // file:// or a private-mode browser: the client falls back to defaults.
    }
  }
})()
