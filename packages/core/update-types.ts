export type ServiceNotice = { provider: string; state: 'available' | 'degraded' | 'unavailable' | 'retired'; message: { en: string; ar: string }; fixedVersion?: string };
export type UpdateState = {
  phase: 'unconfigured' | 'idle' | 'checking' | 'available' | 'current' | 'error' | 'downloading' | 'ready' | 'waiting' | 'installing';
  services: ServiceNotice[]; statusVerified: boolean; loaded: number; total: number; checkedAt?: number;
  error?: 'check' | 'download' | 'install' | 'permission';
  release?: { version: string; kind: string; notes: { en: string; ar: string } };
};
