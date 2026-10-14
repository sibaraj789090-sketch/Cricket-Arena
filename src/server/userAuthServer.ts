import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_STORE_PATH = path.resolve(__dirname, '../../users_store.json');

export const userAuthRouter = express.Router();

export interface StoredUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  role: 'user';
  avatarUrl: string;
  referralCode?: string;
  referredBy?: string | null;
  referralsCount?: number;
  totalReferralEarnings?: number;
  joinedTournamentsCount: number;
  totalFantasyPoints: number;
  createdTeamsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerCode: string;
  refereeId: string;
  refereeName: string;
  refereeIdentifier: string; // masked email or phone, e.g. "ro***@gmail.com"
  bonusCoins: number;
  status: 'completed' | 'pending';
  createdAt: string;
}

interface UserSession {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory user store
const usersMap = new Map<string, StoredUser>(); // id -> user
const emailIndex = new Map<string, string>(); // normalized email -> userId
const phoneIndex = new Map<string, string>(); // normalized phone -> userId
const referralCodeIndex = new Map<string, string>(); // uppercase referralCode -> userId

// Referrals persistent store
const REFERRALS_STORE_PATH = path.resolve(__dirname, '../../referrals_store.json');
let referralsList: ReferralRecord[] = [];

// Sessions store
const userSessions = new Map<string, UserSession>(); // token -> session

// Rate limiter store: identifier -> { attempts, lockedUntil }
const loginRateLimits = new Map<string, { attempts: number; lockedUntil: number }>();

export function generateReferralCode(name: string, userId: string): string {
  const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4) || 'CRIC';
  const idSuffix = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-3).toUpperCase() || '77';
  const randNum = Math.floor(10 + Math.random() * 90);
  return `${cleanName}${idSuffix}${randNum}`;
}

function loadPersistentReferrals() {
  try {
    if (fs.existsSync(REFERRALS_STORE_PATH)) {
      const raw = fs.readFileSync(REFERRALS_STORE_PATH, 'utf-8');
      const data: ReferralRecord[] = JSON.parse(raw);
      if (Array.isArray(data)) {
        referralsList = data;
      }
    }
  } catch (err) {
    console.warn('[UserAuth] Failed to load referrals_store.json:', err);
  }

  // Seed default demo referrals if empty
  if (referralsList.length === 0) {
    referralsList = [
      {
        id: 'ref-demo-1',
        referrerId: 'usr-demo-player-1',
        referrerCode: 'ROHIT77',
        refereeId: 'usr-ref-1',
        refereeName: 'Aman Sharma',
        refereeIdentifier: 'am***@gmail.com',
        bonusCoins: 50,
        status: 'completed',
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'ref-demo-2',
        referrerId: 'usr-demo-player-1',
        referrerCode: 'ROHIT77',
        refereeId: 'usr-ref-2',
        refereeName: 'Vikas Kumar',
        refereeIdentifier: '98******42',
        bonusCoins: 50,
        status: 'completed',
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      },
    ];
    savePersistentReferrals();
  }
}

