import { Config, LocationId, Locations, Position, PositionMap } from '../../types';

let config: Config = {} as any;
let positionMaps: Locations = {} as any;
let positionMap: PositionMap[] = [] as any;

let debounce = false;
let scheduledEvent: MouseEvent | undefined;
async function init() {
  positionMaps = await window.electron.getPositionMaps();
  config = await window.electron.getConfig();
  positionMap = positionMaps[config.lastMap];

  const select = document.getElementById('map-select') as HTMLSelectElement;
  select.value = config.lastMap;
  select.addEventListener('change', async () => {
    const { value } = select;
    config = await window.electron.changeMap(value as LocationId);
    positionMap = positionMaps[config.lastMap];
    draw();
  });
  console.log(positionMap);

  const onlyOnce = document.getElementById('only-once') as HTMLInputElement;
  const disabled = document.getElementById('disabled') as HTMLInputElement;
  const darkTheme = document.getElementById('dark-theme') as HTMLInputElement;
  onlyOnce.checked = config.onlyOnce;
  disabled.checked = config.disabled;
  darkTheme.checked = localStorage.getItem('dark-theme') === 'true';
  if (darkTheme.checked) {
    document.body.classList.add('dark');
  }

  onlyOnce.addEventListener('change', async () => {
    const { checked } = onlyOnce;
    config = await window.electron.changeOnlyOnce(checked);
  });
  disabled.addEventListener('change', async () => {
    const { checked } = disabled;
    config = await window.electron.changeDisabled(checked);
  });
  darkTheme.addEventListener('change', async () => {
    const { checked } = darkTheme;
    localStorage.setItem('dark-theme', checked ? 'true' : 'false');
    if (checked) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  });

  const mouseEventHandler = (e: MouseEvent) => {
    if (!debounce) draw(e);
    else scheduledEvent = e;
  };
  document.addEventListener('mousemove', (e) => mouseEventHandler(e));
  document.addEventListener('mousedown', (e) => mouseEventHandler(e));
  document.addEventListener('mouseup', (e) => mouseEventHandler(e));
  for (const elem of document.getElementById('hidden-images')!.children) {
    elem.addEventListener('load', () => setTimeout(() => {
      draw();
    }, 100));
  }

  draw();
}

async function draw(event?: MouseEvent) {
  if (debounce) return;
  debounce = true;
  setTimeout(() => {
    debounce = false;
    if (scheduledEvent) {
      draw(scheduledEvent);
      scheduledEvent = undefined;
    }
  }, 30);
  const select = document.getElementById('map-select') as HTMLSelectElement;
  const mapName = select.value as LocationId;
  let image: HTMLImageElement | undefined;
  for (const img of document.images) {
    if (img.src.endsWith(`${mapName}.png`)) {
      image = img;
      break;
    }
  }
  if (!image) return;

  const entryPointIds = config.maps[mapName];
  const selectedPoint = entryPointIds?.length
    ? positionMap.find(p => p.locations.find(l => l.id === entryPointIds[0]))?.pixel
    : undefined;

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const mapE = document.getElementById('map') as HTMLDivElement;
  let newWidth = image.width;
  let newHeight = image.height;
  let factor = 1;
  if (newWidth > newHeight) {
    if (newWidth > mapE.clientWidth) {
      const _factor = mapE.clientWidth / newWidth;
      newWidth *= _factor;
      newHeight *= _factor;
      factor *= _factor;
    }
  }
  if (newHeight > mapE.clientHeight - 20) {
    const _factor = (mapE.clientHeight - 20) / newHeight;
    newWidth *= _factor;
    newHeight *= _factor;
    factor *= _factor;
  }
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, newWidth, newHeight);

  if (event) {
    let { x, y } = event;
    const { left, top, width, height } = canvas.getBoundingClientRect();
    x -= left;
    y -= top;
    if (!(x < 0 || x > width || y < 0 || y > height)) {
      x = x / width * image.width;
      y = y / height * image.height;
      if (event.type === 'mousedown') {
        navigator.clipboard.writeText(`\n        "x": ${Number(x).toFixed(0)},\n        "y": ${Number(y).toFixed(0)}`);
      }
      const threshold = 100;

      let closest: { distance: number, position: Position, location: string } | undefined;
      for (const location of positionMap) {
        const distance = Math.sqrt((location.pixel.x - x) ** 2 + (location.pixel.y - y) ** 2);
        if (!closest || distance < closest.distance) {
          closest = { distance, position: location.pixel, location: location.locations[0].id };
        }
      }
      drawEntryPoints(ctx, factor, selectedPoint, closest && closest.distance < threshold ? closest.position : undefined);
      if (closest && closest.distance < threshold) {
        if (event.type === 'mousedown') {
          (async () => {
            config = await window.electron.setEntryPoint(mapName, closest.position);
          })();
        }
        const { position } = closest;
        console.log(position);
        drawCircle(ctx, position.x * factor, position.y * factor, 50 * factor, '#00ff00a0');
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
      console.log(Number(x).toFixed(0), Number(y).toFixed(0));
    } else {
      drawEntryPoints(ctx, factor, selectedPoint);
    }
  } else {
    drawEntryPoints(ctx, factor, selectedPoint);
  }
}

function drawEntryPoints(ctx: CanvasRenderingContext2D, factor: number, selected?: Position, ignore?: Position) {
  let selectedPoint: Position | undefined;
  for (const { pixel } of positionMap) {
    if (ignore && pixel.x === ignore.x && pixel.y === ignore.y)
      continue;
    if (selected && pixel.x === selected.x && pixel.y === selected.y) {
      selectedPoint = pixel;
      continue;
    }
    drawCircle(ctx, pixel.x * factor, pixel.y * factor, 50 * factor, '#ff0000a0');
  }
  if (selectedPoint) {
    drawCircle(ctx, selectedPoint.x * factor, selectedPoint.y * factor, 50 * factor, '#00ff00a0', true, 10 * factor);
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, fill = true, lineWidth?: number) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  if (fill) ctx.fill();
  if (lineWidth) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
  }
  ctx.closePath();
}

init();
