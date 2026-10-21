import assert from 'node:assert/strict';
import { html, escapeHtml } from '../src/ui/html.js';
const hostile = '<img src=x onerror="alert(1)">&\'';
assert.equal(String(html`<b title="${hostile}">${hostile}</b>`), `<b title="${escapeHtml(hostile)}">${escapeHtml(hostile)}</b>`);
assert.equal(String(html`<ul>${[html`<li>${hostile}</li>`, html`<li>${null}</li>`]}</ul>`), `<ul><li>${escapeHtml(hostile)}</li><li></li></ul>`);
assert.equal(String(html`${{ toString: () => '<script>bad</script>' }}`), '&lt;script&gt;bad&lt;/script&gt;');
assert.equal(String(html`<p>${'<b>text</b>'}</p>`), '<p>&lt;b&gt;text&lt;/b&gt;</p>');
console.log('PASS HTML interpolation escapes text and attributes by default, preserves only nested safe templates');
