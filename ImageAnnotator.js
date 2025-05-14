import { SVGImageViewer } from '../svg-image-viewer/SVGImageViewer.js';

export class ImageAnnotator extends HTMLElement {
  // Annotation types
  static ANNOTATION_TYPES = {
    RECTANGLE: 'rectangle',
    ELLIPSE: 'ellipse',
    POLYGON: 'polygon',
    TEXT: 'text'
  };

  // State variables
  annotations = [];
  currentAnnotation = null;
  currentType = ImageAnnotator.ANNOTATION_TYPES.RECTANGLE;
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

  render() {
    this.innerHTML = `
      <div class="image-annotator">
        <div class="toolbar">
          <div class="tool-group">
            <button class="tool" data-tool="${ImageAnnotator.ANNOTATION_TYPES.RECTANGLE}">Rectangle</button>
            <button class="tool" data-tool="${ImageAnnotator.ANNOTATION_TYPES.ELLIPSE}">Ellipse</button>
            <button class="tool" data-tool="${ImageAnnotator.ANNOTATION_TYPES.POLYGON}">Polygon</button>
            <button class="tool" data-tool="${ImageAnnotator.ANNOTATION_TYPES.TEXT}">Text</button>
          </div>
          <div class="mode-group">
            <label class="mode-toggle">
              <input type="checkbox" class="edit-mode-toggle">
              Edit Mode
            </label>
            <span class="mode-hint">(Hold Alt/Ctrl to pan while editing)</span>
          </div>
          <div class="style-group">
            <label>
              Stroke:
              <input type="color" class="stroke-color" value="${this.options.strokeColor}">
            </label>
            <label>
              Fill:
              <input type="color" class="fill-color" value="#ff0000">
              <input type="range" class="fill-opacity" min="0" max="100" value="20">
            </label>
          </div>
          <div class="action-group">
            <button class="action" data-action="clear">Clear All</button>
            <button class="action" data-action="export">Export Data</button>
          </div>
        </div>
        <div class="editor-container">
          <svg-image-viewer></svg-image-viewer>
        </div>
      </div>
    `;

    this.editorContainer = this.querySelector('.editor-container');
    this.svgViewer = this.querySelector('svg-image-viewer');
    this.toolbar = this.querySelector('.toolbar');
    
    // Setup mode toggle
    const modeToggle = this.querySelector('.edit-mode-toggle');
    if (modeToggle) {
      modeToggle.addEventListener('change', (e) => {
        this.setEditingMode(e.target.checked);
      });
    }
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
      
      // Setup additional event listeners specific to annotation
      this.setupAnnotationEvents();
    }, 100);
  }

  attachEvents() {
    // Tool selection
    this.toolbar.addEventListener('click', (e) => {
      const toolButton = e.target.closest('.tool');
      if (toolButton) {
        // Remove active class from all tools
        this.querySelectorAll('.tool').forEach(btn => btn.classList.remove('active'));
        // Add active class to selected tool
        toolButton.classList.add('active');
        // Set current tool
        this.currentType = toolButton.dataset.tool;
        
        // Automatically enable editing mode when selecting a tool
        const editModeToggle = this.querySelector('.edit-mode-toggle');
        if (editModeToggle && !editModeToggle.checked) {
          editModeToggle.checked = true;
          this.setEditingMode(true);
        }
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
      if (e.key === 'Delete' && this.selectedAnnotation) {
        this.deleteAnnotation(this.selectedAnnotation);
      }
    });
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
    
    // Listen for transform changes in the SVG viewer to sync our annotation layer
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'transform') {
          // Get the current transform of the image layer
          const transform = this.transformGroup.getAttribute('transform');
          // Apply the same transform to our annotation layer
          this.annotationLayer.setAttribute('transform', transform);
        }
      });
    });
    
    observer.observe(this.transformGroup, { attributes: true });
    
    // Add keyboard shortcut help
    const helpText = document.createElement('div');
    helpText.classList.add('keyboard-shortcuts');
    helpText.innerHTML = `
      <div class="shortcut-tooltip">
        <strong>Keyboard Shortcuts:</strong>
        <ul>
          <li><kbd>Alt</kbd> or <kbd>Ctrl</kbd> + Drag: Pan image while in edit mode</li>
          <li><kbd>Esc</kbd>: Cancel current drawing</li>
          <li><kbd>Delete</kbd>: Remove selected annotation</li>
          <li>Double-click: Complete polygon</li>
        </ul>
      </div>
    `;
    this.appendChild(helpText);
  }

  // Mode toggles for handling conflicts
  setEditingMode(enabled) {
    // Store the current mode
    this._editingMode = enabled;
    
    // Update cursor style to provide visual feedback
    if (enabled) {
      this.svg.classList.add('editing-mode');
      // Temporarily disable dragging in the SVG viewer
      this.svgViewer._originalOnPointerDown = this.svgViewer.onPointerDown;
      this.svgViewer.onPointerDown = (e) => {
        // We'll conditionally allow the event to pass through
        // based on what element was clicked and if alt/ctrl is pressed
      };
    } else {
      this.svg.classList.remove('editing-mode');
      // Restore original drag handler in SVG viewer
      if (this.svgViewer._originalOnPointerDown) {
        this.svgViewer.onPointerDown = this.svgViewer._originalOnPointerDown;
        this.svgViewer._originalOnPointerDown = null;
      }
    }
  }
  
  get editingMode() {
    return this._editingMode || false;
  }
  
  // Mouse event handlers
  onMouseDown(e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    // Check if we're holding Alt or Ctrl key for pan override
    const isPanOverride = e.altKey || e.ctrlKey;
    
    // If Alt/Ctrl is pressed, let the SVG viewer handle panning
    if (isPanOverride) {
      // Let the original SVG viewer handle it
      if (this.svgViewer._originalOnPointerDown) {
        this.svgViewer._originalOnPointerDown(e);
      }
      return;
    }
    
    // If target is an annotation, select it regardless of mode
    if (e.target.classList.contains('annotation')) {
      this.selectAnnotation(e.target);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // If we're not in editing mode, let the SVG viewer handle panning
    if (!this.editingMode) {
      if (this.svgViewer._originalOnPointerDown) {
        this.svgViewer._originalOnPointerDown(e);
      }
      return;
    }
    
    // We're in editing mode and not selecting existing annotation
    // Convert client coordinates to SVG coordinates
    const point = this.clientToSvgPoint(e.clientX, e.clientY);
    
    // Start drawing a new annotation
    this.isDrawing = true;
    this.startPoint = point;
    
    // Create a new annotation based on the selected tool
    switch (this.currentType) {
      case ImageAnnotator.ANNOTATION_TYPES.RECTANGLE:
        this.currentAnnotation = this.createRectangle(point.x, point.y, 0, 0);
        break;
      case ImageAnnotator.ANNOTATION_TYPES.ELLIPSE:
        this.currentAnnotation = this.createEllipse(point.x, point.y, 0, 0);
        break;
      case ImageAnnotator.ANNOTATION_TYPES.POLYGON:
        // For polygon, we add points as we go
        if (!this.polygonPoints.length) {
          this.currentAnnotation = this.createPolygon([point]);
          this.polygonPoints.push(point);
        }
        break;
      case ImageAnnotator.ANNOTATION_TYPES.TEXT:
        const text = prompt('Enter text annotation:');
        if (text) {
          this.currentAnnotation = this.createText(point.x, point.y, text);
          this.finishAnnotation();
        }
        break;
    }
    
    // Prevent default to avoid any image dragging
    e.preventDefault();
    e.stopPropagation();
  }

  onMouseMove(e) {
    // If Alt/Ctrl is pressed for pan override, let the viewer handle it
    if (e.altKey || e.ctrlKey) return;
    
    // Handle annotation drawing
    if (this.isDrawing && this.currentAnnotation && this.editingMode) {
      const point = this.clientToSvgPoint(e.clientX, e.clientY);
      
      switch (this.currentType) {
        case ImageAnnotator.ANNOTATION_TYPES.RECTANGLE:
          this.updateRectangle(this.currentAnnotation, this.startPoint, point);
          break;
        case ImageAnnotator.ANNOTATION_TYPES.ELLIPSE:
          this.updateEllipse(this.currentAnnotation, this.startPoint, point);
          break;
        case ImageAnnotator.ANNOTATION_TYPES.POLYGON:
          // For polygon, we update the preview line to the current point
          this.updatePolygonPreview(this.currentAnnotation, point);
          break;
      }
      
      // Prevent default to avoid dragging the image
      e.preventDefault();
      e.stopPropagation();
    }
  }

  onMouseUp(e) {
    // If Alt/Ctrl was pressed for pan override, don't interfere
    if (e.altKey || e.ctrlKey) return;
    
    if (this.isDrawing && this.editingMode) {
      // For rectangle and ellipse, we finish on mouse up
      if (this.currentType !== ImageAnnotator.ANNOTATION_TYPES.POLYGON) {
        this.finishAnnotation();
      } else {
        // For polygon, we add a point on click
        const point = this.clientToSvgPoint(e.clientX, e.clientY);
        this.polygonPoints.push(point);
        this.updatePolygon(this.currentAnnotation, this.polygonPoints);
      }
      
      this.isDrawing = false;
      
      // Prevent default to avoid unintended interactions
      e.preventDefault();
      e.stopPropagation();
    }
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