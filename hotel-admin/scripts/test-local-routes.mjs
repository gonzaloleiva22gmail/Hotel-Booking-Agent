import { spawn, spawnSync } from 'child_process'
import http from 'http'

const port = Number(process.env.TEST_PORT || '3000')
const slug = process.env.TEST_SLUG || 'hotel-cascabel'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk.toString()
      })
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          location: res.headers.location ?? null,
          body: body.slice(0, 220),
        })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function main() {
  const child = spawn('cmd.exe', ['/c', `npm run start -- --hostname 127.0.0.1 --port ${port}`], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let ready = false
  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    stdout += text
    if (text.includes('Ready')) {
      ready = true
    }
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  try {
    for (let i = 0; i < 40; i += 1) {
      if (ready) break
      await wait(500)
    }

    if (!ready) {
      console.log(JSON.stringify({ ready, stdout, stderr }, null, 2))
      process.exitCode = 1
      return
    }

    const paths = [
      '/',
      '/login',
      `/admin/${slug}`,
      `/api/hotels/${slug}/rooms`,
      `/api/hotels/${slug}/reservations?month=2030-01`,
    ]

    const results = []
    for (const path of paths) {
      try {
        results.push(await fetchUrl(path))
      } catch (error) {
        results.push({
          path,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    console.log(JSON.stringify({ ready, results }, null, 2))
  } finally {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    })
  }
}

await main()
