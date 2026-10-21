import { access, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const APPROVED_COMPANION_IDS = ['momo', 'yunduo', 'cloudbloom', 'cloudbelle']
export const COMPANION_DIRECTIONS = [
  'front', 'front-right', 'right', 'back-right',
  'back', 'back-left', 'left', 'front-left',
]

function isInside(point, canvas) {
  return point.x >= 0 && point.y >= 0 && point.x <= canvas.width && point.y <= canvas.height
}

function boundsFit(bounds, canvas) {
  return bounds.x >= 0
    && bounds.y >= 0
    && bounds.width > 0
    && bounds.height > 0
    && bounds.x + bounds.width <= canvas.width
    && bounds.y + bounds.height <= canvas.height
}

function pathFromPublicUrl(root, url) {
  return join(root, ...url.replace(/^\/+/, '').split('/'))
}

export async function validateCompanionAssetTree(root, manifests) {
  const errors = []
  let filesChecked = 0
  const seenUrls = new Set()

  for (const manifest of manifests) {
    if (!APPROVED_COMPANION_IDS.includes(manifest.id)) {
      errors.push(`${manifest.id}: unapproved companion id`)
    }
    for (const direction of COMPANION_DIRECTIONS) {
      const frame = manifest.frames?.[direction]
      if (!frame) {
        errors.push(`${manifest.id}: missing direction ${direction}`)
        continue
      }
      if (frame.direction !== direction) {
        errors.push(`${manifest.id}/${direction}: frame direction mismatch`)
      }
      if (!frame.canvas || frame.canvas.width <= 0 || frame.canvas.height <= 0) {
        errors.push(`${manifest.id}/${direction}: invalid canvas metadata`)
        continue
      }
      if (!isInside(frame.origin, frame.canvas)) {
        errors.push(`${manifest.id}/${direction}: origin outside canvas`)
      }
      if (!boundsFit(frame.visualBounds, frame.canvas)) {
        errors.push(`${manifest.id}/${direction}: visual bounds outside canvas`)
      }
      const names = new Set(frame.layers?.map((layer) => layer.name))
      if (!names.has('body')) errors.push(`${manifest.id}/${direction}: missing layer body`)
      if (direction === 'front' && !names.has('eyes')) errors.push(`${manifest.id}/front: missing layer eyes`)
      if (direction === 'front' && !names.has('mouth')) errors.push(`${manifest.id}/front: missing layer mouth`)

      for (const layer of frame.layers ?? []) {
        if (!layer.url?.endsWith('.webp')) {
          errors.push(`${manifest.id}/${direction}/${layer.name}: layer must be WebP`)
          continue
        }
        if (seenUrls.has(layer.url)) {
          errors.push(`${manifest.id}/${direction}/${layer.name}: duplicate layer URL ${layer.url}`)
          continue
        }
        seenUrls.add(layer.url)
        try {
          await access(pathFromPublicUrl(root, layer.url))
          filesChecked += 1
        } catch {
          errors.push(`${manifest.id}/${direction}/${layer.name}: missing file ${layer.url}`)
        }
      }
    }
  }

  return { errors, filesChecked }
}

async function loadDirectoryManifest(root, id) {
  const frames = {}
  for (const direction of COMPANION_DIRECTIONS) {
    const directory = join(root, 'companions-2d', id, direction)
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }
    const layers = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.webp'))
      .map((entry) => ({
        name: entry.name.slice(0, -5),
        url: `/companions-2d/${id}/${direction}/${entry.name}`,
      }))
    frames[direction] = {
      direction,
      canvas: { width: 1024, height: 1024 },
      origin: { x: 512, y: 928 },
      visualBounds: { x: 0, y: 0, width: 1024, height: 1024 },
      layers,
    }
  }
  return { id, frames }
}

async function main() {
  const publicRoot = resolve('public')
  const manifests = await Promise.all(
    APPROVED_COMPANION_IDS.map((id) => loadDirectoryManifest(publicRoot, id)),
  )
  const report = await validateCompanionAssetTree(publicRoot, manifests)
  if (report.errors.length) {
    console.error(`2.5D companion validation failed (${report.errors.length} problems):`)
    for (const error of report.errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }
  console.log(`Validated ${manifests.length} companions and ${report.filesChecked} WebP layers.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
