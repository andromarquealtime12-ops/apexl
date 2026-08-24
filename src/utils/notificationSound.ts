// Audio notification system with vibration support for mobile
const NOTIFICATION_SOUNDS = {
  newOrder: [800, 200, 1000, 200, 1200, 300],   // frequency, duration pairs
  pickup: [600, 150, 900, 250],
  alert: [1000, 100, 1000, 100, 1000, 300],
};

function playTone(frequency: number, duration: number, volume = 0.3): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = volume;

      // Fade out
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

      oscillator.start();
      oscillator.stop(ctx.currentTime + duration / 1000);
      oscillator.onended = () => {
        ctx.close();
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

export async function playNotificationSound(type: keyof typeof NOTIFICATION_SOUNDS = "newOrder") {
  const sequence = NOTIFICATION_SOUNDS[type];
  for (let i = 0; i < sequence.length; i += 2) {
    await playTone(sequence[i], sequence[i + 1]);
    if (i + 2 < sequence.length) {
      await new Promise((r) => setTimeout(r, 80));
    }
  }
}

export function vibrateDevice(pattern: number[] = [200, 100, 200]) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function alertDriver(type: keyof typeof NOTIFICATION_SOUNDS = "newOrder") {
  playNotificationSound(type);
  vibrateDevice(type === "newOrder" ? [200, 100, 200, 100, 400] : [200, 100, 200]);
}

/**
 * Loud, repeating alarm for sellers when a new order arrives.
 * Plays a strong siren-like pattern every few seconds for up to `durationMs`
 * (default 5 minutes) and returns a stop() function.
 */
export function startLoudAlarm(durationMs = 5 * 60 * 1000) {
  let stopped = false;
  let timer: number | undefined;

  const burst = async () => {
    if (stopped) return;
    vibrateDevice([500, 150, 500, 150, 800]);
    for (let i = 0; i < 3 && !stopped; i++) {
      await playTone(1200, 220, 0.9);
      if (stopped) return;
      await playTone(880, 220, 0.9);
    }
  };

  burst();
  timer = window.setInterval(burst, 4000);

  const stopTimeout = window.setTimeout(() => stop(), durationMs);

  function stop() {
    if (stopped) return;
    stopped = true;
    if (timer) window.clearInterval(timer);
    window.clearTimeout(stopTimeout);
  }

  return stop;
}
