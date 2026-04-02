import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authenticate } from "../src/middleware/auth";
import { requireRole } from "../src/middleware/requireRole";
import { config } from "../src/config";

function mockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers };
}

function mockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const mockNext: NextFunction = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("authenticate middleware", () => {
  test("rejects request with no Authorization header", () => {
    const req = mockReq();
    const res = mockRes();

    authenticate(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Unauthorized" })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("rejects request with invalid token", () => {
    const req = mockReq({ authorization: "Bearer invalid-token" });
    const res = mockRes();

    authenticate(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("passes with valid token and sets req.user", () => {
    const token = jwt.sign(
      { userId: "test-uuid", role: "customer" },
      config.jwt.secret,
      { expiresIn: "15m" }
    );
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();

    authenticate(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((req as any).user).toEqual(
      expect.objectContaining({ userId: "test-uuid", role: "customer" })
    );
  });
});

describe("requireRole middleware", () => {
  test("rejects user without required role", () => {
    const req = mockReq();
    (req as any).user = { userId: "test-uuid", role: "customer" };
    const res = mockRes();

    requireRole("admin")(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("allows user with required role", () => {
    const req = mockReq();
    (req as any).user = { userId: "test-uuid", role: "admin" };
    const res = mockRes();

    requireRole("admin")(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test("allows any of multiple roles", () => {
    const req = mockReq();
    (req as any).user = { userId: "test-uuid", role: "driver" };
    const res = mockRes();

    requireRole("driver", "admin")(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
