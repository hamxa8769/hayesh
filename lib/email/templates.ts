export interface NotificationEmailParams {
  title: string
  message: string
  actionUrl?: string | null
  recipientName?: string | null
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch)
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "")
}

function buildAbsoluteUrl(path: string | null | undefined): string {
  const base = appBaseUrl()
  if (!path) return base
  // Only same-app paths are linked; anything else falls back to the home page.
  if (!path.startsWith("/") || path.startsWith("//")) return base
  return `${base}${path}`
}

export function renderNotificationEmail(params: NotificationEmailParams): RenderedEmail {
  const { title, message } = params
  const actionHref = buildAbsoluteUrl(params.actionUrl)
  const privacyHref = `${appBaseUrl()}/privacy`
  const name = params.recipientName?.trim()
  const greeting = name ? `Hi ${name},` : "Hi,"

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f3f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f3f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="background-color:#08090C;padding:24px 28px;border-radius:10px 10px 0 0;">
<span style="font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#E8EAF0;">Hayesh</span>
</td></tr>
<tr><td style="background-color:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;color:#1a1d24;">
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#565E6E;">${escapeHtml(greeting)}</p>
<h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;font-weight:700;color:#08090C;">${escapeHtml(title)}</h1>
<p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#1a1d24;">${escapeHtml(message)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr><td style="background-color:#27C4A0;border-radius:6px;">
<a href="${escapeHtml(actionHref)}" style="display:inline-block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#08090C;text-decoration:none;">Open Hayesh</a>
</td></tr>
</table>
</td></tr>
<tr><td style="background-color:#ffffff;padding:0 28px 28px 28px;border-radius:0 0 10px 10px;border-top:1px solid #e6e8ec;">
<p style="margin:20px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8B93A3;">You're receiving this because you have a Hayesh account. <a href="${escapeHtml(privacyHref)}" style="color:#8B93A3;text-decoration:underline;">Privacy policy</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    greeting,
    "",
    title,
    "",
    message,
    "",
    `Open Hayesh: ${actionHref}`,
    "",
    "--",
    "You're receiving this because you have a Hayesh account.",
    `Privacy: ${privacyHref}`,
  ].join("\n")

  return { subject: title, html, text }
}
