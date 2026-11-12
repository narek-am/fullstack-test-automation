const fs = require('node:fs');
const path = require('node:path');

// Threat model: T12 (XSS). A fast static check of the shop's frontend source.
// The CSP would block inline scripts in the browser anyway; these tests catch the mistake
// at commit time, before it turns into a broken page or a CSP that has to be loosened.

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'app', 'public');

function filesIn(dir, extension) {
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((file) => file.endsWith(extension))
    .map((file) => [path.relative(PUBLIC_DIR, path.join(dir, file)), fs.readFileSync(path.join(dir, file), 'utf8')]);
}

// Drop comments so that a note like "never use innerHTML" is not reported.
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const scripts = filesIn(PUBLIC_DIR, '.js');
const pages = filesIn(PUBLIC_DIR, '.html');

const DANGEROUS_SINKS = [
  ['innerHTML / outerHTML assignment', /\.(inner|outer)HTML\s*\+?=/],
  ['insertAdjacentHTML', /\binsertAdjacentHTML\s*\(/],
  ['document.write', /\bdocument\.write(ln)?\s*\(/],
  ['eval', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\s*\(/],
  ['string passed to setTimeout/setInterval', /\bset(Timeout|Interval)\s*\(\s*['"`]/],
  ['javascript: URL', /javascript:/i],
];

it('finds the frontend files to check', () => {
  expect(scripts.length).toBeGreaterThan(5);
  expect(pages.length).toBeGreaterThan(5);
});

describe.each(scripts)('%s', (_, source) => {
  const code = withoutComments(source);

  it.each(DANGEROUS_SINKS)('does not use %s', (_, pattern) => {
    expect(code).not.toMatch(pattern);
  });

  it('does not keep secrets or tokens in the source', () => {
    expect(code).not.toMatch(/(api[_-]?key|secret|passw(or)?d)\s*[:=]\s*['"][^'"]{4,}/i);
  });
});

describe.each(pages)('%s', (_, html) => {
  it('loads scripts only from its own origin and has no inline scripts', () => {
    const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const [, attributes, body] of tags) {
      expect(attributes).toMatch(/\ssrc="\/[^/]/);
      expect(body.trim()).toBe('');
    }
  });

  it('has no inline event handlers or javascript: links', () => {
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('submits password forms with POST, so a password never ends up in a URL', () => {
    // Found by the ZAP scan: without method="post", a login form falls back to GET when its
    // script fails to load, and the password lands in the URL, browser history and server logs.
    const forms = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)];
    for (const [, attributes, body] of forms.filter(([, , b]) => /type="password"/i.test(b))) {
      expect(attributes).toMatch(/\smethod="post"/i);
    }
  });

  it('has no inline style attributes (the CSP does not allow them)', () => {
    expect(html).not.toMatch(/\sstyle\s*=/i);
  });
});
