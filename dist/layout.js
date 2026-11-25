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

  function mindMapGroups(nodes) {
    const children = new Map();
    for (const node of nodes) {
      if (!children.has(node.parent)) children.set(node.parent, []);
      children.get(node.parent).push(node);
    }
    return (children.get(null) || []).map(root => {
      const group = [root];
      for (const node of group) group.push(...(children.get(node.id) || []));
      return group;
    });
  }

  function mapBounds(nodes, dimensions) {
    const boxes = nodes.map(node => ({ ...dimensions(node), x: node.x, y: node.y }));
    return {
      left: Math.min(...boxes.map(box => box.x - box.w / 2)),
      right: Math.max(...boxes.map(box => box.x + box.w / 2)),
      top: Math.min(...boxes.map(box => box.y - box.h / 2)),
      bottom: Math.max(...boxes.map(box => box.y + box.h / 2)),
    };
  }

  function placeMindMap(group, neighbors, dimensions, append = false) {
    const margin = 84;
    const target = mapBounds(group, dimensions);
    const boxes = neighbors.map(nodes => mapBounds(nodes, dimensions));
    const fits = ([dx, dy]) => group.every(node => (
      Math.abs(node.x + dx) <= coordinateLimit && Math.abs(node.y + dy) <= coordinateLimit
    )) && boxes.every(box => (
      target.right + dx + margin <= box.left || target.left + dx >= box.right + margin ||
      target.bottom + dy + margin <= box.top || target.top + dy >= box.bottom + margin
    ));
    const right = Math.max(...boxes.map(box => box.right)) + margin - target.left;
    const candidates = boxes.flatMap(box => [
      [box.left - margin - target.right, 0], [box.right + margin - target.left, 0],
      [0, box.top - margin - target.bottom], [0, box.bottom + margin - target.top],
    ]).sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    if (!append) candidates.unshift([0, 0]);
    else if (boxes.length) candidates.unshift([right, 0]);
    const offset = candidates.find(fits);
    if (offset) {
      const [dx, dy] = offset;
      for (const node of group) {
        node.x += dx;
        node.y += dy;
      }
    }
    return Boolean(offset);
  }

  globalThis.arrangeMindMap = arrangeMindMap;
  globalThis.mindMapGroups = mindMapGroups;
  globalThis.placeMindMap = placeMindMap;
})();
