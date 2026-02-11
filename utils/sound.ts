
// Utility to generate procedural sound effects using Web Audio API
// This avoids adding extra assets (mp3/wav) to the bundle

const playTone = (freq: number, type: OscillatorType, duration: number, delay = 0) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime + delay;
    osc.start(now);
    
    // Fade out to avoid clicking sound
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.stop(now + duration);
    
    // Cleanup
    setTimeout(() => {
        if(ctx.state !== 'closed') ctx.close();
    }, (duration + delay) * 1000 + 100);
    
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const playSuccessSound = () => {
  // High pitched pleasant "Ding"
  playTone(800, 'sine', 0.1);
  playTone(1200, 'sine', 0.2, 0.1);
};

export const playErrorSound = () => {
  // Low pitched "Buzz"
  playTone(150, 'sawtooth', 0.3);
  playTone(100, 'sawtooth', 0.3, 0.1);
};

export const playWarningSound = () => {
  // Two distinct beeps
  playTone(400, 'square', 0.1);
  playTone(400, 'square', 0.1, 0.15);
};
