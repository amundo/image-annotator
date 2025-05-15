/**
 * SvgImageViewer Component
 * 
 * A web component that displays an image within an SVG container,
 * providing zoom and pan functionality without directly handling events.
 * All event handling is delegated to the parent component.
 */
export class SvgImageViewer extends HTMLElement {
  scale = 1
  translate = { x: 0, y: 0 }
  imageWidth = 0
  imageHeight = 0

  static observedAttributes = ['src']

  constructor() {
    super()
  }

  connectedCallback() {
    this.render()
    this.updateSrc()
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'src') this.updateSrc()
  }

  render() {
    this.innerHTML = `
      <header class="controls"></header>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <g class="transform-group">
          <image href="" width="100%" height="100%"></image>
        </g>
      </svg>
    `
    this.svg = this.querySelector('svg')
    this.transformGroup = this.querySelector('.transform-group')
    this.image = this.querySelector('image')
    
    // Add listener to handle image loading
    this.image.addEventListener('load', this.onImageLoad)
  }

  onImageLoad = () => {
    // Get natural dimensions of the image
    const img = new Image()
    img.src = this.getAttribute('src')
    img.onload = () => {
      this.imageWidth = img.naturalWidth
      this.imageHeight = img.naturalHeight
      
      // Set width and height attributes on the SVG image
      this.image.setAttribute('width', this.imageWidth)
      this.image.setAttribute('height', this.imageHeight)
      
      // Reset transform to initial state
      this.fitImageToView()
      
      // Dispatch a loaded event that parent components can listen for
      this.dispatchEvent(new CustomEvent('image-loaded', {
        bubbles: true,
        detail: { width: this.imageWidth, height: this.imageHeight }
      }))
    }
  }

  // Public API methods
  
  // Convert screen coordinates to image coordinates
  screenToImageCoordinates(screenX, screenY) {
    const svgRect = this.svg.getBoundingClientRect()
    const x = (screenX - svgRect.left - this.translate.x) / this.scale
    const y = (screenY - svgRect.top - this.translate.y) / this.scale
    return { x, y }
  }
  
  // Convert image coordinates to screen coordinates
  imageToScreenCoordinates(imageX, imageY) {
    const svgRect = this.svg.getBoundingClientRect()
    const x = imageX * this.scale + this.translate.x + svgRect.left
    const y = imageY * this.scale + this.translate.y + svgRect.top
    return { x, y }
  }
  
  // Handle zoom at a specific point
  zoomAt(screenX, screenY, zoomFactor) {
    const rect = this.svg.getBoundingClientRect()
    const mouseX = screenX - rect.left
    const mouseY = screenY - rect.top

    const newScale = this.scale * zoomFactor

    // Calculate mouse position relative to the image
    const imgX = (mouseX - this.translate.x) / this.scale
    const imgY = (mouseY - this.translate.y) / this.scale

    // Adjust translation to zoom toward mouse position
    this.translate.x = mouseX - imgX * newScale
    this.translate.y = mouseY - imgY * newScale
    this.scale = newScale

    this.updateTransform()
    
    // Dispatch zoom event that parent can listen for
    this.dispatchEvent(new CustomEvent('zoom-changed', {
      bubbles: true,
      detail: { scale: this.scale }
    }))
  }
  
  // Set zoom to specific level
  setZoom(newScale) {
    // Get center of view
    const rect = this.svg.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    // Zoom at center point
    this.zoomAt(centerX + rect.left, centerY + rect.top, newScale / this.scale)
  }
  
  // Pan the image by a delta
  panBy(dx, dy) {
    this.translate.x += dx
    this.translate.y += dy
    this.updateTransform()
    
    // Dispatch pan event that parent can listen for
    this.dispatchEvent(new CustomEvent('pan-changed', {
      bubbles: true,
      detail: { translate: { ...this.translate } }
    }))
  }
  
  // Set translation to specific values
  setTranslation(x, y) {
    this.translate.x = x
    this.translate.y = y
    this.updateTransform()
  }
  
  // Set dragging state
  setDragging(isDragging) {
    if (isDragging) {
      this.svg.classList.add('dragging')
    } else {
      this.svg.classList.remove('dragging')
    }
  }

  fitImageToView = () => {
    if (!this.imageWidth || !this.imageHeight) return
    
    const svgRect = this.svg.getBoundingClientRect()
    const svgWidth = svgRect.width
    const svgHeight = svgRect.height
    
    // Calculate scale to fit image in view
    const scaleX = svgWidth / this.imageWidth
    const scaleY = svgHeight / this.imageHeight
    this.scale = Math.min(scaleX, scaleY) * 0.9 // 90% to leave some margin
    
    // Center the image
    this.translate.x = (svgWidth - (this.imageWidth * this.scale)) / 2
    this.translate.y = (svgHeight - (this.imageHeight * this.scale)) / 2
    
    this.updateTransform()
    
    // Dispatch events
    this.dispatchEvent(new CustomEvent('zoom-changed', {
      bubbles: true,
      detail: { scale: this.scale }
    }))
    
    this.dispatchEvent(new CustomEvent('pan-changed', {
      bubbles: true,
      detail: { translate: { ...this.translate } }
    }))
    
    return { scale: this.scale, translate: { ...this.translate } }
  }
  
  // Reset to original view
  resetView() {
    return this.fitImageToView()
  }

  updateSrc = () => {
    const src = this.getAttribute('src')
    if (src && this.image) {
      this.image.setAttribute('href', src)
    }
  }

  updateTransform = () => {
    // For SVG, we'll update the transform attribute of the group element
    this.transformGroup.setAttribute('transform', 
      `translate(${this.translate.x} ${this.translate.y}) scale(${this.scale})`)
  }
  
  // Getter for current scale
  getScale() {
    return this.scale
  }
  
  // Getter for current translation
  getTranslation() {
    return { ...this.translate }
  }
  
  // Getter for image dimensions
  getImageDimensions() {
    return { width: this.imageWidth, height: this.imageHeight }
  }
  
  // Getter for svg element dimensions
  getViewportDimensions() {
    const rect = this.svg.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }
}

customElements.define('svg-image-viewer', SvgImageViewer)