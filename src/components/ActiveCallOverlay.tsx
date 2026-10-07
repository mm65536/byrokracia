import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  UserPlus,
  Check,
} from 'lucide-react';
import { CallSession, TeamId, InventoryItem, DiscoveredContact } from '../types';
import { formatPhone } from '../data/agents';
import {
  playRingtone,
  playBusyTone,
  playBangarangLoop,
  playPigLoop,
  playTelecomOperatorNotice,
  playTelecomHangupTone,
  playSlovakAudio,
  prefetchAudioBuffer,
  decodeBase64ToAudioBuffer,
  stopAllAudioPlayback,
  unlockAudioContext,
} from '../utils/audio';
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  requestMicrophoneAccess,
} from '../utils/speechRecognition';

interface ActiveCallOverlayProps {
  session: CallSession;
  activeTeamId: TeamId;
  onEndCall: () => void;
  onQuestCompleted?: (rewardText: string) => void;
  onUnlockItem?: (item: InventoryItem) => void;
  onUnlockContact?: (contact: DiscoveredContact) => void;
  isSavedContact?: boolean;
}

export const ActiveCallOverlay: React.FC<ActiveCallOverlayProps> = ({
  session,
  activeTeamId,
  onEndCall,
  onQuestCompleted,
  onUnlockItem,
  onUnlockContact,
  isSavedContact = false,
}) => {
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [callDuration, setCallDuration] = useState(0);
  const [isMicActive, setIsMicActive] = useState(false);
  const [unlockedNotice, setUnlockedNotice] = useState<string | null>(null);
  const [savedManually, setSavedManually] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bangarangVisual, setBangarangVisual] = useState(false);

  // Hangup cooldown for dummy tetas so users cannot hang up immediately (except 'failed' which can be hung up anytime)
  const [hangupLockedSeconds, setHangupLockedSeconds] = useState<number>(() => {
    return session.isDummy && session.dummyType !== 'failed' ? 6 : 0;
  });
  const [showLockedWarning, setShowLockedWarning] = useState(false);

  useEffect(() => {
    if (hangupLockedSeconds <= 0) return;
    const interval = setInterval(() => {
      setHangupLockedSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [hangupLockedSeconds]);

  const stopCurrentAudioRef = useRef<(() => void) | null>(null);
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognizerRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isCallEndedRef = useRef<boolean>(false);
  const isSendingRef = useRef<boolean>(false);
  const lastSpokenTextRef = useRef<string>('');
  const messagesHistoryRef = useRef<Array<{ role: 'user' | 'model'; text: string }>>([]);

  // Comprehensive cleanup
  const cleanupAll = () => {
    isCallEndedRef.current = true;
    isSendingRef.current = false;

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognizerRef.current) {
      try {
        recognizerRef.current.abort();
      } catch {}
      recognizerRef.current = null;
    }
    if (stopCurrentAudioRef.current) {
      try {
        stopCurrentAudioRef.current();
      } catch {}
      stopCurrentAudioRef.current = null;
    }
    setBangarangVisual(false);
    stopAllAudioPlayback();
  };

  // 1. Initial Telephone Ringing & Connection with Audio Prefetch
  useEffect(() => {
    unlockAudioContext();
    isCallEndedRef.current = false;
    isSendingRef.current = false;

    // Start telephone ringback tone
    const stopRinging = playRingtone();
    stopCurrentAudioRef.current = stopRinging;

    const ringStartTime = Date.now();
    const MIN_RING_MS = 2500; // Minimum authentic ringing time (~1 ring cycle)
    const MAX_RING_MS = 10000; // Safety timeout

    let isFinishedRinging = false;
    let fallbackTimeout: NodeJS.Timeout | null = null;

    // Special behavior for Matej Makita: Never answers in app, rings endlessly!
    if (session.isMatejMakita) {
      return () => {
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        cleanupAll();
      };
    }

    const connectAndSpeak = (
      initialText: string,
      voice?: string,
      audioBuffer?: AudioBuffer,
      audioBase64?: string
    ) => {
      if (isCallEndedRef.current || isFinishedRinging) return;
      isFinishedRinging = true;

      if (fallbackTimeout) clearTimeout(fallbackTimeout);

      // Ring for at least MIN_RING_MS so it sounds like a real phone call
      const elapsed = Date.now() - ringStartTime;
      const remainingRing = Math.max(0, MIN_RING_MS - elapsed);

      setTimeout(() => {
        if (isCallEndedRef.current) return;
        // Stop ringing the instant the call is answered
        stopRinging();
        setCallState('connected');

        if (session.agent) {
          onUnlockContact?.({
            phone: session.agent.phone,
            phoneClean: session.agent.phoneClean,
            name: session.agent.name,
            type: session.agent.type,
          });
        }

        messagesHistoryRef.current = [{ role: 'model', text: initialText }];
        speakAgentResponse(initialText, voice, audioBase64, audioBuffer);
      }, remainingRing);
    };

    // Parallel prefetching while the phone is ringing:
    if (session.isDummy) {
      const type = session.dummyType;
      if (type === 'bangarang' || type === 'beep' || type === 'failed' || type === 'pig') {
        // Local sound dummies - ring for realistic MIN_RING_MS, then connect
        ringTimeoutRef.current = setTimeout(() => {
          if (isCallEndedRef.current || isFinishedRinging) return;
          isFinishedRinging = true;
          stopRinging();
          setCallState('connected');
          handleDummyCall(type);
        }, MIN_RING_MS);
      } else if (type === 'leaders') {
        // Prefetch leaders audio while ringing
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', text: 'Mená vedúcich' }],
            dummyType: 'leaders',
            includeAudio: !isMuted,
          }),
        })
          .then((r) => r.json())
          .then(async (data) => {
            const initialText = data.reply || 'Janko, Lukáš, Julka, Branko, Soňa, Štepi, Aliska, Martin.';
            let buf: AudioBuffer | null = null;
            if (data.audioBase64) {
              buf = await decodeBase64ToAudioBuffer(data.audioBase64);
            }
            connectAndSpeak(initialText, 'fenrir', buf || undefined, data.audioBase64);
          })
          .catch(() => {
            connectAndSpeak('Janko, Lukáš, Julka, Branko, Soňa, Štepi, Aliska, Martin.', 'fenrir');
          });
      } else if (type === 'yapper') {
        // Prefetch Yapper greeting audio while ringing
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', text: 'Haló, kto volá?' }],
            dummyType: 'yapper',
            includeAudio: !isMuted,
          }),
        })
          .then((r) => r.json())
          .then(async (data) => {
            const initialText =
              data.reply ||
              'No nazdar! Práve som zistil, že veveričky v tábore nosia tajné mikrofóny v žaluďoch!';
            let buf: AudioBuffer | null = null;
            if (data.audioBase64) {
              buf = await decodeBase64ToAudioBuffer(data.audioBase64);
            }
            connectAndSpeak(initialText, 'puck', buf || undefined, data.audioBase64);
          })
          .catch(() => {
            connectAndSpeak(
              'No nazdar! Práve som zistil, že veveričky v tábore nosia tajné mikrofóny v žaluďoch!',
              'puck'
            );
          });
      }
    } else {
      // Real Agent (Jaromír Holý, Gregor Hlučný)
      const agent = session.agent;
      const greeting = agent?.greeting || 'Haló, počúvam ťa! Hovor, čo máš na srdci!';
      const voice = agent?.voice || 'leda';

      // Prefetch audio buffer while the phone is ringing
      prefetchAudioBuffer(greeting, voice, agent?.name || '')
        .then((buf) => {
          connectAndSpeak(greeting, voice, buf || undefined);
        })
        .catch(() => {
          connectAndSpeak(greeting, voice);
        });
    }

    // Safety fallback timeout
    fallbackTimeout = setTimeout(() => {
      if (!isFinishedRinging && !isCallEndedRef.current) {
        isFinishedRinging = true;
        stopRinging();
        setCallState('connected');
        if (session.isDummy) {
          handleDummyCall(session.dummyType);
        } else {
          handleAgentCallConnected();
        }
      }
    }, MAX_RING_MS);

    return () => {
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      cleanupAll();
    };
  }, []);

  // Duration timer
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Handle Dummy call behaviors
  const handleDummyCall = async (type?: string) => {
    if (isCallEndedRef.current) return;
    if (type === 'bangarang') {
      setBangarangVisual(true);
      // Bangarang plays continuously until user explicitly hangs up ("až kým to zložím. Presne tak dlho, kým to zložím.")
      const stopDubstep = playBangarangLoop();
      stopCurrentAudioRef.current = () => {
        setBangarangVisual(false);
        stopDubstep();
      };
    } else if (type === 'beep') {
      // Rapid busy tone beeps endlessly until user hangs up
      const stopBeep = playBusyTone();
      stopCurrentAudioRef.current = stopBeep;
    } else if (type === 'failed') {
      // Natural Slovak telecom operator notice (plays once), then ends call
      const stopNotice = playTelecomOperatorNotice(undefined, () => {
        if (!isCallEndedRef.current) {
          setCallState('ended');
          setTimeout(() => {
            if (!isCallEndedRef.current) onEndCall();
          }, 1200);
        }
      });
      stopCurrentAudioRef.current = stopNotice;
    } else if (type === 'pig') {
      // Hilarious pig grunt & squeak loop until user hangs up (or audio file plays)
      const stopPig = playPigLoop();
      stopCurrentAudioRef.current = stopPig;
    }
  };

  // Connected to real Agent fallback
  const handleAgentCallConnected = () => {
    const agent = session.agent;
    const greeting =
      agent?.greeting || 'Haló, počúvam ťa! Hovor, čo máš na srdci!';

    messagesHistoryRef.current = [{ role: 'model', text: greeting }];
    speakAgentResponse(greeting, agent?.voice);
  };

  // Speak agent response & trigger auto-listen when finished (or auto-hangup if agent said goodbye)
  const speakAgentResponse = (
    text: string,
    voice?: string,
    audioBase64?: string,
    audioBuffer?: AudioBuffer,
    willHangUp?: boolean
  ) => {
    if (isCallEndedRef.current) return;

    if (stopCurrentAudioRef.current) {
      stopCurrentAudioRef.current();
      stopCurrentAudioRef.current = null;
    }

    if (isMuted) {
      if (willHangUp) {
        setCallState('ended');
        setUnlockedNotice('📴 Agent zložil hovor.');
        setTimeout(() => {
          if (!isCallEndedRef.current) onEndCall();
        }, 1200);
        return;
      }
      startListening();
      return;
    }

    setIsModelSpeaking(true);
    setIsMicActive(false);

    if (recognizerRef.current) {
      try {
        recognizerRef.current.abort();
      } catch {}
      recognizerRef.current = null;
    }

    const onAudioEnd = () => {
      setIsModelSpeaking(false);

      // Auto-hangup when aunt/agent says goodbye or terminates the call
      if (willHangUp) {
        if (!isCallEndedRef.current) {
          setCallState('ended');
          setUnlockedNotice('📴 Agent zložil hovor.');
          const stopHangup = playTelecomHangupTone(() => {
            if (!isCallEndedRef.current) onEndCall();
          });
          stopCurrentAudioRef.current = stopHangup;
          setTimeout(() => {
            if (!isCallEndedRef.current) onEndCall();
          }, 1500);
        }
        return;
      }

      const isInteractive =
        !session.isDummy ||
        session.dummyType === 'leaders' ||
        session.dummyType === 'yapper';

      if (!isCallEndedRef.current && isInteractive) {
        startListening();
      }
    };

    const stopFn = playSlovakAudio(
      {
        text,
        audioBase64,
        audioBuffer,
        voice:
          voice ||
          session.agent?.voice ||
          (session.dummyType === 'yapper'
            ? 'puck'
            : session.dummyType === 'leaders'
            ? 'fenrir'
            : 'aoede'),
        agent: session.agent?.id || session.dummyType || 'operator',
      },
      onAudioEnd,
      onAudioEnd
    );

    stopCurrentAudioRef.current = stopFn;
  };

  // Send user spoken words to agent
  const sendUserVoiceMessage = async (userText: string) => {
    if (!userText.trim() || isCallEndedRef.current || isSendingRef.current || isProcessing) {
      return;
    }

    isSendingRef.current = true;
    setIsProcessing(true);
    setIsMicActive(false);
    lastSpokenTextRef.current = '';

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (stopCurrentAudioRef.current) {
      stopCurrentAudioRef.current();
      stopCurrentAudioRef.current = null;
    }
    setIsModelSpeaking(false);

    if (recognizerRef.current) {
      try {
        recognizerRef.current.abort();
      } catch {}
      recognizerRef.current = null;
    }

    messagesHistoryRef.current.push({ role: 'user', text: userText });

    try {
      const voiceToRequest =
        session.agent?.voice ||
        (session.dummyType === 'yapper'
          ? 'puck'
          : session.dummyType === 'leaders'
          ? 'fenrir'
          : 'aoede');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: session.agent?.id,
          phone: session.targetPhone,
          teamId: activeTeamId,
          messages: messagesHistoryRef.current,
          voice: voiceToRequest,
          includeAudio: !isMuted,
          dummyType: session.dummyType,
        }),
      });

      if (!res.ok) {
        throw new Error('Chyba servera');
      }

      const data = await res.json();
      const reply = data.reply || 'Počujem ťa, pokračuj!';
      messagesHistoryRef.current.push({ role: 'model', text: reply });

      if (Array.isArray(data.unlockedItems) && data.unlockedItems.length > 0) {
        for (const item of data.unlockedItems) {
          onUnlockItem?.(item);
          setUnlockedNotice(`🎒 Získaný predmet: ${item.name}`);
        }
      }

      if (Array.isArray(data.unlockedContacts) && data.unlockedContacts.length > 0) {
        for (const contact of data.unlockedContacts) {
          onUnlockContact?.(contact);
          setUnlockedNotice(`📞 Nový kontakt: ${contact.name} (${contact.phone})`);
        }
      }

      if (data.questUnlocked) {
        onQuestCompleted?.(session.agent?.reward || 'Quest splnený!');
      }

      // Speak agent response aloud (and hang up if agent said goodbye)
      speakAgentResponse(reply, voiceToRequest, data.audioBase64, undefined, Boolean(data.shouldHangUp));
    } catch (err) {
      console.warn('Voice send error:', err);
      if (!isCallEndedRef.current) {
        speakAgentResponse('Haló? Na linke trochu zašumelo, skús mi to povedať ešte raz!');
      }
    } finally {
      setIsProcessing(false);
      isSendingRef.current = false;
    }
  };

  // Continuous speech recognition / auto-listen in background
  const startListening = async () => {
    if (isCallEndedRef.current || isModelSpeaking || isProcessing || isSendingRef.current) {
      return;
    }

    try {
      await requestMicrophoneAccess();
    } catch {}

    if (!isSpeechRecognitionSupported()) {
      return;
    }

    lastSpokenTextRef.current = '';

    const recognizer = createSpeechRecognizer({
      onStart: () => {
        setIsMicActive(true);
      },
      onResult: (transcript, isFinal) => {
        lastSpokenTextRef.current = transcript;

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        if (isFinal && transcript.trim()) {
          setIsMicActive(false);
          sendUserVoiceMessage(transcript.trim());
        } else if (transcript.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            if (
              lastSpokenTextRef.current.trim() &&
              !isModelSpeaking &&
              !isProcessing &&
              !isSendingRef.current
            ) {
              setIsMicActive(false);
              sendUserVoiceMessage(lastSpokenTextRef.current.trim());
            }
          }, 750);
        }
      },
      onError: () => {
        setIsMicActive(false);
      },
      onEnd: () => {
        setIsMicActive(false);
      },
    });

    if (recognizer) {
      recognizerRef.current = recognizer;
      try {
        recognizer.start();
      } catch (e) {
        setIsMicActive(false);
      }
    }
  };

  // Interrupt agent or toggle mic
  const handleInterruptOrMicClick = async () => {
    unlockAudioContext();
    if (isModelSpeaking) {
      if (stopCurrentAudioRef.current) {
        stopCurrentAudioRef.current();
        stopCurrentAudioRef.current = null;
      }
      stopAllAudioPlayback();
      setIsModelSpeaking(false);
      startListening();
    } else if (isMicActive) {
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stop();
        } catch {}
      }
      if (lastSpokenTextRef.current.trim()) {
        sendUserVoiceMessage(lastSpokenTextRef.current.trim());
      } else {
        setIsMicActive(false);
      }
    } else {
      startListening();
    }
  };

  const handleHangUp = () => {
    // Hangup lock for dummy tetas (except 'failed' which can be hung up anytime)
    if (hangupLockedSeconds > 0) {
      setShowLockedWarning(true);
      setTimeout(() => setShowLockedWarning(false), 2000);
      return;
    }

    // Instantly hard-kill all audio output with zero delay the exact millisecond user taps End Call
    if (stopCurrentAudioRef.current) {
      try {
        stopCurrentAudioRef.current();
      } catch {}
      stopCurrentAudioRef.current = null;
    }
    setBangarangVisual(false);
    stopAllAudioPlayback();
    cleanupAll();
    onEndCall();
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getAvatarEmoji = () => {
    if (session.isMatejMakita) return '📵';
    if (session.agent?.avatarEmoji) return session.agent.avatarEmoji;
    if (session.dummyType === 'pig') return '🐷';
    if (session.dummyType === 'bangarang' || bangarangVisual) return '🔊';
    if (session.dummyType === 'beep') return '📞';
    if (session.dummyType === 'failed') return '🤖';
    if (session.dummyType === 'leaders') return '🏕️';
    if (session.dummyType === 'yapper') return '🗣️';
    return '📞';
  };

  const displayName =
    session.agent?.name ||
    (session.targetName && session.targetName !== session.targetPhone
      ? session.targetName
      : formatPhone(session.targetPhone));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex flex-col justify-between p-6 sm:p-10 select-none ${
        bangarangVisual
          ? 'bg-gradient-to-b from-purple-950 via-slate-950 to-pink-950 animate-pulse'
          : 'bg-slate-950'
      }`}
    >
      {/* Top Caller Info */}
      <div className="flex flex-col items-center mt-6 sm:mt-12 text-center">
        {/* Caller Avatar / Icon */}
        <div className="relative mb-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-4xl sm:text-5xl shadow-2xl">
            {getAvatarEmoji()}
          </div>

          {(isModelSpeaking || isMicActive) && (
            <div
              className={`absolute -inset-3 rounded-full border-2 animate-ping pointer-events-none opacity-40 ${
                isModelSpeaking ? 'border-sky-400' : 'border-emerald-400'
              }`}
            />
          )}
        </div>

        {/* Name / Dialed Number */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">
          {displayName}
        </h2>

        {/* Dialed phone number */}
        {(session.agent || (session.targetName && session.targetName !== session.targetPhone)) && (
          <p className="text-sm font-mono text-slate-400 mb-3">
            {formatPhone(session.targetPhone)}
          </p>
        )}

        {/* Call Status / Timer & Save Button */}
        <div className="flex items-center gap-2 mt-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-medium">
            {callState === 'ringing' ? (
              <span className="text-amber-400 animate-pulse">Vytáčam...</span>
            ) : isProcessing ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300 font-mono text-[11px]">Spracúvam...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-300 font-mono">{formatTime(callDuration)}</span>
              </>
            )}
          </div>

          {isSavedContact || savedManually ? (
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>V kontaktoch</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onUnlockContact) {
                  const contactToSave: DiscoveredContact = {
                    phone: session.targetPhone,
                    phoneClean: session.targetPhone.replace(/[^0-9]/g, ''),
                    name:
                      session.agent?.name ||
                      (session.targetName && session.targetName !== session.targetPhone
                        ? session.targetName
                        : 'Neznámy kontakt'),
                    type: session.agentType || 'voice',
                    unlockedAt: new Date().toISOString(),
                    sourceAgent: 'Ručne uložené počas hovoru',
                  };
                  onUnlockContact(contactToSave);
                  setSavedManually(true);
                  setUnlockedNotice(`📞 Kontakt uložený do batohu: ${contactToSave.name}`);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 hover:text-white text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Uložiť tento kontakt do batohu"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Uložiť kontakt</span>
            </button>
          )}
        </div>

        {unlockedNotice && (
          <div className="mt-3 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-lg flex items-center gap-1.5 animate-fadeIn">
            <span>✨</span>
            <span>{unlockedNotice}</span>
          </div>
        )}

        {session.isMatejMakita && (
          <div className="mt-3 px-4 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs max-w-xs text-center space-y-1 shadow-lg animate-fadeIn">
            <div className="font-bold flex items-center justify-center gap-1.5 text-amber-300">
              <span>📵</span>
              <span>Zvoní... Nikto nedvíha.</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Matej Makita je reálny človek v tábore! V aplikácii vám nezdvihne — musíte mu zavolať zo skutočného telefónu v reálnom živote!
            </p>
          </div>
        )}
      </div>

      {/* Center Audio Feedback Visualizer (Authentic phone screen, ZERO subtitles/transcripts) */}
      <div className="flex flex-col items-center justify-center my-auto py-8">
        {callState === 'connected' && (
          <div className="flex items-center gap-1.5 h-14">
            {[35, 65, 95, 55, 85, 45, 75, 40, 90, 60, 30].map((h, i) => (
              <div
                key={i}
                className={`w-1.5 sm:w-2 rounded-full transition-all duration-150 ${
                  isModelSpeaking
                    ? 'bg-sky-400'
                    : isMicActive
                    ? 'bg-emerald-400'
                    : bangarangVisual
                    ? 'bg-fuchsia-400'
                    : isProcessing
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-700'
                }`}
                style={{
                  height:
                    isModelSpeaking || isMicActive || bangarangVisual
                      ? `${Math.max(16, h * (0.6 + Math.sin(Date.now() / 150 + i) * 0.4))}%`
                      : '15%',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Phone Action Controls */}
      <div className="flex items-center justify-center gap-6 sm:gap-8 w-full max-w-sm mx-auto mb-6 sm:mb-12">
        {/* Mute speaker */}
        <button
          type="button"
          onClick={() => setIsMuted((prev) => !prev)}
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            isMuted
              ? 'bg-rose-950/80 border-rose-700 text-rose-400'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
          }`}
          title={isMuted ? 'Zapnúť zvuk' : 'Stlmiť zvuk'}
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>

        {/* Red Hang Up Button (with lock cooldown for dummy tetas) */}
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={handleHangUp}
            className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
              hangupLockedSeconds > 0
                ? 'bg-amber-700/90 hover:bg-amber-600 text-amber-200 border-2 border-amber-400/60 shadow-amber-900/30 ring-4 ring-amber-500/20'
                : 'bg-rose-600 hover:bg-rose-500 active:scale-95 text-white shadow-rose-600/30'
            }`}
            title={hangupLockedSeconds > 0 ? `Zložiť možné o ${hangupLockedSeconds}s` : 'Ukončiť hovor'}
          >
            {hangupLockedSeconds > 0 ? (
              <div className="flex flex-col items-center justify-center">
                <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8 mb-0.5 opacity-90" />
                <span className="text-[11px] font-bold font-mono text-amber-200">{hangupLockedSeconds}s</span>
              </div>
            ) : (
              <PhoneOff className="w-9 h-9 sm:w-10 sm:h-10" />
            )}
          </button>
          {showLockedWarning && hangupLockedSeconds > 0 && (
            <div className="absolute -top-11 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-bold shadow-lg whitespace-nowrap animate-bounce z-20">
              ⚠️ Počúvajte ešte {hangupLockedSeconds}s!
            </div>
          )}
        </div>

        {/* Mic / Interrupt / Speak button */}
        <button
          type="button"
          onClick={handleInterruptOrMicClick}
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            isModelSpeaking
              ? 'bg-sky-600/30 border-sky-500 text-sky-300 animate-pulse'
              : isMicActive
              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
          }`}
          title={
            isModelSpeaking
              ? 'Prerušiť a hovoriť'
              : isMicActive
              ? 'Odoslať hlas'
              : 'Začať hovoriť'
          }
        >
          {isModelSpeaking ? (
            <Radio className="w-6 h-6 text-sky-400" />
          ) : isMicActive ? (
            <Mic className="w-6 h-6 text-emerald-400" />
          ) : (
            <MicOff className="w-6 h-6 text-slate-400" />
          )}
        </button>
      </div>
    </motion.div>
  );
};
