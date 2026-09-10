// Supply browser APIs missing from jsdom for dnd-kit and Base UI.
// dnd-kit reads ResizeObserver while its modules are loading.
globalThis.ResizeObserver = class ResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}
globalThis.IntersectionObserver = class IntersectionObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
  takeRecords () { return [] }
}
Document.prototype.getAnimations = () => []
Element.prototype.getAnimations = () => []
Object.defineProperty(Element.prototype, 'animate', {
  configurable: true,
  value: () => ({ finished: Promise.resolve() })
})
window.matchMedia = query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener () {},
  removeListener () {},
  addEventListener () {},
  removeEventListener () {},
  dispatchEvent () { return false }
})
