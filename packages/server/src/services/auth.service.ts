import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import type { UserRow } from "../types/db";
import type { AuthResponse, TokenPayload } from "../types/api";

const SALT_ROUNDS = 10;

function generateTokens(userId: string, role: string): { accessToken: string; refreshToken: string } {
  const payload: TokenPayload = { userId, role: role as TokenPayload["role"] };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as string,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
}

function toAuthResponse(user: UserRow, accessToken: string, refreshToken: string): AuthResponse {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      language: user.language,
      avatar: user.avatar,
    },
    accessToken,
    refreshToken,
  };
}

export async function register(data: {
  phone: string;
  name: string;
  email?: string;
  password?: string;
  language?: "it" | "en";
}): Promise<AuthResponse> {
  const existing = await db("users").where("phone", data.phone).first();
  if (existing) {
    throw new AppError(409, "A user with this phone number already exists");
  }

  if (data.email) {
    const emailExists = await db("users").where("email", data.email).first();
    if (emailExists) {
      throw new AppError(409, "A user with this email already exists");
    }
  }

  const passwordHash = data.password
    ? await bcrypt.hash(data.password, SALT_ROUNDS)
    : null;

  const [user] = await db("users")
    .insert({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      password_hash: passwordHash,
      language: data.language || "it",
      role: "customer",
    })
    .returning("*");

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  return toAuthResponse(user, accessToken, refreshToken);
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  const user: UserRow | undefined = await db("users").where("email", email).first();

  if (!user || !user.password_hash) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  return toAuthResponse(user, accessToken, refreshToken);
}

export async function loginWithPhone(phone: string): Promise<AuthResponse> {
  const user: UserRow | undefined = await db("users").where("phone", phone).first();

  if (!user) {
    throw new AppError(404, "No user found with this phone number");
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  return toAuthResponse(user, accessToken, refreshToken);
}

export async function refreshAccessToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
    const user: UserRow | undefined = await db("users").where("id", payload.userId).first();

    if (!user) {
      throw new AppError(401, "User not found");
    }

    return generateTokens(user.id, user.role);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "Invalid or expired refresh token");
  }
}

export async function getUserById(userId: string): Promise<UserRow | undefined> {
  return db("users").where("id", userId).first();
}
