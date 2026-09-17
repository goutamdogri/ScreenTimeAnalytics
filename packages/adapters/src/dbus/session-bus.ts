import type { MessageBus } from 'dbus-next';

/**
 * Structural view of the D-Bus session bus shared by all bus-backed probing
 * (idle, MPRIS, the Wayland window probe). Production instances wrap
 * `dbus-next`'s `MessageBus`; tests inject fakes.
 */
export interface SessionBus {
  call(message: unknown): Promise<{ body: unknown[] }>;
  disconnect(): void;
}

export function toSessionBus(bus: MessageBus): SessionBus {
  return {
    async call(message) {
      const reply = await bus.call(message as Parameters<MessageBus['call']>[0]);
      return reply ? { body: reply.body ?? [] } : { body: [] };
    },
    disconnect: () => bus.disconnect(),
  };
}
