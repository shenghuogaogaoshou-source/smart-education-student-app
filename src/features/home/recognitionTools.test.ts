import { afterEach, describe, expect, it, vi } from 'vitest'
import { imageMaxEdgeForTool, readImage } from './recognitionTools'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('recognition image preparation', () => {
  it('compresses a large valid photo while preserving its aspect ratio', async () => {
    const close = vi.fn()
    const bitmap = { width: 2400, height: 1200, close }
    const drawImage = vi.fn()
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
      expect(this.width).toBe(1600)
      expect(this.height).toBe(800)
      return 'data:image/jpeg;base64,compressed'
    })
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D)

    const result = await readImage(new File(
      [new Uint8Array(6 * 1024 * 1024)],
      'large-photo.jpg',
      { type: 'image/jpeg' },
    ))

    expect(result).toBe('data:image/jpeg;base64,compressed')
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 800)
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', .88)
    expect(close).toHaveBeenCalledOnce()
  })

  it('uses the camera tool image edge policy', () => {
    expect(imageMaxEdgeForTool('object')).toBe(960)
    expect(imageMaxEdgeForTool('ocr')).toBe(1280)
    expect(imageMaxEdgeForTool('solve')).toBe(1024)
    expect(imageMaxEdgeForTool('scan')).toBe(1600)
  })

  it('compresses an image to an explicit maximum edge', async () => {
    const bitmap = { width: 1920, height: 960, close: vi.fn() }
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
      expect(this.width).toBe(960)
      expect(this.height).toBe(480)
      return 'data:image/jpeg;base64,small'
    })
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)

    await expect(readImage(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), { maxEdge: 960 }))
      .resolves.toBe('data:image/jpeg;base64,small')
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', .88)
  })
})
