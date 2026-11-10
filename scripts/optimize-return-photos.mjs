#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const sourceDir = path.join(root, 'public', 'assets', 'return_photo')
const workDir = path.join(root, '.return-photo-orientation-work')
const photoFiles = fs.readdirSync(sourceDir)
  .filter((file) => /\.(?:jpe?g)$/i.test(file))
  .sort()

const rotationRegressionPhotos = new Set([
  'ae74e949f0d9c8c06b084beceefd83aa.jpg',
  '83d66baa1f607b0c7a9e093d9d27d402.jpg',
])
const newReturnPhotoNames = new Set([
  '4ef9c57b5ce47256dcf072ddd4536837.jpg',
  '510465b48a16abc42afc2e76abc890e3.jpg',
  '81b1fdb1f58cde2f62d9a49e488e98c9.jpg',
  'ef347ef1d631ebfc0c1f7624cc774578.jpg',
  '微信图片_20261109160151_262_4419.jpg',
])

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function dimensions(file) {
  const values = run('identify', ['-format', '%w %h', file]).split(/\s+/).map(Number)
  if (values.length !== 2 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Unable to read image dimensions: ' + file)
  }
  return { width: values[0], height: values[1] }
}

if (photoFiles.length !== 53) {
  throw new Error('Expected 53 source return photos, found ' + photoFiles.length)
}

fs.rmSync(workDir, { recursive: true, force: true })
fs.mkdirSync(workDir, { recursive: true })

const rotationChecks = []
const newPhotoOrientationChecks = []

try {
  for (const filename of photoFiles) {
    const input = path.join(sourceDir, filename)
    const normalized = path.join(workDir, filename + '.png')
    const output = path.join(sourceDir, filename.replace(/\.(?:jpe?g)$/i, '.webp'))

    // Physically apply EXIF orientation before encoding; WebP output carries no camera rotation metadata.
    run('convert', [input, '-auto-orient', '-strip', normalized])
    const sourceDimensions = dimensions(normalized)
    const resizeArgs = sourceDimensions.width > 960 ? ['-resize', '960', '0'] : []
    run('cwebp', [
      '-quiet', '-mt', '-m', '5', '-q', '68', ...resizeArgs,
      normalized, '-o', output,
    ])

    const outputDimensions = dimensions(output)
    const sourceRatio = sourceDimensions.width / sourceDimensions.height
    const outputRatio = outputDimensions.width / outputDimensions.height
    if (Math.abs(sourceRatio - outputRatio) > 0.01) {
      throw new Error('Return photo aspect ratio changed: ' + filename)
    }

    if (rotationRegressionPhotos.has(filename)) {
      if (outputDimensions.height <= outputDimensions.width) {
        throw new Error('Known portrait photo was rotated: ' + filename)
      }
      rotationChecks.push(filename)
    }

    if (newReturnPhotoNames.has(filename)) newPhotoOrientationChecks.push(filename)
  }
} finally {
  fs.rmSync(workDir, { recursive: true, force: true })
}

if (rotationChecks.length !== 2) {
  throw new Error('Expected both known rotation-regression photos, checked ' + rotationChecks.length)
}
if (newPhotoOrientationChecks.length !== 5) {
  throw new Error('Expected all five recent return photos, checked ' + newPhotoOrientationChecks.length)
}

const webpFiles = fs.readdirSync(sourceDir).filter((file) => /\.webp$/i.test(file))
if (webpFiles.length !== 53) {
  throw new Error('Expected 53 optimized return photos, found ' + webpFiles.length)
}

console.log('PASS: 53 return photos converted to WebP')
console.log('PASS: EXIF orientation normalized before encoding')
console.log('PASS: both known portrait-rotation regression photos remain portrait')
console.log('PASS: all five recent photos preserve their orientation')
