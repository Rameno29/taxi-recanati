import type { UserRole, UserLanguage } from "./db";

export interface RegisterRequest {
  phone: string;
  name: string;
  email?: string;
  password?: string;
  language?: UserLanguage;
}

export interface LoginEmailRequest {
  email: string;
  password: string;
}

export interface RequestOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    role: UserRole;
    language: UserLanguage;
    avatar: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
