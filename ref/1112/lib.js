// COST1112 시험 공용: 로컬 정적 서버 + 가짜 구글 로그인·가짜 시트(읽기 전용 번들 복사본, 실제 구글 호출 없음)
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('/Users/janghoyeon/dev/zipbanchan/Z-CMS/node_modules/playwright');
const mock = require('/Users/janghoyeon/orca/workspaces/q4-cost-plan-ui-review/gs1/tools/gs9_backend_mock.js');
const APP = process.env.APP_ROOT || '/Users/janghoyeon/orca/workspaces/cost-app';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const startServer = () => new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(APP, u === '/' ? 'index.html' : u); if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(0, '127.0.0.1', () => res(s)); });
async function open(opts) {
  opts = opts || {};
  const srv = await startServer(), base = 'http://127.0.0.1:' + srv.address().port;
  const br = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const m = await mock.install(ctx, p, opts.mock);
  await p.goto(base + '/flow.html'); await p.waitForSelector('#r9loginBtn'); await p.click('#r9loginBtn'); await p.waitForSelector('button[data-div]', { timeout: 15000 });
  await p.waitForFunction(() => window.R10_READY === true, null, { timeout: 15000 });
  return { srv, br, ctx, p, m, base, errs, close: async () => { await br.close(); srv.close(); } };
}
module.exports = { open, APP };
