// Web Audio synth effects & Speech utilities for Camp Game Smartphone

let globalAudioCtx: AudioContext | null = null;
const globalActiveSources = new Set<AudioBufferSourceNode>();
const globalActiveOscillators = new Set<OscillatorNode>();
const globalAbortControllers = new Set<AbortController>();

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    globalAudioCtx = new AudioCtx();
  }
  return globalAudioCtx;
}

export function unlockAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (err) {
    console.debug('AudioContext unlock error:', err);
  }
}

let activeBangarangStop: (() => void) | null = null;
let activePigStop: (() => void) | null = null;

// Master stop to cancel ALL sound, voices, oscillators, and fetches immediately
export function stopAllAudioPlayback(): void {
  // 0. Instantly hard-mute and kill Bangarang if active
  if (activeBangarangStop) {
    try {
      activeBangarangStop();
    } catch {}
    activeBangarangStop = null;
  }

  // Instantly hard-mute and kill Pig loop if active
  if (activePigStop) {
    try {
      activePigStop();
    } catch {}
    activePigStop = null;
  }

  // 1. Abort all TTS / API fetches
  for (const ac of globalAbortControllers) {
    try {
      ac.abort();
    } catch {}
  }
  globalAbortControllers.clear();

  // 2. Stop all Web Audio buffer sources
  for (const src of globalActiveSources) {
    try {
      src.stop();
      src.disconnect();
    } catch {}
  }
  globalActiveSources.clear();

  // 3. Stop all oscillators (beeps, rings)
  for (const osc of globalActiveOscillators) {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  }
  globalActiveOscillators.clear();

  // 4. Cancel browser speech if any
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

// DTMF standard frequencies for telephone keypad
const DTMF_FREQS: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

// Play authentic telephone keypad DTMF dual-tone on tap
export function playDtmfTone(char: string, durationMs: number = 130): void {
  try {
    unlockAudioContext();
    const ctx = getAudioContext();
    if (!ctx) return;

    const freqs = DTMF_FREQS[char] || [440, 880];
    const now = ctx.currentTime;
    const dur = durationMs / 1000;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freqs[0], now);
    osc2.frequency.setValueAtTime(freqs[1], now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.setValueAtTime(0.12, now + dur - 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.01);
    osc2.stop(now + dur + 0.01);
  } catch (e) {
    // audio context blocked
  }
}

// European telephone ringback tone: 425Hz (1 sec tone, 3 sec pause)
export function playRingtone(): () => void {
  unlockAudioContext();
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let isCancelled = false;
  let timerId: any = null;
  let activeOsc: OscillatorNode | null = null;

  const cycle = () => {
    if (isCancelled || !ctx || ctx.state === 'closed') return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      activeOsc = osc;
      globalActiveOscillators.add(osc);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(425, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + 1.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.onended = () => {
        globalActiveOscillators.delete(osc);
      };

      osc.start(now);
      osc.stop(now + 1.25);

      timerId = setTimeout(cycle, 3500);
    } catch {
      // ignore
    }
  };

  cycle();

  return () => {
    isCancelled = true;
    if (timerId) clearTimeout(timerId);
    if (activeOsc) {
      try {
        activeOsc.stop();
        activeOsc.disconnect();
        globalActiveOscillators.delete(activeOsc);
      } catch {}
    }
  };
}

// Rapid busy tone (Dummy: "Proste pípa") - continuous endless busy tone until user hangs up
export function playBusyTone(onFinish?: () => void): () => void {
  unlockAudioContext();
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let isCancelled = false;
  let timer: any = null;

  const beep = () => {
    if (isCancelled) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      globalActiveOscillators.add(osc);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(425, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.setValueAtTime(0.18, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.onended = () => {
        globalActiveOscillators.delete(osc);
      };

      osc.start(now);
      osc.stop(now + 0.28);
    } catch {}

    timer = setTimeout(beep, 480);
  };

  beep();

  return () => {
    isCancelled = true;
    if (timer) clearTimeout(timer);
  };
}

// Dummy: "Bangarang Hotline" (Dubstep synth beat generator - loops continuously until user hangs up)
export function playBangarangLoop(onFinish?: () => void, maxSteps?: number): () => void {
  unlockAudioContext();
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  // If another instance of Bangarang is already running, kill it instantly
  if (activeBangarangStop) {
    try {
      activeBangarangStop();
    } catch {}
    activeBangarangStop = null;
  }

  let isCancelled = false;
  let beatTimer: any = null;
  const activeNodes: any[] = [];

  // Dedicated Master Gain Node:
  // All voices (kick, snare, hi-hat, bass growl) connect directly to this node.
  // Muting & disconnecting this node produces an instant 0ms hard silence the microsecond the call is ended.
  const bangarangMasterGain = ctx.createGain();
  bangarangMasterGain.gain.setValueAtTime(1, ctx.currentTime);
  bangarangMasterGain.connect(ctx.destination);

  const registerNode = (node: any) => {
    activeNodes.push(node);
    if ('playbackRate' in node) {
      globalActiveSources.add(node);
    } else if ('frequency' in node) {
      globalActiveOscillators.add(node);
    }
  };

  const triggerKick = (time: number) => {
    if (isCancelled || !ctx || ctx.state === 'closed') return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(155, time);
      osc.frequency.exponentialRampToValueAtTime(32, time + 0.17);
      gain.gain.setValueAtTime(0.42, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);
      osc.connect(gain);
      gain.connect(bangarangMasterGain);
      osc.start(time);
      osc.stop(time + 0.2);
      registerNode(osc);
    } catch {}
  };

  const triggerSnare = (time: number) => {
    if (isCancelled || !ctx || ctx.state === 'closed') return;
    try {
      // Noise burst for crisp dubstep snare
      const bufferSize = Math.floor(ctx.sampleRate * 0.14);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1100, time);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(bangarangMasterGain);

      noise.start(time);
      noise.stop(time + 0.14);
      registerNode(noise);

      // Snare tonal body
      const tone = ctx.createOscillator();
      const toneGain = ctx.createGain();
      tone.frequency.setValueAtTime(195, time);
      tone.frequency.exponentialRampToValueAtTime(85, time + 0.09);
      toneGain.gain.setValueAtTime(0.25, time);
      toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      tone.connect(toneGain);
      toneGain.connect(bangarangMasterGain);
      tone.start(time);
      tone.stop(time + 0.1);
      registerNode(tone);
    } catch {}
  };

  const triggerHiHat = (time: number) => {
    if (isCancelled || !ctx || ctx.state === 'closed') return;
    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.035);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7500, time);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(bangarangMasterGain);
      noise.start(time);
      noise.stop(time + 0.035);
      registerNode(noise);
    } catch {}
  };

  const triggerBassGrowl = (time: number, freq: number = 55) => {
    if (isCancelled || !ctx || ctx.state === 'closed') return;
    try {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, time);
      filter.frequency.linearRampToValueAtTime(2100, time + 0.09);
      filter.frequency.exponentialRampToValueAtTime(260, time + 0.24);

      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.26);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(bangarangMasterGain);

      osc.start(time);
      osc.stop(time + 0.28);
      registerNode(osc);
    } catch {}
  };

  let step = 0;
  const bpm = 110;
  const stepInterval = (60 / bpm / 2) * 1000;

  const tick = () => {
    if (isCancelled || !ctx || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const beat16 = step % 16;

    // Dubstep half-time drum pattern
    if (beat16 === 0 || beat16 === 7 || beat16 === 10) triggerKick(now);
    if (beat16 === 4 || beat16 === 12) triggerSnare(now);
    if (beat16 % 2 === 1) triggerHiHat(now);

    // Dynamic Skrillex-style bass growls
    if (beat16 === 1 || beat16 === 2 || beat16 === 5 || beat16 === 8 || beat16 === 13 || beat16 === 14) {
      const notes = [46, 58, 69, 78, 52, 62, 50, 72];
      const pitch = notes[step % notes.length];
      triggerBassGrowl(now, pitch);
    }

    step++;
    if (typeof maxSteps === 'number' && step >= maxSteps) {
      isCancelled = true;
      if (onFinish) {
        setTimeout(onFinish, 500);
      }
      return;
    }
    beatTimer = setTimeout(tick, stepInterval);
  };

  tick();

  const stopBangarang = () => {
    if (isCancelled) return;
    isCancelled = true;

    if (activeBangarangStop === stopBangarang) {
      activeBangarangStop = null;
    }

    if (beatTimer) {
      clearTimeout(beatTimer);
      beatTimer = null;
    }

    // 1. Instant sub-millisecond hard silence via master gain cutoff
    try {
      bangarangMasterGain.gain.cancelScheduledValues(ctx.currentTime);
      bangarangMasterGain.gain.setValueAtTime(0, ctx.currentTime);
      bangarangMasterGain.disconnect();
    } catch {}

    // 2. Stop and disconnect all individual nodes
    activeNodes.forEach((node) => {
      try {
        if ('stop' in node) {
          try {
            node.stop(0);
          } catch {
            try {
              node.stop();
            } catch {}
          }
        }
        node.disconnect?.();
        globalActiveOscillators.delete(node);
        globalActiveSources.delete(node);
      } catch {}
    });
    activeNodes.length = 0;
  };

  activeBangarangStop = stopBangarang;

  return stopBangarang;
}

