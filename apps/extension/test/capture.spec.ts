import { buildCapturePayload, CapturePayload, createCaptureScheduler } from '../src/capture';

describe('capture', () => {
  const tab = (partial: Partial<chrome.tabs.Tab>): chrome.tabs.Tab =>
    ({ ...partial }) as chrome.tabs.Tab;

  describe('buildCapturePayload', () => {
    it('returns url/title for regular web tabs', () => {
      expect(buildCapturePayload(tab({ url: 'https://example.com/docs', title: 'Docs' }))).toEqual({
        url: 'https://example.com/docs',
        title: 'Docs',
      });
    });

    it('omits a missing title', () => {
      expect(buildCapturePayload(tab({ url: 'http://localhost:3000' }))).toEqual({
        url: 'http://localhost:3000',
      });
    });

    it('rejects internal and non-http pages', () => {
      expect(buildCapturePayload(tab({ url: 'chrome://extensions' }))).toBeNull();
      expect(buildCapturePayload(tab({ url: 'about:blank' }))).toBeNull();
      expect(buildCapturePayload(tab({ url: 'file:///etc/hosts' }))).toBeNull();
      expect(buildCapturePayload(tab({ url: '' }))).toBeNull();
    });

    it('rejects undefined tabs', () => {
      expect(buildCapturePayload(undefined)).toBeNull();
    });
  });

  describe('createCaptureScheduler', () => {
    it('emits the settled payload after the debounce window', () => {
      jest.useFakeTimers();
      const onCapture = jest.fn();
      const schedule = createCaptureScheduler({ onCapture, delayMs: 1000 });
      const payload: CapturePayload = { url: 'https://a.b', title: 'A' };

      schedule(payload);
      expect(onCapture).not.toHaveBeenCalled();
      jest.advanceTimersByTime(999);
      expect(onCapture).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(onCapture).toHaveBeenCalledTimes(1);
      expect(onCapture).toHaveBeenCalledWith(payload);
      jest.useRealTimers();
    });

    it('debounces bursts down to a single report', () => {
      jest.useFakeTimers();
      const onCapture = jest.fn();
      const schedule = createCaptureScheduler({ onCapture, delayMs: 500 });

      schedule({ url: 'https://a.b/1' });
      schedule({ url: 'https://a.b/2' });
      schedule({ url: 'https://a.b/3' });
      jest.advanceTimersByTime(500);

      expect(onCapture).toHaveBeenCalledTimes(1);
      expect(onCapture).toHaveBeenCalledWith({ url: 'https://a.b/3' });
      jest.useRealTimers();
    });

    it('ignores null payloads without scheduling', () => {
      jest.useFakeTimers();
      const onCapture = jest.fn();
      const schedule = createCaptureScheduler({ onCapture, delayMs: 500 });
      schedule(null);
      jest.advanceTimersByTime(1000);
      expect(onCapture).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
