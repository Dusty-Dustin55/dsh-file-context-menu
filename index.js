/**
 * Host half of the file-actions bundle.
 *
 * Besides the plugin row, this half exposes small local HTTP routes used by the
 * browser half:
 *   GET  /file-actions/browsers   installed browsers on this machine
 *   POST /file-actions/open-url   open an http(s) URL in the default or a chosen browser
 *   POST /file-actions/kind       classify an absolute path: file, directory, or unknown
 *   GET/POST /file-actions/diag   opt-in diagnostic reports (local memory only)
 */
import { existsSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';

const reports = [];
const MAX_REPORTS = 200;
const ROUTE_PREFIX = '/file-actions';

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = '';
    let done = false;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      if (done) return;
      body += chunk;
      if (body.length > 64 * 1024) {
        done = true;
        resolve(null);
      }
    });
    request.on('end', () => {
      if (done) return;
      done = true;
      resolve(body);
    });
    request.on('error', () => {
      if (done) return;
      done = true;
      resolve(null);
    });
  });
}

function homeDir() {
  return process.env.USERPROFILE || process.env.HOME || '';
}

function browserCandidates() {
  const list = [];
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';
    const entries = [
      {
        id: 'edge',
        label: 'Microsoft Edge',
        paths: [
          `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
          `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ],
      },
      {
        id: 'chrome',
        label: 'Google Chrome',
        paths: [
          `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
          `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
          `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
        ],
      },
      {
        id: 'firefox',
        label: 'Mozilla Firefox',
        paths: [`${programFiles}\\Mozilla Firefox\\firefox.exe`, `${programFilesX86}\\Mozilla Firefox\\firefox.exe`],
      },
      {
        id: 'brave',
        label: 'Brave',
        paths: [
          `${programFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
          `${localAppData}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
        ],
      },
      {
        id: 'vivaldi',
        label: 'Vivaldi',
        paths: [`${localAppData}\\Vivaldi\\Application\\vivaldi.exe`, `${programFiles}\\Vivaldi\\Application\\vivaldi.exe`],
      },
    ];
    for (const entry of entries) {
      for (const candidate of entry.paths) {
        if (existsSync(candidate)) {
          list.push({ id: entry.id, label: entry.label, path: candidate });
          break;
        }
      }
    }
  } else if (process.platform === 'darwin') {
    const entries = [
      { id: 'safari', label: 'Safari', app: 'Safari', bundled: true },
      { id: 'chrome', label: 'Google Chrome', app: 'Google Chrome', path: '/Applications/Google Chrome.app' },
      { id: 'firefox', label: 'Mozilla Firefox', app: 'Firefox', path: '/Applications/Firefox.app' },
      { id: 'edge', label: 'Microsoft Edge', app: 'Microsoft Edge', path: '/Applications/Microsoft Edge.app' },
      { id: 'brave', label: 'Brave', app: 'Brave Browser', path: '/Applications/Brave Browser.app' },
    ];
    for (const entry of entries) {
      if (entry.bundled || (entry.path !== undefined && existsSync(entry.path))) {
        list.push({ id: entry.id, label: entry.label, app: entry.app });
      }
    }
  } else {
    const entries = [
      { id: 'firefox', label: 'Mozilla Firefox', commands: ['firefox'] },
      { id: 'chrome', label: 'Google Chrome', commands: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'] },
      { id: 'edge', label: 'Microsoft Edge', commands: ['microsoft-edge', 'microsoft-edge-stable'] },
      { id: 'brave', label: 'Brave', commands: ['brave-browser'] },
    ];
    const pathDirs = (process.env.PATH || '').split(':');
    for (const entry of entries) {
      let found;
      for (const name of entry.commands) {
        for (const dir of pathDirs) {
          const candidate = `${dir}/${name}`;
          if (existsSync(candidate)) {
            found = candidate;
            break;
          }
        }
        if (found !== undefined) break;
      }
      if (found !== undefined) list.push({ id: entry.id, label: entry.label, path: found });
    }
  }
  return list;
}

let browserCache = null;
function browsers() {
  if (browserCache === null) browserCache = browserCandidates();
  return browserCache;
}

function launch(url, browserId) {
  const target = browserId === undefined ? undefined : browsers().find((entry) => entry.id === browserId);
  if (browserId !== undefined && target === undefined) throw new Error('unknown-browser');
  const options = { detached: true, stdio: 'ignore' };
  if (target !== undefined) {
    if (process.platform === 'darwin') spawn('open', ['-a', target.app, url], options).unref();
    else spawn(target.path, [url], options).unref();
    return;
  }
  if (process.platform === 'win32') {
    spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], options).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [url], options).unref();
  } else {
    spawn('xdg-open', [url], options).unref();
  }
}

function normalizeUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) throw new Error('invalid-url');
  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('invalid-url');
  return parsed.href;
}

function openWithDialog(target) {
  if (process.platform === 'darwin') {
    const script = [
      'on run argv',
      '  set targetPath to item 1 of argv',
      '  try',
      '    set chosen to choose application with prompt "选择用于打开的应用"',
      '    do shell script "open -a " & quoted form of (POSIX path of chosen) & " " & quoted form of targetPath',
      '  end try',
      'end run',
    ].join('\n');
    spawn('osascript', ['-e', script, target], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const child = spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', target], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
}

function registerRoute(hostCtx, path, handler, label) {
  hostCtx.effect(
    () => hostCtx.webServer.register({ kind: 'exact', path, handler }),
    label,
  );
}

export function apply(ctx) {
  ctx.inject(['webServer'], (hostCtx) => {
    registerRoute(
      hostCtx,
      `${ROUTE_PREFIX}/browsers`,
      (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' });
          response.end();
          return;
        }
        sendJson(response, 200, {
          browsers: browsers().map((entry) => ({ id: entry.id, label: entry.label })),
        });
      },
      'file-actions: browser list route',
    );

    registerRoute(
      hostCtx,
      `${ROUTE_PREFIX}/open-url`,
      (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' });
          response.end();
          return;
        }
        if (request.headers['x-file-actions'] !== '1') {
          sendJson(response, 403, { ok: false, error: 'forbidden' });
          return;
        }
        readBody(request).then((body) => {
          if (body === null) {
            sendJson(response, 413, { ok: false });
            return;
          }
          let payload;
          try {
            payload = JSON.parse(body);
          } catch {
            sendJson(response, 400, { ok: false });
            return;
          }
          try {
            const url = normalizeUrl(payload && payload.url);
            const browserId = payload && typeof payload.browserId === 'string' ? payload.browserId : undefined;
            launch(url, browserId);
            sendJson(response, 200, { ok: true });
          } catch (error) {
            sendJson(response, 400, { ok: false, error: String(error && error.message) });
          }
        });
      },
      'file-actions: open-url route',
    );

    registerRoute(
      hostCtx,
      `${ROUTE_PREFIX}/open-with`,
      (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' });
          response.end();
          return;
        }
        if (request.headers['x-file-actions'] !== '1') {
          sendJson(response, 403, { ok: false, error: 'forbidden' });
          return;
        }
        readBody(request).then((body) => {
          if (body === null) {
            sendJson(response, 413, { ok: false });
            return;
          }
          let payload;
          try {
            payload = JSON.parse(body);
          } catch {
            sendJson(response, 400, { ok: false });
            return;
          }
          const target = payload && payload.path;
          if (typeof target !== 'string' || target.length === 0 || target.length > 4096 || !isAbsolute(target)) {
            sendJson(response, 400, { ok: false, error: 'invalid-path' });
            return;
          }
          try {
            const info = statSync(target);
            if (!info.isFile() && !info.isDirectory()) {
              sendJson(response, 400, { ok: false, error: 'not-a-file' });
              return;
            }
          } catch {
            sendJson(response, 404, { ok: false, error: 'not-found' });
            return;
          }
          if (process.platform !== 'win32' && process.platform !== 'darwin') {
            sendJson(response, 501, { ok: false, error: 'unsupported' });
            return;
          }
          try {
            openWithDialog(target);
            sendJson(response, 200, { ok: true });
          } catch (error) {
            sendJson(response, 500, { ok: false, error: String(error && error.message) });
          }
        });
      },
      'file-actions: open-with route',
    );

    registerRoute(
      hostCtx,
      `${ROUTE_PREFIX}/kind`,
      (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' });
          response.end();
          return;
        }
        if (request.headers['x-file-actions'] !== '1') {
          sendJson(response, 403, { ok: false, error: 'forbidden' });
          return;
        }
        readBody(request).then((body) => {
          if (body === null) {
            sendJson(response, 413, { ok: false });
            return;
          }
          let payload;
          try {
            payload = JSON.parse(body);
          } catch {
            sendJson(response, 400, { ok: false });
            return;
          }
          const target = payload && payload.path;
          if (typeof target !== 'string' || target.length === 0 || target.length > 4096 || !isAbsolute(target)) {
            sendJson(response, 400, { ok: false, error: 'invalid-path' });
            return;
          }
          try {
            const info = statSync(target);
            const kind = info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other';
            sendJson(response, 200, { kind });
          } catch {
            sendJson(response, 200, { kind: 'unknown' });
          }
        });
      },
      'file-actions: path kind route',
    );

    registerRoute(
      hostCtx,
      `${ROUTE_PREFIX}/diag`,
      (request, response) => {
        if (request.method === 'GET') {
          sendJson(response, 200, { reports });
          return;
        }
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'GET, POST' });
          response.end();
          return;
        }
        readBody(request).then((body) => {
          if (body === null) {
            sendJson(response, 413, { ok: false });
            return;
          }
          let entry;
          try {
            entry = JSON.parse(body);
          } catch {
            sendJson(response, 400, { ok: false });
            return;
          }
          reports.push(entry);
          if (reports.length > MAX_REPORTS) reports.splice(0, reports.length - MAX_REPORTS);
          sendJson(response, 200, { ok: true });
        });
      },
      'file-actions: diagnostic route',
    );
  });
}
