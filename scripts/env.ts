import { readFileSync } from 'node:fs'
import path from 'node:path'

let loaded = false

function parseValue(rawValue: string) {
  let value = rawValue.trim()
  if (!value) return ''

  const quote = value[0]
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1)
    if (quote === '"') {
      return value
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    }
    return value
  }

  const commentMatch = value.match(/\s+#/)
  if (commentMatch?.index !== undefined) {
    value = value.slice(0, commentMatch.index).trim()
  }
  return value
}

export function loadDotEnv(filePath = path.resolve('.env')) {
  if (loaded) return
  loaded = true

  let contents: string
  try {
    contents = readFileSync(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = parseValue(rawValue)
  }
}

export function getEnv(...names: string[]) {
  loadDotEnv()
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}