// Dummy: "Krochajúce prasa" (Rubber squeaking pig toy grunt & squeak loop or user provided pig.m4a)
export function playPigLoop(): () => void {
  unlockAudioContext();
  const ctx = getAudioContext();

  if (activePigStop) {
    try {
      activePigStop();
    } catch {}
    activePigStop = null;
  }

  let isCancelled = false;
  let loopTimer: any = null;
  let audioElem: HTMLAudioElement | null = null;
  const activeNodes: any[] = [];

  // Try playing user m4a/mp3 if present
  try {
    const audioCandidates = ['/assets/pig.m4a', '/pig.m4a', '/assets/prasa.m4a', '/prasa.m4a', '/assets/pig.mp3', '/pig.mp3'];
    const tryPlayFile = (index: number) => {
      if (index >= audioCandidates.length || isCancelled) return false;
      const el = new Audio(audioCandidates[index]);
      el.loop = true;
      el.play()
        .then(() => {
          if (isCancelled) {
            el.pause();
            return;
          }
          audioElem = el;
          if (loopTimer) clearTimeout(loopTimer);
        })
        .catch(() => {
          tryPlayFile(index + 1);
        });
      return true;
    };
    tryPlayFile(0);
  } catch {}

  const pigMasterGain = ctx ? ctx.createGain() : null;
  if (pigMasterGain && ctx) {
    pigMasterGain.gain.setValueAtTime(1, ctx.currentTime);
    pigMasterGain.connect(ctx.destination);
  }

  const triggerPigSqueakAndGrunt = () => {
    if (isCancelled || !ctx || !pigMasterGain || ctx.state === 'closed') return;
    if (audioElem && !audioElem.paused) return; // Audio file is playing!
    const now = ctx.currentTime;

    try {
      // 1. High-pitched rubber compression squeal (squeaker whistling)
      const squeakOsc = ctx.createOscillator();
      const squeakGain = ctx.createGain();
      squeakOsc.type = 'triangle';
      squeakOsc.frequency.setValueAtTime(650, now);
      squeakOsc.frequency.exponentialRampToValueAtTime(1380, now + 0.12);
      squeakOsc.frequency.linearRampToValueAtTime(800, now + 0.22);

      squeakGain.gain.setValueAtTime(0.001, now);
      squeakGain.gain.linearRampToValueAtTime(0.28, now + 0.04);
      squeakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      squeakOsc.connect(squeakGain);
      squeakGain.connect(pigMasterGain);
      squeakOsc.start(now);
      squeakOsc.stop(now + 0.26);
      activeNodes.push(squeakOsc);

      // 2. Heavy guttural pig snort/grunt (fluttering low raspy saw)
      const gruntOsc = ctx.createOscillator();
      const gruntGain = ctx.createGain();
      const gruntFilter = ctx.createBiquadFilter();

      gruntOsc.type = 'sawtooth';
      gruntOsc.frequency.setValueAtTime(110, now + 0.14);
      gruntOsc.frequency.linearRampToValueAtTime(75, now + 0.48);

      // Flutter LFO to create vibrating pig snort / vocal fry
      const flutterOsc = ctx.createOscillator();
      const flutterGain = ctx.createGain();
      flutterOsc.type = 'square';
      flutterOsc.frequency.setValueAtTime(26, now + 0.14);
      flutterGain.gain.setValueAtTime(35, now + 0.14);
      flutterOsc.connect(flutterGain);
      flutterGain.connect(gruntOsc.frequency);

      flutterOsc.start(now + 0.14);
      flutterOsc.stop(now + 0.52);
      activeNodes.push(flutterOsc);

      gruntFilter.type = 'bandpass';
      gruntFilter.frequency.setValueAtTime(340, now + 0.14);
      gruntFilter.Q.setValueAtTime(3.8, now + 0.14);

      gruntGain.gain.setValueAtTime(0.001, now + 0.14);
      gruntGain.gain.linearRampToValueAtTime(0.42, now + 0.18);
      gruntGain.gain.setValueAtTime(0.38, now + 0.36);
      gruntGain.gain.exponentialRampToValueAtTime(0.001, now + 0.50);

      gruntOsc.connect(gruntFilter);
      gruntFilter.connect(gruntGain);
      gruntGain.connect(pigMasterGain);

      gruntOsc.start(now + 0.14);
      gruntOsc.stop(now + 0.52);
      activeNodes.push(gruntOsc);

      // 3. Follow-up short grunt (oink!)
      setTimeout(() => {
        if (isCancelled || !ctx || ctx.state === 'closed') return;
        const t2 = ctx.currentTime;
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(95, t2);
        subOsc.frequency.linearRampToValueAtTime(60, t2 + 0.22);
        subGain.gain.setValueAtTime(0.35, t2);
        subGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.24);
        subOsc.connect(subGain);
        subGain.connect(pigMasterGain);
        subOsc.start(t2);
        subOsc.stop(t2 + 0.25);
        activeNodes.push(subOsc);
      }, 550);

    } catch {}

    // Next squeeze pattern in 900ms - 1400ms
    const nextInterval = 900 + Math.random() * 500;
    loopTimer = setTimeout(triggerPigSqueakAndGrunt, nextInterval);
  };

  triggerPigSqueakAndGrunt();

  const stopPig = () => {
    if (isCancelled) return;
    isCancelled = true;
    if (activePigStop === stopPig) activePigStop = null;
    if (loopTimer) clearTimeout(loopTimer);

    if (audioElem) {
      try {
        audioElem.pause();
        audioElem.currentTime = 0;
      } catch {}
      audioElem = null;
    }

    if (pigMasterGain && ctx) {
      try {
        pigMasterGain.gain.cancelScheduledValues(ctx.currentTime);
        pigMasterGain.gain.setValueAtTime(0, ctx.currentTime);
        pigMasterGain.disconnect();
      } catch {}
    }

    activeNodes.forEach((node) => {
      try {
        if ('stop' in node) {
          try {
            node.stop(0);
          } catch {
            node.stop?.();
          }
        }
        node.disconnect?.();
      } catch {}
    });
    activeNodes.length = 0;
  };

  activePigStop = stopPig;
  return stopPig;
}

