import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const atelierDir = join(process.cwd(), 'public', 'assets', 'atelier')

const assets = [
  { file: 'background.png', maxWidth: 2560, quality: 82 },
  { file: 'background2.png', maxWidth: 2560, quality: 82 },
  { file: 'background3.png', maxWidth: 2560, quality: 82 },
  { file: 'background4.png', maxWidth: 2560, quality: 82 },
  { file: 'window.png', maxWidth: 1800, quality: 84 },
  { file: 'pawcream.png', maxWidth: 1800, quality: 84 },
  { file: 'wall-mounted cabinet.png', maxWidth: 1200, quality: 84 },
  { file: 'people.png', maxWidth: 800, quality: 84 },
  { file: 'light.png', maxWidth: 1200, quality: 84 },
  { file: 'lighton.png', maxWidth: 1400, quality: 84 },
  { file: 'instax.png', maxWidth: 1600, quality: 84 },
  { file: 'sewing machine.png', maxWidth: 2000, quality: 84 },
  { file: 'bear.png', maxWidth: 700, quality: 84 },
  { file: 'music.png', maxWidth: 1200, quality: 84 },
  { file: 'note.png', maxWidth: 1600, quality: 88 },
  { file: 'message.png', maxWidth: 1600, quality: 88 },
  { file: 'color.png', maxWidth: 1200, quality: 84 },
]

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 ** 2).toFixed(2)} MiB`
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`
    throw new Error(`${command} failed: ${detail}`)
  }
  return result.stdout
}

function readPngSize(path) {
  const description = run('file', ['-b', path])
  const match = description.match(/(\d+) x (\d+)/)
  if (!match) throw new Error(`Could not read PNG dimensions for ${path}: ${description.trim()}`)
  return { width: Number(match[1]), height: Number(match[2]) }
}

async function optimize(asset) {
  const source = join(atelierDir, asset.file)
  const output = join(atelierDir, asset.file.replace(/\.png$/i, '.webp'))
  const before = (await stat(source)).size
  const dimensions = readPngSize(source)

  const args = [
    '-quiet',
    '-mt',
    '-m', '6',
    '-q', String(asset.quality),
    '-alpha_q', '100',
  ]

  if (dimensions.width > asset.maxWidth) {
    args.push('-resize', String(asset.maxWidth), '0')
  }

  args.push(source, '-o', output)
  run('cwebp', args)

  const after = (await stat(output)).size
  const reduction = before > 0 ? ((1 - after / before) * 100) : 0
  const resized = dimensions.width > asset.maxWidth
    ? `${dimensions.width}×${dimensions.height} → ${asset.maxWidth}px wide`
    : `${dimensions.width}×${dimensions.height} (kept)`

  console.log(`${asset.file}: ${formatBytes(before)} → ${formatBytes(after)} | -${reduction.toFixed(1)}% | ${resized}`)
  return { before, after }
}

let totalBefore = 0
let totalAfter = 0

for (const asset of assets) {
  const result = await optimize(asset)
  totalBefore += result.before
  totalAfter += result.after
}

const totalReduction = totalBefore > 0 ? ((1 - totalAfter / totalBefore) * 100) : 0
console.log('')
console.log(`Atelier PNG source total: ${formatBytes(totalBefore)}`)
console.log(`Atelier WebP runtime total: ${formatBytes(totalAfter)}`)
console.log(`Total reduction: ${totalReduction.toFixed(1)}%`)
