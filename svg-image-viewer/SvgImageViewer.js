/**
 * SvgImageViewer Component - Debug Version
 * 
 * This version adds extensive debugging visualizations to help diagnose
 * coordinate transformation issues.
 */
export class SvgImageViewer extends HTMLElement {
  scale = 1
  translate = { x: 0, y: 0 }
  imageWidth = 0
  imageHeight = 0
  isDragging = false
  panningEnabled = true
  lastPointerPosition = { x: 0, y: 0 }

  static observedAttributes = ['src']

  constructor() {
    super()
    this._boundMouseDown = this._handleMouseDown.bind(this)
    this._boundMouseMove = this._handleMouseMove.bind(this)
    this._boundMouseUp = this._handleMouseUp.bind(this)
  }

  connectedCallback() {
    this.render()
    this.updateSrc()
    this._attachEvents()
  }
  
  disconnectedCallback() {
    this._detachEvents()
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'src') this.updateSrc()
  }

  render() {
    this.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <!-- Debug visualizations for SVG viewport -->
        <rect class="svg-viewport" x="0" y="0" width="100%" height="100%" 
          fill="rgba(200, 200, 255, 0.05)" stroke="#99f" stroke-width="2" 
          stroke-dasharray="5,5" />
          
        <g class="transform-group">
          <!-- Primary debug visualization for actual image data -->
          <rect class="image-debug-rect" x="0" y="0" width="0" height="0" 
            fill="none" stroke="#f00" stroke-width="3" stroke-dasharray="10,10" />
            
          <!-- Debug container for image element bounds -->
          <rect class="image-bounds" x="0" y="0" width="0" height="0" 
            fill="rgba(255, 200, 200, 0.1)" stroke="#f90" stroke-width="1" />
            
          <!-- The actual image (set to transparent for debugging) -->
          <image href="" width="100%" height="100%" opacity="0.8" preserveAspectRatio="xMidYMid meet"></image>
        </g>
        
        <!-- Mouse position markers -->
        <circle class="mouse-screen-pos" r="5" fill="red" opacity="0.7" cx="-100" cy="-100"></circle>
        <circle class="mouse-image-pos" r="5" fill="blue" opacity="0.7" cx="-100" cy="-100"></circle>
      </svg>
      
      <!-- Debugging info panel -->
      <div class="debug-info" style="position: absolute; top: 5px; left: 5px; background: rgba(255,255,255,0.8); 
        padding: 5px; font-family: monospace; font-size: 10px; z-index: 1000; pointer-events: none;">
        <div>Image size: <span class="debug-image-size">waiting...</span></div>
        <div>Scale: <span class="debug-scale">1.0</span></div>
        <div>Translate: <span class="debug-translate">0,0</span></div>
        <div>Mouse: <span class="debug-mouse-pos">0,0</span></div>
        <div>Image coords: <span class="debug-image-coords">0,0</span></div>
      </div>
    `
    
    // Get references to elements
    this.svg = this.querySelector('svg')
    this.transformGroup = this.querySelector('.transform-group')
    this.image = this.querySelector('image')
    this.imageDebugRect = this.querySelector('.image-debug-rect')
    this.imageBounds = this.querySelector('.image-bounds')
    this.mouseScreenPos = this.querySelector('.mouse-screen-pos')
    this.mouseImagePos = this.querySelector('.mouse-image-pos')
    
    // Debug info elements
    this.debugImageSize = this.querySelector('.debug-image-size')
    this.debugScale = this.querySelector('.debug-scale')
    this.debugTranslate = this.querySelector('.debug-translate')
    this.debugMousePos = this.querySelector('.debug-mouse-pos')
    this.debugImageCoords = this.querySelector('.debug-image-coords')
    
    // Mouse move tracking for debug visualization
    this.svg.addEventListener('mousemove', (e) => {
      const rect = this.svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      // Update screen position marker
      this.mouseScreenPos.setAttribute('cx', mouseX)
      this.mouseScreenPos.setAttribute('cy', mouseY)
      
      // Calculate and update image position marker
      if (this.imageWidth > 0) {
        const imageCoords = this.screenToImageCoordinates(e.clientX, e.clientY)
        
        // Only show if within image bounds
        if (imageCoords.x >= 0 && imageCoords.x <= this.imageWidth && 
            imageCoords.y >= 0 && imageCoords.y <= this.imageHeight) {
          // Position in transformed coordinates
          const transformedX = (imageCoords.x * this.scale) + this.translate.x
          const transformedY = (imageCoords.y * this.scale) + this.translate.y
          
          this.mouseImagePos.setAttribute('cx', transformedX)
          this.mouseImagePos.setAttribute('cy', transformedY)
        } else {
          // Hide if outside bounds
          this.mouseImagePos.setAttribute('cx', -100)
          this.mouseImagePos.setAttribute('cy', -100)
        }
        
        // Update debug text
        this.debugMousePos.textContent = `${Math.round(mouseX)},${Math.round(mouseY)}`
        this.debugImageCoords.textContent = `${Math.round(imageCoords.x)},${Math.round(imageCoords.y)}`
      }
    })
    
    // Add listener to handle image loading
    this.image.addEventListener('load', this.onImageLoad)
  }

  _attachEvents() {
    if (this.panningEnabled) {
      this.svg.addEventListener('mousedown', this._boundMouseDown)
      window.addEventListener('mousemove', this._boundMouseMove)
      window.addEventListener('mouseup', this._boundMouseUp)
    }
  }
  
  _detachEvents() {
    this.svg.removeEventListener('mousedown', this._boundMouseDown)
    window.removeEventListener('mousemove', this._boundMouseMove)
    window.removeEventListener('mouseup', this._boundMouseUp)
  }
  
  _handleMouseDown(e) {
    if (!this.panningEnabled) return
    
    this.isDragging = true
    this.lastPointerPosition = { x: e.clientX, y: e.clientY }
    this.setDragging(true)
    
    // Prevent default to avoid text selection during drag
    e.preventDefault()
  }
  
  _handleMouseMove(e) {
    if (!this.isDragging || !this.panningEnabled) return
    
    const dx = e.clientX - this.lastPointerPosition.x
    const dy = e.clientY - this.lastPointerPosition.y
    
    this.panBy(dx, dy)
    this.lastPointerPosition = { x: e.clientX, y: e.clientY }
  }
  
  _handleMouseUp(e) {
    if (!this.panningEnabled) return
    
    this.isDragging = false
    this.setDragging(false)
  }

  onImageLoad = () => {
    // Get natural dimensions of the image
    const img = new Image()
    img.src = this.getAttribute('src')
    img.onload = () => {
      this.imageWidth = img.naturalWidth
      this.imageHeight = img.naturalHeight
      
      console.log(`Image loaded with natural dimensions: ${this.imageWidth}x${this.imageHeight}`);
      
      // Set width and height attributes on the SVG image
      this.image.setAttribute('width', this.imageWidth)
      this.image.setAttribute('height', this.imageHeight)
      
      // Update the debug visualization rectangles
      this.imageDebugRect.setAttribute('width', this.imageWidth)
      this.imageDebugRect.setAttribute('height', this.imageHeight)
      
      this.imageBounds.setAttribute('width', this.imageWidth)
      this.imageBounds.setAttribute('height', this.imageHeight)
      
      // Update debug info
      this.debugImageSize.textContent = `${this.imageWidth}x${this.imageHeight}`
      
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
  
  // Enable/disable panning
  setPanningEnabled(enabled) {
    if (this.panningEnabled === enabled) return
    
    this.panningEnabled = enabled
    
    if (enabled) {
      this._attachEvents()
      this.svg.classList.remove('pan-disabled')
    } else {
      this._detachEvents()
      this.stopDragging()
      this.svg.classList.add('pan-disabled')
    }
  }
  
  // Stop any ongoing dragging
  stopDragging() {
    if (this.isDragging) {
      this.isDragging = false
      this.setDragging(false)
    }
  }
  
  // Convert screen coordinates to image coordinates
  screenToImageCoordinates(screenX, screenY) {
    const svgRect = this.svg.getBoundingClientRect()
    
    // First, get position relative to SVG element
    const svgX = screenX - svgRect.left
    const svgY = screenY - svgRect.top
    
    // Then, account for the current transform
    const imageX = (svgX - this.translate.x) / this.scale
    const imageY = (svgY - this.translate.y) / this.scale
    
    return { x: imageX, y: imageY }
  }
  
  // Convert image coordinates to screen coordinates
  imageToScreenCoordinates(imageX, imageY) {
    const svgRect = this.svg.getBoundingClientRect()
    
    // Apply scaling and translation
    const svgX = imageX * this.scale + this.translate.x
    const svgY = imageY * this.scale + this.translate.y
    
    // Convert back to screen coordinates
    const screenX = svgX + svgRect.left
    const screenY = svgY + svgRect.top
    
    return { x: screenX, y: screenY }
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
    this.updateDebugInfo()
    
    // Dispatch zoom event that parent can listen for
    this.dispatchEvent(new CustomEvent('zoom-changed', {
      bubbles: true,
      detail: { scale: this.scale }
    }))
    
    // Also dispatch a combined transform event
    this.dispatchEvent(new CustomEvent('transform-changed', {
      bubbles: true,
      detail: { 
        scale: this.scale,
        translate: { ...this.translate }
      }
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
    this.updateDebugInfo()
    
    // Dispatch pan event that parent can listen for
    this.dispatchEvent(new CustomEvent('pan-changed', {
      bubbles: true,
      detail: { translate: { ...this.translate } }
    }))
    
    // Also dispatch a combined transform event
    this.dispatchEvent(new CustomEvent('transform-changed', {
      bubbles: true,
      detail: { 
        scale: this.scale,
        translate: { ...this.translate }
      }
    }))
  }
  
  // Set translation to specific values
  setTranslation(x, y) {
    this.translate.x = x
    this.translate.y = y
    this.updateTransform()
    this.updateDebugInfo()
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
    this.updateDebugInfo()
    
    console.log(`Image fit to view: scale=${this.scale}, translate=(${this.translate.x}, ${this.translate.y})`);
    
    // Dispatch events
    this.dispatchEvent(new CustomEvent('zoom-changed', {
      bubbles: true,
      detail: { scale: this.scale }
    }))
    
    this.dispatchEvent(new CustomEvent('pan-changed', {
      bubbles: true,
      detail: { translate: { ...this.translate } }
    }))
    
    this.dispatchEvent(new CustomEvent('transform-changed', {
      bubbles: true,
      detail: { 
        scale: this.scale,
        translate: { ...this.translate }
      }
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
  
  updateDebugInfo = () => {
    // Update debug info panel
    this.debugScale.textContent = this.scale.toFixed(2)
    this.debugTranslate.textContent = `${Math.round(this.translate.x)},${Math.round(this.translate.y)}`
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
  
  // Check if a point (in image coordinates) is within the actual image bounds
  isPointInImage(x, y) {
    return x >= 0 && x <= this.imageWidth && y >= 0 && y <= this.imageHeight
  }
}

customElements.define('svg-image-viewer', SvgImageViewer)