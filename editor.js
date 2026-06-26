var svg = document.getElementById("svg");

var tool = "select";
var startX = 0, startY = 0;
var current = null;
var selected = null;

var dragging = false;
var prevX = 0, prevY = 0;


var moved = false;
var savedMove = false;

var drawingPath = false;
var pathPoints = [];

var editGroup = null;
var dragPoint = false;
var dragPointIdx = -1;

var undoStack = [];
var STORAGE = "svg_project_save";

function mousePos(e) {
  var r = svg.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function saveState() {
  undoStack.push(svg.innerHTML);
  localStorage.setItem(STORAGE, svg.innerHTML);
}

function undo() {
  if (undoStack.length === 0) return;
  if (editGroup) { editGroup.remove(); editGroup = null; } 
  svg.innerHTML = undoStack.pop();
  selected = null;
  localStorage.setItem(STORAGE, svg.innerHTML);
}

function create(tag) {
  var el = document.createElementNS(svg.namespaceURI, tag);
  el.setAttribute("stroke", document.getElementById("strokeColor").value);
  el.setAttribute("stroke-width", document.getElementById("strokeWidth").value);

  var fill = document.getElementById("noFill").checked ? "none" : document.getElementById("fillColor").value;

  if (tag === "line" || tag === "path") el.setAttribute("fill", "none");
  else el.setAttribute("fill", fill);

  return el;
}

function drawHandles(el) {
  if (editGroup) {
    editGroup.remove();
    editGroup = null;
  }

  var pts = JSON.parse(el.dataset.points || "[]");
  if (pts.length === 0) return;

  editGroup = document.createElementNS(svg.namespaceURI, "g");
  svg.appendChild(editGroup);

  for (var i = 0; i < pts.length; i++) {
    var c = document.createElementNS(svg.namespaceURI, "circle");
    c.setAttribute("cx", pts[i].x);
    c.setAttribute("cy", pts[i].y);
    c.setAttribute("r", 5);
    c.setAttribute("class", "handle");
    c.dataset.idx = i;
    editGroup.appendChild(c);
  }
}

function updateD(el, pts) {
  var d = "M " + pts[0].x + " " + pts[0].y;
  for (var i = 1; i < pts.length; i++)
    d += " L " + pts[i].x + " " + pts[i].y;
  el.setAttribute("d", d);
  el.dataset.points = JSON.stringify(pts);
}

svg.addEventListener("mousedown", function(e) {
  var p = mousePos(e);
  startX = p.x; startY = p.y;

  if (e.target.classList.contains("handle")) {
    saveState();
    dragPoint = true;
    dragPointIdx = parseInt(e.target.dataset.idx, 10);
    return;
  }

  if (tool === "select") {
    if (e.target === svg) {
      selected = null;
      if (editGroup) { editGroup.remove(); editGroup = null; }
      return;
    }

    selected = e.target;
    if (editGroup) { editGroup.remove(); editGroup = null; }

    if (selected.tagName === "path") {
      drawHandles(selected);
    }

    dragging = true;
    moved = false;
    savedMove = false;
    prevX = p.x; prevY = p.y;
    return;
  }

  if (tool === "path") {
    if (!drawingPath) {
      current = create("path");
      svg.appendChild(current);
      pathPoints = [];
      drawingPath = true;
      saveState();
    }
    pathPoints.push({ x: p.x, y: p.y });
    updateD(current, pathPoints);
    return;
  }

  saveState();
  if (tool === "line") {
    current = create("line");
    current.setAttribute("x1", p.x); current.setAttribute("y1", p.y);
    current.setAttribute("x2", p.x); current.setAttribute("y2", p.y);
    svg.appendChild(current);
  }
  else if (tool === "rect") {
    current = create("rect");
    current.setAttribute("x", p.x); current.setAttribute("y", p.y);
    current.setAttribute("width", 0); current.setAttribute("height", 0);
    svg.appendChild(current);
  }
  else if (tool === "ellipse") {
    current = create("ellipse");
    current.setAttribute("cx", p.x); current.setAttribute("cy", p.y);
    current.setAttribute("rx", 0); current.setAttribute("ry", 0);
    svg.appendChild(current);
  }
});

svg.addEventListener("mousemove", function(e) {
  var p = mousePos(e);

  if (dragPoint && selected && selected.tagName === "path") {
    var pts = JSON.parse(selected.dataset.points);
    pts[dragPointIdx].x = p.x;
    pts[dragPointIdx].y = p.y;
    updateD(selected, pts);

    var h = editGroup.querySelector('[data-idx="' + dragPointIdx + '"]');
    if (h) {
      h.setAttribute("cx", p.x);
      h.setAttribute("cy", p.y);
    }
    return;
  }

  if (dragging && selected) {
    var dx = p.x - prevX;
    var dy = p.y - prevY;

    if (dx !== 0 || dy !== 0) {
      moved = true;
      if (!savedMove) {
        saveState();
        savedMove = true;
      }
      moveObj(selected, dx, dy);
    }

    prevX = p.x; prevY = p.y;
    return;
  }

  if (!current) return;

  if (tool === "line") {
    current.setAttribute("x2", p.x);
    current.setAttribute("y2", p.y);
  }
  else if (tool === "rect") {
    var w = Math.abs(p.x - startX);
    var h = Math.abs(p.y - startY);
    current.setAttribute("x", Math.min(p.x, startX));
    current.setAttribute("y", Math.min(p.y, startY));
    current.setAttribute("width", w);
    current.setAttribute("height", h);
  }
  else if (tool === "ellipse") {
    
    var cx = (startX + p.x) / 2;
    var cy = (startY + p.y) / 2;
    var rx = Math.abs(p.x - startX) / 2;
    var ry = Math.abs(p.y - startY) / 2;
    current.setAttribute("cx", cx);
    current.setAttribute("cy", cy);
    current.setAttribute("rx", rx);
    current.setAttribute("ry", ry);
  }
});

svg.addEventListener("mouseup", function() {
  dragging = false;
  dragPoint = false;
  moved = false;
  savedMove = false;

  if (current && tool !== "path") {
    selected = current;
    current = null;
    localStorage.setItem(STORAGE, svg.innerHTML);
  }
});

document.addEventListener("keydown", function(e) {
  if (tool === "path" && drawingPath && e.key === "Enter") {
    drawingPath = false;
    selected = current;
    drawHandles(selected);
    current = null;
    pathPoints = [];
    localStorage.setItem(STORAGE, svg.innerHTML);
  }
});

function moveObj(el, dx, dy) {
  if (el.tagName === "rect") {
    el.setAttribute("x", parseFloat(el.getAttribute("x")) + dx);
    el.setAttribute("y", parseFloat(el.getAttribute("y")) + dy);
  }
  else if (el.tagName === "ellipse") {
    el.setAttribute("cx", parseFloat(el.getAttribute("cx")) + dx);
    el.setAttribute("cy", parseFloat(el.getAttribute("cy")) + dy);
  }
  else if (el.tagName === "line") {
    el.setAttribute("x1", parseFloat(el.getAttribute("x1")) + dx);
    el.setAttribute("y1", parseFloat(el.getAttribute("y1")) + dy);
    el.setAttribute("x2", parseFloat(el.getAttribute("x2")) + dx);
    el.setAttribute("y2", parseFloat(el.getAttribute("y2")) + dy);
  }
  else if (el.tagName === "path") {
    var pts = JSON.parse(el.dataset.points || "[]");
    for (var i = 0; i < pts.length; i++) {
      pts[i].x += dx;
      pts[i].y += dy;
    }
    updateD(el, pts);
    if (editGroup) drawHandles(el);
  }
}

function deleteSelected() {
  if (!selected) return;
  saveState();
  selected.remove();
  selected = null;
  if (editGroup) { editGroup.remove(); editGroup = null; }
  localStorage.setItem(STORAGE, svg.innerHTML);
}

function saveSVG() {
  var blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "desen.svg";
  a.click();
}

function exportPNG() {
  var img = new Image();
  var data = new XMLSerializer().serializeToString(svg);
  img.src = "data:image/svg+xml;base64," + btoa(data);

  img.onload = function() {
    var canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 600;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1000, 600);
    ctx.drawImage(img, 0, 0);

    var a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "export.png";
    a.click();
  };
}

var inputs = document.querySelectorAll("input");
inputs.forEach(function(inp) {
  inp.addEventListener("change", function() {
    if (!selected) return;
    saveState();
    selected.setAttribute("stroke", document.getElementById("strokeColor").value);
    selected.setAttribute("stroke-width", document.getElementById("strokeWidth").value);
    var fill = document.getElementById("noFill").checked ? "none" : document.getElementById("fillColor").value;

    if (selected.tagName !== "line" && selected.tagName !== "path")
      selected.setAttribute("fill", fill);

    localStorage.setItem(STORAGE, svg.innerHTML);
  });
});

window.onload = function() {
  var s = localStorage.getItem(STORAGE);
  if (s) svg.innerHTML = s;
};
