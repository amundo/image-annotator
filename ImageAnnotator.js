import { SVGImageViewer } from './svg-image-viewer/SVGImageViewer.js';

/* ImageAnnotator.js - v26 */
class ImageAnnotator extends HTMLElement {
  // Annotation types
  static ANNOTATION_TYPES = {
    RECTANGLE: 'rectangle',
    ELLIPSE: 'ellipse',
    POLYGON: 'polygon',
    TEXT: 'text'
  };

  static TOOL_MODES = {
    PAN: 'pan',
    SELECT: 'select',
    RECTANGLE: 'rectangle',
    ELLIPSE: 'ellipse',
    POLYGON: 'polygon',
    TEXT: 'text'
  };

  // State variables
  annotations = [];
  currentAnnotation = null;
  currentMode = ImageAnnotator.TOOL_MODES.PAN; // Default to pan mode
  isDrawing = false;
  startPoint = { x: 0, y: 0 };
  polygonPoints = [];
  selectedAnnotation = null;
  
  // Configuration options
  options = {
    strokeWidth: 2,
    strokeColor: '#ff0000',
    fillColor: 'rgba(255, 0, 0, 0.2)',
    textColor: '#000000'
  };

  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.setupSVGViewer();
    this.attachEvents();
  }
  
  disconnectedCallback() {
    // Remove transform change listener
    this.svgViewer?.removeEventListener('transform-changed', this.onTransformChanged);
    
    // Clean up global event listeners
    if (this._annotationGlobalMouseUpHandler) {
      window.removeEventListener('mouseup', this._annotationGlobalMouseUpHandler);
    }
  }

  render() {
    this.innerHTML = `
      <div class="image-annotator">
        <div class="toolbar">
          <div class="tool-group">
            <button class="tool active" data-tool="${ImageAnnotator.TOOL_MODES.PAN}" title="Pan Tool (P)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 15l4-8 4 8M12 7v8"></path>
                <path d="M17 13h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1M9 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"></path>
              </svg>
            </button>
            <button class="tool" data-tool="${ImageAnnotator.TOOL_MODES.SELECT}" title="Select Tool (S)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 13l5 5 11-11"></path>
              </svg>
            </button>
            <button class="tool" data-tool="${ImageAnnotator.TOOL_MODES.RECTANGLE}" title="Rectangle Tool (R)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="4" width="16" height="16" rx="1"></rect>
              </svg>
            </button>
            <button class="tool" data-tool="${ImageAnnotator.TOOL_MODES.ELLIPSE}" title="Ellipse Tool (E)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="8"></circle>
              </svg>
            </button>
            <button class="tool" data-tool="${ImageAnnotator.TOOL_MODES.POLYGON}" title="Polygon Tool (G)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 4l8 8-8 8-8-8z"></path>
              </svg>
            </button>
            <button class="tool" data-tool="${ImageAnnotator.TOOL_MODES.TEXT}" title="Text Tool (T)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 7h16M12 7v10M7 17h10"></path>
              </svg>
            </button>
          </div>
          <div class="style-group">
            <label>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-dasharray="2"></circle>
              </svg>
              <input type="color" class="stroke-color" value="${this.options.strokeColor}" title="Stroke Color">
            </label>
            <label>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" fill-opacity="0.2"></rect>
              </svg>
              <input type="color" class="fill-color" value="#ff0000" title="Fill Color">
              <input type="range" class="fill-opacity" min="0" max="100" value="20" title="Fill Opacity">
            </label>
          </div>
          <div class="action-group">
            <button class="action" data-action="clear" title="Clear All Annotations">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear
            </button>
            <button class="action" data-action="export" title="Export Annotations">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path>
              </svg>
              Export
            </button>
          </div>
        </div>
        <div class="editor-container">
          <svg-image-viewer></svg-image-viewer>
          <div class="status-bar">
            <span class="current-tool">Pan Tool</span>
            <span class="hint">Press Escape to cancel drawing. Double-click to complete polygon.</span>
          </div>
        </div>
      </div>
    `;

    this.editorContainer = this.querySelector('.editor-container');
    this.svgViewer = this.querySelector('svg-image-viewer');
    this.toolbar = this.querySelector('.toolbar');
    this.statusBar = this.querySelector('.status-bar');
    this.currentToolDisplay = this.querySelector('.current-tool');
  }

  setupSVGViewer() {
    // Set image source if provided
    const src = this.getAttribute('src');
    if (src) {
      this.svgViewer.setAttribute('src', src);
    }

    // Wait for the SVG viewer to initialize
    setTimeout(() => {
      // Create a new annotation layer group in the SVG
      this.svg = this.svgViewer.querySelector('svg');
      const svgNamespace = 'http://www.w3.org/2000/svg';
      
      // Create a group for annotations that will sit on top of the image
      this.annotationLayer = document.createElementNS(svgNamespace, 'g');
      this.annotationLayer.classList.add('annotation-layer');
      
      // Find the transform group to insert our annotation layer after it
      const transformGroup = this.svgViewer.querySelector('.transform-group');
      this.svg.insertBefore(this.annotationLayer, transformGroup.nextSibling);
      
      // Store reference to the transform group to sync transformations
      this.transformGroup = transformGroup;
      
      // Listen for transform changes in the SVG viewer
      this.svgViewer.addEventListener('transform-changed', this.onTransformChanged);
      
      // Setup additional event listeners specific to annotation
      this.setupAnnotationEvents();
    }, 100);
  }
  
  onTransformChanged = (e) => {
    // Apply the same transform to our annotation layer
    if (this.transformGroup && this.annotationLayer) {
      const transform = this.transformGroup.getAttribute('transform');
      this.annotationLayer.setAttribute('transform', transform);
    }
  }
  
  // Store event handlers for proper management
  storeOriginalEventHandlers() {
    // No need to store handlers as we'll use the SVGImageViewer's setPanningEnabled() API
  }

  attachEvents() {
    // Tool selection
    this.toolbar.addEventListener('click', (e) => {
      const toolButton = e.target.closest('.tool');
      if (toolButton) {
        this.setToolMode(toolButton.dataset.tool);
      }

      // Action buttons
      const actionButton = e.target.closest('.action');
      if (actionButton) {
        const action = actionButton.dataset.action;
        if (action === 'clear') {
          this.clearAnnotations();
        } else if (action === 'export') {
          this.exportAnnotations();
        }
      }
    });

    // Style controls
    const strokeColorInput = this.querySelector('.stroke-color');
    const fillColorInput = this.querySelector('.fill-color');
    const fillOpacityInput = this.querySelector('.fill-opacity');

    if (strokeColorInput) {
      strokeColorInput.addEventListener('input', (e) => {
        this.options.strokeColor = e.target.value;
        if (this.selectedAnnotation) {
          this.updateAnnotationStyle(this.selectedAnnotation);
        }
      });
    }

    if (fillColorInput && fillOpacityInput) {
      const updateFillColor = () => {
        const color = fillColorInput.value;
        const opacity = fillOpacityInput.value / 100;
        this.options.fillColor = this.hexToRgba(color, opacity);
        if (this.selectedAnnotation) {
          this.updateAnnotationStyle(this.selectedAnnotation);
        }
      };

      fillColorInput.addEventListener('input', updateFillColor);
      fillOpacityInput.addEventListener('input', updateFillColor);
    }
    
    // Key events for keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore if inside input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Tool keyboard shortcuts
      switch(e.key.toLowerCase()) {
        case 'p': // Pan tool
          this.setToolMode(ImageAnnotator.TOOL_MODES.PAN);
          e.preventDefault();
          break;
        case 's': // Select tool
          this.setToolMode(ImageAnnotator.TOOL_MODES.SELECT);
          e.preventDefault();
          break;
        case 'r': // Rectangle tool
          this.setToolMode(ImageAnnotator.TOOL_MODES.RECTANGLE);
          e.preventDefault();
          break;
        case 'e': // Ellipse tool
          this.setToolMode(ImageAnnotator.TOOL_MODES.ELLIPSE);
          e.preventDefault();
          break;
        case 'g': // Polygon tool
          this.setToolMode(ImageAnnotator.TOOL_MODES.POLYGON);
          e.preventDefault();
          break;
        case 't': // Text tool
          this.setToolMode(ImageAnnotator.TOOL_MODES.TEXT);
          e.preventDefault();
          break;
      }
      
      // Escape key to cancel drawing
      if (e.key === 'Escape') {
        if (this.isDrawing && this.currentAnnotation) {
          // Remove the current annotation in progress
          if (this.currentAnnotation.parentNode) {
            this.currentAnnotation.parentNode.removeChild(this.currentAnnotation);
          }
          this.currentAnnotation = null;
          this.isDrawing = false;
          this.polygonPoints = [];
        }
      }
      
      // Delete key to remove selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedAnnotation) {
        this.deleteAnnotation(this.selectedAnnotation);
        e.preventDefault();
      }
    });
  }
  
  setToolMode(mode) {
    // First update the mode
    this.currentMode = mode;
    
    // Update toolbar UI - set active class
    this.querySelectorAll('.tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === mode);
    });
    
    // Update cursor styles based on mode
    this.svg.classList.remove('pan-mode', 'select-mode', 'drawing-mode');
    
    // Configure SVG viewer based on mode
    if (mode === ImageAnnotator.TOOL_MODES.PAN) {
      // Enable panning in SVG viewer
      this.enableSvgViewerPanning();
      this.svg.classList.add('pan-mode');
      this.currentToolDisplay.textContent = 'Pan Tool';
    } else if (mode === ImageAnnotator.TOOL_MODES.SELECT) {
      // Disable panning but enable selection
      this.disableSvgViewerPanning();
      this.svg.classList.add('select-mode');
      this.currentToolDisplay.textContent = 'Select Tool';
    } else {
      // Drawing modes
      this.disableSvgViewerPanning();
      this.svg.classList.add('drawing-mode');
      
      // Update status display
      switch(mode) {
        case ImageAnnotator.TOOL_MODES.RECTANGLE:
          this.currentToolDisplay.textContent = 'Rectangle Tool';
          break;
        case ImageAnnotator.TOOL_MODES.ELLIPSE:
          this.currentToolDisplay.textContent = 'Ellipse Tool';
          break;
        case ImageAnnotator.TOOL_MODES.POLYGON:
          this.currentToolDisplay.textContent = 'Polygon Tool';
          break;
        case ImageAnnotator.TOOL_MODES.TEXT:
          this.currentToolDisplay.textContent = 'Text Tool';
          break;
      }
    }
    
    // Reset drawing state when changing tools
    if (this.isDrawing) {
      if (this.currentAnnotation && this.currentAnnotation.parentNode) {
        this.currentAnnotation.parentNode.removeChild(this.currentAnnotation);
      }
      this.currentAnnotation = null;
      this.isDrawing = false;
      this.polygonPoints = [];
    }
    
    // Make sure dragging is reset if tool changes
    this.svgViewer.isDragging = false;
    this.svgFigure?.classList.remove('dragging');
    this.svg?.classList.remove('dragging');
    
    // Dispatch event for tool change
    this.dispatchEvent(new CustomEvent('tool-changed', { 
      detail: { mode }
    }));
  }
  
  enableSvgViewerPanning() {
    // Use the SVG viewer's built-in panning control
    this.svgViewer.setPanningEnabled(true);
  }
  
  disableSvgViewerPanning() {
    // Use the SVG viewer's built-in panning control
    this.svgViewer.setPanningEnabled(false);
  }

  deleteAnnotation(element) {
    if (!element) return;
    
    // Remove from DOM
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
    
    // Remove from annotations array
    const id = element.id;
    this.annotations = this.annotations.filter(anno => anno.id !== id);
    
    // Clear selection
    this.selectedAnnotation = null;
    
    // Dispatch event
    this.dispatchEvent(new CustomEvent('annotation-deleted', { 
      detail: { id }
    }));
  }
  
  setupAnnotationEvents() {
    // Drawing events - but only attach to our custom annotation layer
    // to avoid interfering with the SVG viewer's events
    this.svg.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.svg.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.svg.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.svg.addEventListener('dblclick', this.onDoubleClick.bind(this));
    
    // Add a global mouseup handler to ensure we don't miss mouse releases
    this._annotationGlobalMouseUpHandler = (e) => {
      if (this.isDrawing) {
        const point = this.clientToSvgPoint(e.clientX, e.clientY);
        
        // Only finish for rectangle and ellipse
        if (this.currentMode === ImageAnnotator.TOOL_MODES.RECTANGLE || 
            this.currentMode === ImageAnnotator.TOOL_MODES.ELLIPSE) {
          this.finishAnnotation();
          this.isDrawing = false;
        }
      }
    };
    window.addEventListener('mouseup', this._annotationGlobalMouseUpHandler);
    
    // Add keyboard shortcut help
    const helpText = document.createElement('div');
    helpText.classList.add('keyboard-shortcuts');
    helpText.innerHTML = `
      <div class="shortcut-tooltip">
        <strong>Keyboard Shortcuts:</strong>
        <ul>
          <li><kbd>P</kbd>: Pan tool</li>
          <li><kbd>S</kbd>: Select tool</li>
          <li><kbd>R</kbd>: Rectangle tool</li>
          <li><kbd>E</kbd>: Ellipse tool</li>
          <li><kbd>G</kbd>: Polygon tool</li>
          <li><kbd>T</kbd>: Text tool</li>
          <li><kbd>Esc</kbd>: Cancel current drawing</li>
          <li><kbd>Delete</kbd>: Remove selected annotation</li>
          <li>Double-click: Complete polygon</li>
        </ul>
      </div>
    `;
    this.appendChild(helpText);
  }

  // Mouse event handlers
  onMouseDown(e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    // Convert coordinates
    const point = this.clientToSvgPoint(e.clientX, e.clientY);
    
    // Different handling based on current tool mode
    switch (this.currentMode) {
      case ImageAnnotator.TOOL_MODES.SELECT:
        if (e.target.classList.contains('annotation')) {
          this.selectAnnotation(e.target);
        } else {
          // Deselect if clicking outside
          if (this.selectedAnnotation) {
            this.selectedAnnotation.classList.remove('selected');
            this.selectedAnnotation = null;
          }
        }
        break;
        
      case ImageAnnotator.TOOL_MODES.RECTANGLE:
        this.startDrawing(point);
        this.currentAnnotation = this.createRectangle(point.x, point.y, 0, 0);
        break;
        
      case ImageAnnotator.TOOL_MODES.ELLIPSE:
        this.startDrawing(point);
        this.currentAnnotation = this.createEllipse(point.x, point.y, 0, 0);
        break;
        
      case ImageAnnotator.TOOL_MODES.POLYGON:
        if (!this.isDrawing) {
          this.startDrawing(point);
          this.polygonPoints = [point];
          this.currentAnnotation = this.createPolygon([point]);
        } else {
          // Add a new point to the polygon
          this.polygonPoints.push(point);
          this.updatePolygon(this.currentAnnotation, this.polygonPoints);
        }
        break;
        
      case ImageAnnotator.TOOL_MODES.TEXT:
        const text = prompt('Enter text annotation:');
        if (text) {
          this.currentAnnotation = this.createText(point.x, point.y, text);
          this.finishAnnotation();
        }
        break;
    }
    
    // Always prevent default for our handled modes
    if (this.currentMode !== ImageAnnotator.TOOL_MODES.PAN) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  onMouseMove(e) {
    // Skip if not drawing or no current annotation
    if (!this.isDrawing || !this.currentAnnotation) return;
    
    const point = this.clientToSvgPoint(e.clientX, e.clientY);
    
    switch (this.currentMode) {
      case ImageAnnotator.TOOL_MODES.RECTANGLE:
        this.updateRectangle(this.currentAnnotation, this.startPoint, point);
        break;
        
      case ImageAnnotator.TOOL_MODES.ELLIPSE:
        this.updateEllipse(this.currentAnnotation, this.startPoint, point);
        break;
        
      case ImageAnnotator.TOOL_MODES.POLYGON:
        // Update with a preview of the next potential point
        const previewPoints = [...this.polygonPoints, point];
        this.updatePolygon(this.currentAnnotation, previewPoints);
        break;
    }
    
    e.preventDefault();
    e.stopPropagation();
  }

  onMouseUp(e) {
    // Only complete drawing for rectangle and ellipse on mouse up
    if (this.isDrawing && 
        (this.currentMode === ImageAnnotator.TOOL_MODES.RECTANGLE || 
         this.currentMode === ImageAnnotator.TOOL_MODES.ELLIPSE)) {
      this.finishAnnotation();
      this.isDrawing = false;
    }
    
    e.preventDefault();
    e.stopPropagation();
  }

  onDoubleClick(e) {
    // Double click to complete polygon
    if (this.currentMode === ImageAnnotator.TOOL_MODES.POLYGON && this.polygonPoints.length > 2) {
      this.finishAnnotation();
      this.isDrawing = false;
      this.polygonPoints = [];
    }
  }
  
  startDrawing(point) {
    this.isDrawing = true;
    this.startPoint = point;
  }

  onDoubleClick(e) {
    // Double click to complete polygon
    if (this.currentType === ImageAnnotator.ANNOTATION_TYPES.POLYGON && this.polygonPoints.length > 2) {
      this.finishAnnotation();
      this.polygonPoints = [];
    }
  }

  // Shape creation methods
  createRectangle(x, y, width, height) {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const rect = document.createElementNS(svgNamespace, 'rect');
    
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    this.setAnnotationStyle(rect);
    
    this.annotationLayer.appendChild(rect);
    return rect;
  }

  updateRectangle(rect, startPoint, endPoint) {
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
  }

  createEllipse(cx, cy, rx, ry) {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const ellipse = document.createElementNS(svgNamespace, 'ellipse');
    
    ellipse.setAttribute('cx', cx);
    ellipse.setAttribute('cy', cy);
    ellipse.setAttribute('rx', rx);
    ellipse.setAttribute('ry', ry);
    this.setAnnotationStyle(ellipse);
    
    this.annotationLayer.appendChild(ellipse);
    return ellipse;
  }

  updateEllipse(ellipse, startPoint, endPoint) {
    const cx = (startPoint.x + endPoint.x) / 2;
    const cy = (startPoint.y + endPoint.y) / 2;
    const rx = Math.abs(endPoint.x - startPoint.x) / 2;
    const ry = Math.abs(endPoint.y - startPoint.y) / 2;
    
    ellipse.setAttribute('cx', cx);
    ellipse.setAttribute('cy', cy);
    ellipse.setAttribute('rx', rx);
    ellipse.setAttribute('ry', ry);
  }

  createPolygon(points) {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const polygon = document.createElementNS(svgNamespace, 'polygon');
    
    this.updatePolygon(polygon, points);
    this.setAnnotationStyle(polygon);
    
    this.annotationLayer.appendChild(polygon);
    return polygon;
  }

  updatePolygon(polygon, points) {
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
    polygon.setAttribute('points', pointsStr);
  }

  updatePolygonPreview(polygon, currentPoint) {
    // Create a temporary array of points including the current mouse position
    const previewPoints = [...this.polygonPoints, currentPoint];
    this.updatePolygon(polygon, previewPoints);
  }

  createText(x, y, text) {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const textElem = document.createElementNS(svgNamespace, 'text');
    
    textElem.setAttribute('x', x);
    textElem.setAttribute('y', y);
    textElem.textContent = text;
    textElem.setAttribute('fill', this.options.textColor);
    textElem.setAttribute('font-size', '14px');
    
    this.annotationLayer.appendChild(textElem);
    return textElem;
  }

  // Annotation management
  finishAnnotation() {
    if (!this.currentAnnotation) return;
    
    // Add class for selection
    this.currentAnnotation.classList.add('annotation');
    
    // Store annotation data
    const annotationData = this.serializeAnnotation(this.currentAnnotation);
    this.annotations.push(annotationData);
    
    // Dispatch event
    this.dispatchEvent(new CustomEvent('annotation-created', { 
      detail: { annotation: annotationData }
    }));
    
    // Reset current annotation
    this.currentAnnotation = null;
  }

  selectAnnotation(element) {
    // Deselect previous selection
    if (this.selectedAnnotation) {
      this.selectedAnnotation.classList.remove('selected');
    }
    
    // Select new element
    this.selectedAnnotation = element;
    this.selectedAnnotation.classList.add('selected');
    
    // Dispatch event
    this.dispatchEvent(new CustomEvent('annotation-selected', { 
      detail: { annotation: this.serializeAnnotation(element) }
    }));
  }

  updateAnnotationStyle(element) {
    element.setAttribute('stroke', this.options.strokeColor);
    element.setAttribute('stroke-width', this.options.strokeWidth);
    
    // Text annotations only get stroke and fill doesn't apply
    if (element.tagName.toLowerCase() === 'text') {
      element.setAttribute('fill', this.options.strokeColor);
    } else {
      element.setAttribute('fill', this.options.fillColor);
    }
  }

  setAnnotationStyle(element) {
    this.updateAnnotationStyle(element);
    element.setAttribute('vector-effect', 'non-scaling-stroke');
  }

  clearAnnotations() {
    // Remove all annotations from the layer
    while (this.annotationLayer.firstChild) {
      this.annotationLayer.removeChild(this.annotationLayer.firstChild);
    }
    
    // Clear stored annotations
    this.annotations = [];
    this.selectedAnnotation = null;
    
    // Dispatch event
    this.dispatchEvent(new CustomEvent('annotations-cleared'));
  }

  // Data export
  serializeAnnotation(element) {
    const type = element.tagName.toLowerCase();
    const id = element.id || `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set ID if not already set
    if (!element.id) {
      element.id = id;
    }
    
    // Basic metadata
    const annotation = {
      id,
      type,
      style: {
        strokeColor: element.getAttribute('stroke'),
        strokeWidth: element.getAttribute('stroke-width'),
        fillColor: element.getAttribute('fill')
      }
    };
    
    // Type-specific data
    switch (type) {
      case 'rect':
        annotation.data = {
          x: parseFloat(element.getAttribute('x')),
          y: parseFloat(element.getAttribute('y')),
          width: parseFloat(element.getAttribute('width')),
          height: parseFloat(element.getAttribute('height'))
        };
        break;
      case 'ellipse':
        annotation.data = {
          cx: parseFloat(element.getAttribute('cx')),
          cy: parseFloat(element.getAttribute('cy')),
          rx: parseFloat(element.getAttribute('rx')),
          ry: parseFloat(element.getAttribute('ry'))
        };
        break;
      case 'polygon':
        const points = element.getAttribute('points').split(' ')
          .map(point => {
            const [x, y] = point.split(',');
            return { x: parseFloat(x), y: parseFloat(y) };
          });
        annotation.data = { points };
        break;
      case 'text':
        annotation.data = {
          x: parseFloat(element.getAttribute('x')),
          y: parseFloat(element.getAttribute('y')),
          text: element.textContent
        };
        break;
    }
    
    return annotation;
  }

  exportAnnotations() {
    // Create JSON of all annotations
    const data = {
      image: this.svgViewer.getAttribute('src'),
      annotations: this.annotations,
      timestamp: new Date().toISOString()
    };
    
    // Convert to string
    const json = JSON.stringify(data, null, 2);
    
    // Create download link
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `annotations-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Dispatch event
    this.dispatchEvent(new CustomEvent('annotations-exported', { 
      detail: { data }
    }));
  }

  // Helper methods
  clientToSvgPoint(clientX, clientY) {
    // Get SVG element's position
    const svgRect = this.svg.getBoundingClientRect();
    
    // Get SVG's current transformation matrix
    const transform = this.transformGroup.getAttribute('transform');
    const scale = this.extractScaleFromTransform(transform);
    const translate = this.extractTranslateFromTransform(transform);
    
    // Calculate the actual point in SVG coordinates
    const x = (clientX - svgRect.left - translate.x) / scale;
    const y = (clientY - svgRect.top - translate.y) / scale;
    
    return { x, y };
  }

  extractScaleFromTransform(transform) {
    if (!transform) return 1;
    
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    return scaleMatch ? parseFloat(scaleMatch[1]) : 1;
  }

  extractTranslateFromTransform(transform) {
    if (!transform) return { x: 0, y: 0 };
    
    const translateMatch = transform.match(/translate\(([^)]+)\)/);
    if (translateMatch) {
      const [x, y] = translateMatch[1].split(' ').map(parseFloat);
      return { x, y };
    }
    
    return { x: 0, y: 0 };
  }
  
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Public API methods
  get src() {
    return this.svgViewer.getAttribute('src');
  }
  
  set src(value) {
    this.svgViewer.setAttribute('src', value);
  }
  
  getAnnotations() {
    return [...this.annotations];
  }
  
  loadAnnotations(data) {
    // Clear existing annotations
    this.clearAnnotations();
    
    // Create each annotation
    data.annotations.forEach(annotation => {
      let element;
      
      switch (annotation.type) {
        case 'rect':
          element = this.createRectangle(
            annotation.data.x,
            annotation.data.y, 
            annotation.data.width, 
            annotation.data.height
          );
          break;
        case 'ellipse':
          element = this.createEllipse(
            annotation.data.cx,
            annotation.data.cy,
            annotation.data.rx,
            annotation.data.ry
          );
          break;
        case 'polygon':
          element = this.createPolygon(annotation.data.points);
          break;
        case 'text':
          element = this.createText(
            annotation.data.x,
            annotation.data.y,
            annotation.data.text
          );
          break;
      }
      
      if (element) {
        // Set ID
        element.id = annotation.id;
        
        // Set style
        element.setAttribute('stroke', annotation.style.strokeColor || this.options.strokeColor);
        element.setAttribute('stroke-width', annotation.style.strokeWidth || this.options.strokeWidth);
        element.setAttribute('fill', annotation.style.fillColor || this.options.fillColor);
        
        // Add to annotations array
        this.annotations.push(annotation);
        
        // Add class for selection
        element.classList.add('annotation');
      }
    });
    
    // Dispatch event
    this.dispatchEvent(new CustomEvent('annotations-loaded', { 
      detail: { annotations: this.annotations }
    }));
  }
}

// Define the custom element
customElements.define('image-annotator', ImageAnnotator);

export {
  ImageAnnotator
}