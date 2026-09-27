import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const publicDir = join(process.cwd(), 'public', 'assets')

const assets = [
  { dir: 'home', file: 'Home_mobile.png', maxWidth: 2048, quality: 82 },
  { dir: 'effects', file: 'pawcream-ecg.png', maxWidth: 1600, quality: 84 },
  ...[1,2,3,4,5,6,7,8,9,10,11,12,14,15].map((number) => ({
    dir: 'stars',
    file: `star-${String(number).padStart(2, '0')}.png`,
    maxWidth: 512,
    quality: 84,
  })),
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
  const source = join(publicDir, asset.dir, asset.file)
  const output = join(publicDir, asset.dir, asset.file.replace(/\.png$/i, '.webp'))
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

  console.log(`${asset.dir}/${asset.file}: ${formatBytes(before)} → ${formatBytes(after)} | -${reduction.toFixed(1)}% | ${resized}`)
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
console.log(`Home/effects/star PNG source total: ${formatBytes(totalBefore)}`)
console.log(`Home/effects/star WebP runtime total: ${formatBytes(totalAfter)}`)
console.log(`Total reduction: ${totalReduction.toFixed(1)}%`)
