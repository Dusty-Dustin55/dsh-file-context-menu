window.__ModuleLoader__.load({
  id: 'dsh-file-context-menu',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'file-actions';
    const FILE_PREFIX = 'dsh-resource://file/';
    const SESSION_PREFIX = FILE_PREFIX + 'session/';
    const MENU_WIDTH = 232;
    const MENU_ESTIMATED_HEIGHT = 300;
    const DIAG_PATH = 'file-actions/diag';

    function diagUrl() {
      const relative = DIAG_PATH.replace(/^\/+/, '');
      if (typeof document === 'undefined') return '/' + relative;
      try {
        return new URL(relative, document.baseURI).pathname;
      } catch {
        return '/' + relative;
      }
    }

    function report(event, extra) {
      let enabled = false;
      try {
        enabled = localStorage.getItem('dsh-file-context-menu.diag') === '1';
      } catch {
        enabled = false;
      }
      if (!enabled) return;
      try {
        fetch(diagUrl(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event, at: Date.now(), ...(extra || {}) }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // diagnostics must never break the plugin
      }
    }

    function describeTarget(target) {
      if (!(target instanceof Element)) return { tag: String(target) };
      const chain = [];
      let element = target;
      for (let i = 0; i < 4 && element && element !== document.body; i += 1) {
        chain.push({
          tag: element.tagName,
          cls: String(element.className || '').slice(0, 100),
          href: element.getAttribute ? element.getAttribute('href') : null,
          title: element.getAttribute ? element.getAttribute('title') : null,
          text: (element.textContent || '').trim().slice(0, 100),
        });
        element = element.parentElement;
      }
      return { chain };
    }

    report('module-load');

    const zh = {
      'menu.preview': '打开（预览）',
      'menu.quote': '引用该文件',
      'menu.openDefault': '用默认应用打开',
      'menu.reveal': '打开文件夹',
      'menu.saveAs': '另存为…',
      'menu.busy': '处理中…',
      'error.generic': '操作失败',
      'error.open': '打开失败',
      'error.reveal': '打开文件夹失败',
      'error.save': '另存为失败',
      'error.tooLarge': '文件过大，暂不支持另存为',
      'error.resolve': '无法定位文件路径',
      'error.preview': '无法在侧栏预览该文件',
      'error.quote': '无法插入文件引用',
    };
    const en = {
      'menu.preview': 'Open preview',
      'menu.quote': 'Reference this file',
      'menu.openDefault': 'Open with default app',
      'menu.reveal': 'Show in folder',
      'menu.saveAs': 'Save as…',
      'menu.busy': 'Working…',
      'error.generic': 'Action failed',
      'error.open': 'Could not open the file',
      'error.reveal': 'Could not show the file location',
      'error.save': 'Could not save a copy',
      'error.tooLarge': 'File is too large to save a copy',
      'error.resolve': 'Could not resolve the file path',
      'error.preview': 'Could not preview this file',
      'error.quote': 'Could not insert the file reference',
    };

    // ---------------------------------------------------------------- paths

    function isAbsolutePath(value) {
      if (typeof value !== 'string') return false;
      return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') || value.startsWith('/');
    }

    function decodeSegment(value) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }

    function decodePath(value) {
      return value.split('/').map(decodeSegment).join('/');
    }

    function fileName(path) {
      const parts = String(path).split(/[\\/]/).filter(Boolean);
      return parts.length === 0 ? 'file' : parts[parts.length - 1];
    }

    function stripLineAnchor(value) {
      return String(value).replace(/#L\d+(?:-L?\d+)?$/, '');
    }

    function parseAddress(href) {
      if (typeof href !== 'string' || !href.startsWith(SESSION_PREFIX)) return null;
      const rest = href.slice(SESSION_PREFIX.length);
      const split = rest.indexOf('/');
      if (split <= 0) return null;
      const sessionId = decodeSegment(rest.slice(0, split));
      const path = decodePath(rest.slice(split + 1));
      if (!sessionId || !path) return null;
      return { sessionId, path, address: href };
    }

    const FILE_TITLE_PATTERN = /^[^<>|?*\r\n]{1,400}\.(md|markdown|docx?|pdf|txt|py|js|mjs|cjs|ts|tsx|jsx|json|jsonl|xlsx?|csv|pptx?|html?|css|scss|tex|caj|png|jpe?g|gif|svg|zip|yaml|yml|toml|ini|cfg|log|ipynb|r|do|sav|dta)$/iu;

    function pathFromTitle(element) {
      if (!element || typeof element.getAttribute !== 'function') return null;
      const title = element.getAttribute('title');
      if (!title || title.length > 4096) return null;
      const value = stripLineAnchor(title.trim());
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null;
      if (!FILE_TITLE_PATTERN.test(value)) return null;
      return value;
    }

    function pathFromHref(href) {
      if (typeof href !== 'string') return null;
      const value = href.trim();
      if (!value || value.startsWith('#') || value.startsWith('data:')) return null;
      if (isAbsolutePath(value)) return stripLineAnchor(value);
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
      if (value.includes('/') || value.includes('\\') || /\.[A-Za-z0-9]{1,8}(?::\d+(?:-\d+)?)?$/.test(value)) {
        return stripLineAnchor(value);
      }
      return null;
    }

    function isInteractive(element) {
      const tag = element.tagName;
      if (tag === 'A' || tag === 'BUTTON') return true;
      const role = element.getAttribute('role');
      return role === 'button' || role === 'link' || role === 'menuitem';
    }

    function findCandidate(target, flow, store) {
      if (!(target instanceof Element)) return null;
      const currentSessionId = store ? store.getSnapshot().currentSessionId : null;
      for (let element = target; element && element !== flow.parentElement; element = element.parentElement) {
        if (element === flow) break;
        const address = parseAddress(element.getAttribute && element.getAttribute('href'));
        if (address) {
          return {
            element,
            mode: 'address',
            sessionId: address.sessionId,
            path: address.path,
            address: address.address,
            absolutePath: null,
          };
        }
        const titled = pathFromTitle(element);
        if (titled && isInteractive(element)) {
          return {
            element,
            mode: 'path',
            sessionId: currentSessionId,
            path: titled,
            address: null,
            absolutePath: isAbsolutePath(titled) ? titled : null,
          };
        }
        const hrefPath = pathFromHref(element.getAttribute && element.getAttribute('href'));
        if (hrefPath && (element.tagName === 'A' || isInteractive(element))) {
          return {
            element,
            mode: 'path',
            sessionId: currentSessionId,
            path: hrefPath,
            address: null,
            absolutePath: isAbsolutePath(hrefPath) ? hrefPath : null,
          };
        }
      }
      return null;
    }

    const FILE_TEXT_PATTERN = /^[\w@.()\[\]\-\\/\u4e00-\u9fa5 {}]+\.(md|markdown|docx?|pdf|txt|py|js|mjs|cjs|ts|tsx|jsx|json|jsonl|xlsx?|csv|pptx?|html?|css|scss|tex|caj|png|jpe?g|gif|svg|zip|yaml|yml|toml|ini|cfg|log|ipynb|r|do|sav|dta)$/iu;

    function normalizeTextCandidate(value) {
      if (typeof value !== 'string') return null;
      let text = value.trim();
      if (text.length === 0 || text.length > 260 || /[\r\n]/.test(text)) return null;
      text = text.replace(/^["'`]+|["'`]+$/g, '').trim();
      text = text.replace(/^@+/u, '').replace(/:\d+(?:-\d+)?$/u, '');
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return null;
      if (!FILE_TEXT_PATTERN.test(text)) return null;
      return text;
    }

    function findTextCandidate(target, flow, store) {
      if (!(target instanceof Element)) return null;
      const sessionId = store.getSnapshot().currentSessionId;
      if (!sessionId) return null;
      for (let element = target; element && element !== flow.parentElement; element = element.parentElement) {
        if (element === flow) break;
        if (element.childElementCount !== 0) continue;
        const candidate = normalizeTextCandidate(element.textContent);
        if (!candidate) continue;
        return {
          element,
          mode: 'text',
          sessionId,
          path: candidate,
          address: null,
          absolutePath: isAbsolutePath(candidate) ? candidate : null,
        };
      }
      return null;
    }

    // ---------------------------------------------------------------- state

    function createMenuStore() {
      let state = { open: false, file: null, x: 0, y: 0, busy: null, error: null, canOpen: null, currentSessionId: null };
      const listeners = new Set();
      const emit = () => {
        for (const listener of listeners) listener();
      };
      return {
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSnapshot() {
          return state;
        },
        patch(next) {
          state = { ...state, ...next };
          emit();
        },
        openAt(file, x, y) {
          state = { ...state, open: true, file, x, y, busy: null, error: null };
          emit();
        },
        close() {
          if (!state.open) return;
          state = { ...state, open: false, file: null, busy: null, error: null };
          emit();
        },
      };
    }

    // --------------------------------------------------------------- actions

    async function resolveAbsolute(file, ctx) {
      if (file.absolutePath) return file.absolutePath;
      const sessionId = file.sessionId;
      if (sessionId) {
        const result = await ctx.remote.workspaceFiles.stat(sessionId, file.path);
        if (result && result.ok === true && result.value && result.value.absolutePath) {
          file.absolutePath = result.value.absolutePath;
          return file.absolutePath;
        }
      }
      throw new Error('resolve');
    }

    function encodeSegment(segment) {
      return encodeURIComponent(segment).replace(/%3A/gi, ':');
    }

    function encodePath(path) {
      return path.split('/').map(encodeSegment).join('/');
    }

    function fileAddressFor(sessionId, path) {
      const normalized = String(path).replace(/\\/g, '/').replace(/^\.\//, '');
      return `${FILE_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
    }

    function openPreview(file, ctx, store) {
      if (file.address) {
        ctx.sidebarRight.openResource(file.address);
        return;
      }
      const sessionId = file.sessionId || store.getSnapshot().currentSessionId;
      if (sessionId && file.path) {
        ctx.sidebarRight.openResource(fileAddressFor(sessionId, file.path));
        return;
      }
      if (file.element && typeof file.element.click === 'function') {
        file.element.click();
        return;
      }
      throw new Error('preview');
    }

    async function openNative(file, action, ctx) {
      const absolutePath = await resolveAbsolute(file, ctx);
      const request = action === 'reveal' ? { path: absolutePath, action } : { path: absolutePath };
      const result = await ctx.remote.session.openWorkspacePath(request);
      if (!result || result.ok !== true) throw new Error(action);
    }

    async function saveCopy(file, ctx, t) {
      const absolutePath = await resolveAbsolute(file, ctx);
      const url = new URL('api/file', document.baseURI);
      url.searchParams.set('path', absolutePath);
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) {
        if (response.status === 413) throw new Error(t('error.tooLarge'));
        throw new Error(t('error.save'));
      }
      const blob = await response.blob();
      const name = fileName(absolutePath);
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: name });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (error) {
          if (error && error.name === 'AbortError') return;
        }
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = name;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    }

    function mentionFor(path) {
      if (typeof path !== 'string' || path.length === 0) return null;
      const normalized = path.replace(/\\/g, '/');
      if (/[\u0000-\u001f\u007f-\u009f"]/u.test(normalized)) return null;
      return /\s/u.test(normalized) ? `@"${normalized}"` : `@${normalized}`;
    }

    function sessionCwd(ctx, sessionId) {
      try {
        const sessions = ctx.get('sessions');
        const entry = sessions && sessions.list ? sessions.list.getSnapshot().byId[sessionId] : undefined;
        return entry && typeof entry.cwd === 'string' ? entry.cwd : null;
      } catch {
        return null;
      }
    }

    function relativeToCwd(path, cwd) {
      if (!cwd) return path;
      const normalized = path.replace(/\\/g, '/');
      const base = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
      if (normalized === base) return normalized;
      if (normalized.startsWith(base + '/')) return normalized.slice(base.length + 1);
      return normalized;
    }

    function quoteReference(file, ctx, store) {
      const sessionId = file.sessionId || store.getSnapshot().currentSessionId;
      if (!sessionId) throw new Error('quote');
      const cwd = sessionCwd(ctx, sessionId);
      const mention = mentionFor(relativeToCwd(file.path, cwd));
      if (!mention) throw new Error('quote');
      const conversation = ctx.get('conversation');
      const shell =
        conversation && conversation.input && typeof conversation.input.shell === 'function'
          ? conversation.input.shell(sessionId)
          : undefined;
      if (!shell || typeof shell.addFiles !== 'function') throw new Error('quote');
      const reference = {
        source: 'reference',
        ref: mention,
        label: fileName(file.path),
        appearance: 'file',
        clipboardText: mention,
      };
      if (shell.addFiles([reference], []) !== true) throw new Error('quote');
    }

    async function perform(file, action, ctx, t, store) {
      if (action === 'preview') return openPreview(file, ctx, store);
      if (action === 'quote') return quoteReference(file, ctx, store);
      if (action === 'open' || action === 'reveal') return openNative(file, action, ctx);
      if (action === 'saveAs') return saveCopy(file, ctx, t);
      throw new Error('unknown-action');
    }

    // ------------------------------------------------------------------- ui

    const menuStyle = {
      position: 'fixed',
      zIndex: 2147483000,
      width: MENU_WIDTH,
      padding: '5px',
      borderRadius: '10px',
      border: '0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.28))',
      background: 'var(--dsw-alias-bg-l1, #fdfdfd)',
      boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
      color: 'var(--dsw-alias-text-l1, #18181b)',
      font: '13px/1.4 var(--dsw-font-sans, system-ui, sans-serif)',
      userSelect: 'none',
    };
    const headerStyle = {
      padding: '5px 9px 7px',
      opacity: 0.62,
      fontSize: '12px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      direction: 'ltr',
    };
    const itemStyle = {
      display: 'block',
      width: '100%',
      padding: '7px 9px',
      border: 0,
      borderRadius: '7px',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
    };
    const separatorStyle = {
      height: '1px',
      margin: '4px 6px',
      background: 'var(--dsw-alias-border-l2, rgba(127,127,127,0.22))',
    };
    const errorStyle = {
      margin: '4px 6px 2px',
      padding: '5px 8px',
      borderRadius: '7px',
      background: 'var(--dsw-static-red-50, rgba(220,38,38,0.12))',
      color: 'var(--dsw-alias-text-error, #b91c1c)',
      fontSize: '12px',
      whiteSpace: 'normal',
    };

    function FileActionMenu(props) {
      const { store, run, t } = props;
      const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      const menuRef = React.useRef(null);

      React.useEffect(() => {
        if (!state.open) return undefined;
        const onPointer = (event) => {
          if (menuRef.current && !menuRef.current.contains(event.target)) store.close();
        };
        const onKey = (event) => {
          if (event.key === 'Escape') store.close();
        };
        const onDismiss = () => store.close();
        window.addEventListener('mousedown', onPointer, true);
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('scroll', onDismiss, true);
        window.addEventListener('resize', onDismiss);
        return () => {
          window.removeEventListener('mousedown', onPointer, true);
          window.removeEventListener('keydown', onKey, true);
          window.removeEventListener('scroll', onDismiss, true);
          window.removeEventListener('resize', onDismiss);
        };
      }, [state.open, store]);

      if (!state.open || !state.file) return null;

      const left = Math.max(8, Math.min(state.x, window.innerWidth - MENU_WIDTH - 8));
      const top = Math.max(8, Math.min(state.y, window.innerHeight - MENU_ESTIMATED_HEIGHT - 8));

      const items = [];
      const makeItem = (action, label) =>
        h(
          'button',
          {
            key: action,
            type: 'button',
            role: 'menuitem',
            disabled: state.busy !== null,
            onClick: () => run(action),
            style: itemStyle,
            onMouseEnter: (event) => {
              event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.14))';
            },
            onMouseLeave: (event) => {
              event.currentTarget.style.background = 'transparent';
            },
          },
          state.busy === action ? t('menu.busy') : label,
        );

      items.push(makeItem('preview', t('menu.preview')));
      if (state.file.sessionId || state.currentSessionId) items.push(makeItem('quote', t('menu.quote')));
      if (state.canOpen !== false) {
        items.push(makeItem('open', t('menu.openDefault')));
        items.push(makeItem('reveal', t('menu.reveal')));
      }
      items.push(h('div', { key: 'separator', role: 'separator', style: separatorStyle }));
      items.push(makeItem('saveAs', t('menu.saveAs')));

      return h(
        'div',
        {
          ref: menuRef,
          role: 'menu',
          'aria-label': t('menu.preview'),
          style: { ...menuStyle, left: `${left}px`, top: `${top}px` },
          onContextMenu: (event) => event.preventDefault(),
        },
        h('div', { style: headerStyle, title: state.file.absolutePath || state.file.path }, fileName(state.file.path)),
        ...items,
        state.error ? h('div', { role: 'alert', style: errorStyle }, state.error) : null,
      );
    }

    // ---------------------------------------------------------------- plugin

    function SessionProbe(props) {
      const { store, sessionId } = props;
      React.useEffect(() => {
        store.patch({ currentSessionId: sessionId === undefined ? null : sessionId });
      }, [store, sessionId]);
      return null;
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session', 'remote.workspaceFiles', 'sidebarRight'],
      apply(ctx) {
        report('apply-start');
        try {
          ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'file-actions: dictionaries');
        const t = ctx.locale.bind(NS);
        const store = createMenuStore();

        const availability = ctx.remote.session.canOpenWorkspacePath();
        Promise.resolve(availability)
          .then((result) => {
            store.patch({ canOpen: result && result.ok === true && result.value === true });
          })
          .catch(() => store.patch({ canOpen: false }));

        ctx.effect(() => {
          const onContextMenu = (event) => {
            const target = event.target;
            const flow = target instanceof Element ? target.closest('[data-chat-flow]') : null;
            if (!flow) return;
            const file = findCandidate(target, flow, store) || findTextCandidate(target, flow, store);
            if (!file) {
              report('miss', describeTarget(target));
              return;
            }
            report('hit', { mode: file.mode, path: file.path });
            event.preventDefault();
            event.stopPropagation();
            store.openAt(file, event.clientX, event.clientY);
          };
          window.addEventListener('contextmenu', onContextMenu, true);
          return () => window.removeEventListener('contextmenu', onContextMenu, true);
        }, 'file-actions: contextmenu');

        const run = async (action) => {
          const snapshot = store.getSnapshot();
          const file = snapshot.file;
          if (!file || snapshot.busy !== null) return;
          store.patch({ busy: action, error: null });
          try {
            await perform(file, action, ctx, t, store);
            store.close();
          } catch (error) {
            const cancelled = error && error.name === 'AbortError';
            if (cancelled) {
              store.patch({ busy: null });
            } else {
              const key = error && error.message;
              const text =
                key === 'resolve'
                  ? t('error.resolve')
                  : key === 'preview'
                    ? t('error.preview')
                    : key === 'reveal'
                      ? t('error.reveal')
                      : key === 'open'
                        ? t('error.open')
                        : key === 'quote'
                          ? t('error.quote')
                          : key && key.startsWith('error.')
                            ? t(key)
                            : t('error.generic');
              store.patch({ busy: null, error: text });
            }
          }
        };

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'file-actions.menu',
              locale: NS,
              inject: () => ({ store, run, t }),
            },
            FileActionMenu,
          ),
        );

        try {
          ctx.slots.inject('conversation.composer.dock', () =>
            ctx.slots.register(
              {
                name: 'conversation.composer.dock',
                id: 'file-actions.session-probe',
                order: 99,
                inject: (sessionId) => ({ sessionId, store }),
              },
              SessionProbe,
            ),
          );
        } catch (error) {
          report('probe-error', { message: String(error && error.message) });
        }
        report('apply-done');
        } catch (error) {
          report('apply-error', {
            message: String(error && error.message),
            stack: String(error && error.stack).slice(0, 2000),
          });
          throw error;
        }
      },
    };
  },
});
