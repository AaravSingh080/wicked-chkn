import React from 'react';

export default function Splash() {
  return (
    <div
      className="fixed inset-0 z-[60] max-w-[420px] mx-auto flex flex-col items-center justify-center gap-5 overflow-hidden"
      style={{ background: '#D92B21' }}
    >
      {/* diagonal poster stripes */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'repeating-linear-gradient(-45deg, rgba(74,14,11,.16) 0 18px, transparent 18px 36px)' }}
      />
      <div
        className="relative w-[92px] h-[92px] rounded-lg flex items-center justify-center -rotate-3"
        style={{ background: '#4A0E0B', border: '3px solid #FFF3EC', boxShadow: '6px 6px 0 rgba(0,0,0,.35)' }}
      >
        <span className="font-display text-white" style={{ fontSize: 38 }}>
          WC
        </span>
      </div>
      <div className="relative font-display text-white uppercase text-[26px] tracking-[1px]">Wicked Chkn</div>
      <div className="relative text-[12.5px] font-bold" style={{ color: '#FFE3DC' }}>
        Firing up the fryer…
      </div>
      <div className="relative spinner" style={{ borderColor: 'rgba(255,243,236,.3)', borderTopColor: '#FFF3EC' }} />
    </div>
  );
}
