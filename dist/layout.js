(() => {
  'use strict';

  const siblingGap = 18;
  const branchGap = 42;
  const levelGap = 55;
  const coordinateLimit = 100000;

  function stackHeight(entries, gap) {
    const totalHeight = entries.reduce((height, entry) => height + entry.height, 0);
    return totalHeight + Math.max(0, entries.length - 1) * gap;
  }

  function keepInRange(entries, axis) {
    const positions = entries.map(entry => entry.node[axis]);
    const low = Math.min(...positions);
    const high = Math.max(...positions);
    const offset = high > coordinateLimit ? coordinateLimit - high : Math.max(0, -coordinateLimit - low);
    if (offset) entries.forEach(entry => { entry.node[axis] += offset; });
  }

  function arrangeMindMap(nodes, dimensions) {
    const entries = nodes.map((node, index) => ({
      node,
      index,
      size: dimensions(node),
      children: [],
      height: 0,
    }));
    const byId = new Map(entries.map(entry => [entry.node.id, entry]));
    const root = entries.find(entry => entry.node.parent === null);

    for (const entry of entries) {
      if (entry !== root) byId.get(entry.node.parent).children.push(entry);
    }

    const byPreviousPosition = (a, b) => a.node.y - b.node.y || a.index - b.index;
    function measure(entry) {
      entry.children.sort(byPreviousPosition);
      entry.children.forEach(measure);
      entry.height = Math.max(entry.size.h, stackHeight(entry.children, siblingGap));
    }

    const left = [];
    const right = [];
    const undecided = [];
    for (const entry of root.children) {
      measure(entry);
      if (entry.node.x < root.node.x) left.push(entry);
      else if (entry.node.x > root.node.x) right.push(entry);
      else undecided.push(entry);
    }
    for (const entry of undecided) {
      const side = stackHeight(left, branchGap) < stackHeight(right, branchGap) ? left : right;
      side.push(entry);
    }
    left.sort(byPreviousPosition);
    right.sort(byPreviousPosition);

    function positionChildren(children, parent, direction, rowGap, columnGap) {
      let top = parent.node.y - stackHeight(children, rowGap) / 2;
      for (const child of children) {
        const distance = parent.size.w / 2 + columnGap + child.size.w / 2;
        child.node.x = parent.node.x + direction * distance;
        child.node.y = top + child.height / 2;
        positionChildren(child.children, child, direction, siblingGap, levelGap);
        top += child.height + rowGap;
      }
    }

    positionChildren(left, root, -1, branchGap, branchGap);
    positionChildren(right, root, 1, branchGap, branchGap);
    keepInRange(entries, 'x');
    keepInRange(entries, 'y');
  }

  globalThis.arrangeMindMap = arrangeMindMap;
})();
