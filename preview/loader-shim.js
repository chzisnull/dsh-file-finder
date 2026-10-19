/**
 * Minimal stand-in for the DSH Web Module Loader.
 *
 * The real shell registers React (and the shared UI primitives) as loader
 * modules. Outside DSH we only have the React 18 UMD globals, so this shim
 * resolves the small set of module IDs a plugin may `require()` and throws a
 * descriptive error for anything else. The redesigned client wraps its
 * primitives import in try/catch, so throwing here deliberately exercises the
 * local fallback styling instead of pulling in CSS modules that cannot resolve
 * outside the DSH build.
 */
(function () {
  'use strict'

  const React = window.React
  const ReactDOM = window.ReactDOM
  const moduleCache = new Map()
  const loadLog = []

  if (!React) throw new Error('[preview] React UMD was not loaded before loader-shim.js')
  if (!ReactDOM) throw new Error('[preview] ReactDOM UMD was not loaded before loader-shim.js')

  function jsx(type, config, maybeKey) {
    const props = {}
    let key = maybeKey === undefined ? null : maybeKey
    if (config) {
      for (const name in config) {
        if (name === 'key') {
          key = config.key
        } else if (name !== '__self' && name !== '__source') {
          props[name] = config[name]
        }
      }
    }
    if (key !== null) props.key = key
    return React.createElement(type, props)
  }

  const jsxRuntime = {
    Fragment: React.Fragment,
    jsx,
    jsxs: jsx,
    jsxDEV: jsx,
  }

  function requireModule(id) {
    loadLog.push(id)
    switch (id) {
      case 'react':
        return React
      case 'react-dom':
        return ReactDOM
      case 'react-dom/client':
        return {
          createRoot: ReactDOM.createRoot,
          hydrateRoot: ReactDOM.hydrateRoot,
          default: ReactDOM,
        }
      case 'react/jsx-runtime':
        return jsxRuntime
      case 'react/jsx-dev-runtime':
        return jsxRuntime
      case '@deepseek-ai/dsh-client-ui-primitives':
        throw new Error(
          '[preview] @deepseek-ai/dsh-client-ui-primitives is not available outside DSH; ' +
          'the plugin should render its local fallback',
        )
      default:
        throw new Error(`[preview] unknown client module "${id}" requested by client.js`)
    }
  }

  window.__ModuleLoader__ = {
    /**
     * Real shape is load({ id, factory }). The factory runs immediately, like
     * the DSH loader does, and the exports are kept for preview/mount.js.
     */
    load(entry) {
      if (!entry || typeof entry.factory !== 'function') {
        throw new Error('[preview] __ModuleLoader__.load() received an entry without factory()')
      }
      const exports = entry.factory(requireModule)
      moduleCache.set(entry.id, exports)
      window.__DFF_MODULE__ = exports
      window.__DFF_MODULE_ID__ = entry.id
      return exports
    },
  }

  window.__DFF_REQUIRE__ = requireModule
  window.__DFF_REQUIRE_LOG__ = loadLog
})()
