---
title: Image Annotation Web Component
description: A vanilla JavaScript web component for image annotation, built on top of the SVG Image Viewer component.
author: Patrick Hall
---

This package provides a vanilla JavaScript web component for image annotation, which uses the SVG Image Viewer component as its foundation. The annotation component allows users to create, edit, and export annotations as structured data.

## Features

- Supports multiple annotation types: rectangles, ellipses, polygons, and text
- Pan and zoom capabilities inherited from the SVG Image Viewer component
- Custom styling options for annotations (stroke color, fill color, opacity)
- Export annotations as JSON data
- Import annotations from JSON data
- Events for annotation creation, selection, and more
- No dependencies or frameworks required

## Components

The system consists of two main components:

1. **SVGImageViewer**: Base component that handles image loading, panning, and zooming
2. **ImageAnnotator**: Main annotation component that uses SVGImageViewer as a sub-component

## Installation

1. Include the necessary files:

```html
<link rel="stylesheet" href="image-annotator.css">
<script type="module" src="SVGImageViewer.js"></script>
<script type="module" src="ImageAnnotator.js"></script>
```

2. Use the custom element in your HTML:

```html
<image-annotator src="your-image.jpg"></image-annotator>
```

## Usage

### Basic Implementation

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Annotation Component Demo</title>
    <link rel="stylesheet" href="image-annotator.css">
    <script type="module" src="SVGImageViewer.js"></script>
    <script type="module" src="ImageAnnotator.js"></script>
  </head>
  <body>
    <h1>Image Annotation Demo</h1>
    <image-annotator src="sample.jpg" id="annotator"></image-annotator>
    
    <script>
      const annotator = document.getElementById('annotator');
      
      // Listen for annotation events
      annotator.addEventListener('annotation-created', (e) => {
        console.log('Annotation created:', e.detail.annotation);
      });
    </script>
  </body>
</html>
```

### Attributes

- `src`: Path to the image (required)

### JavaScript API

#### Methods

- `getAnnotations()`: Returns an array of all annotation objects
- `loadAnnotations(data)`: Loads annotations from a data object
- `clearAnnotations()`: Clears all annotations

#### Properties

- `src`: Get or set the image source

#### Events

- `annotation-created`: Fired when a new annotation is created
- `annotation-selected`: Fired when an annotation is selected
- `annotations-cleared`: Fired when all annotations are cleared
- `annotations-loaded`: Fired when annotations are loaded from data
- `annotations-exported`: Fired when annotations are exported

## Event Handling and Mode Switching

The component implements a dual-mode system to handle the interaction conflicts between panning and annotation:

1. **View Mode**: Default mode where mouse actions are passed to the SVG Image Viewer for panning and zooming.
2. **Edit Mode**: Activated via the "Edit Mode" toggle, where mouse interactions create and modify annotations.

### Keyboard Shortcuts

- **Alt/Ctrl + Drag**: Pan the image while in edit mode
- **Esc**: Cancel the current drawing operation
- **Delete**: Remove the selected annotation
- **Double-click**: Complete a polygon when drawing

### Automatic Mode Switching

The component automatically switches to edit mode when a drawing tool is selected, enhancing the user experience.# Image Annotation Web Component
<!-- README.md - v2 -->

This package provides a vanilla JavaScript web component for image annotation, which uses the SVG Image Viewer component as its foundation. The annotation component allows users to create, edit, and export annotations as structured data.

## Features

- Supports multiple annotation types: rectangles, ellipses, polygons, and text
- Pan and zoom capabilities inherited from the SVG Image Viewer component
- Custom styling options for annotations (stroke color, fill color, opacity)
- Export annotations as JSON data
- Import annotations from JSON data
- Events for annotation creation, selection, and more
- No dependencies or frameworks required

## Components

The system consists of two main components:

1. **SVGImageViewer**: Base component that handles image loading, panning, and zooming
2. **ImageAnnotator**: Main annotation component that uses SVGImageViewer as a sub-component

## Installation

1. Include the necessary files:

```html
<link rel="stylesheet" href="image-annotator.css">
<script type="module" src="SVGImageViewer.js"></script>
<script type="module" src="ImageAnnotator.js"></script>
```

2. Use the custom element in your HTML:

```html
<image-annotator src="your-image.jpg"></image-annotator>
```

## Usage

### Basic Implementation

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Annotation Component Demo</title>
    <link rel="stylesheet" href="image-annotator.css">
    <script type="module" src="SVGImageViewer.js"></script>
    <script type="module" src="ImageAnnotator.js"></script>
  </head>
  <body>
    <h1>Image Annotation Demo</h1>
    <image-annotator src="sample.jpg" id="annotator"></image-annotator>
    
    <script>
      const annotator = document.getElementById('annotator');
      
      // Listen for annotation events
      annotator.addEventListener('annotation-created', (e) => {
        console.log('Annotation created:', e.detail.annotation);
      });
    </script>
  </body>
</html>
```

