export const ACCESS_TOKEN_TYPE = 'access' as const;
export const REFRESH_TOKEN_TYPE = 'refresh' as const;

export interface JwtAccessPayload {
  sub: string;
  email: string;
  tokenType: typeof ACCESS_TOKEN_TYPE;
}

export interface JwtRefreshPayload {
  sub: string;
  email: string;
  jti: string;
  tokenType: typeof REFRESH_TOKEN_TYPE;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
