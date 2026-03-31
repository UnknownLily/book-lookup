export async function detectCoverTone(coverUrl: string): Promise<boolean> {
  try {
    const image = await loadImageElement(coverUrl)
    const luminance = sampleTopAreaLuminance(image)
    return luminance < 118
  } catch {
    return false
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('image-unavailable'))
      return
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = src
  })
}

function sampleTopAreaLuminance(image: HTMLImageElement): number {
  const canvas = document.createElement('canvas')
  const width = 32
  const height = 32
  const sampleHeight = 18

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return 255
  }

  context.drawImage(image, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, sampleHeight)

  let weightedLuminance = 0
  let totalWeight = 0

  for (let y = 0; y < sampleHeight; y += 1) {
    const verticalWeight = 1.2 - y / sampleHeight / 2

    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const alpha = data[index + 3] / 255

      if (alpha <= 0) {
        continue
      }

      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
      const weight = verticalWeight * alpha

      weightedLuminance += luminance * weight
      totalWeight += weight
    }
  }

  return totalWeight > 0 ? weightedLuminance / totalWeight : 255
}