// Dummy: "Hovor sa nepodaril" (Official automated telecom operator message in 100% natural Slovak) - plays once then hangs up
export function playTelecomOperatorNotice(customMsg?: string, onFinish?: () => void): () => void {
  unlockAudioContext();
  const ctx = getAudioContext();
  let isCancelled = false;
  let activeAudioStop: (() => void) | null = null;
  let finishTimer: any = null;
  const msgText =
    customMsg ||
    'Volané číslo je momentálne nedostupné alebo neexistuje. Skontrolujte prosím telefónne číslo a voľbu opakujte. Hovor sa nepodaril.';

  // 1. Play European telecom tri-tone (950Hz, 1400Hz, 1800Hz)
  if (ctx) {
    try {
      const now = ctx.currentTime;
      const tones = [950, 1400, 1800];
      tones.forEach((f, idx) => {
        const t = now + idx * 0.32;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        globalActiveOscillators.add(osc);

        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);

        osc.onended = () => {
          globalActiveOscillators.delete(osc);
        };
      });
    } catch {}
  }

  // 2. Play natural Slovak neural operator speech from server
  const playNotice = () => {
    if (isCancelled) return;
    activeAudioStop = playSlovakAudio(
      {
        text: msgText,
        voice: 'aoede',
        agent: 'operator',
      },
      () => {
        // When notice finishes playing once, wait brief 1 second and finish call
        if (!isCancelled) {
          finishTimer = setTimeout(() => {
            if (!isCancelled) onFinish?.();
          }, 1000);
        }
      },
      () => {
        if (!isCancelled) {
          finishTimer = setTimeout(() => {
            if (!isCancelled) onFinish?.();
          }, 1000);
        }
      }
    );
  };

  const timer = setTimeout(playNotice, 1050);

  return () => {
    isCancelled = true;
    clearTimeout(timer);
    if (finishTimer) clearTimeout(finishTimer);
    if (activeAudioStop) {
      activeAudioStop();
      activeAudioStop = null;
    }
  };
}

