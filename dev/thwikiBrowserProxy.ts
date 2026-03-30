import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { chromium, type Browser, type BrowserContext } from 'playwright-core'
import type { Plugin, ViteDevServer } from 'vite'

interface BrowserProxyResult {
  status: number
  headers: Record<string, string>
  body: string
}

interface SerializableRequest {
  path: string
  method: string
  body?: string
  headers: Record<string, string>
}

const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]

let browserPromise: Promise<Browser> | null = null
let contextPromise: Promise<BrowserContext> | null = null

function resolveBrowserExecutable(): string {
  const configuredPath = process.env.THWIKI_BROWSER_PATH
  if (configuredPath) {
    return configuredPath
  }

  const foundPath = BROWSER_CANDIDATES.find((candidate) => existsSync(candidate))
  if (foundPath) {
    return foundPath
  }

  throw new Error('未找到可用的 Chrome 或 Edge，可通过 THWIKI_BROWSER_PATH 指定浏览器路径。')
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = resolveBrowserExecutable()
    browserPromise = chromium.launch({
      executablePath,
      headless: true,
    })
  }

  return browserPromise
}

async function getContext(): Promise<BrowserContext> {
  if (!contextPromise) {
    contextPromise = getBrowser().then((browser) =>
      browser.newContext({
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      }),
    )
  }

  return contextPromise
}

async function closeBrowserProxy(): Promise<void> {
  const context = await contextPromise?.catch(() => null)
  await context?.close().catch(() => undefined)
  contextPromise = null

  const browser = await browserPromise?.catch(() => null)
  await browser?.close().catch(() => undefined)
  browserPromise = null
}

function getContentType(url: string, headers: Record<string, string>): string {
  return headers['content-type'] || (url.startsWith('/api/ajax.php') ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8')
}

function pickRequestHeaders(request: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: typeof request.headers.accept === 'string' ? request.headers.accept : '*/*',
  }

  if (typeof request.headers['content-type'] === 'string') {
    headers['Content-Type'] = request.headers['content-type']
  }

  return headers
}

function readRequestBody(request: IncomingMessage): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    if (request.method === 'GET' || request.method === 'HEAD') {
      resolve(undefined)
      return
    }

    const chunks: Buffer[] = []
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

async function performBrowserRequest(payload: SerializableRequest): Promise<BrowserProxyResult> {
  const context = await getContext()
  const page = await context.newPage()

  try {
    await page.goto('https://thwiki.cc/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    return await page.evaluate(async (requestPayload) => {
      const response = await fetch(requestPayload.path, {
        method: requestPayload.method,
        body: requestPayload.body,
        headers: requestPayload.headers,
        credentials: 'same-origin',
      })

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text(),
      }
    }, payload)
  } finally {
    await page.close().catch(() => undefined)
  }
}

function mapRequestUrl(url: string): string | null {
  if (url.startsWith('/api/askbook')) {
    return url.replace(/^\/api\/askbook/, '/rest/askbook')
  }

  if (url.startsWith('/api/ajax.php')) {
    return url.replace(/^\/api/, '')
  }

  return null
}

async function handleProxyRequest(request: IncomingMessage, response: ServerResponse, server: ViteDevServer, mappedUrl: string): Promise<void> {
  const url = request.url ?? ''
  try {
    const body = await readRequestBody(request)
    const result = await performBrowserRequest({
      path: mappedUrl,
      method: request.method ?? 'GET',
      body,
      headers: pickRequestHeaders(request),
    })

    response.statusCode = result.status
    response.setHeader('Content-Type', getContentType(url, result.headers))
    response.end(result.body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    server.config.logger.error(`[thwiki-browser-proxy] ${message}`)
    response.statusCode = 502
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({
      message: 'thwiki 开发代理失败',
      detail: message,
    }))
  }
}

export function thwikiBrowserProxy(): Plugin {
  return {
    name: 'thwiki-browser-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? ''
        if (!url.startsWith('/api/askbook') && !url.startsWith('/api/ajax.php')) {
          next()
          return
        }

        const mappedUrl = mapRequestUrl(url)
        if (!mappedUrl) {
          next()
          return
        }

        void handleProxyRequest(request, response, server, mappedUrl)
      })

      server.httpServer?.once('close', () => {
        void closeBrowserProxy()
      })
    },
  }
}