function savePersistentReferrals() {
  try {
    fs.writeFileSync(REFERRALS_STORE_PATH, JSON.stringify(referralsList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UserAuth] Failed to write referrals_store.json:', err);
  }
}

// Load persistent users from local storage backup file
function loadPersistentUsers() {
  try {
    if (fs.existsSync(USERS_STORE_PATH)) {
      const raw = fs.readFileSync(USERS_STORE_PATH, 'utf-8');
      const data: StoredUser[] = JSON.parse(raw);
      if (Array.isArray(data)) {
        data.forEach((u) => {
          if (!u.referralCode) {
            u.referralCode = u.id === 'usr-demo-player-1' ? 'ROHIT77' : generateReferralCode(u.name, u.id);
            u.referralsCount = u.referralsCount || (u.id === 'usr-demo-player-1' ? 2 : 0);
            u.totalReferralEarnings = u.totalReferralEarnings || (u.id === 'usr-demo-player-1' ? 100 : 0);
          }
          usersMap.set(u.id, u);
          if (u.email) emailIndex.set(normalizeEmail(u.email), u.id);
          if (u.phone) phoneIndex.set(normalizePhone(u.phone), u.id);
          if (u.referralCode) referralCodeIndex.set(u.referralCode.toUpperCase(), u.id);
        });
      }
    }
  } catch (err) {
    console.warn('[UserAuth] Failed to load users_store.json, using in-memory store:', err);
  }

  // Ensure default demo player exists if store is empty
  if (usersMap.size === 0) {
    const demoPasswordHash = bcrypt.hashSync('Player123@', 10);
    const demoUser: StoredUser = {
      id: 'usr-demo-player-1',
      name: 'Rohit Sharma',
      email: 'rohit@cricketarena.app',
      phone: '9876543210',
      passwordHash: demoPasswordHash,
      role: 'user',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
      referralCode: 'ROHIT77',
      referralsCount: 2,
      totalReferralEarnings: 100,
      joinedTournamentsCount: 2,
      totalFantasyPoints: 480,
      createdTeamsCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    usersMap.set(demoUser.id, demoUser);
    emailIndex.set(normalizeEmail(demoUser.email!), demoUser.id);
    phoneIndex.set(normalizePhone(demoUser.phone!), demoUser.id);
    referralCodeIndex.set(demoUser.referralCode!.toUpperCase(), demoUser.id);
    savePersistentUsers();
  }
}

function savePersistentUsers() {
  try {
    const list = Array.from(usersMap.values());
    fs.writeFileSync(USERS_STORE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UserAuth] Failed to write users_store.json:', err);
  }
}

loadPersistentUsers();
loadPersistentReferrals();

// ==========================================
// VALIDATION & NORMALIZATION HELPERS
// ==========================================

export function normalizeEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  if (clean.endsWith('@gmail.com') || clean.endsWith('@googlemail.com')) {
    const domain = 'gmail.com';
    const atIndex = clean.indexOf('@');
    const localPart = clean.slice(0, atIndex);
    // Remove dots and ignore +tag aliases for robust Gmail deduplication
    const normalizedLocal = localPart.replace(/\./g, '').split('+')[0];
    return `${normalizedLocal}@${domain}`;
  }
  return clean;
}

export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  const basicRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!basicRegex.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com')) {
    const localPart = lower.split('@')[0];
    if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
      return false;
    }
    const cleanLocal = localPart.replace(/\./g, '').split('+')[0];
    if (cleanLocal.length < 3) return false;
  }
  return true;
}

export function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  // If Indian 12-digit format with country code 91
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }
  // If 11-digit starting with 0
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.slice(1);
  }
  return digitsOnly;
}

export function isValidPhoneFormat(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const normalized = normalizePhone(phone);
  // Standard 10-digit mobile number or standard 10 to 12 digit international number
  return /^[6-9]\d{9}$/.test(normalized) || /^\d{10,12}$/.test(normalized);
}

function sanitizeUser(u: StoredUser): UserProfile {
  return {
    id: u.id,
    name: u.name,
    email: u.email || '',
    phone: u.phone || undefined,
    role: u.role,
    avatarUrl: u.avatarUrl,
    referralCode: u.referralCode,
    referredBy: u.referredBy || undefined,
    referralsCount: u.referralsCount || 0,
    totalReferralEarnings: u.totalReferralEarnings || 0,
    joinedTournamentsCount: u.joinedTournamentsCount,
    totalFantasyPoints: u.totalFantasyPoints,
    createdTeamsCount: u.createdTeamsCount,
    joinedAt: u.createdAt,
  };
}

// Rate limiter check
function checkRateLimit(key: string): { allowed: boolean; remainingSeconds?: number } {
  const record = loginRateLimits.get(key);
  if (!record) return { allowed: true };

  if (Date.now() < record.lockedUntil) {
    const diff = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return { allowed: false, remainingSeconds: diff };
  }

  // Lock expired, reset
  if (Date.now() >= record.lockedUntil && record.lockedUntil > 0) {
    loginRateLimits.delete(key);
  }

  return { allowed: true };
}

function registerFailedAttempt(key: string) {
  const record = loginRateLimits.get(key) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) {
    // Lock for 15 minutes
    record.lockedUntil = Date.now() + 15 * 60 * 1000;
  }
  loginRateLimits.set(key, record);
}

function clearRateLimit(key: string) {
  loginRateLimits.delete(key);
}

