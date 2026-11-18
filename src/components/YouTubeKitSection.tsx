import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { EPISODES, buildYouTubeKit } from '../data/episodesData';

interface YouTubeKitSectionProps {
  activeEpisode: number;
  onSelectEpisode: (epIndex: number) => void;
}

export const YouTubeKitSection: React.FC<YouTubeKitSectionProps> = ({
  activeEpisode,
  onSelectEpisode,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | 'all' | null>(null);
  const kitItems = buildYouTubeKit(activeEpisode);
  const ep = EPISODES[activeEpisode];

  const handleCopy = async (text: string, idx: number | 'all') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleDownloadTxt = () => {
    const fullText = kitItems
      .map((item) => `=== ${item.label} ===\n${item.value}`)
      .join('\n\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube-kit-Q${activeEpisode + 1}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      id="youtube-kit"
      className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-10 border-t border-slate-200 dark:border-slate-800"
    >
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
              క్రియేటర్ మెటాడేటా & అధ్యాయాలు
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              యూట్యూబ్ కిట్ · ఎపిసోడ్ {activeEpisode + 1} ({ep.title})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {EPISODES.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelectEpisode(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  idx === activeEpisode
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Q{idx + 1}
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                handleCopy(
                  kitItems.map((k) => `${k.label}:\n${k.value}`).join('\n\n'),
                  'all'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-800 text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedIndex === 'all' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedIndex === 'all' ? 'అన్నీ కాపీ అయ్యాయి' : 'అన్నీ కాపీ'}
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              .TXT
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
          {/* Left column: Title, Tags, Thumbnail text, Pinned comment */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {[kitItems[0], kitItems[2], kitItems[3], kitItems[4]].map((item) => {
              const origIdx = kitItems.indexOf(item);
              const isCopied = copiedIndex === origIdx;
              return (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <label className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span>{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.value, origIdx)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isCopied
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-blue-800 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isCopied ? 'కాపీ అయింది' : 'కాపీ'}
                    </button>
                  </label>
                  <textarea
                    rows={item.rows}
                    readOnly
                    value={item.value}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 p-2.5 text-sm leading-relaxed focus:outline-none focus:border-blue-600"
                  />
                </div>
              );
            })}
          </div>

          {/* Right column: Full Description with Chapters */}
          <div className="lg:col-span-7 flex flex-col gap-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>{kitItems[1].label}</span>
              <button
                type="button"
                onClick={() => handleCopy(kitItems[1].value, 1)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  copiedIndex === 1
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-blue-800 text-white hover:bg-blue-700'
                }`}
              >
                {copiedIndex === 1 ? 'కాపీ అయింది' : 'కాపీ'}
              </button>
            </label>
            <textarea
              rows={16}
              readOnly
              value={kitItems[1].value}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              className="w-full h-full min-h-[320px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 p-3 text-sm leading-relaxed focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
