import {
  AiAwarenessPack,
  DEFAULT_AWARENESS_PACKS,
  EPISODES,
  LOGO_DATA_URI,
  OPTION_LETTERS,
  WHATSAPP_DISPLAY,
} from '../data/episodesData';

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

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface VideoGenerationConfig {
  epIndex: number;
  aspect: '16:9' | '9:16';
  durationSec: number; // e.g., 18, 45, or 120
  channelName: string;
  awarenessPack?: AiAwarenessPack;
  ttsAudioBase64?: string;
  enableWebSpeechDuringRecord?: boolean;
  onProgress?: (percent: number, phaseLabel: string) => void;
  abortSignal?: AbortSignal;
}

export interface GeneratedVideoResult {
  epIndex: number;
  url: string;
  filename: string;
  aspect: '16:9' | '9:16';
  durationSec: number;
}

export async function generatePublicServiceVideo(
  config: VideoGenerationConfig
): Promise<GeneratedVideoResult> {
  const {
    epIndex,
    aspect,
    durationSec,
    channelName,
    awarenessPack,
    ttsAudioBase64,
    enableWebSpeechDuringRecord = true,
    onProgress,
    abortSignal,
  } = config;

  const ep = EPISODES[epIndex];
  const pack = awarenessPack || DEFAULT_AWARENESS_PACKS[epIndex];
  const [b1, b2, ac] = ep.theme;
  const isLand = aspect === '16:9';
  const width = isLand ? 1280 : 720;
  const height = isLand ? 720 : 1280;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for video generation.');
  }

  // Load assets (logo + editorial illustration with SVG fallback)
  const svgWithXmlns = ep.svg.replace(
    '<svg ',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" '
  );
  const svgBlob = new Blob([svgWithXmlns], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  let logoImg: HTMLImageElement;
  let sceneImg: HTMLImageElement;
  try {
    logoImg = await loadImage(LOGO_DATA_URI);
    try {
      sceneImg = await loadImage(ep.imageUrl);
    } catch {
      sceneImg = await loadImage(svgUrl);
    }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }

  // Setup Web Audio API stream for synchronized audio inside the video
  let audioCtx: AudioContext | null = null;
  let destNode: MediaStreamAudioDestinationNode | null = null;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      destNode = audioCtx.createMediaStreamDestination();

      // If Gemini TTS WAV base64 is available, decode and play it into the video audio track
      if (ttsAudioBase64) {
        const binaryString = atob(ttsAudioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(destNode);
        source.connect(audioCtx.destination);
        source.start(0);
      }
    }
  } catch {
    // Fallback to video-only stream if AudioContext is blocked
  }

  const playTransitionChime = (freq = 528) => {
    if (!audioCtx || !destNode) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(destNode);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.36);
    } catch {
      // Ignore chime errors
    }
  };

  const canvasStream = canvas.captureStream(30);
  if (destNode) {
    destNode.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
  }

  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const supportedMime =
    mimeTypes.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ||
    '';

  const recorder = supportedMime
    ? new MediaRecorder(canvasStream, { mimeType: supportedMime, videoBitsPerSecond: 4_500_000 })
    : new MediaRecorder(canvasStream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Phase normalized timeline (0..1)
  // 0.00 - 0.10: Intro
  // 0.10 - 0.28: Scenario
  // 0.28 - 0.78: Options A, B, C, D, E (0.10 each)
  // 0.78 - 0.90: AI Public Service Civic Lesson & Competency
  // 0.90 - 1.00: Next Steps & iGOT Karmayogi CTA
  const getPhaseInfo = (norm: number): { key: string; label: string; speech: string } => {
    const n = epIndex + 1;
    if (norm < 0.1) {
      return {
        key: 'intro',
        label: 'పరిచయం',
        speech: `ప్రశ్న ${n}. ${pack.thumbnailHeadlineTe}. మీరు ఏమి చేస్తారు?`,
      };
    }
    if (norm < 0.28) {
      return {
        key: 'scenario',
        label: 'పరిస్థితి',
        speech: ep.s,
      };
    }
    if (norm < 0.78) {
      const optIdx = Math.min(4, Math.floor((norm - 0.28) / 0.1));
      return {
        key: `opt-${optIdx}`,
        label: `ఎంపిక ${OPTION_LETTERS[optIdx]}`,
        speech: `ఎంపిక ${OPTION_LETTERS[optIdx]}. ${ep.l[optIdx]}`,
      };
    }
    if (norm < 0.9) {
      return {
        key: 'lesson',
        label: 'ప్రజా సేవ అవగాహన పాఠం',
        speech: `ప్రజా సేవ పాఠం: ${pack.civicLessonTe}`,
      };
    }
    return {
      key: 'outro',
      label: 'తదుపరి దశలు',
      speech: 'iGOT కర్మయోగిలో మీ బేస్‌లైన్ ప్రశ్నావళి పూర్తి చేసి 100 కర్మ పాయింట్లు పొందండి.',
    };
  };

  const renderFrame = (norm: number) => {
    const n = epIndex + 1;

    // 1. Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, b1);
    grad.addColorStop(1, b2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Editorial image with subtle Ken Burns zoom & scrim
    const zoom = 1 + norm * 0.08;
    const imgAlpha = norm < 0.1 ? 0.55 : 0.22;
    ctx.save();
    ctx.globalAlpha = imgAlpha;
    const imgRatio = sceneImg.width / Math.max(1, sceneImg.height);
    const canvasRatio = width / height;
    let dw = width * zoom;
    let dh = height * zoom;
    if (imgRatio > canvasRatio) {
      dw = dh * imgRatio;
    } else {
      dh = dw / imgRatio;
    }
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;
    ctx.drawImage(sceneImg, dx, dy, dw, dh);
    ctx.restore();

    // Dark gradient overlay for WCAG AA+ contrast
    const scrim = ctx.createLinearGradient(0, 0, 0, height);
    scrim.addColorStop(0, 'rgba(11, 25, 60, 0.55)');
    scrim.addColorStop(0.5, 'rgba(11, 25, 60, 0.72)');
    scrim.addColorStop(1, 'rgba(8, 18, 45, 0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, width, height);

    // 3. Top Header Bar (Logo + Channel Name + Kicker)
    const padX = isLand ? 56 : 40;
    const topY = isLand ? 36 : 48;
    const logoSize = isLand ? 58 : 64;

    ctx.save();
    ctx.beginPath();
    ctx.arc(padX + logoSize / 2, topY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logoImg, padX, topY, logoSize, logoSize);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${isLand ? 24 : 26}px "Noto Sans Telugu", "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(channelName || 'Sreenath Solutions', padX + logoSize + 16, topY + 26);

    ctx.fillStyle = ac;
    ctx.font = `800 ${isLand ? 16 : 18}px "Noto Sans Telugu", "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(
      'PUBLIC SERVICE AWARENESS · కర్మయోగి సంకల్పం',
      padX + logoSize + 16,
      topY + 50
    );

    // Center content area
    const centerX = width / 2;
    const maxTextW = width - padX * 2;

    ctx.textAlign = 'center';

    if (norm < 0.1) {
      // Phase 0: Intro
      ctx.fillStyle = ac;
      ctx.font = `800 ${isLand ? 28 : 30}px "Noto Sans Telugu", sans-serif`;
      ctx.fillText('ప్రభుత్వ ఉద్యోగుల ప్రజా సేవ అవగాహన', centerX, isLand ? 195 : 340);

      ctx.fillStyle = ac;
      ctx.font = `900 ${isLand ? 130 : 150}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(`Q${n}`, centerX, isLand ? 335 : 510);

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${isLand ? 48 : 46}px "Noto Sans Telugu", sans-serif`;
      const hLines = wrapTextLines(ctx, pack.thumbnailHeadlineTe || ep.title, maxTextW);
      hLines.forEach((line, i) => {
        ctx.fillText(line, centerX, (isLand ? 415 : 610) + i * 60);
      });

      const badgeY = (isLand ? 470 : 680) + (hLines.length - 1) * 55;
      const badgeText = pack.thumbnailBadgeTe || 'మీరు ఏమి చేస్తారు?';
      ctx.font = `900 ${isLand ? 32 : 34}px "Noto Sans Telugu", sans-serif`;
      const bw = Math.min(maxTextW, ctx.measureText(badgeText).width + 56);
      ctx.fillStyle = ac;
      roundRect(ctx, centerX - bw / 2, badgeY, bw, 62, 16);
      ctx.fill();
      ctx.fillStyle = '#0B1F4B';
      ctx.fillText(badgeText, centerX, badgeY + 42);
    } else if (norm < 0.28) {
      // Phase 1: Scenario
      ctx.fillStyle = ac;
      ctx.font = `800 ${isLand ? 26 : 28}px "Noto Sans Telugu", sans-serif`;
      ctx.fillText(`ప్రశ్న ${n} / 5 · ${ep.title} (పరిస్థితి)`, centerX, isLand ? 165 : 260);

      ctx.fillStyle = '#F1F5F9';
      const fontSize = isLand ? 30 : 32;
      const lineHeight = isLand ? 48 : 52;
      ctx.font = `600 ${fontSize}px "Noto Sans Telugu", sans-serif`;
      const sLines = wrapTextLines(ctx, ep.s, maxTextW - 30);
      const totalH = sLines.length * lineHeight;
      const startY = (height - totalH) / 2 + 25;
      sLines.forEach((line, i) => {
        ctx.fillText(line, centerX, startY + i * lineHeight);
      });
    } else if (norm < 0.78) {
      // Phases 2-6: Options A-E
      const optIdx = Math.min(4, Math.floor((norm - 0.28) / 0.1));
      const letter = OPTION_LETTERS[optIdx];

      ctx.fillStyle = ac;
      ctx.font = `800 ${isLand ? 26 : 28}px "Noto Sans Telugu", sans-serif`;
      ctx.fillText(`ప్రశ్న ${n} / 5 · ${ep.title}`, centerX, isLand ? 160 : 250);

      // Option Box
      const boxW = maxTextW;
      const boxX = padX;
      const boxY = isLand ? 195 : 310;
      const boxH = isLand ? 275 : 460;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
      roundRect(ctx, boxX, boxY, boxW, boxH, 22);
      ctx.fill();
      ctx.strokeStyle = ac;
      ctx.lineWidth = 4;
      roundRect(ctx, boxX, boxY, boxW, boxH, 22);
      ctx.stroke();

      // Letter Circle
      const circleR = isLand ? 36 : 42;
      const circleX = boxX + 28 + circleR;
      const circleY = boxY + 34 + circleR;
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
      ctx.fillStyle = ac;
      ctx.fill();

      ctx.fillStyle = '#0B1F4B';
      ctx.font = `900 ${isLand ? 38 : 42}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(letter, circleX, circleY + 13);

      // Option Text left-aligned inside box
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      const optFont = isLand ? 29 : 31;
      const optLineH = isLand ? 46 : 50;
      ctx.font = `600 ${optFont}px "Noto Sans Telugu", sans-serif`;
      const textX = circleX + circleR + 24;
      const textMaxW = boxW - (textX - boxX) - 28;
      const optLines = wrapTextLines(ctx, ep.o[optIdx], textMaxW);
      optLines.forEach((line, i) => {
        ctx.fillText(line, textX, boxY + 62 + i * optLineH);
      });

      // Leadership lens takeaway below box
      ctx.textAlign = 'center';
      ctx.fillStyle = ac;
      ctx.font = `800 ${isLand ? 28 : 30}px "Noto Sans Telugu", sans-serif`;
      const lensLines = wrapTextLines(ctx, `నాయకత్వ విశ్లేషణ: ${ep.l[optIdx]}`, maxTextW);
      lensLines.forEach((line, i) => {
        ctx.fillText(line, centerX, boxY + boxH + 52 + i * 42);
      });

      // Dots A B C D E
      const dotR = 22;
      const dotGap = 62;
      const dotsStartX = centerX - (4 * dotGap) / 2;
      const dotsY = isLand ? 585 : 960;
      for (let k = 0; k < 5; k++) {
        const dxDot = dotsStartX + k * dotGap;
        ctx.beginPath();
        ctx.arc(dxDot, dotsY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = k === optIdx ? ac : 'rgba(255,255,255,0.22)';
        ctx.fill();
        ctx.fillStyle = k === optIdx ? '#0B1F4B' : '#ffffff';
        ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(OPTION_LETTERS[k], dxDot, dotsY + 8);
      }
    } else if (norm < 0.9) {
      // Phase 7: AI Public Service Educational Lesson
      ctx.fillStyle = ac;
      ctx.font = `800 ${isLand ? 26 : 28}px "Noto Sans Telugu", sans-serif`;
      ctx.fillText(`ప్రజా సేవ అవగాహన పాఠం · Q${n}`, centerX, isLand ? 165 : 270);

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${isLand ? 44 : 44}px "Noto Sans Telugu", sans-serif`;
      ctx.fillText(`నాయకత్వ విలువ: ${ep.attr}`, centerX, isLand ? 225 : 345);

      // Lesson Card
      const cardY = isLand ? 260 : 400;
      const cardH = isLand ? 290 : 520;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, padX, cardY, maxTextW, cardH, 20);
      ctx.fill();
      ctx.strokeStyle = ac;
      ctx.lineWidth = 3;
      roundRect(ctx, padX, cardY, maxTextW, cardH, 20);
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = `600 ${isLand ? 28 : 30}px "Noto Sans Telugu", sans-serif`;
      const lessonLines = wrapTextLines(ctx, pack.civicLessonTe, maxTextW - 60);
      lessonLines.forEach((line, i) => {
        ctx.fillText(line, centerX, cardY + 58 + i * 44);
      });

      ctx.fillStyle = ac;
      ctx.font = `700 ${isLand ? 25 : 27}px "Noto Sans Telugu", sans-serif`;
      const bestLines = wrapTextLines(
        ctx,
        `ఆదర్శ దృక్పథం: ${pack.bestApproachInsightTe}`,
        maxTextW - 60
      );
      const bestStartY = cardY + 75 + lessonLines.length * 44;
      bestLines.forEach((line, i) => {
        ctx.fillText(line, centerX, bestStartY + i * 40);
      });
    } else {
      // Phase 8: Next Steps & CTA
      const ctaText = '👍 లైక్ · 🔔 సబ్‌స్క్రైబ్ · 💬 కామెంట్';
      ctx.font = `900 ${isLand ? 36 : 36}px "Noto Sans Telugu", sans-serif`;
      const cw = Math.min(maxTextW, ctx.measureText(ctaText).width + 64);
      const cy = isLand ? 210 : 380;
      ctx.fillStyle = ac;
      roundRect(ctx, centerX - cw / 2, cy, cw, 70, 18);
      ctx.fill();
      ctx.fillStyle = '#0B1F4B';
      ctx.fillText(ctaText, centerX, cy + 47);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${isLand ? 32 : 34}px "Noto Sans Telugu", sans-serif`;
      const outroLines = wrapTextLines(
        ctx,
        'iGOT కర్మయోగిలో మీ బేస్‌లైన్ ప్రశ్నావళి & కర్మయోగి సంకల్పం పూర్తి చేసి 100 కర్మ పాయింట్లు పొందండి',
        maxTextW - 40
      );
      outroLines.forEach((line, i) => {
        ctx.fillText(line, centerX, (isLand ? 345 : 530) + i * 48);
      });

      ctx.fillStyle = '#25D366';
      ctx.font = `800 ${isLand ? 28 : 30}px "Noto Sans Telugu", sans-serif`;
      ctx.fillText(
        `📲 వాట్సాప్ గ్రూప్: ${WHATSAPP_DISPLAY}`,
        centerX,
        isLand ? 485 : 710
      );

      ctx.fillStyle = ac;
      ctx.font = `800 ${isLand ? 24 : 26}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(
        'SREENATH SOLUTIONS · TROUBLESHOOTER FOR ALL',
        centerX,
        isLand ? 545 : 780
      );
    }

    // 4. Bottom Caption Strip & Progress Bar
    const capH = isLand ? 58 : 76;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
    ctx.fillRect(0, height - capH, width, capH);

    const pInfo = getPhaseInfo(norm);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${isLand ? 21 : 23}px "Noto Sans Telugu", sans-serif`;
    ctx.textAlign = 'center';
    const shortCap =
      pInfo.speech.length > 95 ? `${pInfo.speech.slice(0, 95)}...` : pInfo.speech;
    ctx.fillText(shortCap, centerX, height - capH / 2 + 6);

    // Progress Bar
    ctx.fillStyle = '#E8863A';
    ctx.fillRect(0, height - 8, width * Math.min(1, norm), 8);
  };

  return new Promise<GeneratedVideoResult>((resolve, reject) => {
    const durationMs = durationSec * 1000;
    const startTime = performance.now();
    let lastPhaseKey = '';
    let stopped = false;

    recorder.onstop = () => {
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      if (!ttsAudioBase64 && enableWebSpeechDuringRecord && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (abortSignal?.aborted) {
        reject(new Error('వీడియో జనరేషన్ రద్దు చేయబడింది.'));
        return;
      }
      const blob = new Blob(chunks, { type: supportedMime || 'video/webm' });
      const url = URL.createObjectURL(blob);
      resolve({
        epIndex,
        url,
        filename: `karmayogi-Q${epIndex + 1}-${aspect === '16:9' ? '16x9' : '9x16'}-awareness.webm`,
        aspect,
        durationSec,
      });
    };

    recorder.onerror = (err) => {
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      reject(err);
    };

    recorder.start(200);

    const step = (now: number) => {
      if (stopped) return;
      if (abortSignal?.aborted) {
        stopped = true;
        recorder.stop();
        return;
      }

      const elapsedMs = now - startTime;
      const norm = Math.min(1, elapsedMs / durationMs);
      const pInfo = getPhaseInfo(norm);

      if (pInfo.key !== lastPhaseKey) {
        lastPhaseKey = pInfo.key;
        playTransitionChime(pInfo.key === 'intro' ? 440 : 528);

        // If user didn't pre-generate Gemini WAV, speak Telugu live during recording
        if (!ttsAudioBase64 && enableWebSpeechDuringRecord && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(pInfo.speech);
            u.lang = 'te-IN';
            u.rate = durationSec <= 25 ? 1.25 : 1.05;
            window.speechSynthesis.speak(u);
          } catch {
            // ignore
          }
        }
      }

      renderFrame(norm);
      onProgress?.(Math.round(norm * 100), pInfo.label);

      if (elapsedMs >= durationMs) {
        stopped = true;
        recorder.stop();
      } else {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  });
}
