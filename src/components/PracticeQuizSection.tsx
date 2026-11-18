import React, { useState } from 'react';
import { Check, Copy, Play, RotateCcw } from 'lucide-react';
import {
  EPISODES,
  OPTION_LETTERS,
  WHATSAPP_URL,
} from '../data/episodesData';

interface PracticeQuizSectionProps {
  activeEpisode: number;
  selectedAnswers: Record<number, number>;
  onSelectAnswer: (epIndex: number, optionIndex: number) => void;
  onResetAnswers: () => void;
  onPlayEpisodeAtSecond: (epIndex: number, sec: number) => void;
}

export const PracticeQuizSection: React.FC<PracticeQuizSectionProps> = ({
  activeEpisode,
  selectedAnswers,
  onSelectAnswer,
  onResetAnswers,
  onPlayEpisodeAtSecond,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const answeredCount = Object.keys(selectedAnswers).length;

  const generateSummaryText = () => {
    const lines = EPISODES.map((ep, idx) => {
      const pick = selectedAnswers[idx];
      const letter = pick !== undefined ? OPTION_LETTERS[pick] : '—';
      const lens = pick !== undefined ? ep.l[pick] : 'ఇంకా ఎంచుకోలేదు';
      return `Q${idx + 1} (${ep.shortTitle}): ఎంపిక ${letter} — ${lens}`;
    });
    return `కర్మయోగి సంకల్పం · నా బేస్‌లైన్ నాయకత్వ ఎంపికలు:\n${lines.join(
      '\n'
    )}\n\nSreenath Solutions · ${WHATSAPP_URL}`;
  };

  const handleCopySummary = async () => {
    const text = generateSummaryText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      // Fallback
    }
  };

  return (
    <section
      id="practice-quiz"
      className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-10 border-t border-slate-200 dark:border-slate-800"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
            బేస్‌లైన్ సిట్యుయేషనల్ జడ్జ్‌మెంట్ ప్రాక్టీస్ · 5 ప్రశ్నలు
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            ఇంటరాక్టివ్ ప్రశ్నావళి & స్లైడ్ డెక్
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            ప్రతి పరిస్థితికి మీరు చేసే ఎంపిక (A–E)పై నొక్కండి. సరైన లేదా తప్పు సమాధానాలు లేవు — ప్రతి ఎంపిక మీ నాయకత్వ శైలిని చూపిస్తుంది.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 font-mono tabular-nums">
            పూర్తయినవి: {answeredCount} / 5
          </div>
          {answeredCount > 0 && (
            <>
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSummary ? 'కాపీ అయింది' : 'నా ఎంపికలు కాపీ చేయండి'}
              </button>
              <button
                type="button"
                onClick={onResetAnswers}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                రీసెట్
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {EPISODES.map((ep, epIdx) => {
          const userPick = selectedAnswers[epIdx];
          const isCurrentEp = activeEpisode === epIdx;

          return (
            <article
              key={ep.id}
              className={`rounded-xl bg-white dark:bg-slate-900 border transition-colors overflow-hidden ${
                isCurrentEp
                  ? 'border-amber-500/80 dark:border-amber-400/80'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Slide Header matching original .sh */}
              <div
                className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white border-b-4"
                style={{
                  backgroundColor: ep.theme[0],
                  borderBottomColor: ep.theme[2],
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="font-extrabold text-xl font-mono tabular-nums"
                    style={{ color: ep.theme[2] }}
                  >
                    Q{epIdx + 1}
                  </span>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    {ep.title}
                  </h3>
                  <span className="text-xs text-white/80 hidden sm:inline">
                    · {ep.attr}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {userPick !== undefined && (
                    <span className="text-xs font-bold text-amber-300">
                      మీ ఎంపిక: {OPTION_LETTERS[userPick]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onPlayEpisodeAtSecond(epIdx, 0)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    ఎపిసోడ్ ప్లే చేయండి
                  </button>
                </div>
              </div>

              {/* Slide Body */}
              <div className="p-5">
                <div className="text-xs font-extrabold text-amber-700 dark:text-amber-400 mb-1.5">
                  నాయకత్వ కోణం: {ep.attr}
                </div>
                <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed mb-5">
                  {ep.s}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {ep.o.map((optText, optIdx) => {
                    const isPicked = userPick === optIdx;
                    const optStartSec = 34 + optIdx * 14;

                    return (
                      <div
                        key={optIdx}
                        onClick={() => onSelectAnswer(epIdx, optIdx)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectAnswer(epIdx, optIdx);
                          }
                        }}
                        className={`group relative rounded-xl p-4 pl-13 border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isPicked
                            ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-500 dark:border-amber-400'
                            : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600'
                        }`}
                      >
                        <em
                          className={`not-italic font-extrabold text-sm w-7 h-7 rounded-full flex items-center justify-center absolute left-3.5 top-4 transition-transform ${
                            isPicked
                              ? 'bg-amber-400 text-slate-950 scale-105'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 group-hover:bg-amber-400 group-hover:text-slate-950'
                          }`}
                        >
                          {OPTION_LETTERS[optIdx]}
                        </em>

                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                          {optText}
                        </p>

                        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                            {ep.l[optIdx]}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayEpisodeAtSecond(epIdx, optStartSec);
                            }}
                            title="వీడియోలో ఈ ఎంపికను చూడండి"
                            className="text-[11px] font-mono tabular-nums font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            ▶ 0:{optStartSec < 60 ? optStartSec : `1:${String(optStartSec - 60).padStart(2, '0')}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-5 pb-3.5 text-xs italic text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <span>
                  సూచన: సరైన లేదా తప్పు సమాధానం లేదు · ఈ ప్రశ్న &ldquo;{ep.attr}&rdquo; ని పరీక్షిస్తుంది.
                </span>
                <span>కర్మయోగి సంకల్పం · 100 కర్మ పాయింట్లు</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
