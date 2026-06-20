/**
 * A mock implementation of Google Mobile Ads (AdMob) RewardedAd SDK.
 * Mimics the real SDK structure to keep the code clean and production-ready.
 */
type AdEventListener = (reward?: { amount: number; type: string }) => void;

export class SimulatedRewardedAd {
  private listeners: Record<string, AdEventListener[]> = {};
  public loaded = false;

  addAdEventListener(event: 'loaded' | 'earned_reward', callback: AdEventListener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  load() {
    // Simulate loading delay of 500ms
    setTimeout(() => {
      this.loaded = true;
      this.trigger('loaded');
    }, 500);
  }

  show(triggerAdModal: (onComplete: () => void) => void) {
    if (!this.loaded) {
      console.warn("Rewarded ad not loaded yet.");
      return;
    }
    triggerAdModal(() => {
      this.trigger('earned_reward', { amount: 1, type: 'unlock' });
      this.loaded = false;
    });
  }

  private trigger(event: string, reward?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(reward));
    }
  }
}
