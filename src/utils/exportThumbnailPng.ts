import { EPISODES, LOGO_DATA_URI } from '../data/episodesData';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface ThumbnailExportOptions {
  useEditorialArt?: boolean;
  customHeadline?: string;
  customBadge?: string;
}

export async function downloadEpisodeThumbnailPng(
  epIndex: number,
  aspect: '16:9' | '1:1',
  channelName: string,
  options?: ThumbnailExportOptions
): Promise<void> {
  const ep = EPISODES[epIndex];
  const [b1, b2, ac] = ep.theme;
  const is16 = aspect === '16:9';
  const width = is16 ? 1920 : 1080;
  const height = 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Background gradient
  const grad = ctx.createLinearGradient(0, 0, width * 0.85, height);
  grad.addColorStop(0, b1);
  grad.addColorStop(1, b2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Concentric subtle rings
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 3;
  const cx = width * 0.9;
  const cy = height * 0.12;
  for (let r = 120; r < width * 1.2; r += 120) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Render either editorial illustration or SVG scene image
  const useArt = options?.useEditorialArt ?? true;
  const svgWithXmlns = ep.svg.replace(
    '<svg ',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" '
  );
  const svgBlob = new Blob([svgWithXmlns], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const logoImg = await loadImage(LOGO_DATA_URI);
    let sceneImg: HTMLImageElement;
    if (useArt && ep.imageUrl) {
      try {
        sceneImg = await loadImage(ep.imageUrl);
      } catch {
        sceneImg = await loadImage(svgUrl);
      }
    } else {
      sceneImg = await loadImage(svgUrl);
    }

    const headlineText = options?.customHeadline || ep.shortTitle;
    const badgeText = options?.customBadge || 'మీరు ఏమి చేస్తారు?';

    if (is16) {
      // Right framed scene box
      const rx = 1020;
      const ry = 54;
      const rw = 846;
      const rh = 972;
      ctx.save();
      roundRect(ctx, rx, ry, rw, rh, 36);
      ctx.clip();
      // Cover-fit image
      const imgRatio = sceneImg.width / Math.max(1, sceneImg.height);
      const boxRatio = rw / rh;
      let dw = rw;
      let dh = rh;
      let dx = rx;
      let dy = ry;
      if (imgRatio > boxRatio) {
        dw = rh * imgRatio;
        dx = rx - (dw - rw) / 2;
      } else {
        dh = rw / imgRatio;
        dy = ry - (dh - rh) / 2;
      }
      ctx.drawImage(sceneImg, dx, dy, dw, dh);
      ctx.restore();

      ctx.strokeStyle = ac;
      ctx.lineWidth = 10;
      roundRect(ctx, rx, ry, rw, rh, 36);
      ctx.stroke();

      // Left column content
      const lx = 78;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx + 48, 118, 48, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.clip();
      ctx.drawImage(logoImg, lx, 70, 96, 96);
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 36px "Noto Sans Telugu", "Plus Jakarta Sans", sans-serif';
      ctx.fillText((channelName || 'SREENATH SOLUTIONS').toUpperCase(), lx + 118, 112);

      ctx.fillStyle = ac;
      ctx.font = '800 26px "Noto Sans Telugu", "Plus Jakarta Sans", sans-serif';
      ctx.fillText('PUBLIC SERVICE EDUCATIONAL AWARENESS', lx + 118, 148);

      // Q number
      ctx.fillStyle = ac;
      ctx.font = '900 165px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Q${epIndex + 1}`, lx, 330);

      // Leadership attribute kicker
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '700 32px "Noto Sans Telugu", sans-serif';
      ctx.fillText(`నాయకత్వ గుణం: ${ep.attr}`, lx + 250, 295);

      // Wrapped Headline
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 66px "Noto Sans Telugu", sans-serif';
      const hLines = wrapLines(ctx, headlineText, 880).slice(0, 2);
      hLines.forEach((line, idx) => {
        ctx.fillText(line, lx, 440 + idx * 84);
      });

      const ctaY = hLines.length > 1 ? 575 : 515;
      ctx.font = '900 48px "Noto Sans Telugu", sans-serif';
      const ctaW = Math.min(880, ctx.measureText(badgeText).width + 64);
      ctx.fillStyle = ac;
      roundRect(ctx, lx, ctaY, ctaW, 88, 20);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.fillText(badgeText, lx + 32, ctaY + 60);

      // Subtitle
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '700 32px "Noto Sans Telugu", sans-serif';
      ctx.fillText('కర్మయోగి సంకల్పం · ప్రజా సేవ అవగాహన · 100 కర్మ పాయింట్లు', lx, ctaY + 148);

      // WhatsApp badge
      const waText = 'మా వాట్సాప్ గ్రూప్‌లో చేరండి';
      ctx.font = '900 36px "Noto Sans Telugu", sans-serif';
      const waW = ctx.measureText(waText).width + 56;
      ctx.fillStyle = '#25D366';
      roundRect(ctx, lx, ctaY + 190, waW, 74, 16);
      ctx.fill();
      ctx.fillStyle = '#06371A';
      ctx.fillText(waText, lx + 28, ctaY + 239);
    } else {
      // 1:1 Square post (1080x1080)
      const rx = 48;
      const ry = 48;
      const rw = 984;
      const rh = 450;
      ctx.save();
      roundRect(ctx, rx, ry, rw, rh, 32);
      ctx.clip();
      ctx.drawImage(sceneImg, rx, ry - 30, rw, rh + 90);
      ctx.restore();

      ctx.strokeStyle = ac;
      ctx.lineWidth = 9;
      roundRect(ctx, rx, ry, rw, rh, 32);
      ctx.stroke();

      const lx = 56;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx + 38, 565, 38, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.clip();
      ctx.drawImage(logoImg, lx, 527, 76, 76);
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 32px "Noto Sans Telugu", "Plus Jakarta Sans", sans-serif';
      ctx.fillText((channelName || 'SREENATH SOLUTIONS').toUpperCase(), lx + 96, 560);

      ctx.fillStyle = ac;
      ctx.font = '800 24px "Noto Sans Telugu", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`ప్రజా సేవ అవగాహన · ${ep.attr}`, lx + 96, 594);

      ctx.fillStyle = ac;
      ctx.font = '900 104px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Q${epIndex + 1}`, lx, 710);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 54px "Noto Sans Telugu", sans-serif';
      const hLines = wrapLines(ctx, headlineText, 740).slice(0, 2);
      hLines.forEach((line, idx) => {
        ctx.fillText(line, lx + 195, 675 + idx * 64);
      });

      ctx.font = '900 44px "Noto Sans Telugu", sans-serif';
      const ctaW = Math.min(960, ctx.measureText(badgeText).width + 56);
      ctx.fillStyle = ac;
      roundRect(ctx, lx, 785, ctaW, 80, 18);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.fillText(badgeText, lx + 28, 840);

      const waText = 'మా వాట్సాప్ గ్రూప్‌లో చేరండి · 100 కర్మ పాయింట్లు';
      ctx.font = '900 32px "Noto Sans Telugu", sans-serif';
      const waW = ctx.measureText(waText).width + 48;
      ctx.fillStyle = '#25D366';
      roundRect(ctx, lx, 895, waW, 68, 16);
      ctx.fill();
      ctx.fillStyle = '#06371A';
      ctx.fillText(waText, lx + 24, 940);
    }

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `karmayogi-sankalpa-Q${epIndex + 1}-${aspect === '16:9' ? '16x9-thumbnail' : '1x1-post'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
