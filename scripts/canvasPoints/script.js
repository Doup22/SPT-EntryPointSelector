let map = 'bigmap';
let static = true;
const colorMap = static ? {} : {
  '65ca29cd-d60a-458b-b588-6e898b8c060d': 'green',
  'ced7d497-d16a-41d4-8caf-7c515c28ccdb': 'green',
  'f519a18e-0583-4d8d-b5c6-de9d75699312': 'green',
  '27643426-5933-4ba9-a5dd-04b40c8e33e2': 'green',
  '2854bc78-ceaa-401f-bf71-e41de72e0052': 'green',
};

const imagesPath = '../../electron/src/client/public/images';
const canvas = document.getElementById('canvas');
const closeDiv = document.getElementById('close');
const select = document.getElementById('map-select');
const staticCheckbox = document.getElementById('static');

let spawns,
  realMaxX,
  realMinX,
  realMaxZ,
  realMinZ,
  minX,
  maxX,
  minZ,
  maxZ,
  shiftX,
  shiftZ,
  zoomX,
  zoomZ,
  lerpType,
  swapAxis,
  closenessThreshold;
let selectedIds = [];
function init() {
  spawns = window.spawns[map];
  canvas.style.backgroundImage = `url('${imagesPath}/${map}.png')`;
  const img = new Image();
  img.onload = function () {
    canvas.width = img.width;
    canvas.height = img.height;
    draw();
  };
  img.src = `${imagesPath}/${map}.png`;

  realMinX = Math.min(...spawns.map(s => s.Position.z));
  minX = realMinX;
  realMaxX = Math.max(...spawns.map(s => s.Position.z));
  maxX = realMaxX;
  realMinZ = Math.min(...spawns.map(s => s.Position.x));
  minZ = realMinZ;
  realMaxZ = Math.max(...spawns.map(s => s.Position.x));
  maxZ = realMaxZ;

  staticCheckbox.checked = static;
  selectedIds = [];
  if (window.params?.[map]) {
    shiftX = window.params[map].shiftX;
    shiftZ = window.params[map].shiftZ;
    zoomX = window.params[map].zoomX;
    zoomZ = window.params[map].zoomZ;
    lerpType = window.params[map].lerpType;
    swapAxis = window.params[map].swapAxis;
  } else {
    shiftX = 0;
    shiftZ = 0;
    zoomX = 1;
    zoomZ = 1;
    lerpType = 0;
    swapAxis = false;
  }
  closenessThreshold = 50 ** 2;
  minX = realMinX - zoomX;
  maxX = realMaxX + zoomX;
  minZ = realMinZ - zoomZ;
  maxZ = realMaxZ + zoomZ;
  draw();
}
init();

select.addEventListener('change', async () => {
  const { value } = select;
  map = value;
  init();
});
staticCheckbox.addEventListener('change', async () => {
  const { checked } = staticCheckbox;
  static = checked;
});

const mouseEventHandler = (e) => {
  draw(e);
};
canvas.addEventListener('mousemove', (e) => mouseEventHandler(e));
canvas.addEventListener('mousedown', (e) => mouseEventHandler(e));
canvas.addEventListener('mouseup', (e) => mouseEventHandler(e));
canvas.addEventListener('wheel', (e) => {
  if (static) {
    closenessThreshold -= e.deltaY * (e.shiftKey ? 2 : 10);
  } else {
    const delta = e.deltaY / (e.shiftKey ? 100 : 10);
    if (e.altKey) {
      zoomZ += delta;
    } else {
      zoomX += delta;
    }
    minX = realMinX - zoomX;
    maxX = realMaxX + zoomX;
    minZ = realMinZ - zoomZ;
    maxZ = realMaxZ + zoomZ;
  }
  draw(e);
});

document.addEventListener('keydown', (e) => {
  if (static) return;
  if (e.key === '1') lerpType++;
  lerpType %= 4;
  if (e.key === '2') swapAxis = !swapAxis;
  draw();
});

