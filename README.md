# Mindo

A lightweight mind map studio built with HTML, CSS, and JavaScript. Open `dist/index.html` or serve `dist` with a static HTTP server.

Maps are automatically saved in this browser's local storage. Features include editable and draggable ideas, colored branches, node styles, notes, undo/redo, zoom and pan, outline view, favorites, JSON import/export, SVG and PNG export, and editable snapshot links.

Choose **New mind map** to start with a blank canvas. Hover over the canvas title to reveal the edit icon, then click the title to rename it. Press Enter to save or Escape to cancel. Click the star to add or remove the canvas from Favorites.

Adding or deleting an idea automatically spaces the branches around the central idea. Branches animate into place when you add an idea. Mindo respects your device's reduced motion setting. You can still drag ideas between changes, and Undo restores the previous ideas and their positions.

With the Select tool, drag a box from empty canvas to select every node it touches. Drag any selected node to move the group together, or click empty canvas to clear the selection. Use the Hand tool or hold Space while dragging to pan.

Nodes resize as you edit their labels. Long labels wrap, and SVG and PNG exports use the same line breaks. On phones, the canvas tools move to the bottom. Select a node and tap the pencil to edit it.

Remove a map from the workspace via My mind maps or Recent maps and confirm the removal. Open Removed maps to restore it, including after a reload in the same browser.

Use the palette selector above the canvas to choose brighter, muted, or monochrome colors. New canvases use Bright by default. Open the Node style panel to pick an idea's font, weight, size, and text color. These choices travel with an editable JSON export or snapshot link.

Snapshot links contain a complete copy of the current map, including notes. They require the recipient to have access to the app. This app does not provide real-time collaboration or cross-device synchronization.

Keyboard shortcuts: Tab adds a child, Enter adds a sibling, F2 edits, Delete removes a branch, Ctrl Z undoes, Ctrl Shift Z redoes, Ctrl D duplicates, Ctrl 0 fits the view, and Space + drag pans. Use Command in place of Ctrl on macOS.
