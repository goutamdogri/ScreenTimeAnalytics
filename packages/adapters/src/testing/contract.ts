import { ActiveWindowInfo, MediaListener, PlatformAdapter } from '../index';

export type AdapterFactory = () => PlatformAdapter;

/**
 * Contract test suite (design doc §8.3) that every `PlatformAdapter`
 * implementation must pass. Adapter-specific specs call this with their own
 * factory; Wayland/Windows adapters must satisfy the same expectations.
 */
export function runAdapterContractTests(name: string, create: AdapterFactory): void {
  describe(`PlatformAdapter contract: ${name}`, () => {
    let adapter: PlatformAdapter;

    beforeEach(() => {
      adapter = create();
    });

    afterEach(() => {
      adapter.dispose();
    });

    it('getActiveWindow() returns an ActiveWindowInfo or null', () => {
      const win = adapter.getActiveWindow();
      if (win !== null) {
        expect(typeof (win as ActiveWindowInfo).title).toBe('string');
        expect(typeof (win as ActiveWindowInfo).processName).toBe('string');
      }
    });

    it('onIdleChanged registers a callback without throwing', () => {
      const cb = jest.fn();
      expect(() => adapter.onIdleChanged(cb)).not.toThrow();
    });

    it('onMediaChanged registers a callback without throwing', () => {
      const cb: MediaListener = jest.fn();
      expect(() => adapter.onMediaChanged(cb)).not.toThrow();
    });

    it('dispose() is idempotent', () => {
      expect(() => {
        adapter.dispose();
        adapter.dispose();
      }).not.toThrow();
    });
  });
}
