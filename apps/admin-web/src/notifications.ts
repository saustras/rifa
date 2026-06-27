let audioContext: AudioContext | null = null;

export const primeNotificationAudio = (): void => {
  try {
    audioContext ??= new AudioContext();

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }
  } catch {
    // Browsers without Web Audio or blocked autoplay.
  }
};

export const playNotificationSound = (): void => {
  try {
    primeNotificationAudio();

    if (!audioContext) {
      return;
    }

    const context = audioContext;
    const start = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);

    const playTone = (frequency: number, at: number, duration: number): void => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.connect(gain);
      oscillator.start(at);
      oscillator.stop(at + duration);
    };

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);

    playTone(880, start, 0.18);
    playTone(1174.66, start + 0.12, 0.22);
    playTone(1567.98, start + 0.24, 0.28);
  } catch {
    // Ignore playback errors.
  }
};

export const ensureNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  return Notification.requestPermission();
};

export const showPurchaseNotification = (title: string, body: string): void => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      tag: 'rifa-new-purchase',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Ignore if the browser blocks notifications.
  }
};

export const alertNewPurchase = (title: string, body: string): void => {
  playNotificationSound();
  showPurchaseNotification(title, body);
};
