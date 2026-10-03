"use client"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#08090C", color: "#E8EAF0", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Hayesh is having trouble</h1>
            <p style={{ color: "#8B93A3" }}>An unexpected error occurred. Please try again.</p>
            <button
              onClick={reset}
              style={{ padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: 600, cursor: "pointer", background: "linear-gradient(110deg,#27C4A0,#5AD1B0 40%,#F5B84E)", color: "#08090C" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
