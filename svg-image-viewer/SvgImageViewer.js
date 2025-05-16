/**
 * SvgImageViewer Component with Controls
 * 
 * Adds optional controls UI similar to HTML5 media elements
 */
export class SvgImageViewer extends HTMLElement {
  scale = 1
  translate = { x: 0, y: 0 }
  imageWidth = 0
  imageHeight = 0
  isDragging = false
  panningEnabled = true
  lastPointerPosition = { x: 0, y: 0 }
  controlsVisible = false
  zoomStep = 1.2 // 20% zoom factor per click

  static observedAttributes = ['src', 'controls']

  constructor() {
    super()
    this._boundMouseDown = this._handleMouseDown.bind(this)
    this._boundMouseMove = this._handleMouseMove.bind(this)
    this._boundMouseUp = this._handleMouseUp.bind(this)
    this._boundWheel = this._handleWheel.bind(this)
    this._boundKeyDown = this._handleKeyDown.bind(this)
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
    if (name === 'controls' && oldVal !== newVal) {
      this.render() // Re-render if controls state changes
    }
  }

  render() {
    // Base viewer 
    let template = `
      <div class="svg-viewer-container">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <!-- Debug visualization for SVG viewport -->
          <rect class="svg-viewport" x="0" y="0" width="100%" height="100%" 
            fill="rgba(200, 200, 255, 0.05)" stroke="#99f" stroke-width="1" 
            stroke-dasharray="5,5" />
            
          <g class="transform-group">
            <!-- Debug rectangle for image bounds -->
            <rect class="image-bounds" x="0" y="0" width="0" height="0" 
              fill="rgba(255, 200, 200, 0.1)" stroke="#f00" stroke-width="1" />
              
            <!-- The actual image -->
            <image href="" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"></image>
          </g>
        </svg>
    `
    
    // Add controls if attribute exists
    if (this.hasAttribute('controls')) {
      this.controlsVisible = true
      template += `
        <div class="svg-viewer-controls">
          <button class="zoom-out" title="Zoom Out">−</button>
          <button class="zoom-reset" title="Reset View"><svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M15,3H9V1h6V3z M12,18.5c0.83,0,1.5-0.67,1.5-1.5h-3C10.5,17.83,11.17,18.5,12,18.5z M14,19v1H10v-1H14z M19,13.8V7 c0-2.48-1.49-4.55-3.55-5.15C15.17,1.33,14.66,1,14,1H9.9C9.44,1,8.9,1.31,8.64,1.68C6.5,2.29,5,4.35,5,6.81v7 c0,2.09-1.07,3.59-2,4.35V19h18v-0.83C20.05,17.4,19,15.89,19,13.8z M17,14c0,2.46-2.06,4.41-4.5,4.41S8,16.46,8,14s2.06-4.41,4.5-4.41 S17,11.54,17,14z"/>
            <rect x="8" y="11" width="8" height="6" fill="currentColor"/>
          </svg></button>
          <div class="zoom-level">100%</div>
          <button class="zoom-in" title="Zoom In">+</button>
          <button class="toggle-pan" title="Toggle Pan Mode">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M13,6c0-0.55-0.45-1-1-1s-1,0.45-1,1s0.45,1,1,1S13,6.55,13,6z M18,1c1.1,0,2,0.9,2,2v8c0,2.76-2.24,5-5,5h-3.17 l1.59,1.59L12,19l-4-4l4-4l1.41,1.41L11.83,14H15c1.65,0,3-1.35,3-3V3c0,0,0-1-1-1h-7.64c-0.64,0-1.36,0-2.06,0.94 c-0.29,0.39-0.39,0.69-0.39,1.06c0,0.37,0.14,0.67,0.42,1.03C7.55,5.34,7.91,6,8.88,6C9.85,6,10,5,10,5h0.3 c-0.06-0.32-0.1-0.66-0.1-1H18z M11.86,14.19c-1.93-0.35-3.4-2.04-3.5-4.1C8.33,10.08,8.31,10.04,8.28,10H9c0.55,0,1-0.45,1-1 c0-0.55-0.45-1-1-1H5c-0.55,0-1,0.45-1,1c0,0.55,0.45,1,1,1h1.68c0.04,0.07,0.08,0.15,0.12,0.22c0.82,1.41,2.12,2.43,3.69,2.78 c0.54,0.12,1.07-0.22,1.19-0.76C11.8,11.72,11.45,14.31,11.86,14.19z"/>
            </svg>
          </button>
          <button class="fullscreen-toggle" title="Toggle Fullscreen">
            <svg class="fullscreen-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
            <svg class="fullscreen-exit-icon" viewBox="0 0 24 24" width="20" height="20" style="display:none">
              <path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
            </svg>
          </button>
        </div>
      `
    }
    
    // Close container div
    template += `</div>`
    
    this.innerHTML = template
    
    // Get references to elements
    this.container = this.querySelector('.svg-viewer-container')
    this.svg = this.querySelector('svg')
    this.transformGroup = this.querySelector('.transform-group')
    this.image = this.querySelector('image')
    this.imageBounds = this.querySelector('.image-bounds')
    
    // Add listener to handle image loading
    this.image.addEventListener('load', this.onImageLoad)
    
    // Setup controls if present
    if (this.controlsVisible) {
      this.setupControlsEvents()
    }
    
    // Tabindex for keyboard support
    this.svg.setAttribute('tabindex', '0')
  }

