import { NullAdapter } from './null-adapter';
import { runAdapterContractTests } from './testing/contract';

describe('NullAdapter', () => {
  it('reports nothing on unsupported platforms', () => {
    const adapter = new NullAdapter();
    expect(adapter.getActiveWindow()).toBeNull();
    adapter.onIdleChanged(jest.fn());
    adapter.onMediaChanged(jest.fn());
    adapter.dispose();
  });

  runAdapterContractTests('NullAdapter', () => new NullAdapter());
});
