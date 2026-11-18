import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { EPISODES, LOGO_DATA_URI } from '../data/episodesData';
import { downloadEpisodeThumbnailPng } from '../utils/exportThumbnailPng';

interface ThumbnailsGalleryProps {
  activeEpisode: number;
  channelName: string;
  onSelectEpisode: (epIndex: number, scrollToTop?: boolean) => void;
}

export const ThumbnailsGallery: React.FC<ThumbnailsGalleryProps> = ({
  activeEpisode,
  channelName,
  onSelectEpisode,
}) => {
  const [galleryMode, setGalleryMode] = useState<'t16' | 't1'>('t16');
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const handleDownloadPng = async (
    e: React.MouseEvent,
    epIndex: number,
    aspect: '16:9' | '1:1'
  ) => {
    e.stopPropagation();
    const key = `${epIndex}-${aspect}`;
    setDownloadingKey(key);
    try {
      await downloadEpisodeThumbnailPng(epIndex, aspect, channelName);
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <section
      id="thumbnails"
      className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-10 border-t border-slate-200 dark:border-slate-800"
    >
      {/* Main 16:9 & 1:1 Studio Gallery */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
            సోషల్ మీడియా & యూట్యూబ్ స్టూడియో
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            5 ఎపిసోడ్‌ల థంబ్‌నెయిల్స్, పోస్ట్‌లు
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            ఎపిసోడ్ తెరవడానికి కార్డ్ నొక్కండి. యూట్యూబ్ థంబ్‌నెయిల్ లేదా సోషల్ పోస్ట్‌గా వాడటానికి కార్డ్ స్క్రీన్‌షాట్ తీసుకోండి లేదా నేరుగా PNG డౌన్‌లోడ్ చేయండి.
          </p>
        </div>

        {/* Segmented Control for 16:9 vs 1:1 */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setGalleryMode('t16')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              galleryMode === 't16'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            16:9 థంబ్‌నెయిల్
          </button>
          <button
            type="button"
            onClick={() => setGalleryMode('t1')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              galleryMode === 't1'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            1:1 పోస్ట్
          </button>
        </div>
      </div>

      <div
        className={`grid gap-5 ${
          galleryMode === 't16'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {EPISODES.map((ep, i) => {
          const isSel = i === activeEpisode;
          const aspectLabel = galleryMode === 't16' ? '16:9' : '1:1';
          const dlKey = `${i}-${aspectLabel}`;

          return (
            <div key={ep.id} className="flex flex-col gap-2">
              <div
                onClick={() => onSelectEpisode(i, true)}
                className={`gal-th ${galleryMode}${isSel ? ' sel' : ''}`}
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
                    <img src={LOGO_DATA_URI} alt="Sreenath Solutions" />
                    <span>
                      <b>{(channelName || 'SREENATH SOLUTIONS').toUpperCase()}</b>
                      <small className="stage-tg">TROUBLESHOOTER FOR ALL</small>
                    </span>
                  </div>
                  <div className="thq">Q{i + 1}</div>
                  <div className="tht">{ep.shortTitle}</div>
                  <div className="thw">మీరు ఏమి చేస్తారు?</div>
                  <div className="thf">కర్మయోగి సంకల్పం · 100 కర్మ పాయింట్లు</div>
                  <div className="thj">📲 మా వాట్సాప్ గ్రూప్‌లో చేరండి</div>
                </div>
                <div
                  className="thr"
                  dangerouslySetInnerHTML={{ __html: ep.svg }}
                />
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Q{i + 1} · {ep.title}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDownloadPng(e, i, aspectLabel)}
                  disabled={downloadingKey === dlKey}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingKey === dlKey ? 'సిద్ధమవుతోంది...' : `${aspectLabel} PNG డౌన్‌లోడ్`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Classic Banner Thumbnail Posts (#posts) */}
      <div className="mt-12">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          Thumbnail posts · ఎపిసోడ్ తెరవడానికి కార్డ్‌పై నొక్కండి
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {EPISODES.map((d, i) => (
            <div
              key={d.id}
              onClick={() => onSelectEpisode(i, true)}
              className={`thumb-post-card transition-transform hover:-translate-y-0.5 ${
                i === activeEpisode ? 'ring-3 ring-amber-400' : ''
              }`}
            >
              <div
                className="ts"
                dangerouslySetInnerHTML={{ __html: d.svg }}
              />
              <div className="tx">
                <div className="t1">LEADERSHIP AS A MISSION</div>
                <div className="t2">Q{i + 1}</div>
                <div className="t3">{d.title}</div>
                <div className="t4">మీరు ఏమి చేస్తారు?</div>
              </div>
              <div className="t5">
                iGOT Karmayogi · Karmayogi Sankalpa · 100 Karma Points
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
