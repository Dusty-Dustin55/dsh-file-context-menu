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
      'menu.quoteFile': '引用该文件',
      'menu.quoteLink': '引用链接',
      'menu.copyName': '复制名称',
      'menu.copyPath': '复制路径',
      'menu.copyLink': '复制链接',
      'menu.openInternal': '打开（内部）',
      'menu.openDefault': '打开（默认应用）',
      'menu.openFolder': '打开文件夹',
      'menu.openWorkspaceFolder': '打开工作区文件夹',
      'menu.chooseApp': '选择应用打开…',
      'menu.reveal': '打开所在文件夹',
      'menu.saveAs': '另存为…',
      'menu.openLink': '打开（默认浏览器）',
      'menu.chooseBrowser': '选择浏览器打开…',
      'menu.back': '返回',
      'menu.loading': '加载中…',
      'menu.defaultMark': '（默认）',
      'menu.busy': '处理中…',
      'error.generic': '操作失败',
      'error.open': '打开失败',
      'error.reveal': '打开文件夹失败',
      'error.save': '另存为失败',
      'error.tooLarge': '文件过大，暂不支持另存为',
      'error.resolve': '无法定位文件路径',
      'error.preview': '无法在侧栏打开',
      'error.quote': '无法插入引用',
      'error.copy': '复制失败',
      'error.url': '无法打开链接',
      'error.browsers': '无法获取浏览器列表',
      'error.apps': '无法获取应用列表',
      'error.openWith': '无法打开系统应用选择框',
    };
    const en = {
      'menu.quoteFile': 'Reference this file',
      'menu.quoteLink': 'Reference this link',
      'menu.copyName': 'Copy name',
      'menu.copyPath': 'Copy path',
      'menu.copyLink': 'Copy link',
      'menu.openInternal': 'Open inside DSH',
      'menu.openDefault': 'Open with default app',
      'menu.openFolder': 'Open folder',
      'menu.openWorkspaceFolder': 'Open workspace folder',
      'menu.chooseApp': 'Open with…',
      'menu.reveal': 'Open containing folder',
      'menu.saveAs': 'Save as…',
      'menu.openLink': 'Open in default browser',
      'menu.chooseBrowser': 'Open in browser…',
      'menu.back': 'Back',
      'menu.loading': 'Loading…',
      'menu.defaultMark': ' (default)',
      'menu.busy': 'Working…',
      'error.generic': 'Action failed',
      'error.open': 'Could not open the file',
      'error.reveal': 'Could not show the file location',
      'error.save': 'Could not save a copy',
      'error.tooLarge': 'File is too large to save a copy',
      'error.resolve': 'Could not resolve the file path',
      'error.preview': 'Could not open inside DSH',
      'error.quote': 'Could not insert the reference',
      'error.copy': 'Could not copy',
      'error.url': 'Could not open the link',
      'error.browsers': 'Could not list browsers',
      'error.apps': 'Could not list applications',
      'error.openWith': 'Could not open the system app chooser',
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

    function linkName(element, href) {
      const text = (element && typeof element.textContent === 'string' ? element.textContent : '').trim().replace(/\s+/g, ' ');
      if (text.length > 0) return text.slice(0, 200);
      try {
        return new URL(href).host;
      } catch {
        return href;
      }
    }

    function displayName(file) {
      if (file && typeof file.label === 'string' && file.label.length > 0) return file.label;
      if (file && file.mode === 'url') {
        try {
          return new URL(file.url).host;
        } catch {
          return file.url;
        }
      }
      if (file && typeof file.path === 'string' && file.path.length > 0) return fileName(file.path);
      return '';
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

    const KNOWN_EXTENSIONS = new Set(
      (
        'md markdown mdx txt text rtf pdf doc docx xls xlsx xlsm ppt pptx pps ppsx ' +
        'odt ods odp wps et dps caj ofd epub mobi azw3 djvu djv tex bib ris enw nbib ' +
        'csv tsv json jsonl ndjson yaml yml xml html htm css scss less ' +
        'js mjs cjs ts tsx jsx vue svelte py ipynb r rmd qmd do ado sav dta sas sps ' +
        'rds rdata zsav por xpt dct sql db sqlite sqlite3 parquet feather pkl pickle npy npz h5 hdf5 mat nc ' +
        'shp shx dbf prj geojson kml kmz gpx mdb accdb xmind mm drawio vsdx ' +
        'psd ai eps svgz svg png jpg jpeg jfif gif webp bmp tif tiff ico heic avif jxl apng raw dng ' +
        'mp3 wav flac m4a m4b aac ogg opus wma aiff ape mid midi ' +
        'mp4 mov avi mkv webm wmv flv m4v mpd mpeg mpg m2ts 3gp srt ass vtt ' +
        'zip rar 7z tar gz tgz bz2 xz zst iso dmg exe msi apk jar war class ' +
        'java c h cpp hpp cc go rs php rb swift kt kts sh bash zsh bat cmd ps1 ' +
        'log cfg ini toml conf env properties lock patch diff rst org sty cls bst ' +
        'aux toc bbl blg fls fdb_latexmk synctex out ' +
        'pages key numbers chm oxps xps dwg dxf stl obj fbx blend skp mpp vsd one pub ' +
        'docm dot dotx xltx potx mht mhtml webarchive sas7bdat step stp iges igs gcode bcf ' +
        'woff woff2 ttf otf eot ps torrent crx xpi vsix nupkg csl enl nh'
      ).split(/\s+/u),
    );

    const SPECIAL_FILENAMES = new Set([
      'makefile',
      'dockerfile',
      'license',
      'readme',
      'changelog',
      'contributing',
      'authors',
      'notice',
      'gemfile',
      'procfile',
      'vagrantfile',
      'gitignore',
      'gitattributes',
      'editorconfig',
      'npmrc',
      'nvmrc',
      'prettierrc',
      'eslintrc',
    ]);

    const INVALID_PATH_CHARS = /[<>"|?*\u0000-\u001f\r\n]/u;

    function looksLikePath(value) {
      if (typeof value !== 'string') return false;
      if (value.length === 0 || value.length > 400) return false;
      if (INVALID_PATH_CHARS.test(value)) return false;
      const rest = value.replace(/^[A-Za-z]:[\\/]/u, '');
      if (rest.includes(':')) return false;
      return true;
    }

    function baseNameOf(value) {
      const parts = value.split(/[\\/]/u);
      return parts[parts.length - 1] || '';
    }

    function extensionOf(value) {
      const match = /\.([A-Za-z0-9]{1,12})$/u.exec(value);
      return match ? match[1].toLowerCase() : null;
    }

    function hasPathSeparator(value) {
      return value.includes('/') || value.includes('\\');
    }

    function classifyPathText(value) {
      if (!looksLikePath(value)) return null;
      if (value.endsWith('/') || value.endsWith('\\')) return 'directory';
      const base = baseNameOf(value);
      if (base.length === 0) return null;
      if (SPECIAL_FILENAMES.has(base.toLowerCase())) return 'file';
      if (base.startsWith('.') && base.length > 1) return 'file';
      const extension = extensionOf(base);
      if (extension !== null) {
        if (KNOWN_EXTENSIONS.has(extension) || hasPathSeparator(value) || /[\u3400-\u9fff]/u.test(base)) return 'file';
        return null;
      }
      if (hasPathSeparator(value)) return 'entry';
      return null;
    }

    function pathFromTitle(element) {
      if (!element || typeof element.getAttribute !== 'function') return null;
      const title = element.getAttribute('title');
      if (!title || title.length > 4096) return null;
      const value = stripLineAnchor(title.trim());
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null;
      const kind = classifyPathText(value);
      if (kind === null) return null;
      return { value, kind };
    }

    function pathFromHref(href) {
      if (typeof href !== 'string') return null;
      const value = stripLineAnchor(href.trim());
      if (!value || value.startsWith('#') || value.startsWith('data:')) return null;
      if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[A-Za-z]:[\\/]/.test(value)) return null;
      if (!isAbsolutePath(value) && !hasPathSeparator(value) && classifyPathText(value) === null) return null;
      const kind = classifyPathText(value);
      if (kind === null) return null;
      return { value, kind };
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
        const elementHref = element.getAttribute && element.getAttribute('href');
        if (element.tagName === 'A' && typeof elementHref === 'string' && /^https?:\/\//i.test(elementHref)) {
          return {
            element,
            mode: 'url',
            url: elementHref,
            label: linkName(element, elementHref),
            sessionId: null,
            path: null,
            address: null,
            absolutePath: null,
          };
        }
        const address = parseAddress(elementHref);
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
            mode: titled.kind === 'file' ? 'path' : titled.kind,
            sessionId: currentSessionId,
            path: titled.value,
            address: null,
            absolutePath: isAbsolutePath(titled.value) ? titled.value : null,
          };
        }
        const hrefPath = pathFromHref(element.getAttribute && element.getAttribute('href'));
        if (hrefPath && (element.tagName === 'A' || isInteractive(element))) {
          return {
            element,
            mode: hrefPath.kind === 'file' ? 'path' : hrefPath.kind,
            sessionId: currentSessionId,
            path: hrefPath.value,
            address: null,
            absolutePath: isAbsolutePath(hrefPath.value) ? hrefPath.value : null,
          };
        }
      }
      return null;
    }

    function normalizeTextCandidate(value) {
      if (typeof value !== 'string') return null;
      let text = value.trim();
      if (text.length === 0 || text.length > 400 || /[\r\n]/.test(text)) return null;
      text = text.replace(/^@+/u, '').trim();
      text = text.replace(/^["'`]+|["'`]+$/g, '').trim();
      text = text.replace(/:\d+(?:-\d+)?$/u, '');
      text = stripLineAnchor(text);
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return null;
      if (!looksLikePath(text)) return null;
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
        const kind = classifyPathText(candidate);
        if (kind === null) continue;
        return {
          element,
          mode: kind === 'file' ? 'text' : kind,
          sessionId,
          path: candidate,
          address: null,
          absolutePath: isAbsolutePath(candidate) ? candidate : null,
        };
      }
      return null;
    }

    function findPlainUrlCandidate(target, flow) {
      if (!(target instanceof Element)) return null;
      for (let element = target; element && element !== flow.parentElement; element = element.parentElement) {
        if (element === flow) break;
        if (element.childElementCount !== 0) continue;
        const text = (element.textContent || '').trim();
        if (text.length < 8 || text.length > 2048 || /\s/u.test(text) || !/^https?:\/\//iu.test(text)) continue;
        const url = text.replace(/[.,;:!?]+$/u, '');
        if (!/^https?:\/\/[^\s<>"']+$/iu.test(url)) continue;
        let label;
        try {
          label = new URL(url).host;
        } catch {
          label = url;
        }
        return {
          element,
          mode: 'url',
          url,
          label,
          sessionId: null,
          path: null,
          address: null,
          absolutePath: null,
        };
      }
      return null;
    }

    function findAttachmentCandidate(target, flow, store) {
      if (!(target instanceof Element)) return null;
      const card = target.closest('[data-message-attachments] [title]');
      if (!card) return null;
      if (typeof flow.contains === 'function' && !flow.contains(card)) return null;
      const name = card.getAttribute('title');
      if (typeof name !== 'string' || name.length === 0) return null;
      if (classifyPathText(name) !== 'file') return null;
      return {
        element: card,
        mode: 'attachment',
        sessionId: store.getSnapshot().currentSessionId,
        path: name,
        label: name,
        address: null,
        absolutePath: null,
      };
    }

    function findSidebarCandidate(target, ctx, store) {
      if (!(target instanceof Element)) return null;
      const entry = target.closest('[data-files-entry]');
      if (entry) {
        if (entry.getAttribute('data-files-entry') !== 'directory') return null;
        const path = entry.getAttribute('data-files-path');
        if (typeof path !== 'string' || path.length === 0) return null;
        return {
          element: entry,
          mode: 'directory',
          sessionId: store.getSnapshot().currentSessionId,
          path,
          label: fileName(path),
          address: null,
          absolutePath: isAbsolutePath(path) ? path : null,
        };
      }
      const row = target.closest('[data-row-key^="workspace:"]');
      if (!row) return null;
      const key = row.getAttribute('data-row-key') || '';
      const workspaceId = key.slice('workspace:'.length);
      if (!workspaceId) return null;
      let path;
      let label;
      try {
        const workspaces = ctx.get('workspaces');
        const items = workspaces && workspaces.list ? workspaces.list.getSnapshot().items : [];
        const workspace = items.find((item) => item && item.workspaceId === workspaceId);
        if (workspace && typeof workspace.path === 'string' && workspace.path.length > 0) {
          path = workspace.path;
          label = typeof workspace.title === 'string' && workspace.title.length > 0 ? workspace.title : fileName(path);
        }
      } catch {
        path = undefined;
      }
      if (path === undefined) return null;
      return {
        element: row,
        mode: 'workspace',
        sessionId: store.getSnapshot().currentSessionId,
        path,
        label,
        address: null,
        absolutePath: isAbsolutePath(path) ? path : null,
      };
    }

    // ---------------------------------------------------------------- state


    function createMenuStore() {
      let state = {
        open: false,
        file: null,
        x: 0,
        y: 0,
        busy: null,
        error: null,
        canOpen: null,
        currentSessionId: null,
        view: 'main',
        options: null,
        viewError: null,
        entryKind: null,
      };
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
          state = {
            ...state,
            open: true,
            file,
            x,
            y,
            busy: null,
            error: null,
            view: 'main',
            options: null,
            viewError: null,
            entryKind: null,
          };
          emit();
        },
        close() {
          if (!state.open) return;
          state = {
            ...state,
            open: false,
            file: null,
            busy: null,
            error: null,
            view: 'main',
            options: null,
            viewError: null,
            entryKind: null,
          };
          emit();
        },
      };
    }

    // --------------------------------------------------------------- actions

    function absoluteForPath(file, ctx) {
      if (file.absolutePath) return file.absolutePath;
      const sessionId = file.sessionId;
      if (!sessionId || typeof file.path !== 'string' || file.path.length === 0) return null;
      if (isAbsolutePath(file.path)) return file.path;
      const cwd = sessionCwd(ctx, sessionId);
      if (!cwd) return null;
      const base = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
      const relative = file.path.replace(/\\/g, '/').replace(/^\.\//, '');
      return `${base}/${relative}`;
    }

    async function resolveAbsolute(file, ctx) {
      if (file.absolutePath) return file.absolutePath;
      const sessionId = file.sessionId;
      if (sessionId && file.path) {
        try {
          const result = await ctx.remote.workspaceFiles.stat(sessionId, file.path);
          if (result && result.ok === true && result.value && result.value.absolutePath) {
            file.absolutePath = result.value.absolutePath;
            return file.absolutePath;
          }
        } catch {
          // fall through to the cwd join below
        }
      }
      const fallback = absoluteForPath(file, ctx);
      if (fallback) return fallback;
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

    function quoteUrl(url, ctx, store) {
      const sessionId = store.getSnapshot().currentSessionId;
      if (!sessionId) throw new Error('quote');
      const conversation = ctx.get('conversation');
      const shell =
        conversation && conversation.input && typeof conversation.input.shell === 'function'
          ? conversation.input.shell(sessionId)
          : undefined;
      if (!shell || typeof shell.requestDraftInitialization !== 'function') throw new Error('quote');
      const result = shell.requestDraftInitialization({ prompt: url, whenDraftExists: 'append' });
      if (result === 'blocked' || result === 'preserved') throw new Error('quote');
    }

    async function copyPath(file, ctx) {
      let value = file.absolutePath;
      if (!value) {
        try {
          value = await resolveAbsolute(file, ctx);
        } catch {
          value = file.path;
        }
      }
      if (typeof value !== 'string' || value.length === 0) throw new Error('copy');
      await navigator.clipboard.writeText(value);
    }

    function openUrlInternally(url, ctx) {
      const tabs = ctx.get('sidebarRightTabs');
      if (tabs && typeof tabs.get === 'function' && tabs.get('browser') === undefined) {
        throw new Error('preview');
      }
      ctx.sidebarRight.openTab('browser', { params: { url } });
    }

    function apiPath(relative) {
      const value = String(relative).replace(/^\/+/, '');
      if (typeof document === 'undefined') return '/' + value;
      try {
        return new URL(value, document.baseURI).pathname;
      } catch {
        return '/' + value;
      }
    }

    async function fetchBrowsers() {
      const response = await fetch(apiPath('file-actions/browsers'), {
        headers: { 'x-file-actions': '1' },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('browsers');
      const body = await response.json();
      return Array.isArray(body && body.browsers) ? body.browsers : [];
    }

    async function openUrl(url, browserId) {
      const response = await fetch(apiPath('file-actions/open-url'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-file-actions': '1' },
        credentials: 'same-origin',
        body: JSON.stringify(browserId === undefined ? { url } : { url, browserId }),
      });
      if (!response.ok) throw new Error('url');
    }

    async function listApplications(file, ctx) {
      const absolutePath = await resolveAbsolute(file, ctx);
      const result = await ctx.remote.session.workspacePathApplications({ path: absolutePath });
      if (!result || result.ok !== true || !Array.isArray(result.value)) throw new Error('apps');
      return result.value;
    }

    async function openWithApplication(file, applicationId, ctx) {
      const absolutePath = await resolveAbsolute(file, ctx);
      const result = await ctx.remote.session.openWorkspacePath({ path: absolutePath, application: applicationId });
      if (!result || result.ok !== true) throw new Error('open');
    }

    function hasSystemChooser() {
      try {
        const platform = navigator.platform || '';
        const agent = navigator.userAgent || '';
        return /^Win/i.test(platform) || /Windows/u.test(agent) || /^Mac/i.test(platform) || /Mac OS X/u.test(agent);
      } catch {
        return false;
      }
    }

    async function openWithSystem(file, ctx) {
      const absolutePath = await resolveAbsolute(file, ctx);
      const response = await fetch(apiPath('file-actions/open-with'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-file-actions': '1' },
        credentials: 'same-origin',
        body: JSON.stringify({ path: absolutePath }),
      });
      if (response.status === 501) throw new Error('unsupported');
      if (!response.ok) throw new Error('openWith');
    }

    async function fetchPathKind(absolutePath) {
      const response = await fetch(apiPath('file-actions/kind'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-file-actions': '1' },
        credentials: 'same-origin',
        body: JSON.stringify({ path: absolutePath }),
      });
      if (!response.ok) throw new Error('kind');
      const body = await response.json();
      return body && body.kind ? body.kind : 'unknown';
    }

    async function resolveEntryKind(file, ctx, store) {
      try {
        const absolutePath = absoluteForPath(file, ctx) || (await resolveAbsolute(file, ctx));
        const kind = await fetchPathKind(absolutePath);
        store.patch({ entryKind: kind === 'directory' ? 'directory' : kind === 'file' ? 'file' : 'unknown' });
      } catch {
        store.patch({ entryKind: 'unknown' });
      }
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
      maxHeight: '60vh',
      overflowY: 'auto',
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

    const loadingStyle = {
      padding: '7px 9px',
      opacity: 0.6,
      fontSize: '12px',
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

      const file = state.file;
      const isUrl = file.mode === 'url';
      const left = Math.max(8, Math.min(state.x, window.innerWidth - MENU_WIDTH - 8));
      const top = Math.max(8, Math.min(state.y, window.innerHeight - MENU_ESTIMATED_HEIGHT - 8));

      const makeItem = (action, label, payload) =>
        h(
          'button',
          {
            key: `${action}:${payload === undefined ? '' : payload}`,
            type: 'button',
            role: 'menuitem',
            disabled: state.busy !== null,
            onClick: () => run(action, payload),
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

      const separator = (key) => h('div', { key, role: 'separator', style: separatorStyle });
      const items = [];

      if (state.view === 'browsers' || state.view === 'apps') {
        items.push(makeItem('back', `← ${t('menu.back')}`));
        if (state.viewError !== null) {
          items.push(h('div', { key: 'view-error', role: 'alert', style: errorStyle }, state.viewError));
        } else if (state.options === null) {
          items.push(h('div', { key: 'view-loading', style: loadingStyle }, t('menu.loading')));
        } else {
          for (const option of state.options) {
            const label =
              state.view === 'browsers'
                ? option.label
                : `${option.name}${option.default === true ? t('menu.defaultMark') : ''}`;
            items.push(makeItem(state.view === 'browsers' ? 'browser-open' : 'app-open', label, option.id));
          }
        }
      } else if (isUrl) {
        if (state.currentSessionId) items.push(makeItem('quote-url', t('menu.quoteLink')));
        items.push(makeItem('copy-name', t('menu.copyName')));
        items.push(makeItem('copy-url', t('menu.copyLink')));
        items.push(makeItem('open-url-internal', t('menu.openInternal')));
        items.push(separator('separator-url'));
        items.push(makeItem('url-default', t('menu.openLink')));
        items.push(makeItem('url-choose', t('menu.chooseBrowser')));
      } else if (file.mode === 'attachment') {
        items.push(makeItem('copy-name', t('menu.copyName')));
      } else {
        const kind =
          file.mode === 'workspace'
            ? 'workspace'
            : file.mode === 'directory'
              ? 'directory'
              : file.mode === 'entry'
                ? state.entryKind
                : 'file';
        const isWorkspace = kind === 'workspace';
        const isDirectory = kind === 'directory';
        const isPendingEntry = file.mode === 'entry' && state.entryKind === null;
        const isFile = !isDirectory && !isWorkspace && !isPendingEntry && kind !== 'unknown';
        if (isFile && (file.sessionId || state.currentSessionId)) items.push(makeItem('quote', t('menu.quoteFile')));
        items.push(makeItem('copy-name', t('menu.copyName')));
        items.push(makeItem('copy-path', t('menu.copyPath')));
        if (isPendingEntry) {
          items.push(h('div', { key: 'entry-loading', style: loadingStyle }, t('menu.loading')));
        } else if (kind === 'unknown') {
          items.push(h('div', { key: 'entry-error', role: 'alert', style: errorStyle }, t('error.resolve')));
        }
        if (isFile) items.push(makeItem('preview', t('menu.openInternal')));
        if (state.canOpen !== false) {
          items.push(separator('separator-apps'));
          if (isWorkspace) {
            items.push(makeItem('open', t('menu.openWorkspaceFolder')));
            items.push(makeItem('reveal', t('menu.reveal')));
          } else {
            items.push(makeItem('open', isFile ? t('menu.openDefault') : t('menu.openFolder')));
            if (isFile) {
              items.push(makeItem('apps-choose', t('menu.chooseApp')));
              items.push(makeItem('reveal', t('menu.reveal')));
            }
          }
        }
        if (isFile) {
          items.push(separator('separator-save'));
          items.push(makeItem('saveAs', t('menu.saveAs')));
        }
      }

      let headerText;
      let headerTitle;
      if (isUrl) {
        headerTitle = file.url;
        try {
          headerText = new URL(file.url).host;
        } catch {
          headerText = file.url;
        }
      } else {
        headerTitle = file.absolutePath || file.path;
        headerText = displayName(file);
      }

      return h(
        'div',
        {
          ref: menuRef,
          role: 'menu',
          'aria-label': headerText,
          style: { ...menuStyle, left: `${left}px`, top: `${top}px` },
          onContextMenu: (event) => event.preventDefault(),
        },
        h('div', { style: headerStyle, title: headerTitle }, headerText),
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
            const file = flow
              ? findCandidate(target, flow, store) ||
                findTextCandidate(target, flow, store) ||
                findPlainUrlCandidate(target, flow) ||
                findAttachmentCandidate(target, flow, store)
              : findSidebarCandidate(target, ctx, store);
            if (!file) {
              if (flow) report('miss', describeTarget(target));
              return;
            }
            report('hit', { mode: file.mode, path: file.path });
            event.preventDefault();
            event.stopPropagation();
            store.openAt(file, event.clientX, event.clientY);
            if (file.mode === 'entry') void resolveEntryKind(file, ctx, store);
          };
          window.addEventListener('contextmenu', onContextMenu, true);
          return () => window.removeEventListener('contextmenu', onContextMenu, true);
        }, 'file-actions: contextmenu');

        const run = async (action, payload) => {
          const snapshot = store.getSnapshot();
          const file = snapshot.file;
          if (!file) return;
          if (action === 'back') {
            store.patch({ view: 'main', options: null, viewError: null, error: null });
            return;
          }
          if (action === 'url-choose') {
            store.patch({ view: 'browsers', options: null, viewError: null, error: null });
            try {
              const browsers = await fetchBrowsers();
              if (browsers.length === 0) {
                store.patch({ viewError: t('error.browsers') });
              } else {
                store.patch({ options: browsers });
              }
            } catch {
              store.patch({ viewError: t('error.browsers') });
            }
            return;
          }
          if (action === 'apps-choose') {
            if (hasSystemChooser()) {
              store.patch({ busy: action, error: null });
              try {
                await openWithSystem(file, ctx);
                store.close();
                return;
              } catch (error) {
                if (error && error.message !== 'unsupported') {
                  store.patch({ busy: null, error: t('error.openWith') });
                  return;
                }
                store.patch({ busy: null });
              }
            }
            store.patch({ view: 'apps', options: null, viewError: null, error: null });
            try {
              const apps = await listApplications(file, ctx);
              if (apps.length === 0) {
                store.patch({ viewError: t('error.apps') });
              } else {
                store.patch({ options: apps });
              }
            } catch {
              store.patch({ viewError: t('error.apps') });
            }
            return;
          }
          if (snapshot.busy !== null) return;
          store.patch({ busy: action, error: null });
          try {
            if (action === 'url-default') {
              await openUrl(file.url);
            } else if (action === 'open-url-internal') {
              openUrlInternally(file.url, ctx);
            } else if (action === 'quote-url') {
              quoteUrl(file.url, ctx, store);
            } else if (action === 'browser-open') {
              await openUrl(file.url, payload);
            } else if (action === 'copy-name') {
              await navigator.clipboard.writeText(displayName(file));
            } else if (action === 'copy-url') {
              await navigator.clipboard.writeText(file.url);
            } else if (action === 'copy-path') {
              await copyPath(file, ctx);
            } else if (action === 'app-open') {
              await openWithApplication(file, payload, ctx);
            } else {
              await perform(file, action, ctx, t, store);
            }
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
                          : key === 'url'
                            ? t('error.url')
                            : key === 'copy'
                              ? t('error.copy')
                              : key === 'browsers'
                                ? t('error.browsers')
                                : key === 'apps'
                                  ? t('error.apps')
                                  : key === 'openWith'
                                    ? t('error.openWith')
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
