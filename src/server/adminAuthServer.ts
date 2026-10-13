import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Verified Authorized Administrator Gmail Addresses
const DEFAULT_AUTHORIZED_ADMIN_EMAILS = [
  'sibaraj789090@gmail.com',
  'ranidas14343@gmail.com',
  'ranidas784170@gmail.com',
];

export function getAuthorizedAdminEmails(): string[] {
  const envEmail = process.env.ADMIN_EMAIL || process.env.AUTHORIZED_ADMIN_EMAIL || '';
  if (envEmail.trim()) {
    const list = envEmail.split(',').map((e) => e.trim().toLowerCase());
    return Array.from(new Set([...list, ...DEFAULT_AUTHORIZED_ADMIN_EMAILS]));
  }
  return DEFAULT_AUTHORIZED_ADMIN_EMAILS;
}

export function getAuthorizedAdminEmail(): string {
  const allowed = getAuthorizedAdminEmails();
  return allowed[0] || 'sibaraj789090@gmail.com';
}

export function isAuthorizedAdminEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const allowed = getAuthorizedAdminEmails();
  return allowed.includes(normalized);
}

interface AdminSession {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory server-authoritative admin sessions (12-hour session lifetime)
const adminSessions = new Map<string, AdminSession>();

// In-memory fallback password store if Supabase is unconfigured and ADMIN_PASSWORD env var is not set
let inMemoryAdminPassword: string | null = process.env.ADMIN_PASSWORD || null;

/**
 * Validates an admin session token or a Supabase JWT from an authorized administrator
 */
export async function verifyAdminToken(token: string | undefined | null): Promise<{
  valid: boolean;
  email?: string;
}> {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  const cleanToken = token.trim();

  // 1. Check active server-side session
  const session = adminSessions.get(cleanToken);
  if (session) {
    if (Date.now() > session.expiresAt) {
      adminSessions.delete(cleanToken);
      return { valid: false };
    }
    return { valid: true, email: session.email };
  }

  // 2. Check if it's a Supabase JWT directly
  if (cleanToken.startsWith('ey') && isSupabaseConfigured && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(cleanToken);
      if (!error && user && user.email) {
        if (isAuthorizedAdminEmail(user.email)) {
          // Cache verified session
          adminSessions.set(cleanToken, {
            token: cleanToken,
            email: user.email.toLowerCase(),
            createdAt: Date.now(),
            expiresAt: Date.now() + 12 * 3600 * 1000,
          });
          return { valid: true, email: user.email.toLowerCase() };
        }
      }
    } catch (err) {
      console.warn('Supabase token verification error:', err);
    }
  }

  return { valid: false };
}

/**
 * Authoritative Express middleware: Rejects any request not accompanied by a verified admin session
 */
export async function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const sessionHeader = req.headers['x-admin-session-token'];

  let token: string | undefined;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof sessionHeader === 'string') {
    token = sessionHeader.trim();
  }

  if (!token) {
    return res.status(401).json({
      error: 'Access Denied: Administrator authentication token required.',
      code: 'UNAUTHORIZED_ADMIN',
    });
  }

  const verification = await verifyAdminToken(token);
  if (!verification.valid) {
    return res.status(403).json({
      error: 'Access Denied: Invalid, expired, or unauthorized administrator credentials.',
      code: 'FORBIDDEN_NOT_ADMIN',
    });
  }

  (req as any).adminEmail = verification.email;
  return next();
}

/**
 * Handler for POST /api/admin/auth/login
 */
export async function handleAdminLogin(req: Request, res: Response) {
  const { email, password, supabaseToken } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Administrator email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // STRICT CHECK: Only the exact authorized Gmail is permitted.
  // Other Gmails, even if authentic users in the system, are strictly denied.
  if (!isAuthorizedAdminEmail(normalizedEmail)) {
    return res.status(403).json({
      error: 'Access Denied: Invalid credentials or account is not authorized as an administrator.',
    });
  }

  // 1. If Supabase token provided (client authenticated through Supabase Auth)
  if (supabaseToken && typeof supabaseToken === 'string' && isSupabaseConfigured && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(supabaseToken);
      if (error || !user || !isAuthorizedAdminEmail(user.email)) {
        return res.status(403).json({
          error: 'Access Denied: Invalid Supabase credentials or unauthorized email.',
        });
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      adminSessions.set(sessionToken, {
        token: sessionToken,
        email: normalizedEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 3600 * 1000,
      });

      return res.json({
        success: true,
        token: sessionToken,
        email: normalizedEmail,
        message: 'Administrator authenticated successfully via Supabase Auth.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Supabase authentication verification failed.' });
    }
  }

  // 2. If password provided
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required for administrator login.' });
  }

  // If Supabase is configured, verify against Supabase Auth
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data.user) {
        return res.status(401).json({
          error: error?.message || 'Invalid email or password.',
        });
      }

      if (!isAuthorizedAdminEmail(data.user.email)) {
        return res.status(403).json({
          error: 'Access Denied: This account is not authorized as an administrator.',
        });
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      adminSessions.set(sessionToken, {
        token: sessionToken,
        email: normalizedEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 3600 * 1000,
      });

      return res.json({
        success: true,
        token: sessionToken,
        email: normalizedEmail,
        message: 'Administrator authenticated successfully.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Authentication service error.' });
    }
  }

  // 3. Fallback when Supabase is not yet configured in local development:
  // Server checks process.env.ADMIN_PASSWORD
  const expectedPassword = process.env.ADMIN_PASSWORD || inMemoryAdminPassword;

  if (expectedPassword) {
    if (password === expectedPassword) {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      adminSessions.set(sessionToken, {
        token: sessionToken,
        email: normalizedEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 3600 * 1000,
      });

      return res.json({
        success: true,
        token: sessionToken,
        email: normalizedEmail,
        message: 'Administrator authenticated successfully.',
      });
    } else {
      return res.status(401).json({
        error: 'Invalid administrator password.',
      });
    }
  } else {
    // If no password is set yet in the server environment, securely initialize it on first login
    inMemoryAdminPassword = password;
    const sessionToken = crypto.randomBytes(32).toString('hex');
    adminSessions.set(sessionToken, {
      token: sessionToken,
      email: normalizedEmail,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 3600 * 1000,
    });

    return res.json({
      success: true,
      token: sessionToken,
      email: normalizedEmail,
      initialized: true,
      message: 'Administrator password initialized and session created.',
    });
  }
}

/**
 * Handler for POST /api/admin/auth/logout
 */
export function handleAdminLogout(req: Request, res: Response) {
  const authHeader = req.headers['authorization'];
  const sessionHeader = req.headers['x-admin-session-token'];

  let token: string | undefined;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof sessionHeader === 'string') {
    token = sessionHeader.trim();
  }

  if (token) {
    adminSessions.delete(token);
  }

  res.json({ success: true, message: 'Administrator logged out successfully.' });
}

/**
 * Handler for GET /api/admin/auth/check
 */
export async function handleAdminCheck(req: Request, res: Response) {
  const authHeader = req.headers['authorization'];
  const sessionHeader = req.headers['x-admin-session-token'];

  let token: string | undefined;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof sessionHeader === 'string') {
    token = sessionHeader.trim();
  }

  if (!token) {
    return res.json({ authenticated: false });
  }

  const verification = await verifyAdminToken(token);
  if (verification.valid) {
    return res.json({
      authenticated: true,
      email: verification.email,
      role: 'admin',
    });
  }

  return res.json({ authenticated: false });
}
