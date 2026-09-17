/**
 * Desktop agent (Phase 2): capture → buffer → sync.
 *
 * Public surface for consumers (the CLI in this package). The runtime is
 * importable for embedding and testing.
 */

export { AgentApp } from './runtime';
export type { AgentAppOptions } from './runtime';
export { createAdapters, resolvePlatform } from './adapter-factory';
export type { AdapterSet, AdapterSource, MediaSource, PlatformId } from './adapter-factory';
export { EventBuffer } from './buffer';
export { SyncEngine } from './sync';
export type { IngestResponse } from './sync';
export { LocalServer } from './local-server';
export { ApiClient, ApiError } from './api-client';
export type { ApiResponse } from './api-client';
export { AuthClient, AuthError } from './auth';
export { DeviceRegistrar } from './device-registrar';
export { FileAgentStore } from './store';
export type { AgentStore, AgentStoreData } from './store';
export * from './config';
export { JsonLogger, createLogger, SILENT_LOGGER } from './logger';
export type { AgentLogger } from './logger';
export { focusEvent, idleEvent, mediaEvent, browseEvent } from './event-builder';
export type { BrowseEventInput } from './event-builder';
