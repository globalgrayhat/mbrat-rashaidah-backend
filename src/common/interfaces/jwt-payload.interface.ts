export interface JwtPayload {
  sub: string; // id of the user
  email: string; // user's email
  role: string; // user's role
  refreshToken?: string; // refresh token
}
