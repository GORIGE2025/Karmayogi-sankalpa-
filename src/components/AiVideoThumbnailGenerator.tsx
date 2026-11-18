import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  AiAwarenessPack,
  DEFAULT_AWARENESS_PACKS,
  EPISODES,
  LOGO_DATA_URI,
} from '../data/episodesData';
import { downloadEpisodeThumbnailPng } from '../utils/exportThumbnailPng';
import {
  GeneratedVideoResult,
  generatePublicServiceVideo,
} from '../utils/exportEpisodeVideo';

interface AiVideoThumbnailGeneratorProps {
  channelName: string;
  onSelectEpisodeInStudio: (epIndex: number) => void;
}

export const AiVideoThumbnailGenerator: React.FC<AiVideoThumbnailGeneratorProps> = ({
  channelName,
  onSelectEpisodeInStudio,
}) => {
  const [packs, setPacks] = useState<Record<number, AiAwarenessPack>>(DEFAULT_AWARENESS_PACKS);
  const [customFocus, setCustomFocus] = useState<string>('');
  const [useEditorialArt, setUseEditorialArt] = useState<boolean>(true);
  const [thumbAspect, setThumbAspect] = useState<'16:9' | '1:1'>('16:9');
  const [videoAspect, setVideoAspect] = useState<'16:9' | '9:16'>('16:9');
  const [videoDurationSec, setVideoDurationSec] = useState<number>(18);
  const [voiceName, setVoiceName] = useState<string>('Kore');

  // LLM generation states
  const [isGeneratingAllLlm, setIsGeneratingAllLlm] = useState<boolean>(false);
  const [generatingSingleLlm, setGeneratingSingleLlm] = useState<number | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [llmSuccessBanner, setLlmSuccessBanner] = useState<string | null>(null);

  // TTS audio states per question (0..4)
  const [ttsLoadingEp, setTtsLoadingEp] = useState<number | null>(null);
  const [ttsAudioMap, setTtsAudioMap] = useState<Record<number, string>>({});
  const [ttsErrorMap, setTtsErrorMap] = useState<Record<number, string>>({});

  // Video generation states
  const [activeVideoEp, setActiveVideoEp] = useState<number | null>(null);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [videoPhaseLabel, setVideoPhaseLabel] = useState<string>('');
  const [isBatchGeneratingVideos, setIsBatchGeneratingVideos] = useState<boolean>(false);
  const [generatedVideos, setGeneratedVideos] = useState<Record<number, GeneratedVideoResult>>({});
  const [copiedScriptEp, setCopiedScriptEp] = useState<number | null>(null);
  const [isDownloadingAllThumbs, setIsDownloadingAllThumbs] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Call Server-Side Free-Tier Gemini LLM ('gemini-4-hydrogen') for 1 or all 5 questions
  const handleGenerateLlmAwareness = async (targetEpIndex?: number) => {
    setLlmError(null);
    setLlmSuccessBanner(null);

    const targetEpisodes =
      targetEpIndex !== undefined ? [EPISODES[targetEpIndex]] : EPISODES;

    if (targetEpIndex !== undefined) {
      setGeneratingSingleLlm(targetEpIndex);
    } else {
      setIsGeneratingAllLlm(true);
    }

    try {
      const response = await fetch('/api/ai/awareness-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodes: targetEpisodes,
          customFocus: customFocus.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI అవగాహన కంటెంట్ రూపొందించడంలో విఫలమైంది.');
      }

      if (Array.isArray(data.packs)) {
        setPacks((prev) => {
          const next = { ...prev };
          for (const item of data.packs) {
            if (typeof item.id === 'number') {
              next[item.id] = item;
            }
          }
          return next;
        });
        setLlmSuccessBanner(
          targetEpIndex !== undefined
            ? `Q${targetEpIndex + 1} కోసం ఉచిత Gemini LLM (gemini-4-hydrogen) తో ప్రజా సేవ అవగాహన థంబ్‌నెయిల్ & వీడియో స్క్రిప్ట్ సిద్ధమైంది!`
            : 'మొత్తం 5 ప్రశ్నలకు ఉచిత Gemini LLM (gemini-4-hydrogen) తో ప్రజా సేవ అవగాహన థంబ్‌నెయిల్స్ & వీడియో స్క్రిప్ట్‌లు సిద్ధమయ్యాయి!'
        );
      }
    } catch (err: unknown) {
      setLlmError(
        err instanceof Error ? err.message : 'AI జనరేషన్‌లో లోపం జరిగింది.'
      );
    } finally {
      setIsGeneratingAllLlm(false);
      setGeneratingSingleLlm(null);
    }
  };

  // Call Server-Side Free-Tier Gemini TTS ('gemini-3.8-flash-lite-tts')
  const handleGenerateTts = async (epIndex: number) => {
    setTtsLoadingEp(epIndex);
    setTtsErrorMap((prev) => ({ ...prev, [epIndex]: '' }));

    try {
      const pack = packs[epIndex] || DEFAULT_AWARENESS_PACKS[epIndex];
      const response = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pack.videoScriptTe,
          voiceName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI వాయిస్ ఓవర్ రూపొందించడంలో లోపం.');
      }

      if (data.audioBase64) {
        setTtsAudioMap((prev) => ({ ...prev, [epIndex]: data.audioBase64 }));
      }
    } catch (err: unknown) {
      setTtsErrorMap((prev) => ({
        ...prev,
        [epIndex]: err instanceof Error ? err.message : 'TTS లోపం',
      }));
    } finally {
      setTtsLoadingEp(null);
    }
  };

  // Generate Single Question Video (.webm)
  const handleGenerateSingleVideo = async (epIndex: number) => {
    if (activeVideoEp !== null) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setActiveVideoEp(epIndex);
    setVideoProgress(0);
    setVideoPhaseLabel('పరిచయం');

    try {
      const res = await generatePublicServiceVideo({
        epIndex,
        aspect: videoAspect,
        durationSec: videoDurationSec,
        channelName,
        awarenessPack: packs[epIndex],
        ttsAudioBase64: ttsAudioMap[epIndex],
        enableWebSpeechDuringRecord: true,
        abortSignal: controller.signal,
        onProgress: (pct, label) => {
          setVideoProgress(pct);
          setVideoPhaseLabel(label);
        },
      });

      setGeneratedVideos((prev) => {
        if (prev[epIndex]?.url) {
          URL.revokeObjectURL(prev[epIndex].url);
        }
        return { ...prev, [epIndex]: res };
      });
    } catch {
      // Cancelled or failed
    } finally {
      setActiveVideoEp(null);
      abortControllerRef.current = null;
    }
  };

  // Batch Generate Videos for All 5 Questions
  const handleBatchGenerateAllVideos = async () => {
    if (activeVideoEp !== null) return;
    setIsBatchGeneratingVideos(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      for (let i = 0; i < EPISODES.length; i++) {
        if (controller.signal.aborted) break;
        setActiveVideoEp(i);
        setVideoProgress(0);
        setVideoPhaseLabel(`Q${i + 1} · పరిచయం`);

        const res = await generatePublicServiceVideo({
          epIndex: i,
          aspect: videoAspect,
          durationSec: videoDurationSec,
          channelName,
          awarenessPack: packs[i],
          ttsAudioBase64: ttsAudioMap[i],
          enableWebSpeechDuringRecord: true,
          abortSignal: controller.signal,
          onProgress: (pct, label) => {
            setVideoProgress(pct);
            setVideoPhaseLabel(`Q${i + 1} · ${label}`);
          },
        });

        setGeneratedVideos((prev) => {
          if (prev[i]?.url) {
            URL.revokeObjectURL(prev[i].url);
          }
          return { ...prev, [i]: res };
        });
      }
    } catch {
      // Cancelled
    } finally {
      setActiveVideoEp(null);
      setIsBatchGeneratingVideos(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelVideoGeneration = () => {
    abortControllerRef.current?.abort();
  };

  // Batch Download All 5 Thumbnails as High-Res PNGs
  const handleDownloadAll5Thumbnails = async () => {
    setIsDownloadingAllThumbs(true);
    try {
      for (let i = 0; i < EPISODES.length; i++) {
        const p = packs[i] || DEFAULT_AWARENESS_PACKS[i];
        await downloadEpisodeThumbnailPng(i, thumbAspect, channelName, {
          useEditorialArt,
          customHeadline: p.thumbnailHeadlineTe,
          customBadge: p.thumbnailBadgeTe,
        });
        await new Promise((r) => setTimeout(r, 280));
      }
    } finally {
      setIsDownloadingAllThumbs(false);
    }
  };

  const handleUpdatePackField = (
    epIndex: number,
    field: keyof AiAwarenessPack,
    value: string
  ) => {
    setPacks((prev) => ({
      ...prev,
      [epIndex]: {
        ...(prev[epIndex] || DEFAULT_AWARENESS_PACKS[epIndex]),
        [field]: value,
      },
    }));
  };

  const handleCopyScript = async (epIndex: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedScriptEp(epIndex);
      setTimeout(() => setCopiedScriptEp(null), 1600);
    } catch {
      // fallback
    }
  };

  return (
    <section
      id="ai-video-generator"
      className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-10 border-t border-slate-200 dark:border-slate-800"
    >
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
            ఉచిత జెమిని LLM (gemini-4-hydrogen & gemini-3.8-flash-lite-tts) · ప్రజా సేవ అవగాహన
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            5 ప్రశ్నల AI థంబ్‌నెయిల్ & వీడియో జనరేటర్ స్టూడియో
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            ప్రభుత్వ ఉద్యోగులు మరియు పౌరులలో ప్రజా సేవ అవగాహన కోసం మొత్తం 5 ప్రశ్నలకు (Q1–Q5) ఉచిత AI LLM ద్వారా తెలుగు థంబ్‌నెయిల్స్, నాయకత్వ విశ్లేషణ, వాయిస్ ఓవర్ మరియు డౌన్‌లోడ్ చేసుకోగల వీడియోలను (.WebM) రూపొందించండి.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleGenerateLlmAwareness()}
            disabled={isGeneratingAllLlm}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isGeneratingAllLlm ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isGeneratingAllLlm
              ? '5 ప్రశ్నలకు AI స్క్రిప్ట్ రూపొందుతోంది...'
              : '5 ప్రశ్నలకు AI అవగాహన కంటెంట్ రూపొందించండి'}
          </button>

          <button
            type="button"
            onClick={handleDownloadAll5Thumbnails}
            disabled={isDownloadingAllThumbs}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#1F4E9E] text-white hover:bg-[#173d7e] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isDownloadingAllThumbs ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            మొత్తం 5 థంబ్‌నెయిల్స్ డౌన్‌లోడ్ (PNG)
          </button>
        </div>
      </div>

      {/* Control Bar: Custom AI Focus, Thumbnail Style, Video Format & Batch Video Button */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          {/* Custom LLM Educational Focus Prompt */}
          <div className="lg:col-span-4">
            <label
              htmlFor="ai-focus-input"
              className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5"
            >
              AI ప్రజా సేవ అవగాహన శైలి (ఐచ్ఛికం)
            </label>
            <input
              id="ai-focus-input"
              type="text"
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              placeholder="ఉదా: యువ ప్రభుత్వ ఉద్యోగులు & పౌర హక్కుల కోణంలో..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Thumbnail Visual Mode & Aspect */}
          <div className="lg:col-span-3 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              థంబ్‌నెయిల్ ఆర్ట్ & సైజు
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setUseEditorialArt(true)}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  useEditorialArt
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                ఎడిటోరియల్ ఆర్ట్
              </button>
              <button
                type="button"
                onClick={() => setUseEditorialArt(false)}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  !useEditorialArt
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                యానిమేటెడ్ SVG
              </button>
              <button
                type="button"
                onClick={() => setThumbAspect((a) => (a === '16:9' ? '1:1' : '16:9'))}
                className="px-2.5 py-2 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
              >
                {thumbAspect}
              </button>
            </div>
          </div>

          {/* Video Generator Settings (Aspect, Duration, Voice) */}
          <div className="lg:col-span-5 flex flex-wrap sm:flex-nowrap items-end gap-2">
            <div className="flex-1 min-w-[110px]">
              <label
                htmlFor="vid-aspect-select"
                className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5"
              >
                వీడియో సైజు
              </label>
              <select
                id="vid-aspect-select"
                value={videoAspect}
                onChange={(e) => setVideoAspect(e.target.value as '16:9' | '9:16')}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                <option value="16:9">16:9 (YouTube HD)</option>
                <option value="9:16">9:16 (Shorts / Reels)</option>
              </select>
            </div>

            <div className="flex-1 min-w-[125px]">
              <label
                htmlFor="vid-duration-select"
                className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5"
              >
                వీడియో నిడివి
              </label>
              <select
                id="vid-duration-select"
                value={videoDurationSec}
                onChange={(e) => setVideoDurationSec(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                <option value={18}>18 సెకన్లు (క్విక్ రీల్)</option>
                <option value={45}>45 సెకన్లు (షార్ట్ వీడియో)</option>
                <option value={120}>2:00 నిమిషాలు (పూర్తి ఎపిసోడ్)</option>
              </select>
            </div>

            <div className="w-28">
              <label
                htmlFor="tts-voice-select"
                className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5"
              >
                AI వాయిస్
              </label>
              <select
                id="tts-voice-select"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                <option value="Kore">Kore</option>
                <option value="Puck">Puck</option>
                <option value="Charon">Charon</option>
                <option value="Fenrir">Fenrir</option>
                <option value="Zephyr">Zephyr</option>
              </select>
            </div>
          </div>
        </div>

        {/* Batch Video Generation Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            ప్రతి ప్రశ్నకు విడిగా లేదా మొత్తం 5 ప్రశ్నలకు ఒకేసారి ఎడ్యుకేషనల్ వీడియో (.WebM) రికార్డ్ చేసి డౌన్‌లోడ్ చేసుకోవచ్చు.
          </div>

          <div className="flex items-center gap-2">
            {activeVideoEp !== null ? (
              <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                  Q{activeVideoEp + 1} రికార్డింగ్: {videoProgress}% ({videoPhaseLabel})
                </div>
                <button
                  type="button"
                  onClick={handleCancelVideoGeneration}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <XCircle className="w-3.5 h-3.5" /> రద్దు చేయండి
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleBatchGenerateAllVideos}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Film className="w-3.5 h-3.5" />
                మొత్తం 5 ప్రశ్నల వీడియోలు వరుసగా రూపొందించండి ({videoDurationSec}s × 5)
              </button>
            )}
          </div>
        </div>

        {/* Status / Error Alerts */}
        {llmError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-300 font-medium">
            గమనిక: {llmError}
          </div>
        )}
        {llmSuccessBanner && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
            ✓ {llmSuccessBanner}
          </div>
        )}
      </div>

      {/* All 5 Questions Cards: Thumbnail Preview + Editable AI Copy + TTS + Video Generator */}
      <div className="flex flex-col gap-8">
        {EPISODES.map((ep, idx) => {
          const pack = packs[idx] || DEFAULT_AWARENESS_PACKS[idx];
          const isThisVideoRecording = activeVideoEp === idx;
          const generatedVideo = generatedVideos[idx];
          const ttsBase64 = ttsAudioMap[idx];
          const ttsError = ttsErrorMap[idx];
          const isSingleLlmLoading = generatingSingleLlm === idx;

          return (
            <article
              key={ep.id}
              className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs"
            >
              {/* Card Top Bar */}
              <div
                className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white border-b-4"
                style={{
                  backgroundColor: ep.theme[0],
                  borderBottomColor: ep.theme[2],
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xl font-black font-mono tabular-nums"
                    style={{ color: ep.theme[2] }}
                  >
                    Q{idx + 1}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {ep.title}
                  </h3>
                  <span className="text-xs text-white/80">
                    · నాయకత్వ గుణం: {ep.attr}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerateLlmAwareness(idx)}
                    disabled={isSingleLlmLoading || isGeneratingAllLlm}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isSingleLlmLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    AI రీ-జనరేట్
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectEpisodeInStudio(idx)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    ప్రధాన స్టూడియోలో ప్లే
                  </button>
                </div>
              </div>

              {/* Card 2-Column Split: Left (Live Thumbnail & Generated Video Player) / Right (AI Awareness Copy, Script & Actions) */}
              <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Live Thumbnail Card + Video Output */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                  {/* Live High-Contrast Thumbnail Preview */}
                  <div
                    className={`gal-th ${thumbAspect === '16:9' ? 't16' : 't1'}`}
                    style={
                      {
                        '--b1': ep.theme[0],
                        '--b2': ep.theme[1],
                        '--ac': ep.theme[2],
                      } as React.CSSProperties
                    }
                  >
                    <div className="thl">
                      <div className="thb">
                        <img
                          src={LOGO_DATA_URI}
                          alt="Sreenath Solutions"
                          referrerPolicy="no-referrer"
                        />
                        <span>
                          <b>{(channelName || 'SREENATH SOLUTIONS').toUpperCase()}</b>
                          <small className="stage-tg">PUBLIC SERVICE AWARENESS</small>
                        </span>
                      </div>
                      <div className="thq">Q{idx + 1}</div>
                      <div className="tht">{pack.thumbnailHeadlineTe}</div>
                      <div className="thw">{pack.thumbnailBadgeTe}</div>
                      <div className="thf">
                        కర్మయోగి సంకల్పం · {ep.attr} · 100 కర్మ పాయింట్లు
                      </div>
                      <div className="thj">📲 మా వాట్సాప్ గ్రూప్‌లో చేరండి</div>
                    </div>

                    <div className="thr relative bg-slate-900">
                      {useEditorialArt && ep.imageUrl ? (
                        <img
                          src={ep.imageUrl}
                          alt={ep.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full"
                          dangerouslySetInnerHTML={{ __html: ep.svg }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Thumbnail & Video Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadEpisodeThumbnailPng(idx, '16:9', channelName, {
                          useEditorialArt,
                          customHeadline: pack.thumbnailHeadlineTe,
                          customBadge: pack.thumbnailBadgeTe,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#1F4E9E] text-white hover:bg-[#173d7e] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      16:9 థంబ్‌నెయిల్ PNG
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadEpisodeThumbnailPng(idx, '1:1', channelName, {
                          useEditorialArt,
                          customHeadline: pack.thumbnailHeadlineTe,
                          customBadge: pack.thumbnailBadgeTe,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      1:1 పోస్ట్ PNG
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGenerateSingleVideo(idx)}
                      disabled={activeVideoEp !== null || isBatchGeneratingVideos}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {isThisVideoRecording ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          రికార్డింగ్ {videoProgress}% ({videoPhaseLabel})
                        </>
                      ) : (
                        <>
                          <Film className="w-3.5 h-3.5" />
                          వీడియో రూపొందించండి ({videoAspect} · {videoDurationSec}s)
                        </>
                      )}
                    </button>
                  </div>

                  {/* Generated Video Preview & Download Box */}
                  {generatedVideo && (
                    <div className="rounded-xl bg-slate-900 p-3.5 border border-amber-400/70 text-white">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-amber-300">
                          ✓ Q{idx + 1} ఎడ్యుకేషనల్ వీడియో సిద్ధమైంది ({generatedVideo.aspect} ·{' '}
                          {generatedVideo.durationSec}s)
                        </span>
                        <a
                          href={generatedVideo.url}
                          download={generatedVideo.filename}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          వీడియో డౌన్‌లోడ్ (.WebM)
                        </a>
                      </div>
                      <video
                        src={generatedVideo.url}
                        controls
                        className="w-full max-h-[340px] rounded-lg bg-black"
                      />
                    </div>
                  )}
                </div>

                {/* Right Column: Editable AI Thumbnail Copy, Public Service Lesson, TTS & Narration Script */}
                <div className="lg:col-span-6 flex flex-col gap-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                        AI థంబ్‌నెయిల్ శీర్షిక (మార్చుకోవచ్చు)
                      </label>
                      <input
                        type="text"
                        value={pack.thumbnailHeadlineTe}
                        onChange={(e) =>
                          handleUpdatePackField(idx, 'thumbnailHeadlineTe', e.target.value)
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                        థంబ్‌నెయిల్ బ్యాడ్జ్ టెక్స్ట్
                      </label>
                      <input
                        type="text"
                        value={pack.thumbnailBadgeTe}
                        onChange={(e) =>
                          handleUpdatePackField(idx, 'thumbnailBadgeTe', e.target.value)
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Civic Awareness Lesson Box */}
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-3.5">
                    <div className="text-xs font-extrabold text-amber-700 dark:text-amber-400 mb-1">
                      ప్రజా సేవ అవగాహన పాఠం (Educational Takeaway)
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {pack.civicLessonTe}
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white">
                        ఆదర్శ నాయకత్వ దృక్పథం:
                      </strong>{' '}
                      {pack.bestApproachInsightTe}
                    </div>
                  </div>

                  {/* AI Video Voiceover Script + Gemini TTS WAV Generator */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        వీడియో వాయిస్ ఓవర్ స్క్రిప్ట్ (తెలుగు)
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleGenerateTts(idx)}
                          disabled={ttsLoadingEp === idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#1F4E9E] text-white hover:bg-[#173d7e] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {ttsLoadingEp === idx ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                          {ttsLoadingEp === idx
                            ? 'వాయిస్ సిద్ధమవుతోంది...'
                            : 'AI వాయిస్ ఓవర్ (WAV)'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyScript(idx, pack.videoScriptTe)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {copiedScriptEp === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> కాపీ అయింది
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> స్క్రిప్ట్ కాపీ
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={4}
                      value={pack.videoScriptTe}
                      onChange={(e) =>
                        handleUpdatePackField(idx, 'videoScriptTe', e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-sm text-slate-900 dark:text-slate-100 leading-relaxed"
                    />

                    {ttsError && (
                      <div className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                        {ttsError}
                      </div>
                    )}

                    {ttsBase64 && (
                      <div className="mt-2 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <audio
                          controls
                          src={`data:audio/wav;base64,${ttsBase64}`}
                          className="h-8 flex-1 min-w-[200px]"
                        />
                        <a
                          href={`data:audio/wav;base64,${ttsBase64}`}
                          download={`karmayogi-Q${idx + 1}-voiceover.wav`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" /> WAV డౌన్‌లోడ్
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
