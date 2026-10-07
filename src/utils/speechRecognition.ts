// Browser SpeechRecognition helper with graceful fallback & getUserMedia permission request

export interface SpeechRecognitionResultItem {
  transcript: string;
  isFinal: boolean;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

// Explicitly prompt user for microphone access (essential for iframes & modern mobile browsers)
export async function requestMicrophoneAccess(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks immediately so mic is freed for Web Speech API
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err) {
    console.warn('Microphone permission denied or unavailable:', err);
    return false;
  }
}

export function createSpeechRecognizer(callbacks: {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}) {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError?.('Tento prehliadač nepodporuje Web Speech Recognition API.');
    return null;
  }

  const SpeechRecognitionConstructor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognizer = new SpeechRecognitionConstructor();

  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = 'sk-SK'; // Prefer Slovak recognition

  recognizer.onstart = () => {
    callbacks.onStart?.();
  };

  recognizer.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const currentText = finalTranscript || interimTranscript;
    const isFinal = Boolean(finalTranscript);
    callbacks.onResult?.(currentText, isFinal);
  };

  recognizer.onerror = (event: any) => {
    // 'no-speech' is a standard silence pause, not a fatal failure
    if (event.error === 'no-speech' || event.error === 'aborted') {
      return;
    }
    console.warn('SpeechRecognition error:', event.error);
    callbacks.onError?.(event.error || 'Chyba rozpoznávania reči');
  };

  recognizer.onend = () => {
    callbacks.onEnd?.();
  };

  return recognizer;
}
