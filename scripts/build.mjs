import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(root, 'src', 'client.css'), 'utf8')
const source = readFileSync(join(root, 'src', 'client.source.js'), 'utf8')
const cssMarker = '"__PRTS_CSS__"'
const audioMarker = '"__PRTS_AUDIO__"'
const artMarker = '"__PRTS_ART__"'

if (!source.includes(cssMarker)) {
  throw new Error('CSS placeholder not found in src/client.source.js')
}
if (!source.includes(audioMarker)) {
  throw new Error('Audio placeholder not found in src/client.source.js')
}
if (!source.includes(artMarker)) {
  throw new Error('Art placeholder not found in src/client.source.js')
}

function readAudio(kind) {
  const dir = join(root, 'assets', kind)
  const out = {}
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.mp3')) continue
    const key = name.slice(0, -4)
    out[key] = 'data:audio/mpeg;base64,' + readFileSync(join(dir, name)).toString('base64')
  }
  return out
}

function readArt() {
  const dir = join(root, 'assets', 'art')
  const out = {}
  const mime = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }
  for (const name of readdirSync(dir)) {
    const dot = name.lastIndexOf('.')
    if (dot < 0) continue
    const ext = name.slice(dot).toLowerCase()
    if (!mime[ext]) continue
    const key = name.slice(0, dot)
    out[key] = 'data:' + mime[ext] + ';base64,' + readFileSync(join(dir, name)).toString('base64')
  }
  return out
}

const audio = { voice: readAudio('voice'), sfx: readAudio('sfx') }
const art = readArt()
const out = source
  .replace(cssMarker, JSON.stringify(css))
  .replace(audioMarker, JSON.stringify(audio))
  .replace(artMarker, JSON.stringify(art))

writeFileSync(join(root, 'client.js'), out)
console.log(`client.js written: ${Buffer.byteLength(out, 'utf8')} bytes`)
console.log(`voice lines: ${Object.keys(audio.voice).length}; sound effects: ${Object.keys(audio.sfx).length}; art: ${Object.keys(art).length}`)
