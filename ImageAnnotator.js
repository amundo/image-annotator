import { SvgImageViewer } from './svg-image-viewer/SvgImageViewer.js';

/**
 * ImageAnnotator Component - Improved Version
 * 
 * A web component that combines an SvgImageViewer with annotation capabilities.
 * This version correctly handles letterboxing/pillarboxing for accurate annotations.
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
        
        // Update the pointer events based on tool
        this.updatePointerEvents()
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
    
    // Update the pointer events based on tool
    this.updatePointerEvents()
  }
  
  updatePointerEvents() {
    // When in pan mode, allow events to pass through to image viewer
    // Otherwise, capture events for annotation drawing
    if (this.currentTool === 'pan') {
      this.annotationSvg.style.pointerEvents = 'none'
      // Set SVG viewer panning to enabled when in pan mode
      if (this.imageViewer && typeof this.imageViewer.setPanningEnabled === 'function') {
        this.imageViewer.setPanningEnabled(true);
      }
    } else {
      this.annotationSvg.style.pointerEvents = 'auto'
      // Disable SVG viewer direct panning when in drawing mode
      if (this.imageViewer && typeof this.imageViewer.setPanningEnabled === 'function') {
        this.imageViewer.setPanningEnabled(false);
      }
    }
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
    this.imageViewer.addEventListener('transform-changed', this.syncAnnotationLayer)
    
    // Initialize the panning mode based on current tool
    this.updatePointerEvents()
  }
  
  onImageLoaded = (e) => {
    // Handle when image is loaded
    console.log('Image loaded event:', e.detail);
    
    // Set the annotation SVG to match the image viewer dimensions
    this.resizeAnnotationLayer()
    
    // Load annotations from an attribute or storage if needed
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
    
    // Update pointer events based on current tool
    this.updatePointerEvents()
  }
  
  syncAnnotationLayer = (e) => {
    // Get current transform from the transform-changed event
    const scale = e.detail.scale
    const { x, y } = e.detail.translate
    
    // Apply the same transform to the annotations group
    this.annotationsGroup.setAttribute('transform', 
      `translate(${x} ${y}) scale(${scale})`)
      
    // Update stroke width for all annotations based on scale
    // This ensures stroke widths remain visually consistent regardless of zoom level
    const annotations = this.annotationsGroup.querySelectorAll('*')
    annotations.forEach(element => {
      if (element.hasAttribute('data-original-stroke-width')) {
        const originalWidth = parseFloat(element.getAttribute('data-original-stroke-width'))
        element.setAttribute('stroke-width', originalWidth / scale)
      }
    })
    
    // Debug the transformation
    console.log('Syncing annotation layer with transform:', e.detail);
  }
  
  onWheel = (e) => {
    e.preventDefault()
    
    // Only zoom if we're in pan mode or holding Alt/Ctrl key for other modes
    if (this.currentTool === 'pan' || e.altKey || e.ctrlKey) {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
      this.imageViewer.zoomAt(e.clientX, e.clientY, zoomFactor)
    }
  }
  
  onPointerDown = (e) => {
    // In pan mode, let the SvgImageViewer handle it
    if (this.currentTool === 'pan') {
      // The event should pass through to the image viewer
      return;
    }
    
    this.isDragging = true
    this.lastPointer = { x: e.clientX, y: e.clientY }
    
    // Handle based on current tool
    switch (this.currentTool) {
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
    // In pan mode, let the SvgImageViewer handle it
    if (this.currentTool === 'pan') {
      return;
    }
    
    if (!this.isDragging) return
    
    const dx = e.clientX - this.lastPointer.x
    const dy = e.clientY - this.lastPointer.y
    
    // Handle based on current tool
    switch (this.currentTool) {
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
    // In pan mode, let the SvgImageViewer handle it
    if (this.currentTool === 'pan') {
      return;
    }
    
    // Finish the current action based on tool
    switch (this.currentTool) {
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
    console.log('Starting rectangle at image coordinates:', imageCoords);
    
    // Only proceed if the point is within the actual image
    if (!this.imageViewer.isPointInImage(imageCoords.x, imageCoords.y)) {
      console.log('Point is outside image bounds, not creating annotation');
      return;
    }
    
    // Create a new rectangle element
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('x', imageCoords.x)
    rect.setAttribute('y', imageCoords.y)
    rect.setAttribute('width', 0)
    rect.setAttribute('height', 0)
    rect.setAttribute('fill', 'rgba(255, 0, 0, 0.3)')
    rect.setAttribute('stroke', 'red')
    
    // Store original stroke width for scaling during zoom
    const originalStrokeWidth = 2
    rect.setAttribute('data-original-stroke-width', originalStrokeWidth)
    rect.setAttribute('stroke-width', originalStrokeWidth / this.imageViewer.getScale())
    
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
      rect.setAttribute('x', this.activeAnnotation.startX)
      rect.setAttribute('width', width)
    }
    
    if (height < 0) {
      rect.setAttribute('y', imageCoords.y)
      rect.setAttribute('height', Math.abs(height))
    } else {
      rect.setAttribute('y', this.activeAnnotation.startY)
      rect.setAttribute('height', height)
    }
    
    console.log('Updating rectangle to:', {
      x: parseFloat(rect.getAttribute('x')),
      y: parseFloat(rect.getAttribute('y')),
      width: parseFloat(rect.getAttribute('width')),
      height: parseFloat(rect.getAttribute('height'))
    });
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
      
      console.log('Created rectangle annotation:', this.annotations[this.annotations.length - 1]);
    } else {
      // Remove tiny rectangles
      rect.remove()
      console.log('Rectangle too small, removed');
    }
    
    this.activeAnnotation = null
  }
  
  // Ellipse annotation methods
  startEllipseAnnotation(e) {
    // Convert screen coordinates to image coordinates
    const imageCoords = this.imageViewer.screenToImageCoordinates(e.clientX, e.clientY)
    console.log('Starting ellipse at image coordinates:', imageCoords);
    
    // Only proceed if the point is within the actual image
    if (!this.imageViewer.isPointInImage(imageCoords.x, imageCoords.y)) {
      console.log('Point is outside image bounds, not creating annotation');
      return;
    }
    
    // Create a new ellipse element
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    ellipse.setAttribute('cx', imageCoords.x)
    ellipse.setAttribute('cy', imageCoords.y)
    ellipse.setAttribute('rx', 0)
    ellipse.setAttribute('ry', 0)
    ellipse.setAttribute('fill', 'rgba(0, 0, 255, 0.3)')
    ellipse.setAttribute('stroke', 'blue')
    
    // Store original stroke width for scaling during zoom
    const originalStrokeWidth = 2
    ellipse.setAttribute('data-original-stroke-width', originalStrokeWidth)
    ellipse.setAttribute('stroke-width', originalStrokeWidth / this.imageViewer.getScale())
    
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
    
    console.log('Updating ellipse to:', {
      cx: parseFloat(ellipse.getAttribute('cx')),
      cy: parseFloat(ellipse.getAttribute('cy')),
      rx: parseFloat(ellipse.getAttribute('rx')),
      ry: parseFloat(ellipse.getAttribute('ry'))
    });
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
      
      console.log('Created ellipse annotation:', this.annotations[this.annotations.length - 1]);
    } else {
      // Remove tiny ellipses
      ellipse.remove()
      console.log('Ellipse too small, removed');
    }
    
    this.activeAnnotation = null
  }
  
  // Polygon annotation methods
  handlePolygonPoint(e) {
    // Convert screen coordinates to image coordinates
    const imageCoords = this.imageViewer.screenToImageCoordinates(e.clientX, e.clientY)
    console.log('Polygon point at image coordinates:', imageCoords);
    
    // Only proceed if the point is within the actual image (for first point)
    if (!this.activeAnnotation && !this.imageViewer.isPointInImage(imageCoords.x, imageCoords.y)) {
      console.log('Point is outside image bounds, not creating annotation');
      return;
    }
    
    // Check if we're starting a new polygon
    if (!this.activeAnnotation || this.activeAnnotation.type !== 'polygon') {
      // Create a new polygon element
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      polygon.setAttribute('points', `${imageCoords.x},${imageCoords.y}`)
      polygon.setAttribute('fill', 'rgba(0, 255, 0, 0.3)')
      polygon.setAttribute('stroke', 'green')
      
      // Store original stroke width for scaling during zoom
      const originalStrokeWidth = 2
      polygon.setAttribute('data-original-stroke-width', originalStrokeWidth)
      polygon.setAttribute('stroke-width', originalStrokeWidth / this.imageViewer.getScale())
      
      // Create preview line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', imageCoords.x)
      line.setAttribute('y1', imageCoords.y)
      line.setAttribute('x2', imageCoords.x)
      line.setAttribute('y2', imageCoords.y)
      line.setAttribute('stroke', 'green')
      
      const originalLineWidth = 1
      line.setAttribute('data-original-stroke-width', originalLineWidth)
      line.setAttribute('stroke-width', originalLineWidth / this.imageViewer.getScale())
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
      
      console.log('Created polygon annotation:', this.annotations[this.annotations.length - 1]);
    } else {
      // Remove incomplete polygons
      this.activeAnnotation.element.remove()
      console.log('Polygon has fewer than 3 points, removed');
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
          element.setAttribute('data-original-stroke-width', 2)
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
          element.setAttribute('data-original-stroke-width', 2)
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
          element.setAttribute('data-original-stroke-width', 2)
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
  
  // Add method for programmatically setting the tool mode
  setToolMode(mode) {
    if (['pan', 'rect', 'ellipse', 'polygon'].includes(mode)) {
      this.currentTool = mode
      this.updateToolUI()
      return true
    }
    return false
  }
}

// Define the custom element
customElements.define('image-annotator', ImageAnnotator);
export {
  ImageAnnotator
}