// ==========================================
// 1. SIGN UP (NO OTP REQUIRED)
// ==========================================
userAuthRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, referralCode } = req.body;

    // Validate Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid full name (at least 2 characters).',
      });
    }

    // Validate Password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    // Ensure at least one contact method (email or phone) is provided
    const rawEmail = typeof email === 'string' ? email.trim() : '';
    const rawPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!rawEmail && !rawPhone) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either a Gmail address or a Mobile Phone number to create your account.',
      });
    }

    let cleanEmail: string | null = null;
    let cleanPhone: string | null = null;

    // Validate Email if provided
    if (rawEmail) {
      if (!isValidEmailFormat(rawEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Gmail / Email address format. Please check and try again.',
        });
      }
      cleanEmail = normalizeEmail(rawEmail);
    }

    // Validate Phone if provided
    if (rawPhone) {
      if (!isValidPhoneFormat(rawPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Mobile Number. Please enter a valid 10-digit mobile number.',
        });
      }
      cleanPhone = normalizePhone(rawPhone);
    }

    // Check for duplicate account by Email
    if (cleanEmail) {
      const existingIdByEmail = emailIndex.get(cleanEmail);
      if (existingIdByEmail && usersMap.has(existingIdByEmail)) {
        return res.status(409).json({
          success: false,
          error: 'An account with this Gmail address already exists. Please Sign In.',
        });
      }
    }

    // Check for duplicate account by Phone
    if (cleanPhone) {
      const existingIdByPhone = phoneIndex.get(cleanPhone);
      if (existingIdByPhone && usersMap.has(existingIdByPhone)) {
        return res.status(409).json({
          success: false,
          error: 'An account with this phone number already exists. Please Sign In.',
        });
      }
    }

    // Check Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        if (cleanEmail) {
          const { data: existingSbEmail } = await supabase
            .from('app_users')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (existingSbEmail) {
            return res.status(409).json({
              success: false,
              error: 'An account with this Gmail address already exists. Please Sign In.',
            });
          }
        }

        if (cleanPhone) {
          const { data: existingSbPhone } = await supabase
            .from('app_users')
            .select('id')
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (existingSbPhone) {
            return res.status(409).json({
              success: false,
              error: 'An account with this phone number already exists. Please Sign In.',
            });
          }
        }
      } catch (sbErr) {
        console.warn('[UserAuth] Supabase duplicate check warning:', sbErr);
      }
    }

    // Hash Password securely using bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    // Process Referral Code if provided
    const cleanRefCode = typeof referralCode === 'string' ? referralCode.trim().toUpperCase() : '';
    let matchedReferrer: StoredUser | null = null;

    if (cleanRefCode) {
      const referrerId = referralCodeIndex.get(cleanRefCode);
      if (referrerId && usersMap.has(referrerId)) {
        matchedReferrer = usersMap.get(referrerId)!;
      }
    }

    // Generate unique user ID, timestamps, and referral code
    const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const avatarUrl = `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80`;
    const userReferralCode = generateReferralCode(name, userId);

    const newUser: StoredUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      role: 'user', // strictly regular player
      avatarUrl,
      referralCode: userReferralCode,
      referredBy: matchedReferrer ? (matchedReferrer.referralCode || cleanRefCode) : null,
      referralsCount: 0,
      totalReferralEarnings: 0,
      joinedTournamentsCount: 0,
      totalFantasyPoints: 0,
      createdTeamsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in-memory and write to persistent store
    usersMap.set(userId, newUser);
    if (cleanEmail) emailIndex.set(cleanEmail, userId);
    if (cleanPhone) phoneIndex.set(cleanPhone, userId);
    referralCodeIndex.set(userReferralCode.toUpperCase(), userId);

    // Award referral reward to referrer and log referral
    if (matchedReferrer && matchedReferrer.id !== newUser.id) {
      matchedReferrer.referralsCount = (matchedReferrer.referralsCount || 0) + 1;
      matchedReferrer.totalReferralEarnings = (matchedReferrer.totalReferralEarnings || 0) + 50;
      usersMap.set(matchedReferrer.id, matchedReferrer);

      const referralRecord: ReferralRecord = {
        id: `ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        referrerId: matchedReferrer.id,
        referrerCode: matchedReferrer.referralCode || cleanRefCode,
        refereeId: newUser.id,
        refereeName: newUser.name,
        refereeIdentifier: cleanEmail
          ? `${cleanEmail.slice(0, 2)}***@${cleanEmail.split('@')[1]}`
          : `${cleanPhone ? `${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)}` : 'Friend'}`,
        bonusCoins: 50,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      referralsList.unshift(referralRecord);
      savePersistentReferrals();
    }

    savePersistentUsers();

    // Persist to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('app_users').insert({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          password_hash: newUser.passwordHash,
          role: 'user',
          avatar_url: newUser.avatarUrl,
          joined_tournaments_count: 0,
          total_fantasy_points: 0,
          created_teams_count: 0,
          created_at: newUser.createdAt,
          updated_at: newUser.updatedAt,
        });
      } catch (sbInsertErr) {
        console.warn('[UserAuth] Supabase app_users insert warning:', sbInsertErr);
      }
    }

    // Issue cryptographic session token (30 days validity)
    const token = crypto.randomBytes(32).toString('hex');
    userSessions.set(token, {
      token,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
    });

    const sanitized = sanitizeUser(newUser);

    return res.status(201).json({
      success: true,
      message: matchedReferrer
        ? `Registration successful! Referral code applied from ${matchedReferrer.name}. +50 Welcome Bonus Credits unlocked!`
        : 'Registration successful! Welcome to Cricket Arena.',
      user: sanitized,
      token,
      authMethod: cleanEmail ? 'email' : 'phone',
      referralApplied: Boolean(matchedReferrer),
      referrerName: matchedReferrer?.name,
      bonusCoinsAwarded: matchedReferrer ? 50 : 0,
    });
  } catch (err: any) {
    console.error('[UserAuth] Registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during registration. Please try again.',
    });
  }
});

// ==========================================
// 2. LOGIN (GMAIL OR PHONE + PASSWORD, NO OTP)
// ==========================================
userAuthRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, email, phone, password } = req.body;

    const rawInput = (identifier || email || phone || '').trim();

    if (!rawInput) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your registered Gmail address or Mobile Number.',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Please enter your account password.',
      });
    }

    // Determine whether input is Email or Phone Number
    const isEmailInput = rawInput.includes('@');
    let searchEmail: string | null = null;
    let searchPhone: string | null = null;

    if (isEmailInput) {
      searchEmail = normalizeEmail(rawInput);
    } else {
      searchPhone = normalizePhone(rawInput);
    }

    const rateLimitKey = searchEmail || searchPhone || req.ip || 'general';
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Please wait ${Math.ceil((rateCheck.remainingSeconds || 900) / 60)} minute(s) before trying again.`,
        locked: true,
      });
    }

    // Look up user in memory/file store
    let matchedUser: StoredUser | null = null;

    if (searchEmail) {
      const userId = emailIndex.get(searchEmail);
      if (userId && usersMap.has(userId)) {
        matchedUser = usersMap.get(userId)!;
      }
    } else if (searchPhone) {
      const userId = phoneIndex.get(searchPhone);
      if (userId && usersMap.has(userId)) {
        matchedUser = usersMap.get(userId)!;
      }
    }

    // If not found in local memory, check Supabase app_users table
    if (!matchedUser && isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('app_users').select('*');
        if (searchEmail) {
          query = query.eq('email', searchEmail);
        } else if (searchPhone) {
          query = query.eq('phone', searchPhone);
        }

        const { data: sbUser } = await query.maybeSingle();
        if (sbUser) {
          matchedUser = {
            id: sbUser.id,
            name: sbUser.name,
            email: sbUser.email,
            phone: sbUser.phone,
            passwordHash: sbUser.password_hash,
            role: 'user',
            avatarUrl: sbUser.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
            joinedTournamentsCount: sbUser.joined_tournaments_count || 0,
            totalFantasyPoints: sbUser.total_fantasy_points || 0,
            createdTeamsCount: sbUser.created_teams_count || 0,
            createdAt: sbUser.created_at || new Date().toISOString(),
            updatedAt: sbUser.updated_at || new Date().toISOString(),
          };

          // Cache in local store
          usersMap.set(matchedUser.id, matchedUser);
          if (matchedUser.email) emailIndex.set(normalizeEmail(matchedUser.email), matchedUser.id);
          if (matchedUser.phone) phoneIndex.set(normalizePhone(matchedUser.phone), matchedUser.id);
        }
      } catch (sbLookupErr) {
        console.warn('[UserAuth] Supabase user lookup warning:', sbLookupErr);
      }
    }

    if (!matchedUser) {
      registerFailedAttempt(rateLimitKey);
      return res.status(404).json({
        success: false,
        error: isEmailInput
          ? 'No account found with this Gmail address. Please verify or Sign Up.'
          : 'No account found with this mobile number. Please verify or Sign Up.',
      });
    }

    // Verify Password securely using bcrypt
    const passwordMatch = await bcrypt.compare(password, matchedUser.passwordHash);
    if (!passwordMatch) {
      registerFailedAttempt(rateLimitKey);
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Please try again.',
      });
    }

    // Login successful - Clear rate limits
    clearRateLimit(rateLimitKey);

    // Issue cryptographic session token (30 days validity)
    const token = crypto.randomBytes(32).toString('hex');
    userSessions.set(token, {
      token,
      userId: matchedUser.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
    });

    const sanitized = sanitizeUser(matchedUser);

    return res.json({
      success: true,
      message: `Welcome back, ${sanitized.name}!`,
      user: sanitized,
      token,
      authMethod: isEmailInput ? 'email' : 'phone',
    });
  } catch (err: any) {
    console.error('[UserAuth] Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during sign in. Please try again.',
    });
  }
});

