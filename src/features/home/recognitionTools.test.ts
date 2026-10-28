import { afterEach, describe, expect, it, vi } from 'vitest'
import { readImage } from './recognitionTools'

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
})
