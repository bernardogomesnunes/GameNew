/** Plain interpolated values are text. Only nested html templates carry markup.
 * Use quoted attributes; never interpolate tag names, scripts, styles or URLs.
 */
const safe = new WeakSet();
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function render(value) {
  if (value && safe.has(value)) return String(value);
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}
export function html(strings, ...values) {
  if (!Array.isArray(strings) || !Object.hasOwn(strings, 'raw')) throw new TypeError('Use html as a template tag');
  const text = strings.reduce((result, part, index) => result + part + (index < values.length ? render(values[index]) : ''), '');
  const fragment = Object.freeze({ toString: () => text });
  safe.add(fragment);
  return fragment;
}
