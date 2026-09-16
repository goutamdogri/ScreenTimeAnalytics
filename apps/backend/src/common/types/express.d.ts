declare global {
  // Express does not declare a stable per-request id field; we allocate one in
  // the logging interceptor and surface it in log lines and error payloads.
  namespace Express {
    interface Request {
      id?: string;
      /** Populated by DeviceTokenGuard with { deviceId, userId }. */
      device?: { deviceId: string; userId: string };
    }
  }
}

export {};
