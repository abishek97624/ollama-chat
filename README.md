# Proitbridge — Local Ollama Chat

A simple React + Vite chat interface inspired by the supplied screenshot. It uses the official [`ollama` JavaScript library](https://github.com/ollama/ollama-js), imported through `ollama/browser` for browser-side usage.

## Features

- Sidebar with model picker populated from your local Ollama installation
- Local connection status and refresh button
- Streaming chat responses
- New chats, recent chat history, and local browser persistence
- Suggested starter prompts
- Responsive mobile sidebar
- No cloud API key needed for local models

## Requirements

- Node.js 18+ recommended
- [Ollama installed](https://ollama.com/download) and running locally
- At least one model pulled locally, for example `llama3.2:latest`

## Run on Windows (PowerShell)

Open a terminal in this project folder and run:

```powershell
npm install
ollama list
```

If Ollama is already running as a background Windows service, you do not need `ollama serve`. Open a terminal in the project folder and run:

```powershell
npm run dev
```

Then open the local URL printed by Vite, usually `http://localhost:5173`.

## Browser access / CORS

The browser bundle makes requests directly to the Ollama server at `http://127.0.0.1:11434`. Ollama must allow the development site's origin. If the browser console reports a CORS error, configure the `OLLAMA_ORIGINS` environment variable for your environment, then restart Ollama. For example, on Windows PowerShell for a current terminal session:

```powershell
$env:OLLAMA_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
ollama serve
```

If Ollama is running as a background service, set `OLLAMA_ORIGINS` in the environment used by that service and restart the service instead. Do not expose the Ollama port to the public internet.

## Default model

The default model is `llama3.2:latest`. You can switch models at any time using the selector in the sidebar. To pull another model:

```powershell
ollama pull llama3.2
```

## Production build

```powershell
npm run build
npm run preview
```

**Important:** This frontend is designed for local use. A public deployment does not automatically give visitors access to your laptop's Ollama server. For a public-facing app, use a separate backend that authenticates users, controls access, and proxies requests to a protected Ollama host; never expose a local/private inference server directly to the public internet.
