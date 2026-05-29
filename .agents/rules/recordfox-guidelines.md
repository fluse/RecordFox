---
trigger: always_on
---

# 🦊 RecordFox AI Agent Guidelines

## 🎯 Project Context

This project is **RecordFox** – a modern, lightning-fast, and intuitive DJ library management software being developed as a lightweight alternative to Rekordbox.
Our main focus is on **performance**, **seamless user experience (UX)**, and a clean UI without visual noise.

## 💻 Tech Stack

- **Environment:** Electron, Node.js Typescript (v24+)
- **Package Manager:** npm
- **CI/CD:** GitHub Actions (automated release via Git tags `v*` and `electron-builder`)

## 🏗️ Architecture & Electron Rules (IMPORTANT!)

1.  **Strict separation of Main and Renderer:**
    - The Renderer process (UI) must **never** directly access Node.js modules (like `fs`, `path`, `child_process`).
    - Security standard: `nodeIntegration: false` and `contextIsolation: true` must be strictly adhered to.
2.  **IPC Communication (Inter-Process Communication):**
    - All communication between the UI and the system level MUST happen via `preload.js` scripts and `ipcMain` / `ipcRenderer` using `contextBridge`.
3.  **Cross-Platform Compatibility:**
    - Code must be executable on macOS, Windows, and Linux.
    - Always resolve paths dynamically with `path.join()` and `app.getPath()`, never hardcode them (e.g., no absolute `C:\` or `/Users/` paths).

## 📘 TypeScript Rules

- **Strict Typing:** Never use `any`. Always define explicit `interfaces` or `types` for data structures, especially for Audio Metadata and IPC Payloads.
- **IPC Interface:** The `window.api` contract is strictly defined in `src/types/electron.d.ts`. Never invent new IPC channels without updating this interface first.
- **Imports:** Use absolute path aliases (`@main/`, `@renderer/`, `@shared/`) instead of relative paths (`../`).

## 🚀 Performance & Code Style

- **Component-Driven:** Organize code into small, modular, and highly reusable components.
- **Readable Functions:** Write small, single-purpose, and easily readable functions.
- **Linting:** Strictly adhere to the project's linting configurations (e.g., ESLint, Prettier). Resolve any linting errors before providing code.
- **Audio & Metadata:** Parsing audio files (ID3 tags, BPM, waveforms) must be resource-efficient, ideally asynchronous or handled in worker threads to avoid blocking the UI.
- **Large Datasets:** The app must be able to display thousands of tracks without any lag. Use virtualization/windowing for large lists.
- **Clean Code:** Avoid deep nesting (callback hell) and consistently use `async/await`.
- **Dependencies:** Keep the `package.json` clean. Do not add heavy third-party libraries if a native Web API or Node.js solution exists.

## 🧠 AI Assistant Behavior

- Think like a Senior Electron Developer.
- When generating code, always provide the complete, runnable block for the specific file without omitting important existing logic.
- Before suggesting a new NPM library, ask for permission first.
- Ensure that any UI changes maintain the clean, distraction-free design principles of RecordFox.
