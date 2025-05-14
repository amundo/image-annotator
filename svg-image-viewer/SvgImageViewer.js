/* SvgImageViewer.js - v2 */
class SVGImageViewer extends HTMLElement {
  scale = 1
  translate = { x: 0, y: 0 }
  isDragging = false
  lastPointer = { x: 0, y: 0 }
  imageWidth = 0
  imageHeight = 0
  pointerDownTime = 0
  dragTimeout = null
  moveThreshold = 5  // Increased for better detection
  clickTimeThreshold = 300  // Increased for better detection
  _panningEnabled = true  // New flag to control panning behavior

  static observedAttributes = ['src']

  constructor() {
    super()
  }

  connectedCallback() {
    // Disable any drag capabilities at the component level
    this.style.webkitUserDrag = 'none'
    this.style.userDrag = 'none'
    this.style.webkitTouchCallout = 'none'
    
    this.render()
    this.attachEvents()
    this.updateSrc()
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'src') this.updateSrc()
  }

  render() {
    this.innerHTML = `
      <header class="controls"></header>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" draggable="false">
        <g class="transform-group">
          <image href="" width="100%" height="100%" draggable="false" style="pointer-events: none;"></image>
        </g>
      </svg>
    `
    this.svg = this.querySelector('svg')
    this.transformGroup = this.querySelector('.transform-group')
    this.image = this.querySelector('image')
    
    // Also set the draggable attribute programmatically for extra safety
    this.svg.setAttribute('draggable', 'false')
    this.image.setAttribute('draggable', 'false')
  }

  attachEvents() {
    this.svg.addEventListener('wheel', this.onWheel, { passive: false })
    this.svg.addEventListener('mousedown', this.onPointerDown)
    window.addEventListener('mousemove', this.onPointerMove)
    window.addEventListener('mouseup', this.onPointerUp)
    
    // Add these handlers to prevent the ghost drag effect
    this.svg.addEventListener('dragstart', this.preventDragGhost)
    this.svg.addEventListener('drop', this.preventDragGhost)
    this.svg.addEventListener('dragover', this.preventDragGhost)
    
    // Add click event to ensure we don't miss click events
    this.svg.addEventListener('click', this.onClick)
    
    // Add listener to handle image loading
    this.image.addEventListener('load', this.onImageLoad)
  }

  // Add this method to prevent the default drag behavior
  preventDragGhost = (e) => {
    e.preventDefault()
    e.stopPropagation()
    return false
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
  }

  updateSrc = () => {
    const src = this.getAttribute('src')
    if (src && this.image) {
      this.image.setAttribute('href', src)
    }
  }

  onWheel = (e) => {
    // Check if panning is enabled
    if (!this._panningEnabled) return
    
    e.preventDefault()

    const rect = this.svg.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = this.scale * zoomFactor

    // Calculate mouse position relative to the image
    const imgX = (mouseX - this.translate.x) / this.scale
    const imgY = (mouseY - this.translate.y) / this.scale

    // Adjust translation to zoom toward mouse position
    this.translate.x = mouseX - imgX * newScale
    this.translate.y = mouseY - imgY * newScale
    this.scale = newScale

    this.updateTransform()
  }

  onPointerDown = (e) => {
    // Check if panning is enabled
    if (!this._panningEnabled) return
    
    // Prevent browser's default drag behavior
    e.preventDefault()
    
    // Get the coordinates at the start point
    const svgRect = this.svg.getBoundingClientRect()
    const svgX = e.clientX - svgRect.left
    const svgY = e.clientY - svgRect.top
    
    // Store the start coordinates for later
    this.pointerStartCoords = {
      screen: { x: e.clientX, y: e.clientY },
      svg: { x: svgX, y: svgY },
      image: this.getImageCoordinates(e.clientX, e.clientY)
    }
    
    // Track the initial time for distinguishing between click and drag
    this.pointerDownTime = Date.now()
    
    // Set up dragging with a short delay to distinguish from clicks
    this.dragTimeout = setTimeout(() => {
      this.isDragging = true
      this.svg.classList.add('dragging')
    }, 150) // Short delay before initiating drag
    
    this.lastPointer = { x: e.clientX, y: e.clientY }
  }

  onPointerMove = (e) => {
    // Check if panning is enabled
    if (!this._panningEnabled) return
    
    // If we haven't started dragging yet but the mouse moved significantly
    if (!this.isDragging && this.dragTimeout) {
      const dx = e.clientX - this.pointerStartCoords.screen.x
      const dy = e.clientY - this.pointerStartCoords.screen.y
      const moveDistance = Math.sqrt(dx*dx + dy*dy)
      
      // If moved more than threshold, start dragging immediately
      if (moveDistance > this.moveThreshold) {
        clearTimeout(this.dragTimeout)
        this.dragTimeout = null
        this.isDragging = true
        this.svg.classList.add('dragging')
      }
    }
    
    if (!this.isDragging) return

    const dx = e.clientX - this.lastPointer.x
    const dy = e.clientY - this.lastPointer.y

    this.translate.x += dx
    this.translate.y += dy

    this.lastPointer = { x: e.clientX, y: e.clientY }

    this.updateTransform()
  }

  onPointerUp = (e) => {
    // Clear the drag timeout if it exists
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout)
      this.dragTimeout = null
    }
    
    const wasDragging = this.isDragging
    this.isDragging = false
    this.svg.classList.remove('dragging')
    
    // We'll handle click detection in the separate onClick handler
  }
  
  // Separate click handler for better reliability
  onClick = (e) => {
    // Don't process if we were just dragging
    if (this.isDragging) return
    
    // Calculate how far the pointer moved from its start position
    if (!this.pointerStartCoords) return
    
    const dx = e.clientX - this.pointerStartCoords.screen.x
    const dy = e.clientY - this.pointerStartCoords.screen.y
    const moveDistance = Math.sqrt(dx*dx + dy*dy)
    
    // Calculate how long since the pointer went down
    const clickTime = Date.now()
    const pointerDownDuration = clickTime - this.pointerDownTime
    
    // Only process clicks that didn't move much and weren't held down long
    if (moveDistance <= this.moveThreshold && pointerDownDuration <= this.clickTimeThreshold) {
      const imageCoords = this.getImageCoordinates(e.clientX, e.clientY)
      
      // Round to integers if needed for pixel precision
      const x = Math.round(imageCoords.x)
      const y = Math.round(imageCoords.y)
      
      // Check if the coordinates are within the image bounds
      const isWithinImage = this.isPointWithinImage(x, y)
      
      // Dispatch a custom event with the coordinates and whether it was inside the image
      this.dispatchEvent(new CustomEvent('image-click', {
        detail: { 
          x, 
          y, 
          withinImage: isWithinImage,
          originalEvent: e 
        }
      }))
    }
  }

  updateTransform = () => {
    // For SVG, we'll update the transform attribute of the group element
    this.transformGroup.setAttribute('transform', 
      `translate(${this.translate.x} ${this.translate.y}) scale(${this.scale})`)
      
    // Dispatch event when transform changes
    this.dispatchEvent(new CustomEvent('transform-changed', {
      detail: {
        translate: this.translate,
        scale: this.scale
      }
    }))
  }
  
  // Check if a point is within the image bounds
  isPointWithinImage(x, y) {
    return x >= 0 && y >= 0 && x <= this.imageWidth && y <= this.imageHeight
  }
  
  // Add this method for coordinate conversion
  getImageCoordinates(screenX, screenY) {
    // Get SVG bounding rect to adjust for its position
    const svgRect = this.svg.getBoundingClientRect()
    
    // Adjust screen coordinates to be relative to SVG
    const svgX = screenX - svgRect.left
    const svgY = screenY - svgRect.top
    
    // Apply inverse of current transformations
    // First subtract translation, then divide by scale
    const imageX = (svgX - this.translate.x) / this.scale
    const imageY = (svgY - this.translate.y) / this.scale
    
    return { x: imageX, y: imageY }
  }
  
  // Method to convert image coordinates back to screen coordinates
  getScreenCoordinates(imageX, imageY) {
    const svgRect = this.svg.getBoundingClientRect()
    
    // Apply current transformations
    // First multiply by scale, then add translation
    const svgX = (imageX * this.scale) + this.translate.x
    const svgY = (imageY * this.scale) + this.translate.y
    
    return { 
      x: svgX + svgRect.left, 
      y: svgY + svgRect.top 
    }
  }
  
  // PUBLIC API FOR CONTROLLING PANNING BEHAVIOR
  
  /**
   * Enable or disable panning functionality
   * @param {boolean} enabled - Whether panning should be enabled
   */
  setPanningEnabled(enabled) {
    this._panningEnabled = enabled
    
    // If disabling panning, ensure any ongoing drag operation is canceled
    if (!enabled) {
      if (this.dragTimeout) {
        clearTimeout(this.dragTimeout)
        this.dragTimeout = null
      }
      this.isDragging = false
      this.svg.classList.remove('dragging')
    }
    
    // Update cursor to give visual feedback based on new state
    if (enabled) {
      this.svg.classList.add('pan-enabled')
      this.svg.classList.remove('pan-disabled')
    } else {
      this.svg.classList.add('pan-disabled')
      this.svg.classList.remove('pan-enabled')
    }
    
    return this  // For chaining
  }
  
  /**
   * Check if panning is currently enabled
   * @return {boolean} Whether panning is enabled
   */
  isPanningEnabled() {
    return this._panningEnabled
  }
  
  /**
   * Force-stop any ongoing drag operation
   */
  stopDragging() {
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout)
      this.dragTimeout = null
    }
    if (this.isDragging) {
      this.isDragging = false
      this.svg.classList.remove('dragging')
    }
    return this  // For chaining
  }
}



customElements.define('svg-image-viewer', SVGImageViewer)
export {
  SVGImageViewer
}