  setupControlsEvents() {
    const zoomIn = this.querySelector('.zoom-in')
    const zoomOut = this.querySelector('.zoom-out')
    const zoomReset = this.querySelector('.zoom-reset')
    const togglePan = this.querySelector('.toggle-pan')
    const fullscreenToggle = this.querySelector('.fullscreen-toggle')
    this.zoomLevel = this.querySelector('.zoom-level')
    
    zoomIn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const rect = this.svg.getBoundingClientRect()
      this.zoomAt(rect.left + rect.width/2, rect.top + rect.height/2, this.zoomStep)
    })
    
    zoomOut.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const rect = this.svg.getBoundingClientRect()
      this.zoomAt(rect.left + rect.width/2, rect.top + rect.height/2, 1/this.zoomStep)
    })
    
    zoomReset.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.fitImageToView()
    })
    
    togglePan.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.setPanningEnabled(!this.panningEnabled)
      this.updateControlsState()
    })
    
    // Ensure initial state is reflected
    this.updateControlsState()
    
    // Fullscreen support
    if (fullscreenToggle) {
      fullscreenToggle.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.toggleFullscreen()
      })
      
      // Update icon when fullscreen state changes
      document.addEventListener('fullscreenchange', () => {
        this.updateFullscreenButton()
      })
    }
  }
  
  updateControlsState() {
    const togglePan = this.querySelector('.toggle-pan')
    if (togglePan) {
      togglePan.classList.toggle('active', this.panningEnabled)
      togglePan.setAttribute('title', this.panningEnabled ? 'Disable Pan Mode' : 'Enable Pan Mode')
    }
    
    // Update zoom level display
    this.updateZoomDisplay()
  }
  
  updateZoomDisplay() {
    if (this.zoomLevel) {
      this.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`
    }
  }
  
  updateFullscreenButton() {
    const button = this.querySelector('.fullscreen-toggle')
    if (!button) return
    
    const fullscreenIcon = button.querySelector('.fullscreen-icon')
    const exitIcon = button.querySelector('.fullscreen-exit-icon')
    
    const isFullscreen = document.fullscreenElement === this || 
                         document.webkitFullscreenElement === this
    
    if (isFullscreen) {
      fullscreenIcon.style.display = 'none'
      exitIcon.style.display = 'block'
      button.setAttribute('title', 'Exit Fullscreen')
    } else {
      fullscreenIcon.style.display = 'block'
      exitIcon.style.display = 'none'
      button.setAttribute('title', 'Enter Fullscreen')
    }
  }
  
  toggleFullscreen() {
    if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) {
      console.warn('Fullscreen API not supported')
      return
    }
    
    if (document.fullscreenElement === this || document.webkitFullscreenElement === this) {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      }
    } else {
      // Enter fullscreen
      if (this.requestFullscreen) {
        this.requestFullscreen()
      } else if (this.webkitRequestFullscreen) {
        this.webkitRequestFullscreen()
      }
    }
  }

  _attachEvents() {
    // Mouse events for panning
    if (this.panningEnabled) {
      this.svg.addEventListener('mousedown', this._boundMouseDown)
    }
    
    // These are always attached to handle cleanup properly
    window.addEventListener('mousemove', this._boundMouseMove)
    window.addEventListener('mouseup', this._boundMouseUp)
    
    // Wheel for zooming
    this.svg.addEventListener('wheel', this._boundWheel)
    
    // Keyboard navigation
    this.svg.addEventListener('keydown', this._boundKeyDown)
  }
  
  _detachEvents() {
    this.svg.removeEventListener('mousedown', this._boundMouseDown)
    window.removeEventListener('mousemove', this._boundMouseMove)
    window.removeEventListener('mouseup', this._boundMouseUp)
    this.svg.removeEventListener('wheel', this._boundWheel)
    this.svg.removeEventListener('keydown', this._boundKeyDown)
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
    if (this.isDragging) {
      this.isDragging = false
      this.setDragging(false)
    }
  }
  
  _handleWheel(e) {
    // Prevent default to avoid page scrolling
    e.preventDefault()
    
    // Determine zoom direction
    const delta = -Math.sign(e.deltaY)
    const factor = delta > 0 ? this.zoomStep : 1/this.zoomStep
    
    // Zoom at mouse position
    this.zoomAt(e.clientX, e.clientY, factor)
  }
  
  _handleKeyDown(e) {
    const STEP = 20 // Pixels to move per key press
    
    // Only handle keys when focused
    if (document.activeElement !== this.svg) return
    
    switch (e.key) {
      case 'ArrowLeft':
        if (this.panningEnabled) {
          this.panBy(STEP, 0)
          e.preventDefault()
        }
        break
      case 'ArrowRight':
        if (this.panningEnabled) {
          this.panBy(-STEP, 0)
          e.preventDefault()
        }
        break
      case 'ArrowUp':
        if (this.panningEnabled) {
          this.panBy(0, STEP)
          e.preventDefault()
        }
        break
      case 'ArrowDown':
        if (this.panningEnabled) {
          this.panBy(0, -STEP)
          e.preventDefault()
        }
        break
      case '+':
      case '=':
        const rect = this.svg.getBoundingClientRect()
        this.zoomAt(rect.left + rect.width/2, rect.top + rect.height/2, this.zoomStep)
        e.preventDefault()
        break
      case '-':
      case '_':
        const rect2 = this.svg.getBoundingClientRect()
        this.zoomAt(rect2.left + rect2.width/2, rect2.top + rect2.height/2, 1/this.zoomStep)
        e.preventDefault()
        break
      case 'Home':
      case '0':
        this.fitImageToView()
        e.preventDefault()
        break
      case ' ':
        this.setPanningEnabled(!this.panningEnabled)
        this.updateControlsState()
        e.preventDefault()
        break
      case 'f':
        if (this.controlsVisible) {
          this.toggleFullscreen()
          e.preventDefault()
        }
        break
    }
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
      
      // Update the debug rectangle
      this.imageBounds.setAttribute('width', this.imageWidth)
      this.imageBounds.setAttribute('height', this.imageHeight)
      
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
      this.svg.addEventListener('mousedown', this._boundMouseDown)
      this.svg.classList.remove('pan-disabled')
      
      // Dispatch event
      this.dispatchEvent(new CustomEvent('pan-enabled', {
        bubbles: true
      }))
    } else {
      this.svg.removeEventListener('mousedown', this._boundMouseDown)
      this.stopDragging()
      this.svg.classList.add('pan-disabled')
      
      // Dispatch event
      this.dispatchEvent(new CustomEvent('pan-disabled', {
        bubbles: true
      }))
    }
    
    // Update controls if present
    if (this.controlsVisible) {
      this.updateControlsState()
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
    
    // Update zoom display if controls are visible
    if (this.controlsVisible) {
      this.updateZoomDisplay()
    }
    
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
    
    // Update controls display if visible
    if (this.controlsVisible) {
      this.updateZoomDisplay()
    }
    
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