export interface PlaySlovakOptions {
  text?: string;
  audioBase64?: string;
  audioBuffer?: AudioBuffer;
  voice?: string;
  agent?: string;
}

// Play natural Slovak speech via server neural TTS
export function playSlovakAudio(
  input: string | PlaySlovakOptions,
  onEnd?: () => void,
  onError?: (err: any) => void
): () => void {
  let isCancelled = false;
  let activeSrc: AudioBufferSourceNode | null = null;
  let abortController: AbortController | null = null;

  const stop = () => {
    isCancelled = true;
    if (abortController) {
      try {
        abortController.abort();
        globalAbortControllers.delete(abortController);
      } catch {}
      abortController = null;
    }
    if (activeSrc) {
      try {
        activeSrc.stop();
        activeSrc.disconnect();
        globalActiveSources.delete(activeSrc);
      } catch {}
      activeSrc = null;
    }
  };

  const rawText = typeof input === 'string' ? input : input.text || '';
  const audioBase64 = typeof input === 'object' ? input.audioBase64 : undefined;
  const audioBuffer = typeof input === 'object' ? input.audioBuffer : undefined;
  const voice = typeof input === 'object' ? input.voice || 'aoede' : 'aoede';
  const agent = typeof input === 'object' ? input.agent || 'operator' : 'operator';

  // Instant playback if pre-decoded AudioBuffer is provided
  if (audioBuffer) {
    const ctx = getAudioContext();
    if (ctx) {
      if (isCancelled) return () => {};
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.playbackRate.value = 1.04; // Natural, clear, authentic speech tempo
      src.connect(ctx.destination);
      activeSrc = src;
      globalActiveSources.add(src);

      src.onended = () => {
        globalActiveSources.delete(src);
        if (!isCancelled) onEnd?.();
      };
      src.start(0);
      return stop;
    }
  }

  const cleanText = rawText
    .replace(/[*_~`]/g, '')
    .replace(/\[QUEST_COMPLETED:[^\]]+\]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();

  // If audioBase64 is directly provided from /api/chat:
  if (audioBase64) {
    try {
      const binaryString = window.atob(audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const ctx = getAudioContext();
      if (ctx) {
        ctx.decodeAudioData(
          bytes.buffer.slice(0),
          (decoded) => {
            if (isCancelled) return;
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            src.playbackRate.value = 1.04; // Natural, clear, authentic speech tempo
            src.connect(ctx.destination);
            activeSrc = src;
            globalActiveSources.add(src);

            src.onended = () => {
              globalActiveSources.delete(src);
              if (!isCancelled) onEnd?.();
            };
            src.start(0);
          },
          (err) => {
            console.warn('Decode error:', err);
            onError?.(err);
          }
        );
        return stop;
      }
    } catch (e) {
      console.warn('Base64 audio parse error:', e);
    }
  }

  // Stream or fetch TTS from server
  const controller = new AbortController();
  abortController = controller;
  globalAbortControllers.add(controller);

  fetch(
    `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(voice)}&agent=${encodeURIComponent(agent)}`,
    { signal: controller.signal }
  )
    .then((res) => {
      if (!res.ok) throw new Error(`TTS server error ${res.status}`);
      return res.arrayBuffer();
    })
    .then((buf) => {
      if (isCancelled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      return ctx.decodeAudioData(buf);
    })
    .then((decoded) => {
      if (isCancelled || !decoded) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.playbackRate.value = 1.04; // Natural, clear, authentic speech tempo
      src.connect(ctx.destination);
      activeSrc = src;
      globalActiveSources.add(src);

      src.onended = () => {
        globalActiveSources.delete(src);
        if (!isCancelled) onEnd?.();
      };
      src.start(0);
    })
    .catch((err) => {
      if (isCancelled || err.name === 'AbortError') return;
      console.warn('Server TTS failed:', err?.message);
      onError?.(err);
    });

  return stop;
}

// Prefetch TTS audio buffer in advance (e.g. while telephone is still ringing)
export async function prefetchAudioBuffer(
  text: string,
  voice: string = 'leda',
  agent: string = ''
): Promise<AudioBuffer | null> {
  try {
    unlockAudioContext();
    const ctx = getAudioContext();
    if (!ctx) return null;

    const cleanText = text
      .replace(/[*_~`]/g, '')
      .replace(/\[QUEST_COMPLETED:[^\]]+\]/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();

    if (!cleanText) return null;

    const res = await fetch(
      `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(voice)}&agent=${encodeURIComponent(agent)}`
    );
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return await ctx.decodeAudioData(buf);
  } catch (e) {
    console.warn('Prefetch audio error:', e);
    return null;
  }
}

