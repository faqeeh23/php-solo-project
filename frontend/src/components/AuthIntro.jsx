export default function AuthIntro() {
  return <aside className="auth-intro">
    <span className="eyebrow">A little care goes a long way</span>
    <h2>A healthier smile.<br /><span>A simpler day.</span></h2>
    <p>Make room for your dental care. Find the right service, choose an available time, and keep every appointment in one place.</p>
    <div className="care-illustration" aria-hidden="true"><div className="care-orbit"></div>
      <svg viewBox="0 0 120 140" className="care-tooth" fill="none"><path d="M60 20C40 7 16 16 16 40c0 20 13 28 17 56 3 24 11 31 18 5l5-17c2-9 6-9 9 0l5 17c7 26 15 19 18-5 4-28 17-36 17-56 0-24-24-33-45-20Z" fill="currentColor" /><path d="M43 33c9 0 13 9 26 7" stroke="#a7d9cd" strokeWidth="5" strokeLinecap="round" /></svg>
      <span className="care-note note-top">Your care, your schedule</span><span className="care-note note-bottom"><span className="check-mark">✓</span> One less thing to worry about</span>
    </div>
    <ol className="care-steps"><li><span>01</span> Choose your service</li><li><span>02</span> Find your time</li><li><span>03</span> We’ll see you soon</li></ol>
  </aside>;
}
