import { Locations, Position, PositionMap } from '../../types';

let positionMaps: Locations = {} as any;
let positionMap: PositionMap[] = [] as any;

let debounce = false;
let scheduledEvent: MouseEvent | undefined;
async function init() {
  positionMaps = await window.electron.getPositionMaps();
  const select = document.getElementById('map-select') as HTMLSelectElement;
  positionMap = positionMaps[select.value];
  console.log(positionMap);

  const onlyOnce = document.getElementById('only-once') as HTMLInputElement;
  const disabled = document.getElementById('disabled') as HTMLInputElement;
  const config = await window.electron.getConfig();
  onlyOnce.checked = config.onlyOnce;
  disabled.checked = config.disabled;

  onlyOnce.addEventListener('change', () => {
    const { checked } = onlyOnce;
    window.electron.changeOnlyOnce(checked);
  });
  disabled.addEventListener('change', () => {
    const { checked } = disabled;
    window.electron.changeDisabled(checked);
  });

  document.addEventListener('mousemove', (e) => {
    if (!debounce) draw(e);
    else scheduledEvent = e;
  });
  document.addEventListener('mousedown', (e) => {
    if (!debounce) draw(e);
    else scheduledEvent = e;
  });
  for (const elem of document.getElementById('hidden-images')!.children) {
    elem.addEventListener('load', () => setTimeout(() => {
      draw();
    }, 100));
  }

  draw();
}

function draw(event?: MouseEvent) {
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
  let image: HTMLImageElement | undefined;
  for (const img of document.images) {
    if (img.src.endsWith(`${select.value}.png`)) {
      image = img;
      break;
    }
  }

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.width = image!.width;
  canvas.height = image!.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(image!, 0, 0, image!.width, image!.height);

  if (event) {
    let { x, y } = event;
    const { left, top, width, height } = canvas.getBoundingClientRect();
    x -= left;
    y -= top;
    if (!(x < 0 || x > width || y < 0 || y > height)) {
      x = x / width * image!.width;
      y = y / height * image!.height;
      const threshold = 100;

      let closest: { distance: number, position: Position } | undefined;
      for (const location of positionMap) {
        const distance = Math.sqrt((location.pixel.x - x) ** 2 + (location.pixel.y - y) ** 2);
        if (!closest || distance < closest.distance) {
          closest = { distance, position: location.pixel };
        }
      }
      drawEntryPoints(ctx, closest && closest.distance < threshold ? closest.position : undefined);
      if (closest && closest.distance < threshold) {
        if (event.type === 'mousedown') {
          window.electron.setEntryPoint(select.value as any, closest.position);
        }
        const { position } = closest;
        console.log(position);
        drawCircle(ctx, position.x, position.y, 50, '#00ff00a0');
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
      console.log(x, y);
    } else {
      drawEntryPoints(ctx);
    }
  } else {
    drawEntryPoints(ctx);
  }
}

function drawEntryPoints(ctx: CanvasRenderingContext2D, ignore?: Position) {
  for (const { pixel } of positionMap) {
    if (ignore && pixel.x === ignore.x && pixel.y === ignore.y)
      continue;
    drawCircle(ctx, pixel.x, pixel.y, 50, '#ff0000a0');
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