// ==========================================
// 3. GET CURRENT USER PROFILE (/me)
// ==========================================
userAuthRouter.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-user-session-token'];

  let token: string | undefined;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof customHeader === 'string') {
    token = customHeader.trim();
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'User session token missing.' });
  }

  const session = userSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) userSessions.delete(token);
    return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
  }

  const user = usersMap.get(session.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User account not found.' });
  }

  return res.json({
    success: true,
    user: sanitizeUser(user),
  });
});

// ==========================================
// 4. LOGOUT
// ==========================================
userAuthRouter.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-user-session-token'];

  let token: string | undefined;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof customHeader === 'string') {
    token = customHeader.trim();
  }

  if (token) {
    userSessions.delete(token);
  }

  return res.json({
    success: true,
    message: 'Logged out successfully.',
  });
});

// ==========================================
// 5. REFERRAL CODE VALIDATION
// ==========================================
userAuthRouter.get('/validate-referral/:code', (req: Request, res: Response) => {
  const code = (req.params.code || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ success: false, valid: false, error: 'Referral code is required.' });
  }

  const referrerId = referralCodeIndex.get(code);
  if (!referrerId || !usersMap.has(referrerId)) {
    return res.json({ success: false, valid: false, error: 'Invalid or unrecognized referral code.' });
  }

  const referrer = usersMap.get(referrerId)!;
  return res.json({
    success: true,
    valid: true,
    referralCode: code,
    referrerName: referrer.name.split(' ')[0] || 'Friend',
    welcomeBonusCoins: 50,
  });
});

