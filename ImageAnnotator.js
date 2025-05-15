import { SvgImageViewer } from './svg-image-viewer/SvgImageViewer.js';

/**
 * ImageAnnotator Component
 * 
 * A web component that combines an SvgImageViewer with annotation capabilities.
 * This component handles all user interactions and delegates zooming and panning
 * to the embedded SvgImageViewer instance.
 */
class ImageAnnotator extends HTMLElement {
  isDragging = false
  lastPointer = { x: 0, y: 0 }
  annotations = []
  activeAnnotation = null
  currentTool = 'pan' // Default tool: 'pan', 'rect', 'ellipse', 'polygon', etc.
  
  static observedAttributes = ['src', 'tool']
  
  constructor() {
    super()
  }
  
  connectedCallback() {
    this.render()
    this.imageViewer = this.querySelector('svg-image-viewer')
    this.setupControls()
    this.attachEvents()
  }
  
  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'src' && this.imageViewer) {
      this.imageViewer.setAttribute('src', newVal)
    }
    if (name === 'tool') {
      this.currentTool = newVal
      this.updateToolUI()
    }
  }
  
  render() {
    // Create basic structure
    this.innerHTML = `
      <div class="annotator-container">
        <div class="toolbar">
          <button data-tool="pan" class="active">Pan</button>
          <button data-tool="rect">Rectangle</button>
          <button data-tool="ellipse">Ellipse</button>
          <button data-tool="polygon">Polygon</button>
          <button data-tool="reset">Reset View</button>
        </div>
        <div class="viewer-container">
          <svg-image-viewer src="${this.getAttribute('src') || ''}"></svg-image-viewer>
          <svg class="annotation-layer" xmlns="http://www.w3.org/2000/svg">
            <g class="annotations-group"></g>
          </svg>
        </div>
      </div>
    `
    
    // Get essential elements
    this.imageViewer = this.querySelector('svg-image-viewer')
    this.annotationSvg = this.querySelector('.annotation-layer')
    this.annotationsGroup = this.querySelector('.annotations-group')
  }
  
  setupControls() {
    // Set up tool buttons
    const buttons = this.querySelectorAll('.toolbar button[data-tool]')
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons
        buttons.forEach(btn => btn.classList.remove('active'))
        // Add active class to clicked button
        button.classList.add('active')
        // Set current tool
        this.currentTool = button.dataset.tool
        
        // Handle special tools
        if (this.currentTool === 'reset') {
          this.imageViewer.resetView()
          // Reset to pan mode after reset
          this.currentTool = 'pan'
          this.updateToolUI()
          return
        }
      })
    })
  }
  
  updateToolUI() {
    // Update active button
    const buttons = this.querySelectorAll('.toolbar button[data-tool]')
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === this.currentTool)
    })
    
    // Update cursor on annotation layer based on tool
    const cursorMap = {
      'pan': 'grab',
      'rect': 'crosshair',
      'ellipse': 'crosshair',
      'polygon': 'crosshair'
    }
    this.annotationSvg.style.cursor = cursorMap[this.currentTool] || 'default'
  }
  
  attachEvents() {
    // Listen for wheel events
    this.addEventListener('wheel', this.onWheel, { passive: false })
    
    // Listen for mouse events on the annotation layer
    this.annotationSvg.addEventListener('mousedown', this.onPointerDown)
    window.addEventListener('mousemove', this.onPointerMove)
    window.addEventListener('mouseup', this.onPointerUp)
    
    // Listen for image load
    this.imageViewer.addEventListener('image-loaded', this.onImageLoaded)
    
    // Listen for zoom/pan events from the image viewer to sync annotation layer
    this.imageViewer.addEventListener('zoom-changed', this.syncAnnotationLayer)
    this.imageViewer.addEventListener('pan-changed', this.syncAnnotationLayer)
  }
  
  onImageLoaded = (e) => {
    // Handle when image is loaded
    const { width, height } = e.detail
    
    // Set the annotation SVG to match the image viewer dimensions
    this.resizeAnnotationLayer()
    
    // Maybe load annotations from an attribute or storage
    this.loadAnnotations()
  }
  
  resizeAnnotationLayer() {
    // Match annotation SVG size to the image viewer
    const viewerRect = this.imageViewer.getBoundingClientRect()
    this.annotationSvg.setAttribute('width', viewerRect.width)
    this.annotationSvg.setAttribute('height', viewerRect.height)
    
    // Position annotation layer absolutely over the image viewer
    this.annotationSvg.style.position = 'absolute'
    this.annotationSvg.style.top = '0'
    this.annotationSvg.style.left = '0'
    this.annotationSvg.style.pointerEvents = 'none' // Allow events to pass through to imageViewer
    
    // For tools other than pan, we need to capture events
    if (this.currentTool !== 'pan') {
      this.annotationSvg.style.pointerEvents = 'auto'
    }
  }
  
  syncAnnotationLayer = () => {
    // Get current transform from image viewer
    const scale = this.imageViewer.getScale()
    const { x, y } = this.imageViewer.getTranslation()
    
    // Apply the same transform to the annotations group
    this.annotationsGroup.setAttribute('transform', 
      `translate(${x} ${y}) scale(${scale})`)
  }
  
  onWheel = (e) => {
    e.preventDefault()
    
    // Only zoom if we're in pan mode
    if (this.currentTool === 'pan') {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
      this.imageViewer.zoomAt(e.clientX, e.clientY, zoomFactor)
    }
  }
  
  onPointerDown = (e) => {
    this.isDragging = true
    this.lastPointer = { x: e.clientX, y: e.clientY }
    
    // Handle based on current tool
    switch (this.currentTool) {
      case 'pan':
        this.imageViewer.setDragging(true)
        break
      case 'rect':
        this.startRectangleAnnotation(e)
        break
      case 'ellipse':
        this.startEllipseAnnotation(e)
        break
      case 'polygon':
        this.handlePolygonPoint(e)
        break
    }
  }
  
  onPointerMove = (e) => {
    if (!this.isDragging) return
    
    const dx = e.clientX - this.lastPointer.x
    const dy = e.clientY - this.lastPointer.y
    
    // Handle based on current tool
    switch (this.currentTool) {
      case 'pan':
        this.imageViewer.panBy(dx, dy)
        break
      case 'rect':
        this.updateRectangleAnnotation(e)
        break
      case 'ellipse':
        this.updateEllipseAnnotation(e)
        break
      case 'polygon':
        this.updatePolygonPreview(e)
        break
    }
    
    this.lastPointer = { x: e.clientX, y: e.clientY }
  }
  
  onPointerUp = (e) => {
    // Finish the current action based on tool
    switch (this.currentTool) {
      case 'pan':
        this.imageViewer.setDragging(false)
        break
      case 'rect':
        this.finishRectangleAnnotation(e)
        break
      case 'ellipse':
        this.finishEllipseAnnotation(e)
        break
      // Polygon is special - it finishes on double-click
    }
    
    this.isDragging = false
  }
  
  // Rectangle annotation methods
  startRectangleAnnotation(e) {
    // Convert screen coordinates to image coordinates
    const imageCoords = this.imageViewer.screenToImageCoordinates(e.clientX, e.clientY)
    
    // Create a new rectangle element
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('x', imageCoords.x)
    rect.setAttribute('y', imageCoords.y)
    rect.setAttribute('width', 0)
    rect.setAttribute('height', 0)
    rect.setAttribute('fill', 'rgba(255, 0, 0, 0.3)')
    rect.setAttribute('stroke', 'red')
    rect.setAttribute('stroke-width', 2 / this.imageViewer.getScale()) // Scale-independent stroke
    
    // Add to the annotations group
    this.annotationsGroup.appendChild(rect)
    
    // Set as active annotation
    this.activeAnnotation = {
      element: rect,
      type: 'rect',
      startX: imageCoords.x,
      startY: imageCoords.y
    }
  }
  
  updateRectangleAnnotation(e) {
    if (!this.activeAnnotation || this.activeAnnotation.type !== 'rect') return
    
    // Convert current mouse position to image coordinates
    const imageCoords = this.imageViewer.screenToImageCoordinates(e.clientX, e.clientY)
    
    // Calculate width and height
    const width = imageCoords.x - this.activeAnnotation.startX
    const height = imageCoords.y - this.activeAnnotation.startY
    
    // Update rectangle attributes
    const rect = this.activeAnnotation.element
    
    if (width < 0) {
      rect.setAttribute('x', imageCoords.x)
      rect.setAttribute('width', Math.abs(width))
    } else {
      rect.setAttribute('width', width)
    }
    
    if (height < 0) {
      rect.setAttribute('y', imageCoords.y)
      rect.setAttribute('height', Math.abs(height))
    } else {
      rect.setAttribute('height', height)
    }
  }
  
  finishRectangleAnnotation(e) {
    if (!this.activeAnnotation || this.activeAnnotation.type !== 'rect') return
    
    // Get final dimensions
    const rect = this.activeAnnotation.element
    const x = parseFloat(rect.getAttribute('x'))
    const y = parseFloat(rect.getAttribute('y'))
    const width = parseFloat(rect.getAttribute('width'))
    const height = parseFloat(rect.getAttribute('height'))
    
    // Only keep rectangles with meaningful area
    if (width > 2 && height > 2) {
      // Save annotation data
      this.annotations.push({
        id: Date.now().toString(),
        type: 'rect',
        x, y, width, height
      })
      
      // Dispatch event about new annotation
      this.dispatchEvent(new CustomEvent('annotation-created', {
        bubbles: true,
        detail: this.annotations[this.annotations.length - 1]
      }))
    } else {
      // Remove tiny rectangles
      rect.remove()
    }
    
    this.activeAnnotation = null
  }
  
  // Ellipse annotation methods
  startEllipseAnnotation(e) {
    // Convert screen coordinates to image coordinates
    const imageCoords = this.imageViewer.screenToImageCoordinates(e.clientX, e.clientY)
    
    // Create a new ellipse element
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    ellipse.setAttribute('cx', imageCoords.x)
    ellipse.setAttribute('cy', imageCoords.y)
    ellipse.setAttribute('rx', 0)
    ellipse.setAttribute('ry', 0)
    ellipse.setAttribute('fill', 'rgba(0, 0, 255, 0.3)')
    ellipse.setAttribute('stroke', 'blue')
    ellipse.setAttribute('stroke-width', 2 / this.imageViewer.getScale()) // Scale-independent stroke
    
    // Add to the annotations group
    this.annotationsGroup.appendChild(ellipse)
    
    // Set as active annotation
    this.activeAnnotation = {
      element: ellipse,
      type: 'ellipse',
      startX: imageCoords.x,
      startY: imageCoords.y
    }
  }
  
  updateEllipseAnnotation(e) {
    if (!this.activeAnnotation || this.activeAnnotation.type !== 'ellipse') return
    
    // Convert current mouse position to image coordinates
    const imageCoords = this.imageViewer.screenToImageCoordinates(e.clientX, e.clientY)
    
    // Calculate radii
    const rx = Math.abs(imageCoords.x - this.activeAnnotation.startX)
    const ry = Math.abs(imageCoords.y - this.activeAnnotation.startY)
    
    // Update ellipse attributes
    const ellipse = this.activeAnnotation.element
    ellipse.setAttribute('rx', rx)
    ellipse.setAttribute('ry', ry)
  }
  
  finishEllipseAnnotation(e) {
    if (!this.activeAnnotation || this.activeAnnotation.type !== 'ellipse') return
    
    // Get final dimensions
    const ellipse = this.activeAnnotation.element
    const cx = parseFloat(ellipse.getAttribute('cx'))
    const cy = parseFloat(ellipse.getAttribute('cy'))
    const rx = parseFloat(ellipse.getAttribute('rx'))
    const ry = parseFloat(ellipse.getAttribute('ry'))
    
    // Only keep ellipses with meaningful area
    if (rx > 2 && ry > 2) {
      // Save annotation data
      this.annotations.push({
        id: Date.now().toString(),
        type: 'ellipse',
        cx, cy, rx, ry
      })
      
      // Dispatch event about new annotation
      this.dispatchEvent(new CustomEvent('annotation-created', {
        bubbles: true,
        detail: this.annotations[this.annotations.length - 1]
      }))
    } else {
      // Remove tiny ellipses
      ellipse.remove()
    }
    
    this.activeAnnotation = null
  }
  
  // Polygon annotation methods
  handlePolygonPoint(e) {
    // Convert screen coordinates to image coordinates
    const imageCoords = this.imageViewer.screenToImageCoordinates(e.clientX, e.clientY)
    
    // Check if we're starting a new polygon
    if (!this.activeAnnotation || this.activeAnnotation.type !== 'polygon') {
      // Create a new polygon element
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      polygon.setAttribute('points', `${imageCoords.x},${imageCoords.y}`)
      polygon.setAttribute('fill', 'rgba(0, 255, 0, 0.3)')
      polygon.setAttribute('stroke', 'green')
      polygon.setAttribute('stroke-width', 2 / this.imageViewer.getScale())
      
      // Create preview line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', imageCoords.x)
      line.setAttribute('y1', imageCoords.y)
      line.setAttribute('x2', imageCoords.x)
      line.setAttribute('y2', imageCoords.y)
      line.setAttribute('stroke', 'green')
      line.setAttribute('stroke-width', 1 / this.imageViewer.getScale())
      line.setAttribute('stroke-dasharray', '5,5')
      
      // Add to the annotations group
      this.annotationsGroup.appendChild(polygon)
      this.annotationsGroup.appendChild(line)
      
      // Set as active annotation
      this.activeAnnotation = {
        element: polygon,
        previewLine: line,
        type: 'polygon',
        points: [{ x: imageCoords.x, y: imageCoords.y }],
        isComplete: false
      }
    } else {
      // Check for double-click (close polygon)
      const now = Date.now()
      const lastClick = this.activeAnnotation.lastClick || 0
      this.activeAnnotation.lastClick = now
      
      if (now - lastClick < 300 && this.activeAnnotation.points.length > 2) {
        this.finishPolygonAnnotation()
        return
      }
      
      // Add a new point to the existing polygon
      this.activeAnnotation.points.push({ x: imageCoords.x, y: imageCoords.y })
      
      // Update polygon points attribute
      const pointsString = this.activeAnnotation.points
        .map(p => `${p.x},${p.y}`)
        .join(' ')
      this.activeAnnotation.element.setAttribute('points', pointsString)
      
      // Update preview line start point
      this.activeAnnotation.previewLine.setAttribute('x1', imageCoords.x)
      this.activeAnnotation.previewLine.setAttribute('y1', imageCoords.y)
    }
  }
  
  updatePolygonPreview(e) {
    if (!this.activeAnnotation || this.activeAnnotation.type !== 'polygon') return
    
    // Only update preview line
    const imageCoords = this.imageViewer.screenToImageCoordinates(e.clientX, e.clientY)
    this.activeAnnotation.previewLine.setAttribute('x2', imageCoords.x)
    this.activeAnnotation.previewLine.setAttribute('y2', imageCoords.y)
  }
  
  finishPolygonAnnotation() {
    if (!this.activeAnnotation || this.activeAnnotation.type !== 'polygon') return
    
    // Remove preview line
    this.activeAnnotation.previewLine.remove()
    
    // Save polygon data
    const points = [...this.activeAnnotation.points]
    
    // Only keep polygons with at least 3 points
    if (points.length >= 3) {
      this.annotations.push({
        id: Date.now().toString(),
        type: 'polygon',
        points
      })
      
      // Dispatch event about new annotation
      this.dispatchEvent(new CustomEvent('annotation-created', {
        bubbles: true,
        detail: this.annotations[this.annotations.length - 1]
      }))
    } else {
      // Remove incomplete polygons
      this.activeAnnotation.element.remove()
    }
    
    this.activeAnnotation = null
  }
  
  // Load saved annotations
  loadAnnotations() {
    // Clear existing annotations
    this.annotationsGroup.innerHTML = ''
    
    // Re-create each annotation
    this.annotations.forEach(annotation => {
      let element
      
      switch (annotation.type) {
        case 'rect':
          element = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          element.setAttribute('x', annotation.x)
          element.setAttribute('y', annotation.y)
          element.setAttribute('width', annotation.width)
          element.setAttribute('height', annotation.height)
          element.setAttribute('fill', 'rgba(255, 0, 0, 0.3)')
          element.setAttribute('stroke', 'red')
          element.setAttribute('stroke-width', 2 / this.imageViewer.getScale())
          break
          
        case 'ellipse':
          element = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
          element.setAttribute('cx', annotation.cx)
          element.setAttribute('cy', annotation.cy)
          element.setAttribute('rx', annotation.rx)
          element.setAttribute('ry', annotation.ry)
          element.setAttribute('fill', 'rgba(0, 0, 255, 0.3)')
          element.setAttribute('stroke', 'blue')
          element.setAttribute('stroke-width', 2 / this.imageViewer.getScale())
          break
          
        case 'polygon':
          element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
          const pointsString = annotation.points
            .map(p => `${p.x},${p.y}`)
            .join(' ')
          element.setAttribute('points', pointsString)
          element.setAttribute('fill', 'rgba(0, 255, 0, 0.3)')
          element.setAttribute('stroke', 'green')
          element.setAttribute('stroke-width', 2 / this.imageViewer.getScale())
          break
      }
      
      // Add data attribute for annotation id
      element.dataset.annotationId = annotation.id
      
      // Add to the annotations group
      this.annotationsGroup.appendChild(element)
    })
  }
  
  // Get all annotations
  getAnnotations() {
    return [...this.annotations]
  }
  
  // Clear all annotations
  clearAnnotations() {
    this.annotations = []
    this.loadAnnotations() // This will clear the SVG
    
    this.dispatchEvent(new CustomEvent('annotations-cleared', {
      bubbles: true
    }))
  }
  
  // Export annotations as JSON
  exportAnnotations() {
    return JSON.stringify(this.annotations)
  }
  
  // Import annotations from JSON
  importAnnotations(json) {
    try {
      this.annotations = JSON.parse(json)
      this.loadAnnotations()
      
      this.dispatchEvent(new CustomEvent('annotations-imported', {
        bubbles: true,
        detail: { count: this.annotations.length }
      }))
      
      return true
    } catch (e) {
      console.error('Failed to import annotations:', e)
      return false
    }
  }
}

// Define the custom element
customElements.define('image-annotator', ImageAnnotator);
export {
  ImageAnnotator
}