// Convert base64 audio string to AudioBuffer
export async function decodeBase64ToAudioBuffer(base64: string): Promise<AudioBuffer | null> {
  try {
    unlockAudioContext();
    const ctx = getAudioContext();
    if (!ctx || !base64) return null;

    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return await ctx.decodeAudioData(bytes.buffer.slice(0));
  } catch (e) {
    console.warn('Decode base64 to AudioBuffer error:', e);
    return null;
  }
}

// Telecom Hangup / Busy Tone when an agent or aunt hangs up on the caller
export function playTelecomHangupTone(onFinish?: () => void): () => void {
  unlockAudioContext();
  const ctx = getAudioContext();
  if (!ctx) {
    onFinish?.();
    return () => {};
  }

  let isCancelled = false;
  let timer: any = null;
  let count = 0;
  const maxBeeps = 3;

  const beep = () => {
    if (isCancelled || count >= maxBeeps) {
      if (!isCancelled) onFinish?.();
      return;
    }

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      globalActiveOscillators.add(osc);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(425, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain.gain.setValueAtTime(0.2, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.onended = () => {
        globalActiveOscillators.delete(osc);
      };

      osc.start(now);
      osc.stop(now + 0.24);
      count++;
    } catch {}

    timer = setTimeout(beep, 450);
  };

  beep();

  return () => {
    isCancelled = true;
    if (timer) clearTimeout(timer);
  };
}
