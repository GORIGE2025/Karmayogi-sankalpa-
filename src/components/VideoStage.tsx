import React from 'react';
import {
  EPISODES,
  EPISODE_DURATION,
  LOGO_DATA_URI,
  OPTION_LETTERS,
  WHATSAPP_DISPLAY,
  getStageNarration,
} from '../data/episodesData';

interface VideoStageProps {
  epIndex: number;
  elapsedSeconds: number;
  aspect: '16:9' | '9:16';
  channelName: string;
  onJumpToSecond: (sec: number) => void;
  stageRef?: React.RefObject<HTMLDivElement | null>;
  useEditorialArt?: boolean;
}

export const VideoStage: React.FC<VideoStageProps> = ({
  epIndex,
  elapsedSeconds,
  aspect,
  channelName,
  onJumpToSecond,
  stageRef,
  useEditorialArt = true,
}) => {
  const d = EPISODES[epIndex];
  const n = epIndex + 1;
  const r = Math.min(EPISODE_DURATION - 0.01, Math.max(0, Math.floor(elapsedSeconds)));
  const { caption } = getStageNarration(epIndex, r);
  const progressPct = Math.min(100, Math.max(0, (elapsedSeconds / EPISODE_DURATION) * 100));

  const stageStyle = {
    '--b1': d.theme[0],
    '--b2': d.theme[1],
    '--ac': d.theme[2],
  } as React.CSSProperties;

  const renderStageBody = () => {
    const headerTag = (
      <div className="stage-vt">
        ప్రశ్న {n} / 5 · {d.title}
      </div>
    );

    if (r < 8) {
      return (
        <div key={`intro-${epIndex}`} className="stage-v in">
          <div className="stage-vt">ప్రభుత్వ ఉద్యోగుల నాయకత్వ పరీక్ష</div>
          <div className="stage-big">Q{n}</div>
          <div className="stage-vh">{d.title}</div>
          <div className="stage-vs stage-gold">మీరు ఏమి చేస్తారు?</div>
        </div>
      );
    }

    if (r < 34) {
      return (
        <div key={`scenario-${epIndex}`} className="stage-v">
          {headerTag}
          <div className="stage-vs">{d.s}</div>
        </div>
      );
    }

    if (r < 104) {
      const j = Math.min(4, Math.floor((r - 34) / 14));
      return (
        <div key={`opt-${epIndex}-${j}`} className="stage-v">
          {headerTag}
          <div className="stage-oc">
            <em>{OPTION_LETTERS[j]}</em>
            <span>{d.o[j]}</span>
          </div>
          <div className="stage-ln">{d.l[j]}</div>
          <div className="stage-dots">
            {[0, 1, 2, 3, 4].map((k) => (
              <b
                key={k}
                className={k === j ? 'a' : ''}
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToSecond(34 + k * 14);
                }}
                title={`ఎంపిక ${OPTION_LETTERS[k]} కి వెళ్ళండి`}
              >
                {OPTION_LETTERS[k]}
              </b>
            ))}
          </div>
        </div>
      );
    }

    if (r < 114) {
      return (
        <div key={`recap-${epIndex}`} className="stage-v">
          {headerTag}
          <div className="stage-vh">ఈ ప్రశ్న చూసేది</div>
          <div className="stage-vh stage-gold">{d.attr}</div>
          <div className="stage-vs">
            సరైన లేదా తప్పు సమాధానాలు లేవు.
            <br />
            మీరు ఏ ఎంపిక చేస్తారు? కామెంట్‌లో A, B, C, D లేదా E రాయండి.
          </div>
        </div>
      );
    }

    const nx = EPISODES[epIndex + 1];
    return (
      <div key={`outro-${epIndex}`} className="stage-v">
        <div className="stage-cta">👍 లైక్ · 🔔 సబ్‌స్క్రైబ్ · 💬 కామెంట్</div>
        <div className="stage-vs">
          {nx
            ? `తర్వాత: ప్రశ్న ${n + 1} · ${nx.title}`
            : 'ఇప్పుడు iGOT కర్మయోగిలో మీ బేస్‌లైన్ ప్రశ్నావళి, కర్మయోగి సంకల్పం పూర్తి చేయండి'}
        </div>
        <div className="stage-vt">{nx ? '' : '100 కర్మ పాయింట్లు పొందండి'}</div>
        <div className="stage-vt">📲 మా వాట్సాప్ గ్రూప్‌లో చేరండి</div>
        <div className="stage-ln">{WHATSAPP_DISPLAY}</div>
        <div className="stage-vt">SREENATH SOLUTIONS · TROUBLESHOOTER FOR ALL</div>
      </div>
    );
  };

  return (
    <div
      ref={stageRef}
      className={`karmayogi-stage ${aspect === '16:9' ? 'land' : 'port'}`}
      style={stageStyle}
    >
      {useEditorialArt && d.imageUrl ? (
        <div
          className="stage-bg"
          style={{ opacity: r < 8 ? 0.65 : 0.22 }}
        >
          <img
            src={d.imageUrl}
            alt={d.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="stage-bg"
          style={{ opacity: r < 8 ? 1 : 0.25 }}
          dangerouslySetInnerHTML={{ __html: d.svg }}
        />
      )}
      <div className="stage-ch">
        <img src={LOGO_DATA_URI} alt={channelName || 'Sreenath Solutions'} />
        <span>
          <span>{channelName || 'Sreenath Solutions'}</span>
          <small className="stage-tg">TROUBLESHOOTER FOR ALL</small>
        </span>
      </div>

      {renderStageBody()}

      <div className="stage-cap">{caption}</div>
      <div className="stage-pg" style={{ width: `${progressPct}%` }} />
    </div>
  );
};
