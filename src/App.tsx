import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Maximize2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sun,
  Volume2,
  VolumeX,
  Download,
} from 'lucide-react';
import {
  EPISODES,
  EPISODE_DURATION,
  LOGO_DATA_URI,
  OPTION_LETTERS,
  ORIGINAL_HTML_PATH,
  PHASES,
  WHATSAPP_URL,
  formatTime,
  getPhaseIndexAtSecond,
  getStageNarration,
} from './data/episodesData';
import { VideoStage } from './components/VideoStage';
import { AiVideoThumbnailGenerator } from './components/AiVideoThumbnailGenerator';
import { PracticeQuizSection } from './components/PracticeQuizSection';
import { ThumbnailsGallery } from './components/ThumbnailsGallery';
import { YouTubeKitSection } from './components/YouTubeKitSection';

export default function App() {
  const [epIndex, setEpIndex] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9');
  const [voiceOn, setVoiceOn] = useState<boolean>(false);
  const [voiceSpeedMultiplier, setVoiceSpeedMultiplier] = useState<number>(1);
  const [channelName, setChannelName] = useState<string>('Sreenath Solutions');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [autoAdvanceEpisode, setAutoAdvanceEpisode] = useState<boolean>(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [embedOriginalHtml, setEmbedOriginalHtml] = useState<boolean>(false);
  const [stageEditorialArt, setStageEditorialArt] = useState<boolean>(true);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenKeyRef = useRef<string>('');
  const lastFrameTimeRef = useRef<number | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Speech synthesis helper
  const speakTelugu = useCallback(
    (text: string, baseRate: number) => {
      if (!voiceOn || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'te-IN';
        u.rate = Math.min(1.5, Math.max(0.7, (baseRate || 1) * voiceSpeedMultiplier));
        window.speechSynthesis.speak(u);
      } catch {
        // Ignore speech synthesis errors on unsupported browsers
      }
    },
    [voiceOn, voiceSpeedMultiplier]
  );

  // Trigger speech when phase or episode changes
  const currentSecFloor = Math.min(EPISODE_DURATION - 1, Math.max(0, Math.floor(elapsed)));
  const currentPhaseIndex = getPhaseIndexAtSecond(currentSecFloor);

  useEffect(() => {
    const key = `${epIndex}-${currentPhaseIndex}`;
    if (lastSpokenKeyRef.current !== key) {
      lastSpokenKeyRef.current = key;
      if (voiceOn && !embedOriginalHtml) {
        const { speechText, speechRate } = getStageNarration(epIndex, currentSecFloor);
        speakTelugu(speechText, speechRate);
      }
    }
  }, [epIndex, currentPhaseIndex, currentSecFloor, voiceOn, embedOriginalHtml, speakTelugu]);

  // Stop speech when voice turned off or original HTML mode opened
  useEffect(() => {
    if ((!voiceOn || embedOriginalHtml) && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [voiceOn, embedOriginalHtml]);

  // RequestAnimationFrame playback timer
  useEffect(() => {
    if (paused || embedOriginalHtml) {
      lastFrameTimeRef.current = null;
      return;
    }

    let animId: number;
    const loop = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const delta = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      setElapsed((prev) => {
        const next = prev + delta;
        if (next >= EPISODE_DURATION) {
          if (autoAdvanceEpisode) {
            setEpIndex((currEp) => (currEp + 1) % EPISODES.length);
          }
          lastSpokenKeyRef.current = '';
          return 0;
        }
        return next;
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [paused, autoAdvanceEpisode, embedOriginalHtml]);

  const handleSelectEpisode = (idx: number, scrollToTop = false) => {
    setEpIndex(idx);
    setElapsed(0);
    lastSpokenKeyRef.current = '';
    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleJumpToSecond = (sec: number) => {
    const clamped = Math.max(0, Math.min(EPISODE_DURATION - 0.1, sec));
    lastSpokenKeyRef.current = '';
    setElapsed(clamped);
  };

  const handlePlayEpisodeAtSecond = (idx: number, sec: number) => {
    setEpIndex(idx);
    setElapsed(sec);
    setPaused(false);
    setEmbedOriginalHtml(false);
    lastSpokenKeyRef.current = '';
    const studioEl = document.getElementById('video-studio');
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleFullscreenStage = () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      stageRef.current.requestFullscreen?.().catch(() => {});
    }
  };

  const currentEp = EPISODES[epIndex];
  const currentPhaseName = PHASES[currentPhaseIndex]?.[1] || 'పరిచయం';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element Brand wordmark */}
        <a
          href="#video-studio"
          className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          Sreenath Solutions
        </a>

        {/* Zone 2: 5 clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <a
            href="#video-studio"
            onClick={() => setEmbedOriginalHtml(false)}
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            వీడియో స్టూడియో
          </a>
          <a
            href="#ai-video-generator"
            onClick={() => setEmbedOriginalHtml(false)}
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            AI వీడియో & థంబ్‌నెయిల్
          </a>
          <a
            href="#practice-quiz"
            onClick={() => setEmbedOriginalHtml(false)}
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            ప్రాక్టీస్ క్విజ్
          </a>
          <a
            href="#thumbnails"
            onClick={() => setEmbedOriginalHtml(false)}
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            థంబ్‌నెయిల్ గ్యాలరీ
          </a>
          <a
            href="#youtube-kit"
            onClick={() => setEmbedOriginalHtml(false)}
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            యూట్యూబ్ కిట్
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold bg-[#25D366] text-[#06371A] hover:brightness-95 transition-all whitespace-nowrap shrink-0"
          >
            📲 వాట్సాప్ గ్రూప్‌లో చేరండి
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Studio Brand Hero Banner */}
        <section
          id="video-studio"
          className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 pb-8"
        >
          <div className="flex flex-col items-center text-center mb-6">
            <img
              src={LOGO_DATA_URI}
              alt="Sreenath Solutions"
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-full bg-white shadow-md mb-2"
            />
            <div className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400 mb-1">
              SREENATH SOLUTIONS · TROUBLESHOOTER FOR ALL
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight max-w-3xl">
              కర్మయోగి సంకల్పం · లీడర్‌షిప్ యాజ్ ఎ మిషన్
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1.5">
              బేస్‌లైన్ ప్రశ్నావళి వివరణ: 5 ఎపిసోడ్లు, ఒక్కొక్కటి 2 నిమిషాలు · iGOT Karmayogi · 100 కర్మ పాయింట్లు
            </p>

            {/* Mode & Utility Toolbar */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setEmbedOriginalHtml(false)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    !embedOriginalHtml
                      ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  ఇంటరాక్టివ్ స్టూడియో వ్యూ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaused(true);
                    setEmbedOriginalHtml(true);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    embedOriginalHtml
                      ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  క్లాసిక్ HTML వ్యూ
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                {darkMode ? 'లైట్ థీమ్' : 'డార్క్ థీమ్'}
              </button>

              <a
                href={ORIGINAL_HTML_PATH}
                download="karmayogi-sankalpa-telugu-episodes.html"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                HTML డౌన్‌లోడ్
              </a>
            </div>
          </div>

          {embedOriginalHtml ? (
            <div className="w-full rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-white shadow-sm">
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>అసలు HTML ఫైల్ ప్రివ్యూ (Standalone HTML)</span>
                <a
                  href={ORIGINAL_HTML_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blue-700 dark:text-amber-400 hover:underline"
                >
                  కొత్త ట్యాబ్‌లో తెరవండి ↗
                </a>
              </div>
              <iframe
                src={ORIGINAL_HTML_PATH}
                title="కర్మయోగి సంకల్పం – తెలుగు ఎపిసోడ్లు"
                className="w-full h-[85vh] border-0"
              />
            </div>
          ) : (
            <>
              {/* Episode Selector Tabs (Q1 - Q5) */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mb-5">
                {EPISODES.map((q, i) => {
                  const isActive = i === epIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleSelectEpisode(i)}
                      className={`px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-amber-400 text-slate-950 shadow-sm scale-[1.02]'
                          : 'bg-[#1F4E9E] text-white hover:bg-[#173d7e]'
                      }`}
                    >
                      Q{i + 1} · {q.shortTitle}
                    </button>
                  );
                })}
              </div>

              {/* Two-Zone Sandbox Layout: Left (Interactive Stage & Timeline) / Right (Control & Script Deck) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Zone: Interactive Video Stage + Timeline Scrubber */}
                <div className="lg:col-span-8 flex flex-col items-center">
                  <div className="w-full flex justify-center">
                    <VideoStage
                      stageRef={stageRef}
                      epIndex={epIndex}
                      elapsedSeconds={elapsed}
                      aspect={aspect}
                      channelName={channelName}
                      onJumpToSecond={handleJumpToSecond}
                      useEditorialArt={stageEditorialArt}
                    />
                  </div>

                  {/* Interactive Timeline Scrubber & Phase Jumper Bar */}
                  <div className="w-full mt-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                        ఎపిసోడ్ {epIndex + 1} / 5 · {formatTime(currentSecFloor)} / 2:00 ·{' '}
                        <span className="text-amber-700 dark:text-amber-400 font-sans">
                          {currentPhaseName}
                        </span>
                      </span>

                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        నాయకత్వ గుణం: <strong className="text-slate-800 dark:text-slate-200">{currentEp.attr}</strong>
                      </span>
                    </div>

                    {/* Range Slider with clear label */}
                    <div className="flex items-center gap-3 my-2">
                      <span className="text-xs font-mono tabular-nums text-slate-500">0:00</span>
                      <input
                        type="range"
                        aria-label="ఎపిసోడ్ టైమ్‌లైన్ స్క్రబ్బర్"
                        min={0}
                        max={EPISODE_DURATION - 0.1}
                        step={0.2}
                        value={elapsed}
                        onChange={(e) => handleJumpToSecond( parseFloat(e.target.value) )}
                        className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <span className="text-xs font-mono tabular-nums text-slate-500">2:00</span>
                    </div>

                    {/* 9 Phase Direct Jump Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {PHASES.map(([sec, label], idx) => {
                        const isCurrentPhase = idx === currentPhaseIndex;
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => handleJumpToSecond(sec)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                              isCurrentPhase
                                ? 'bg-amber-400 text-slate-950 font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="font-mono tabular-nums opacity-75 mr-1">
                              {formatTime(sec)}
                            </span>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2.5 max-w-2xl">
                    ప్రతి ఎపిసోడ్ సరిగ్గా 2:00. యూట్యూబ్ కోసం 16:9, షార్ట్స్/రీల్స్ కోసం 9:16లో రికార్డ్ చేయండి (అవసరమైతే 60 సెకన్లకు కత్తిరించండి). నేరేషన్ కోసం వాయిస్ ఆన్ చేయండి.
                  </p>
                </div>

                {/* Right Zone: Studio Controls & Synchronized Option Inspector */}
                <div className="lg:col-span-4 flex flex-col gap-4 w-full">
                  {/* Playback & Studio Control Deck */}
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                      స్టూడియో కంట్రోల్స్
                    </h2>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setPaused((p) => !p)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          paused
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-[#1F4E9E] text-white hover:bg-[#173d7e]'
                        }`}
                      >
                        {paused ? (
                          <>
                            <Play className="w-4 h-4 fill-current" /> ప్లే
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4 fill-current" /> ఆపు
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleJumpToSecond(0)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-[#1F4E9E] text-white hover:bg-[#173d7e] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" /> మళ్ళీ
                      </button>

                      <button
                        type="button"
                        onClick={() => handleJumpToSecond(elapsed - 5)}
                        title="5 సెకన్లు వెనక్కి"
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <SkipBack className="w-3.5 h-3.5" /> -5s
                      </button>

                      <button
                        type="button"
                        onClick={() => handleJumpToSecond(elapsed + 5)}
                        title="5 సెకన్లు ముందుకు"
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        +5s <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Aspect Ratio, Voice & Fullscreen */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setAspect('16:9')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          aspect === '16:9'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        16:9 (YouTube)
                      </button>

                      <button
                        type="button"
                        onClick={() => setAspect('9:16')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          aspect === '9:16'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        9:16 (Shorts/Reels)
                      </button>

                      <button
                        type="button"
                        onClick={() => setVoiceOn((v) => !v)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          voiceOn
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {voiceOn ? (
                          <>
                            <Volume2 className="w-4 h-4" /> వాయిస్ ఆన్
                          </>
                        ) : (
                          <>
                            <VolumeX className="w-4 h-4" /> వాయిస్ ఆఫ్
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleFullscreenStage}
                        title="పూర్తి స్క్రీన్ (Fullscreen రికార్డింగ్ కోసం)"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Maximize2 className="w-3.5 h-3.5" /> పూర్తి స్క్రీన్
                      </button>

                      <button
                        type="button"
                        onClick={() => setStageEditorialArt((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {stageEditorialArt ? 'బ్యాక్‌గ్రౌండ్: ఎడిటోరియల్ ఆర్ట్' : 'బ్యాక్‌గ్రౌండ్: యానిమేటెడ్ SVG'}
                      </button>
                    </div>

                    {/* Channel Name & Voice Speed */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label
                          htmlFor="channel-name-input"
                          className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                          ఛానల్ పేరు
                        </label>
                        <input
                          id="channel-name-input"
                          type="text"
                          value={channelName}
                          onChange={(e) => setChannelName(e.target.value)}
                          placeholder="Sreenath Solutions"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="voice-rate-select"
                          className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                          వాయిస్ వేగం: {voiceSpeedMultiplier}x
                        </label>
                        <select
                          id="voice-rate-select"
                          value={voiceSpeedMultiplier}
                          onChange={(e) => setVoiceSpeedMultiplier(parseFloat(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                        >
                          <option value={0.9}>0.9x (నిదానం)</option>
                          <option value={1}>1.0x (సాధారణం)</option>
                          <option value={1.15}>1.15x (వేగం)</option>
                        </select>
                      </div>
                    </div>

                    <label className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAdvanceEpisode}
                        onChange={(e) => setAutoAdvanceEpisode(e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      2:00 ముగియగానే తదుపరి ఎపిసోడ్‌కు ఆటోమేటిక్‌గా వెళ్ళు
                    </label>
                  </div>

                  {/* Live Synchronized Option Navigator */}
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        5 ఎంపికల తక్షణ నావిగేటర్ (A–E)
                      </h3>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        నొక్కితే ఆ సమయానికి వెళ్తుంది
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {currentEp.o.map((optText, idx) => {
                        const optSec = 34 + idx * 14;
                        const isPlayingThisOpt =
                          currentSecFloor >= optSec && currentSecFloor < optSec + 14;
                        const isUserPicked = selectedAnswers[epIndex] === idx;

                        return (
                          <div
                            key={idx}
                            onClick={() => handleJumpToSecond(optSec)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleJumpToSecond(optSec);
                              }
                            }}
                            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                              isPlayingThisOpt
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500'
                                : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center ${
                                    isPlayingThisOpt
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {OPTION_LETTERS[idx]}
                                </span>
                                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                  {currentEp.l[idx]}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAnswers((prev) => ({
                                      ...prev,
                                      [epIndex]: idx,
                                    }));
                                  }}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                    isUserPicked
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-300 hover:text-slate-950'
                                  }`}
                                >
                                  {isUserPicked ? '✓ నా ఎంపిక' : 'ఎంచుకోండి'}
                                </button>
                                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                                  {formatTime(optSec)}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                              {optText}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {!embedOriginalHtml && (
          <>
            {/* Free API LLM Thumbnail & Video Generator for All 5 Questions */}
            <AiVideoThumbnailGenerator
              channelName={channelName}
              onSelectEpisodeInStudio={(idx) => handleSelectEpisode(idx, true)}
            />

            {/* Interactive Situational Judgment Quiz & Slide Deck */}
            <PracticeQuizSection
              activeEpisode={epIndex}
              selectedAnswers={selectedAnswers}
              onSelectAnswer={(ep, opt) =>
                setSelectedAnswers((prev) => ({ ...prev, [ep]: opt }))
              }
              onResetAnswers={() => setSelectedAnswers({})}
              onPlayEpisodeAtSecond={handlePlayEpisodeAtSecond}
            />

            {/* Thumbnails & Social Posts Studio */}
            <ThumbnailsGallery
              activeEpisode={epIndex}
              channelName={channelName}
              onSelectEpisode={handleSelectEpisode}
            />

            {/* YouTube Creator Kit */}
            <YouTubeKitSection
              activeEpisode={epIndex}
              onSelectEpisode={(idx) => handleSelectEpisode(idx, false)}
            />
          </>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-6 px-4 sm:px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            Sreenath Solutions · Troubleshooter for All · కర్మయోగి సంకల్పం (iGOT Karmayogi)
          </span>
          <div className="flex items-center gap-4">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              వాట్సాప్ గ్రూప్
            </a>
            <a
              href={ORIGINAL_HTML_PATH}
              download="karmayogi-sankalpa-telugu-episodes.html"
              className="hover:underline"
            >
              Standalone HTML డౌన్‌లోడ్
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
