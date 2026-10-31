/**
 * Host half of the file-actions bundle.
 *
 * Besides the no-op plugin row, this half exposes a tiny diagnostic route so the
 * browser half can report whether it loaded and what a right-click hit. The
 * route is read-mostly: GET returns the collected reports, POST appends one.
 */
const reports = [];
const MAX_REPORTS = 200;

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

export function apply(ctx) {
  ctx.inject(['webServer'], (hostCtx) => {
    hostCtx.effect(
      () =>
        hostCtx.webServer.register({
          kind: 'exact',
          path: '/file-actions/diag',
          handler: (request, response) => {
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
        }),
      'file-actions: diagnostic route',
    );
  });
}