let lastMouseX = 0;
let lastMouseY = 0;
let isMouseDown = false;
function draw(event) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let mouseX = 0;
  let mouseY = 0;
  if (event) {
    mouseX = event.x;
    mouseY = event.y;
    mouseX -= canvas.offsetLeft;
    mouseY -= canvas.offsetTop;
    mouseX = lerp(0, canvas.width, mouseX / canvas.clientWidth);
    mouseY = lerp(0, canvas.height, mouseY / canvas.clientHeight);
    if (event.type === 'mousedown') {
      lastMouseX = mouseX;
      lastMouseY = mouseY;
      isMouseDown = true;
    }
    if (event.type === 'mouseup') {
      isMouseDown = false;
      navigator.clipboard.writeText(`
      ${map}: {
        shiftX: ${shiftX},
        shiftZ: ${shiftZ},
        zoomX: ${zoomX},
        zoomZ: ${zoomZ},
        lerpType: ${lerpType},
        swapAxis: ${swapAxis},
      },`);
    }
    if (event.type === 'mousemove' && isMouseDown && !static) {
      shiftX += mouseX - lastMouseX;
      shiftZ += mouseY - lastMouseY;
      lastMouseX = mouseX;
      lastMouseY = mouseY;
    }
  }
  if (static)
    console.log(Number(mouseX).toFixed(0), Number(mouseY).toFixed(0));

  for (const spawn of spawns) {
    const [x, y] = worldToScreen(spawn.Position.x, spawn.Position.z);
    let color = 'red';
    if (selectedIds.includes(spawn.Id)) {
      color = 'green';
    }
    drawCircle(ctx, x + shiftX, y + shiftZ, 15, color);
  }
  if (!static)
    console.log(shiftX, shiftZ, zoomX, zoomZ, lerpType, realMinX - minX, realMaxX - maxX, realMinZ - minZ, realMaxZ - maxZ);

  if (static) {
    const closePoints = spawns.filter(s => {
      const [x, y] = worldToScreen(s.Position.x, s.Position.z);
      return distance2(x + shiftX, y + shiftZ, mouseX, mouseY) < closenessThreshold;
    });

    for (const spawn of closePoints) {
      const [x, y] = worldToScreen(spawn.Position.x, spawn.Position.z);
      drawCircle(ctx, x + shiftX, y + shiftZ, 15, colorMap[spawn.Id] || 'black', 10);
    }
    if (event?.type === 'mousedown') {
      selectedIds = closePoints.map(s => s.Id);
      closeDiv.innerText = JSON.stringify(selectedIds);
      const sumXY = closePoints.reduce(([accX, accY], s) => {
        const [x, y] = worldToScreen(s.Position.x, s.Position.z);
        return [accX + x + shiftX, accY + y + shiftZ];
      }, [0, 0]);
      const avgX = Number(sumXY[0] / closePoints.length).toFixed(0);
      const avgY = Number(sumXY[1] / closePoints.length).toFixed(0);
      closeDiv.innerText += `\n"x": ${avgX},\n"y": ${avgY}`;
      navigator.clipboard.writeText('(' + selectedIds.join('|') + ')');
    }
  }
}

function drawCircle(ctx, x, y, radius = 30, color = '#ff0000', lineWidth = 0) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  if (lineWidth) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.fill();
  }
  ctx.closePath();
}

function distance2(x1, y1, x2, y2) {
  return (x2 - x1) ** 2 + (y2 - y1) ** 2;
}

// function to convert world coordinates to screen coordinates
function worldToScreen(x, z) {
  if (swapAxis) [x, z] = [z, x];
  const tX = (x - minX) / (maxX - minX);
  const tZ = (z - minZ) / (maxZ - minZ);
  if (lerpType === 0) return [lerp(0, canvas.width, tX), lerp(0, canvas.height, tZ)];
  if (lerpType === 1) return [lerp(canvas.width, 0, tX), lerp(0, canvas.height, tZ)];
  if (lerpType === 2) return [lerp(0, canvas.width, tX), lerp(canvas.height, 0, tZ)];
  if (lerpType === 3) return [lerp(canvas.width, 0, tX), lerp(canvas.height, 0, tZ)];
}

function lerp(a, b, t) {
  return a + t * (b - a);
}