### Attributes

- `src`: Path to the image (required)

### JavaScript API

#### Methods

- `getAnnotations()`: Returns an array of all annotation objects
- `loadAnnotations(data)`: Loads annotations from a data object
- `clearAnnotations()`: Clears all annotations

#### Properties

- `src`: Get or set the image source

#### Events

- `annotation-created`: Fired when a new annotation is created
- `annotation-selected`: Fired when an annotation is selected
- `annotations-cleared`: Fired when all annotations are cleared
- `annotations-loaded`: Fired when annotations are loaded from data
- `annotations-exported`: Fired when annotations are exported

### Annotation Data Structure

Annotations are stored and exported in the following JSON format:

```json
{
  "image": "path/to/image.jpg",
  "annotations": [
    {
      "id": "annotation-123456789",
      "type": "rect",
      "style": {
        "strokeColor": "#ff0000",
        "strokeWidth": "2",
        "fillColor": "rgba(255, 0, 0, 0.2)"
      },
      "data": {
        "x": 100,
        "y": 150,
        "width": 200,
        "height": 100
      }
    },
    {
      "id": "annotation-987654321",
      "type": "text",
      "style": {
        "strokeColor": "#000000",
        "strokeWidth": "1",
        "fillColor": "#000000"
      },
      "data": {
        "x": 150,
        "y": 200,
        "text": "Sample annotation"
      }
    }
  ],
  "timestamp": "2025-05-14T12:34:56.789Z"
}
```

## Customization

### CSS

You can customize the appearance of the annotation component by modifying the `image-annotator.css` file or by adding custom CSS rules:

```css
image-annotator {
  /* Customize the container */
  border: 2px solid blue;
}

image-annotator .annotation {
  /* Customize all annotations */
  stroke-width: 3px;
}

image-annotator .annotation.selected {
  /* Customize selected annotations */
  stroke-dasharray: 8, 4;
}
```

### JavaScript

You can extend the `ImageAnnotator` class to add custom functionality:

```javascript
import { ImageAnnotator } from './ImageAnnotator.js';

class CustomAnnotator extends ImageAnnotator {
  constructor() {
    super();
    // Add custom initialization
  }
  
  // Override or add methods
  clearAnnotations() {
    // Confirm before clearing
    if (confirm('Are you sure you want to clear all annotations?')) {
      super.clearAnnotations();
    }
  }
}

customElements.define('custom-annotator', CustomAnnotator);
```

## Integration with Data Systems

The annotation data can be easily integrated with backend systems:

```javascript
const annotator = document.getElementById('annotator');
const saveButton = document.getElementById('save-button');

saveButton.addEventListener('click', async () => {
  const annotationData = {
    image: annotator.src,
    annotations: annotator.getAnnotations(),
    timestamp: new Date().toISOString()
  };
  
  try {
    const response = await fetch('/api/save-annotations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(annotationData)
    });
    
    if (response.ok) {
      alert('Annotations saved successfully');
    } else {
      alert('Failed to save annotations');
    }
  } catch (error) {
    console.error('Error saving annotations:', error);
  }
});
```

## Browser Support

This component works in all modern browsers that support Web Components:

- Chrome, Edge (Chromium-based)
- Firefox
- Safari

## License

MIT