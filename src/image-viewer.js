export function attachImageGestures(stage, image, { onChange }) {
  let baseWidth = 0, scale = 1, drag, pinch
  const pointers = new Map()
  const update = () => {
    image.style.width = `${baseWidth * scale}px`
    image.style.cursor = scale > 1 ? 'grab' : 'zoom-in'
    onChange(scale)
  }
  const fit = () => {
    baseWidth = Math.max(1, Math.min(stage.clientWidth - 48, (stage.clientHeight - 48) * image.naturalWidth / image.naturalHeight))
    scale = 1; update(); stage.scrollLeft = 0; stage.scrollTop = 0
  }
  const zoom = (next, x = stage.clientWidth / 2, y = stage.clientHeight / 2) => {
    const previous = scale
    scale = Math.max(.25, Math.min(8, next))
    const imageLeft = image.offsetLeft, imageTop = image.offsetTop
    const relativeX = stage.scrollLeft + x - imageLeft, relativeY = stage.scrollTop + y - imageTop
    update()
    stage.scrollLeft += relativeX * (scale / previous - 1)
    stage.scrollTop += relativeY * (scale / previous - 1)
  }
  stage.addEventListener('wheel', event => {
    event.preventDefault()
    const rect = stage.getBoundingClientRect()
    zoom(scale * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .003), event.clientX - rect.left, event.clientY - rect.top)
  }, { passive: false })
  image.addEventListener('dragstart', event => event.preventDefault())
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try { stage.setPointerCapture(event.pointerId) } catch { /* Synthetic or already released pointers cannot be captured. */ }
    drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop }
    if (pointers.size === 2) {
      const [a,b] = [...pointers.values()]
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale }
    }
    image.style.cursor = 'grabbing'
  })
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2 && pinch) {
      const [a,b] = [...pointers.values()], rect = stage.getBoundingClientRect()
      zoom(pinch.scale * Math.hypot(a.x-b.x, a.y-b.y) / Math.max(1,pinch.distance), (a.x+b.x)/2-rect.left, (a.y+b.y)/2-rect.top)
    } else if (drag) {
      stage.scrollLeft = drag.left + drag.x - event.clientX
      stage.scrollTop = drag.top + drag.y - event.clientY
    }
  })
  const end = event => { pointers.delete(event.pointerId); pinch = null; drag = null; image.style.cursor = scale > 1 ? 'grab' : 'zoom-in' }
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end)
  stage.addEventListener('dblclick', () => scale > 1 ? fit() : zoom(2))
  return { fit, zoom, step: delta => zoom(scale + delta), scale: () => scale }
}
