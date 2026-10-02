/**
 * Returns `target` only if it is a same-origin relative path, else undefined.
 * Rejects protocol-relative ("//evil.com"), backslash and control-character
 * tricks ("/\t/evil.com" — browsers strip tabs/newlines, yielding "//evil.com").
 */
export function safeRedirectPath(target: string | null | undefined): string | undefined {
  if (!target || target === "/" || !target.startsWith("/")) return undefined
  if (/[\u0000-\u001f\u007f\\]/.test(target) || target.startsWith("//")) return undefined
  try {
    const base = "https://hayesh.invalid"
    const url = new URL(target, base)
    if (url.origin !== base) return undefined
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return undefined
  }
}