// ==========================================
// 6. REFERRAL STATS & HISTORY
// ==========================================
userAuthRouter.get('/referrals/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = usersMap.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const userReferrals = referralsList.filter((r) => r.referrerId === userId);
  const totalEarned = userReferrals.reduce((sum, r) => sum + r.bonusCoins, 0);

  return res.json({
    success: true,
    referralCode: user.referralCode || 'CRIC-ARENA',
    referralsCount: userReferrals.length,
    totalBonusEarned: totalEarned,
    bonusPerReferral: 50,
    welcomeBonus: 50,
    referrals: userReferrals,
  });
});

userAuthRouter.get('/my-referrals', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-user-session-token'];

  let token: string | undefined;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof customHeader === 'string') {
    token = customHeader.trim();
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Session token missing.' });
  }

  const session = userSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    return res.status(401).json({ success: false, error: 'Session expired.' });
  }

  const user = usersMap.get(session.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const userReferrals = referralsList.filter((r) => r.referrerId === user.id);
  const totalEarned = userReferrals.reduce((sum, r) => sum + r.bonusCoins, 0);

  return res.json({
    success: true,
    referralCode: user.referralCode || 'CRIC-ARENA',
    referralsCount: userReferrals.length,
    totalBonusEarned: totalEarned,
    bonusPerReferral: 50,
    welcomeBonus: 50,
    referrals: userReferrals,
  });
});
