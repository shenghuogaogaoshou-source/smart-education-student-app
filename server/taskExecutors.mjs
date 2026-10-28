export function createTaskExecutor({ handleApi, brainOrigin, fetchImpl = fetch }) {
  return async function executeTask({ kind, payload, updateStage }) {
    if (kind === 'vision') {
      await updateStage('recognizing')
      const result = await handleApi({ method: 'POST', path: '/api/companion/recognize', body: payload })
      if (result.status !== 200) throw new Error(result.body?.error || 'vision_failed')
      return result.body?.result
    }

    if (kind === 'product-image') {
      await updateStage('rendering')
      const result = await handleApi({ method: 'POST', path: '/api/ark/images/generations', body: payload })
      if (result.status !== 200) throw new Error(result.body?.error || 'image_failed')
      return result.body
    }

    if (kind === 'film-image') {
      await updateStage('rendering')
      const response = await fetchImpl(`${brainOrigin.replace(/\/$/, '')}/api/image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('film_image_failed')
      return response.json()
    }

    throw new Error('invalid_task_kind')
  }
}
