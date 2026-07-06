@echo off
echo.
echo ============================================
echo   LUMORA — Project Setup Script
echo   Run this once to set everything up
echo ============================================
echo.

:: ── Step 1: Check Node.js ──────────────────────────────────
echo [1/8] Checking Node.js version...
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Please download and install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo OK: Node.js %NODE_VER% found

:: ── Step 2: Check Git ──────────────────────────────────────
echo [2/8] Checking Git...
git --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git not found!
    echo Please download and install Git from https://git-scm.com
    pause
    exit /b 1
)
echo OK: Git found

:: ── Step 3: Install Claude Code ────────────────────────────
echo [3/8] Installing Claude Code...
npm install -g @anthropic-ai/claude-code
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Claude Code
    pause
    exit /b 1
)
echo OK: Claude Code installed

:: ── Step 4: Install OmniRoute ──────────────────────────────
echo [4/8] Installing OmniRoute...
npm install -g omniroute
if %errorlevel% neq 0 (
    echo WARNING: OmniRoute install failed — you can install manually later
    echo Run: npm install -g omniroute
) else (
    echo OK: OmniRoute installed
)

:: ── Step 5: Create Next.js Project ─────────────────────────
echo [5/8] Creating Lumora Next.js project...
if exist lumora (
    echo WARNING: lumora folder already exists — skipping creation
) else (
    call npx create-next-app@latest lumora ^
        --typescript ^
        --tailwind ^
        --app ^
        --turbopack ^
        --no-git ^
        --import-alias "@/*"
    if %errorlevel% neq 0 (
        echo ERROR: Failed to create Next.js project
        pause
        exit /b 1
    )
    echo OK: Next.js project created
)

:: ── Step 6: Install Dependencies ───────────────────────────
echo [6/8] Installing Lumora dependencies...
cd lumora

echo Installing shadcn/ui dependencies...
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-toast
npm install class-variance-authority clsx tailwind-merge lucide-react

echo Installing animation libraries...
npm install framer-motion
npm install @tsparticles/react @tsparticles/engine @tsparticles/slim
npm install gsap lenis
npm install three @react-three/fiber @react-three/drei

echo Installing Supabase...
npm install @supabase/supabase-js @supabase/ssr

echo Installing Stripe...
npm install stripe @stripe/stripe-js @stripe/react-stripe-js

echo Installing AI libraries...
npm install @anthropic-ai/sdk openai

echo Installing form + validation...
npm install react-hook-form @hookform/resolvers zod

echo Installing charts...
npm install recharts

echo Installing LiveKit...
npm install @livekit/components-react @livekit/components-core livekit-client

echo Installing utilities...
npm install date-fns axios

echo OK: All dependencies installed

:: ── Step 7: Copy Config Files ──────────────────────────────
echo [7/8] Setting up config files...
cd ..
copy CLAUDE.md lumora\CLAUDE.md > nul
copy .env.example lumora\.env.example > nul
copy .env.example lumora\.env.local > nul

echo OK: Config files copied
echo.
echo IMPORTANT: Open lumora\.env.local and fill in your API keys!

:: ── Step 8: Initialize Git ─────────────────────────────────
echo [8/8] Initializing Git repository...
cd lumora
git init
echo node_modules/ > .gitignore
echo .env.local >> .gitignore
echo .next/ >> .gitignore
echo .vercel/ >> .gitignore
git add .
git commit -m "Initial Lumora setup"
echo OK: Git initialized

:: ── Done ───────────────────────────────────────────────────
echo.
echo ============================================
echo   SETUP COMPLETE!
echo ============================================
echo.
echo Next steps:
echo.
echo 1. Open lumora\.env.local and add your API keys
echo 2. cd lumora
echo 3. Start OmniRoute: omniroute   (new terminal window)
echo 4. Connect OmniRoute to Claude Code:
echo    claude mcp add omniroute --type http --url http://localhost:20128/api/mcp/stream
echo 5. Start coding: claude
echo 6. Dev server: npm run dev
echo.
echo Happy building! - Lumora v1.0
echo.
pause
