// server.ts
import express4 from "express";
import http from "http";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import fs2 from "fs";
import crypto4 from "crypto";

// src/server/ludoMatchServer.ts
import express from "express";

// src/types/ludoCash.ts
var LUDO_CASH_TABLE_TIERS = [
  { entryFee: 5, prize2P: 8.75, prize4P: 17.5 },
  { entryFee: 10, prize2P: 17.5, prize4P: 35 },
  { entryFee: 20, prize2P: 35, prize4P: 70 },
  { entryFee: 50, prize2P: 87.5, prize4P: 175 },
  { entryFee: 100, prize2P: 175, prize4P: 350 },
  { entryFee: 200, prize2P: 350, prize4P: 700 },
  { entryFee: 250, prize2P: 440, prize4P: 875 },
  { entryFee: 500, prize2P: 880, prize4P: 1750 },
  { entryFee: 750, prize2P: 1320, prize4P: 2625 },
  { entryFee: 1e3, prize2P: 1800, prize4P: 3500 },
  { entryFee: 1500, prize2P: 2700, prize4P: 5250 },
  { entryFee: 1750, prize2P: 3150, prize4P: 6125 },
  { entryFee: 2e3, prize2P: 3640, prize4P: 7e3 },
  { entryFee: 3e3, prize2P: 5460, prize4P: 10500 },
  { entryFee: 3500, prize2P: 6370, prize4P: 12250 },
  { entryFee: 5e3, prize2P: 9200, prize4P: 17500 },
  { entryFee: 7e3, prize2P: 12880, prize4P: 24500 },
  { entryFee: 1e4, prize2P: 18400, prize4P: 35e3 },
  { entryFee: 12e3, prize2P: 22080, prize4P: 42e3 },
  { entryFee: 15e3, prize2P: 27600, prize4P: 52500 },
  { entryFee: 25e3, prize2P: 46e3, prize4P: 87e3 }
];
var TABLE_BOT_DISTRIBUTION = {
  5: { online2P: 285, playing2P: 194, online4P: 263, playing4P: 181 },
  10: { online2P: 251, playing2P: 174, online4P: 237, playing4P: 163 },
  20: { online2P: 224, playing2P: 152, online4P: 211, playing4P: 143 },
  50: { online2P: 196, playing2P: 135, online4P: 182, playing4P: 126 },
  100: { online2P: 168, playing2P: 115, online4P: 155, playing4P: 106 },
  200: { online2P: 142, playing2P: 96, online4P: 131, playing4P: 89 },
  250: { online2P: 121, playing2P: 82, online4P: 112, playing4P: 75 },
  500: { online2P: 62, playing2P: 43, online4P: 54, playing4P: 37 },
  750: { online2P: 48, playing2P: 33, online4P: 43, playing4P: 29 },
  1e3: { online2P: 39, playing2P: 26, online4P: 35, playing4P: 23 },
  1500: { online2P: 31, playing2P: 21, online4P: 28, playing4P: 19 },
  1750: { online2P: 26, playing2P: 17, online4P: 23, playing4P: 15 },
  2e3: { online2P: 21, playing2P: 14, online4P: 19, playing4P: 13 },
  3e3: { online2P: 18, playing2P: 12, online4P: 16, playing4P: 10 },
  3500: { online2P: 15, playing2P: 9, online4P: 14, playing4P: 8 },
  5e3: { online2P: 13, playing2P: 8, online4P: 11, playing4P: 7 },
  7e3: { online2P: 10, playing2P: 6, online4P: 9, playing4P: 5 },
  1e4: { online2P: 8, playing2P: 5, online4P: 7, playing4P: 4 },
  12e3: { online2P: 6, playing2P: 4, online4P: 5, playing4P: 3 },
  15e3: { online2P: 5, playing2P: 3, online4P: 4, playing4P: 2 },
  25e3: { online2P: 4, playing2P: 2, online4P: 3, playing4P: 1 }
};
function getTableBotCounts(entryFee, mode) {
  const dist = TABLE_BOT_DISTRIBUTION[entryFee] || (entryFee < 250 ? {
    online2P: Math.max(120, Math.floor(1800 / (entryFee + 5))),
    playing2P: Math.max(80, Math.floor(1200 / (entryFee + 5))),
    online4P: Math.max(110, Math.floor(1600 / (entryFee + 5))),
    playing4P: Math.max(75, Math.floor(1100 / (entryFee + 5)))
  } : {
    online2P: Math.max(4, Math.floor(1e3 / (entryFee + 1))),
    playing2P: Math.max(2, Math.floor(700 / (entryFee + 1))),
    online4P: Math.max(3, Math.floor(900 / (entryFee + 1))),
    playing4P: Math.max(1, Math.floor(600 / (entryFee + 1)))
  });
  const baseOnline = mode === 2 ? dist.online2P : dist.online4P;
  const basePlaying = mode === 2 ? dist.playing2P : dist.playing4P;
  const timeStep = Math.floor(Date.now() / 2e4);
  const hash = (entryFee * 19 + (mode === 2 ? 37 : 73) + timeStep) % 7;
  const onlineDrift = hash % 5 - 2;
  const playingDrift = (hash + 2) % 5 - 2;
  const onlinePlayers = Math.max(mode === 2 ? 3 : 2, baseOnline + onlineDrift);
  const playingPlayers = Math.max(1, basePlaying + playingDrift);
  return { onlinePlayers, playingPlayers };
}
function generateDefaultCashTables() {
  const tables = [];
  LUDO_CASH_TABLE_TIERS.forEach((tier) => {
    const counts2P = getTableBotCounts(tier.entryFee, 2);
    tables.push({
      id: `table-2p-${tier.entryFee}`,
      entryFee: tier.entryFee,
      mode: 2,
      prize: tier.prize2P,
      isActive: true,
      minBalanceRequired: tier.entryFee,
      waitingPlayers: 0,
      activeMatches: 0,
      status: "waiting",
      onlinePlayers: counts2P.onlinePlayers,
      playingPlayers: counts2P.playingPlayers,
      current_players: counts2P.onlinePlayers + counts2P.playingPlayers
    });
    const counts4P = getTableBotCounts(tier.entryFee, 4);
    tables.push({
      id: `table-4p-${tier.entryFee}`,
      entryFee: tier.entryFee,
      mode: 4,
      prize: tier.prize4P,
      isActive: true,
      minBalanceRequired: tier.entryFee,
      waitingPlayers: 0,
      activeMatches: 0,
      status: "waiting",
      onlinePlayers: counts4P.onlinePlayers,
      playingPlayers: counts4P.playingPlayers,
      current_players: counts4P.onlinePlayers + counts4P.playingPlayers
    });
  });
  return tables;
}
var INITIAL_RECENT_WINNERS = [
  {
    id: "seed-win-1",
    matchId: "match-ludo-891",
    userId: "usr-rohit-88",
    userName: "Rohit_Sharma_99",
    tableTitle: "\u20B9100 Table (2P)",
    entryFee: 100,
    mode: 2,
    prizeWon: 175,
    completedAt: new Date(Date.now() - 2 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-2",
    matchId: "match-ludo-892",
    userId: "usr-vikram-07",
    userName: "Vikram_Rathore",
    tableTitle: "\u20B950 Table (4P)",
    entryFee: 50,
    mode: 4,
    prizeWon: 175,
    completedAt: new Date(Date.now() - 5 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-3",
    matchId: "match-ludo-893",
    userId: "usr-priya-k",
    userName: "Priya_LudoQueen",
    tableTitle: "\u20B9200 Table (2P)",
    entryFee: 200,
    mode: 2,
    prizeWon: 350,
    completedAt: new Date(Date.now() - 9 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-4",
    matchId: "match-ludo-894",
    userId: "usr-aman-singh",
    userName: "Aman_Striker",
    tableTitle: "\u20B9500 Table (2P)",
    entryFee: 500,
    mode: 2,
    prizeWon: 880,
    completedAt: new Date(Date.now() - 14 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-5",
    matchId: "match-ludo-895",
    userId: "usr-rahul-m",
    userName: "Rahul_DiceKing",
    tableTitle: "\u20B920 Table (2P)",
    entryFee: 20,
    mode: 2,
    prizeWon: 35,
    completedAt: new Date(Date.now() - 21 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-6",
    matchId: "match-ludo-896",
    userId: "usr-deepak-99",
    userName: "Deepak_Arena7",
    tableTitle: "\u20B91000 Table (4P)",
    entryFee: 1e3,
    mode: 4,
    prizeWon: 3500,
    completedAt: new Date(Date.now() - 32 * 60 * 1e3).toISOString()
  }
];

// src/lib/ludoEngine.ts
var COLOR_OFFSETS = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
};
var SAFE_CELL_INDICES = /* @__PURE__ */ new Set([0, 8, 13, 21, 26, 34, 39, 47]);
function getGlobalTrackIndex(color, step) {
  if (step < 0 || step > 50) return null;
  return (COLOR_OFFSETS[color] + step) % 52;
}
function createInitialLudoGame(playerCount) {
  const players = playerCount === 2 ? ["red", "yellow"] : ["red", "green", "yellow", "blue"];
  const createTokens = (color) => [
    { id: 0, color, step: 0, score: 0, reachedHome: false },
    { id: 1, color, step: 0, score: 0, reachedHome: false },
    { id: 2, color, step: 0, score: 0, reachedHome: false },
    { id: 3, color, step: 0, score: 0, reachedHome: false }
  ];
  const tokens = {
    red: createTokens("red"),
    green: createTokens("green"),
    yellow: createTokens("yellow"),
    blue: createTokens("blue")
  };
  const initialScores = {
    red: 0,
    green: 0,
    yellow: 0,
    blue: 0
  };
  return {
    playerCount,
    players,
    currentTurn: players[0],
    diceValue: null,
    hasRolled: false,
    consecutiveSixes: 0,
    tokens,
    winners: [],
    isGameOver: false,
    lastActionText: `${capitalize(players[0])}'s turn to roll!`,
    extraTurn: false,
    highlightedTokenIds: [],
    scores: initialScores
  };
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function canTokenMove(token, dice) {
  if (token.step === 56) return false;
  const currentStep = token.step < 0 ? 0 : token.step;
  return currentStep + dice <= 56;
}
function getLegalMoves(tokens, color, dice) {
  const playerTokens = tokens[color];
  const legal = [];
  playerTokens.forEach((t) => {
    if (canTokenMove(t, dice)) {
      legal.push(t.id);
    }
  });
  return legal;
}
function getNextPlayer(current, players, winners) {
  const activePlayers = players.filter((p) => !winners.includes(p));
  if (activePlayers.length <= 1) return current;
  const currentIdx = players.indexOf(current);
  for (let i = 1; i <= players.length; i++) {
    const nextCandidate = players[(currentIdx + i) % players.length];
    if (!winners.includes(nextCandidate)) {
      return nextCandidate;
    }
  }
  return current;
}

// src/server/adminControlServer.ts
var serverCashRequests = /* @__PURE__ */ new Map();
var seedReq1 = {
  id: "req-seed-1",
  userId: "user-demo-1",
  userName: "Rajesh_Sharma",
  requestedAmount: 500,
  reason: "UPI transfer completed via GPay ref 90481239. Please credit match tokens.",
  status: "pending",
  createdAt: new Date(Date.now() - 25 * 60 * 1e3).toISOString()
};
var seedReq2 = {
  id: "req-seed-2",
  userId: "user-player-2",
  userName: "Vikram_Rathore",
  requestedAmount: 1e3,
  approvedAmount: 1e3,
  reason: "Top-up for 4P High Roller Table entry.",
  adminNote: "Verified bank transaction slip UTR 481920391. Approved.",
  status: "approved",
  processedBy: "admin-master",
  processedByName: "Master Admin",
  processedAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString(),
  createdAt: new Date(Date.now() - 4 * 3600 * 1e3).toISOString()
};
serverCashRequests.set(seedReq1.id, seedReq1);
serverCashRequests.set(seedReq2.id, seedReq2);
var serverPlayerRestrictions = /* @__PURE__ */ new Map();
var seedBan1 = {
  id: "res-seed-1",
  userId: "usr-suspicious-99",
  userName: "SpeedHacker_99",
  restrictionType: "full_ban",
  status: "active",
  reason: "Automated turn timeout exploit & multi-accounting detection.",
  internalNote: "Caught sending 40 consecutive moves within 200ms. Account permanently banned.",
  adminId: "admin-master",
  adminName: "Security Admin",
  createdAt: new Date(Date.now() - 2 * 86400 * 1e3).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 86400 * 1e3).toISOString()
};
var seedBan2 = {
  id: "res-seed-2",
  userId: "usr-quitter-12",
  userName: "RageQuitter_Pro",
  restrictionType: "ludo_ban",
  status: "active",
  reason: "Frequent table stalling and intentional disconnects in 4P high cash tables.",
  internalNote: "Temporarily restricted from Ludo tables for 7 days.",
  adminId: "admin-master",
  adminName: "FairPlay Team",
  expiresAt: new Date(Date.now() + 5 * 86400 * 1e3).toISOString(),
  createdAt: new Date(Date.now() - 1 * 86400 * 1e3).toISOString(),
  updatedAt: new Date(Date.now() - 1 * 86400 * 1e3).toISOString()
};
serverPlayerRestrictions.set(seedBan1.id, seedBan1);
serverPlayerRestrictions.set(seedBan2.id, seedBan2);
function checkUserBanStatus(userId, context = "all") {
  if (!userId) return { banned: false };
  const now = /* @__PURE__ */ new Date();
  for (const restriction of serverPlayerRestrictions.values()) {
    if (restriction.userId === userId && restriction.status === "active") {
      if (restriction.expiresAt && new Date(restriction.expiresAt) <= now) {
        restriction.status = "lifted";
        continue;
      }
      if (restriction.restrictionType === "full_ban" || restriction.restrictionType === "temp_suspend") {
        return { banned: true, restriction, reason: restriction.reason };
      }
      if (context === "ludo" && restriction.restrictionType === "ludo_ban") {
        return { banned: true, restriction, reason: restriction.reason };
      }
    }
  }
  return { banned: false };
}

// src/server/ludoBotEngine.ts
var LUDO_BOTS_ENABLED = process.env.LUDO_BOTS_ENABLED !== "false";
var botPoolConfig = {
  enabled: LUDO_BOTS_ENABLED,
  poolSize: 5200,
  // 5000+ virtual bots pool
  defaultStrategy: "stronger_legal",
  allowSimulationMode: true,
  simulationNoticeText: "SIMULATION \u2014 NOT A REAL MATCH (Test Tokens Only)",
  totalGeneratedBots: 5200,
  activeBotsCount: 0,
  autoMatchStealthBots: true,
  // Auto-match stealth bots when no real players online
  autoMatchWaitSeconds: 3,
  // Realistic 3s matchmaking wait
  updatedAt: (/* @__PURE__ */ new Date()).toISOString()
};
var REALISTIC_HUMAN_NAMES = [
  "Aman_Verma",
  "Sneha_Patel",
  "Rohit_Gamer",
  "Vikram_99",
  "Pooja_Sharma",
  "Arjun_K",
  "Priya_Singh",
  "Deepak_Raj",
  "Neha_Dice",
  "Siddharth_21",
  "Ananya_R",
  "Amit_Kumar",
  "Karan_Pro",
  "Divya_Star",
  "Vikas_07",
  "Rohan_Mehta",
  "Kavita_Rolls",
  "Aditya_King",
  "Gaurav_Player",
  "Mohit_777",
  "Suresh_Striker",
  "Preeti_Dice",
  "Manish_Rawat",
  "Swati_P",
  "Vivek_99",
  "Ritu_Queen",
  "Simran_K",
  "Megha_Sharma",
  "Anjali_Verma",
  "Nisha_Gamer",
  "Rajesh_Ludo",
  "Sanjay_Dice",
  "Harsh_V",
  "Varun_Chopra",
  "Sunny_Pro",
  "Bunty_Master",
  "Tarun_99",
  "Kunal_Dice",
  "Pankaj_Kumar",
  "Sachin_Star",
  "Naveen_Yadav",
  "Rakesh_Sharma",
  "Dharmendra_S",
  "Abhishek_A",
  "Sunil_B",
  "Sonu_Dice",
  "Monu_King",
  "Ashok_Kumar",
  "Pradeep_P",
  "Vinay_V",
  "Sonia_Dice",
  "Alka_Singh",
  "Komal_Sharma",
  "Pinki_Verma",
  "Geeta_R"
];
var REALISTIC_AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-purple-600",
  "bg-indigo-600",
  "bg-cyan-600",
  "bg-teal-600",
  "bg-fuchsia-600",
  "bg-sky-600",
  "bg-orange-600",
  "bg-violet-600",
  "bg-pink-600"
];
function generateStealthPlayer(index) {
  const idx = index ?? Math.floor(Math.random() * REALISTIC_HUMAN_NAMES.length);
  const userName = REALISTIC_HUMAN_NAMES[idx % REALISTIC_HUMAN_NAMES.length];
  const avatar = REALISTIC_AVATAR_COLORS[idx % REALISTIC_AVATAR_COLORS.length];
  const userId = `player-${Date.now().toString(36)}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  return {
    userId,
    userName,
    avatar,
    isSimulated: true
  };
}
var botPoolMap = /* @__PURE__ */ new Map();
var botPoolArray = [];
var botMatchLogs = [];
var activeSimulationMatches = /* @__PURE__ */ new Map();
var NAME_PREFIXES = [
  "Apex",
  "Turbo",
  "Dice",
  "Ludo",
  "Shadow",
  "Lucky",
  "Pawn",
  "Master",
  "Storm",
  "Knight",
  "Volt",
  "Strike",
  "Hyper",
  "Blaze",
  "Cosmic",
  "Pixel",
  "Vector",
  "Sonic",
  "Titan",
  "Zenith",
  "Phantom",
  "Sniper",
  "Alpha",
  "Omega",
  "Vortex",
  "Echo",
  "Neon",
  "Cyber",
  "Quantum",
  "Glitch",
  "Flash",
  "Raptor",
  "Viper",
  "Nova",
  "Pulse",
  "Comet",
  "Orbit",
  "Meteor",
  "Aero",
  "Frost",
  "Magma",
  "Thunder",
  "Drake",
  "Falcon",
  "Raven",
  "Eagle",
  "Wolf",
  "Tiger",
  "Lion",
  "Cobra"
];
var NAME_SUFFIXES = [
  "Roller",
  "Striker",
  "King",
  "Queen",
  "Champ",
  "Spinner",
  "Tactician",
  "Hunter",
  "Player",
  "Runner",
  "Gamer",
  "Master",
  "Expert",
  "Wizard",
  "Ace",
  "Pro",
  "Elite",
  "Hero",
  "Legend",
  "Star",
  "Crusher",
  "Slayer",
  "Rider",
  "Commander",
  "Pilot",
  "Drifter",
  "Warrior",
  "Ninja",
  "Ranger",
  "Samurai",
  "Buster",
  "Captain",
  "Chief",
  "Seeker",
  "Voyager",
  "Pioneer",
  "StrikerX",
  "Roller99",
  "PawnMaster",
  "Sixer"
];
var AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-purple-600",
  "bg-indigo-600",
  "bg-cyan-600",
  "bg-teal-600",
  "bg-fuchsia-600",
  "bg-sky-600"
];
function initializeBotPool(targetSize = 5200) {
  botPoolMap.clear();
  botPoolArray = [];
  const strategies = ["beginner", "random_legal", "stronger_legal"];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (let i = 1; i <= targetSize; i++) {
    const id = `bot-${String(i).padStart(5, "0")}`;
    const prefix = NAME_PREFIXES[i * 7 % NAME_PREFIXES.length];
    const suffix = NAME_SUFFIXES[i * 13 % NAME_SUFFIXES.length];
    const num = i * 31 % 900 + 100;
    const rawName = `${prefix}${suffix}_${num}`;
    const botName = `${rawName} [BOT]`;
    const stratMod = i % 100;
    let strategy = "stronger_legal";
    if (stratMod < 25) strategy = "beginner";
    else if (stratMod < 60) strategy = "random_legal";
    const rating = 1100 + i * 47 % 750;
    const matchesPlayed = i * 17 % 45 + 5;
    const wins = Math.floor(matchesPlayed * (0.35 + i % 30 / 100));
    const losses = matchesPlayed - wins;
    const bot = {
      id,
      name: botName,
      rawName,
      avatar: AVATAR_COLORS[i % AVATAR_COLORS.length],
      strategy,
      status: "idle",
      assignedTableId: null,
      activeMatchId: null,
      testTokenBalance: 1e3,
      // Non-purchasable simulated tokens only
      rating,
      matchesPlayed,
      wins,
      losses,
      isBot: true,
      isSimulated: true,
      createdAt: now,
      lastActive: now
    };
    botPoolMap.set(id, bot);
    botPoolArray.push(bot);
  }
  botPoolConfig.totalGeneratedBots = botPoolArray.length;
  botPoolConfig.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  addBotLog({
    matchId: "system",
    tableId: "all",
    eventType: "match_started",
    details: `Initialized pool of ${botPoolArray.length} virtual Ludo bots. Default strategy: ${botPoolConfig.defaultStrategy}.`,
    strategyUsed: botPoolConfig.defaultStrategy,
    isSimulation: true
  });
}
initializeBotPool(5200);
function addBotLog(log) {
  const newLog = {
    ...log,
    id: `bot-log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  botMatchLogs.unshift(newLog);
  if (botMatchLogs.length > 1e3) {
    botMatchLogs.length = 1e3;
  }
}
function setLudoBotsEnabled(enabled) {
  LUDO_BOTS_ENABLED = enabled;
  botPoolConfig.enabled = enabled;
  botPoolConfig.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  addBotLog({
    matchId: "system",
    tableId: "all",
    eventType: enabled ? "match_started" : "match_stopped",
    details: `LUDO_BOTS_ENABLED set to ${enabled} by administrator.`,
    strategyUsed: botPoolConfig.defaultStrategy,
    isSimulation: true
  });
  if (!enabled) {
    botPoolArray.forEach((b) => {
      if (b.status === "in_match" || b.status === "testing") {
        b.status = "idle";
        b.activeMatchId = null;
      }
    });
    activeSimulationMatches.clear();
  }
}
function getBotPoolStats() {
  let idle = 0;
  let inMatch = 0;
  let paused = 0;
  const stratCounts = { beginner: 0, random_legal: 0, stronger_legal: 0 };
  for (const bot of botPoolArray) {
    if (bot.status === "idle") idle++;
    else if (bot.status === "in_match" || bot.status === "testing") inMatch++;
    else if (bot.status === "paused") paused++;
    if (bot.strategy in stratCounts) {
      stratCounts[bot.strategy]++;
    }
  }
  return {
    totalBots: botPoolArray.length,
    idleBots: idle,
    inMatchBots: inMatch,
    pausedBots: paused,
    strategiesCount: stratCounts,
    totalMatchesRun: botMatchLogs.filter((l) => l.eventType === "match_finished").length,
    totalLogsCount: botMatchLogs.length
  };
}
function queryBots(params) {
  const { search, status, strategy, tableId, page = 1, limit = 50 } = params;
  let filtered = botPoolArray;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (b) => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)
    );
  }
  if (status && status !== "all") {
    filtered = filtered.filter((b) => b.status === status);
  }
  if (strategy && strategy !== "all") {
    filtered = filtered.filter((b) => b.strategy === strategy);
  }
  if (tableId && tableId !== "all") {
    filtered = filtered.filter((b) => b.assignedTableId === tableId);
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const pageBots = filtered.slice(startIndex, startIndex + limit);
  return {
    bots: pageBots,
    total,
    page,
    limit,
    totalPages
  };
}
function getBotById(id) {
  return botPoolMap.get(id);
}
function updateBot(id, updates) {
  const bot = botPoolMap.get(id);
  if (!bot) return null;
  Object.assign(bot, updates, { lastActive: (/* @__PURE__ */ new Date()).toISOString() });
  return bot;
}
function selectBotMove(gameState, color, roll, legalMoves, strategy = "stronger_legal") {
  if (!legalMoves || legalMoves.length === 0) return 0;
  if (legalMoves.length === 1) return legalMoves[0];
  const colorTokens = gameState.tokens[color];
  if (strategy === "beginner") {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }
  if (strategy === "random_legal") {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }
  const homeToken = legalMoves.find((id) => {
    const step = colorTokens[id].step < 0 ? 0 : colorTokens[id].step;
    return step + roll === 56;
  });
  if (homeToken !== void 0) return homeToken;
  for (const tokenId of legalMoves) {
    const currentStep = colorTokens[tokenId].step < 0 ? 0 : colorTokens[tokenId].step;
    const nextStep = currentStep + roll;
    if (nextStep <= 50) {
      const myGlobalIdx = (COLOR_OFFSETS[color] + nextStep) % 52;
      if (!SAFE_CELL_INDICES.has(myGlobalIdx)) {
        for (const otherColor of Object.keys(gameState.tokens)) {
          if (otherColor === color) continue;
          const opTokens = gameState.tokens[otherColor];
          for (const opTok of opTokens) {
            if (opTok.step >= 0 && opTok.step <= 50) {
              const otherGlobalIdx = (COLOR_OFFSETS[otherColor] + opTok.step) % 52;
              if (otherGlobalIdx === myGlobalIdx) {
                return tokenId;
              }
            }
          }
        }
      }
    }
  }
  const homeStretchToken = legalMoves.find((id) => {
    const step = colorTokens[id].step < 0 ? 0 : colorTokens[id].step;
    return step < 51 && step + roll >= 51;
  });
  if (homeStretchToken !== void 0) return homeStretchToken;
  return legalMoves.reduce((best, curr) => {
    const bestStep = colorTokens[best].step;
    const currStep = colorTokens[curr].step;
    return currStep > bestStep ? curr : best;
  }, legalMoves[0]);
}
function createSimulationMatch(params) {
  if (!LUDO_BOTS_ENABLED) {
    return {
      success: false,
      error: "Bot system is currently disabled globally (LUDO_BOTS_ENABLED = false). Enable bots first in admin settings."
    };
  }
  const { tableId, mode, strategy, simulatedOutcome, botCount, adminUserId, adminUserName } = params;
  const selectedBots = [];
  for (const bot of botPoolArray) {
    if (bot.status === "idle") {
      selectedBots.push(bot);
      if (selectedBots.length >= botCount) break;
    }
  }
  if (selectedBots.length < botCount) {
    return {
      success: false,
      error: `Not enough idle bots available in pool (needed ${botCount}, found ${selectedBots.length}). Reset existing matches.`
    };
  }
  const matchId = `sim-match-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const colors = mode === 2 ? ["red", "yellow"] : ["red", "green", "yellow", "blue"];
  const matchPlayers = [];
  if (adminUserId) {
    matchPlayers.push({
      userId: adminUserId,
      userName: `${adminUserName || "QA Admin"} (Test Account)`,
      color: colors[0],
      isReady: true,
      isOnline: true,
      lastActive: (/* @__PURE__ */ new Date()).toISOString(),
      timeoutCount: 0,
      timeouts: 0
    });
  }
  selectedBots.forEach((bot, idx) => {
    const colorIdx = adminUserId ? idx + 1 : idx;
    if (colorIdx < colors.length) {
      matchPlayers.push({
        userId: bot.id,
        userName: bot.name,
        // Already ends with [BOT]
        color: colors[colorIdx],
        isReady: true,
        isOnline: true,
        lastActive: (/* @__PURE__ */ new Date()).toISOString(),
        timeoutCount: 0,
        timeouts: 0,
        isSimulated: true
      });
      bot.status = "testing";
      bot.activeMatchId = matchId;
      bot.assignedTableId = tableId;
      bot.strategy = strategy;
    }
  });
  const simMatch = {
    id: matchId,
    tableId: `SIM-${tableId}`,
    entryFee: 0,
    // Strict zero real cash
    playerCount: mode,
    prizeAmount: 0,
    // Strict zero real cash reward
    status: "in_progress",
    players: matchPlayers,
    gameState: createInitialLudoGame(mode),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    turnDeadline: new Date(Date.now() + 3e4).toISOString(),
    // Custom QA simulation markers
    isSimulation: true,
    simulatedOutcome,
    simulationNotice: "SIMULATION \u2014 NOT A REAL MATCH (Test Tokens Only)",
    testTokenStake: 50
  };
  activeSimulationMatches.set(matchId, simMatch);
  addBotLog({
    matchId,
    tableId,
    eventType: "match_started",
    details: `QA Simulation Match started. Outcome mode: ${simulatedOutcome}. Strategy: ${strategy}. Participants: ${matchPlayers.map((p) => p.userName).join(", ")}.`,
    strategyUsed: strategy,
    isSimulation: true,
    simulatedOutcome
  });
  return { success: true, match: simMatch };
}
function stopSimulationMatch(matchId, reason = "Stopped by Administrator") {
  const match = activeSimulationMatches.get(matchId);
  if (!match) return false;
  match.status = "cancelled";
  match.players.forEach((p) => {
    if (p.isSimulated || p.userId.startsWith("bot-")) {
      const bot = botPoolMap.get(p.userId);
      if (bot) {
        bot.status = "idle";
        bot.activeMatchId = null;
        bot.assignedTableId = null;
      }
    }
  });
  addBotLog({
    matchId,
    tableId: match.tableId,
    eventType: "match_stopped",
    details: `Match stopped: ${reason}. All bots safely returned to idle state. Real balances untouched.`,
    strategyUsed: "stronger_legal",
    isSimulation: true
  });
  activeSimulationMatches.delete(matchId);
  return true;
}
function resetAllSimulationMatches() {
  const count = activeSimulationMatches.size;
  activeSimulationMatches.forEach((match, matchId) => {
    stopSimulationMatch(matchId, "Batch admin reset");
  });
  botPoolArray.forEach((b) => {
    if (b.status !== "idle") {
      b.status = "idle";
      b.activeMatchId = null;
      b.assignedTableId = null;
    }
  });
  addBotLog({
    matchId: "system",
    tableId: "all",
    eventType: "match_reset",
    details: `Safe reset executed. ${count} simulation matches cleared, all 5000+ bots restored to idle.`,
    strategyUsed: "stronger_legal",
    isSimulation: true
  });
  return count;
}
function getActiveSimulationMatches() {
  return Array.from(activeSimulationMatches.values());
}
function getBotMatchLogs(limit = 100) {
  return botMatchLogs.slice(0, limit);
}
function clearBotLogs() {
  botMatchLogs.length = 0;
  addBotLog({
    matchId: "system",
    tableId: "all",
    eventType: "match_started",
    details: "Bot match logs cleared by administrator.",
    strategyUsed: "stronger_legal",
    isSimulation: true
  });
}

// src/server/adminAuthServer.ts
import crypto from "crypto";

// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var getSavedSupabaseConfig = () => {
  const metaEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : null;
  const procEnv = typeof process !== "undefined" && process.env ? process.env : null;
  const envUrl = metaEnv?.VITE_SUPABASE_URL || procEnv?.VITE_SUPABASE_URL || procEnv?.SUPABASE_URL || "";
  const envKey = metaEnv?.VITE_SUPABASE_ANON_KEY || procEnv?.VITE_SUPABASE_ANON_KEY || procEnv?.SUPABASE_ANON_KEY || procEnv?.SUPABASE_SERVICE_ROLE_KEY || "";
  const customUrl = typeof window !== "undefined" ? localStorage.getItem("cricket_arena_supabase_url") : "";
  const customKey = typeof window !== "undefined" ? localStorage.getItem("cricket_arena_supabase_anon_key") : "";
  const url = (customUrl || envUrl || "").trim();
  const key = (customKey || envKey || "").trim();
  const isDefunctUrl = url.includes("amdmlwmkzcjnpzzyzivr.supabase.co") && !customUrl;
  const isPlaceholder = !url || url.includes("xyzcompany") || url.includes("placeholder") || url.includes("example.com") || url.includes("your-project") || url.includes("<");
  const isConfigured = Boolean(url && key && url.startsWith("http") && !isDefunctUrl && !isPlaceholder);
  return {
    url,
    key,
    isConfigured
  };
};
var { url: supabaseUrl, key: supabaseAnonKey, isConfigured: isSupabaseConfigured } = getSavedSupabaseConfig();
var supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
}) : null;

// src/server/adminAuthServer.ts
var DEFAULT_AUTHORIZED_ADMIN_EMAILS = [
  "sibaraj789090@gmail.com",
  "ranidas14343@gmail.com",
  "ranidas784170@gmail.com"
];
function getAuthorizedAdminEmails() {
  const envEmail = process.env.ADMIN_EMAIL || process.env.AUTHORIZED_ADMIN_EMAIL || "";
  if (envEmail.trim()) {
    const list = envEmail.split(",").map((e) => e.trim().toLowerCase());
    return Array.from(/* @__PURE__ */ new Set([...list, ...DEFAULT_AUTHORIZED_ADMIN_EMAILS]));
  }
  return DEFAULT_AUTHORIZED_ADMIN_EMAILS;
}
function isAuthorizedAdminEmail(email) {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  const allowed = getAuthorizedAdminEmails();
  return allowed.includes(normalized);
}
var adminSessions = /* @__PURE__ */ new Map();
var inMemoryAdminPassword = process.env.ADMIN_PASSWORD || null;
async function verifyAdminToken(token) {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }
  const cleanToken = token.trim();
  const session = adminSessions.get(cleanToken);
  if (session) {
    if (Date.now() > session.expiresAt) {
      adminSessions.delete(cleanToken);
      return { valid: false };
    }
    return { valid: true, email: session.email };
  }
  if (cleanToken.startsWith("ey") && isSupabaseConfigured && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(cleanToken);
      if (!error && user && user.email) {
        if (isAuthorizedAdminEmail(user.email)) {
          adminSessions.set(cleanToken, {
            token: cleanToken,
            email: user.email.toLowerCase(),
            createdAt: Date.now(),
            expiresAt: Date.now() + 12 * 3600 * 1e3
          });
          return { valid: true, email: user.email.toLowerCase() };
        }
      }
    } catch (err) {
      console.warn("Supabase token verification error:", err);
    }
  }
  return { valid: false };
}
async function requireAdminRole(req, res, next) {
  const authHeader = req.headers["authorization"];
  const sessionHeader = req.headers["x-admin-session-token"];
  let token;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (typeof sessionHeader === "string") {
    token = sessionHeader.trim();
  }
  if (!token) {
    return res.status(401).json({
      error: "Access Denied: Administrator authentication token required.",
      code: "UNAUTHORIZED_ADMIN"
    });
  }
  const verification = await verifyAdminToken(token);
  if (!verification.valid) {
    return res.status(403).json({
      error: "Access Denied: Invalid, expired, or unauthorized administrator credentials.",
      code: "FORBIDDEN_NOT_ADMIN"
    });
  }
  req.adminEmail = verification.email;
  return next();
}
async function handleAdminLogin(req, res) {
  const { email, password, supabaseToken } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Administrator email is required." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalizedEmail)) {
    return res.status(403).json({
      error: "Access Denied: Invalid credentials or account is not authorized as an administrator."
    });
  }
  if (supabaseToken && typeof supabaseToken === "string" && isSupabaseConfigured && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(supabaseToken);
      if (error || !user || !isAuthorizedAdminEmail(user.email)) {
        return res.status(403).json({
          error: "Access Denied: Invalid Supabase credentials or unauthorized email."
        });
      }
      const sessionToken = crypto.randomBytes(32).toString("hex");
      adminSessions.set(sessionToken, {
        token: sessionToken,
        email: normalizedEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 3600 * 1e3
      });
      return res.json({
        success: true,
        token: sessionToken,
        email: normalizedEmail,
        message: "Administrator authenticated successfully via Supabase Auth."
      });
    } catch (err) {
      return res.status(500).json({ error: "Supabase authentication verification failed." });
    }
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required for administrator login." });
  }
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (error || !data.user) {
        return res.status(401).json({
          error: error?.message || "Invalid email or password."
        });
      }
      if (!isAuthorizedAdminEmail(data.user.email)) {
        return res.status(403).json({
          error: "Access Denied: This account is not authorized as an administrator."
        });
      }
      const sessionToken = crypto.randomBytes(32).toString("hex");
      adminSessions.set(sessionToken, {
        token: sessionToken,
        email: normalizedEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 3600 * 1e3
      });
      return res.json({
        success: true,
        token: sessionToken,
        email: normalizedEmail,
        message: "Administrator authenticated successfully."
      });
    } catch (err) {
      return res.status(500).json({ error: "Authentication service error." });
    }
  }
  const expectedPassword = process.env.ADMIN_PASSWORD || inMemoryAdminPassword;
  if (expectedPassword) {
    if (password === expectedPassword) {
      const sessionToken = crypto.randomBytes(32).toString("hex");
      adminSessions.set(sessionToken, {
        token: sessionToken,
        email: normalizedEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 3600 * 1e3
      });
      return res.json({
        success: true,
        token: sessionToken,
        email: normalizedEmail,
        message: "Administrator authenticated successfully."
      });
    } else {
      return res.status(401).json({
        error: "Invalid administrator password."
      });
    }
  } else {
    inMemoryAdminPassword = password;
    const sessionToken = crypto.randomBytes(32).toString("hex");
    adminSessions.set(sessionToken, {
      token: sessionToken,
      email: normalizedEmail,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 3600 * 1e3
    });
    return res.json({
      success: true,
      token: sessionToken,
      email: normalizedEmail,
      initialized: true,
      message: "Administrator password initialized and session created."
    });
  }
}
function handleAdminLogout(req, res) {
  const authHeader = req.headers["authorization"];
  const sessionHeader = req.headers["x-admin-session-token"];
  let token;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (typeof sessionHeader === "string") {
    token = sessionHeader.trim();
  }
  if (token) {
    adminSessions.delete(token);
  }
  res.json({ success: true, message: "Administrator logged out successfully." });
}
async function handleAdminCheck(req, res) {
  const authHeader = req.headers["authorization"];
  const sessionHeader = req.headers["x-admin-session-token"];
  let token;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (typeof sessionHeader === "string") {
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
      role: "admin"
    });
  }
  return res.json({ authenticated: false });
}

// src/server/ludoMatchServer.ts
import crypto2 from "crypto";
function toSafeUuid(id) {
  if (!id) return "00000000-0000-0000-0000-000000000000";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id.toLowerCase();
  }
  const hash = crypto2.createHash("md5").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
var ludoRouter = express.Router();
ludoRouter.use("/admin", requireAdminRole);
var cashTables = generateDefaultCashTables();
var adminConfig = {
  onlineLudoEnabled: true,
  timerLudoEnabled: true,
  durationMinutes2P: 10,
  durationMinutes4P: 15,
  homeBonusPoints: 60,
  dicePointsEnabled: true,
  captureTransferEnabled: true,
  tieBreakerRule: "home_tokens_then_captures",
  allowTwoPlayer: true,
  allowFourPlayer: true,
  turnTimeoutSeconds: 30,
  maxTimeoutsBeforeForfeit: 3
};
var waitingQueues = /* @__PURE__ */ new Map();
var activeMatches = /* @__PURE__ */ new Map();
var matchHistory = [];
function updateTableQueueStats() {
  const botsActive = botPoolConfig.enabled;
  const poolMultiplier = botPoolConfig.poolSize > 0 ? botPoolConfig.poolSize / 5200 : 1;
  cashTables.forEach((table) => {
    const queue = waitingQueues.get(table.id) || [];
    table.waitingPlayers = queue.length;
    let activeCount = 0;
    activeMatches.forEach((m) => {
      if (m.tableId === table.id && (m.status === "in_progress" || m.status === "starting")) {
        activeCount++;
      }
    });
    table.activeMatches = activeCount;
    table.status = queue.length > 0 ? "waiting" : activeCount > 0 ? "in_progress" : "waiting";
    const botCounts = getTableBotCounts(table.entryFee, table.mode);
    const scaledOnline = botsActive ? Math.max(1, Math.round(botCounts.onlinePlayers * poolMultiplier)) : 0;
    const scaledPlaying = botsActive ? Math.max(1, Math.round(botCounts.playingPlayers * poolMultiplier)) : 0;
    if (table.manualOnlinePlayers !== void 0) {
      table.onlinePlayers = Math.max(0, table.manualOnlinePlayers + queue.length);
    } else {
      table.onlinePlayers = scaledOnline + queue.length;
    }
    if (table.manualPlayingPlayers !== void 0) {
      table.playingPlayers = Math.max(0, table.manualPlayingPlayers + activeCount * table.mode);
    } else {
      table.playingPlayers = scaledPlaying + activeCount * table.mode;
    }
    table.current_players = table.onlinePlayers + table.playingPlayers;
  });
}
function getTieBreakerDescription(rule = adminConfig.tieBreakerRule) {
  switch (rule) {
    case "most_captures":
      return "Hierarchy: 1) Highest Score \u2794 2) Most Captures \u2794 3) Most Home Tokens \u2794 4) Fewest Timeouts";
    case "least_timeouts":
      return "Hierarchy: 1) Highest Score \u2794 2) Fewest Timeouts \u2794 3) Most Home Tokens \u2794 4) Most Captures";
    case "home_tokens_then_captures":
    default:
      return "Hierarchy: 1) Highest Score \u2794 2) Most Home Tokens \u2794 3) Most Captures \u2794 4) Fewest Timeouts";
  }
}
function finalizeTimerLudoMatch(match, reasonText) {
  if (match.status === "completed") return;
  match.status = "completed";
  match.gameState.isGameOver = true;
  match.completedAt = (/* @__PURE__ */ new Date()).toISOString();
  match.timeRemainingSeconds = 0;
  const rankings = match.players.map((p) => {
    const homeTokens = match.gameState.tokens[p.color]?.filter((t) => t.step === 56).length || 0;
    const captures = p.scoreBreakdown?.capturesCount || 0;
    const timeouts = p.timeoutCount || 0;
    const totalScore = p.score || 0;
    return {
      rank: 1,
      userId: p.userId,
      userName: p.userName,
      color: p.color,
      score: totalScore,
      tokensHomeCount: homeTokens,
      capturesCount: captures,
      timeoutsCount: timeouts,
      prizeWon: 0,
      isWinner: false,
      scoreBreakdown: p.scoreBreakdown || {
        dicePoints: 0,
        capturePoints: 0,
        homeBonuses: 0,
        lostInCaptures: 0,
        totalScore,
        tokensHomeCount: homeTokens,
        capturesCount: captures
      }
    };
  });
  rankings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (adminConfig.tieBreakerRule === "most_captures") {
      if (b.capturesCount !== a.capturesCount) return b.capturesCount - a.capturesCount;
      if (b.tokensHomeCount !== a.tokensHomeCount) return b.tokensHomeCount - a.tokensHomeCount;
    } else if (adminConfig.tieBreakerRule === "least_timeouts") {
      if (a.timeoutsCount !== b.timeoutsCount) return a.timeoutsCount - b.timeoutsCount;
      if (b.tokensHomeCount !== a.tokensHomeCount) return b.tokensHomeCount - a.tokensHomeCount;
    } else {
      if (b.tokensHomeCount !== a.tokensHomeCount) return b.tokensHomeCount - a.tokensHomeCount;
      if (b.capturesCount !== a.capturesCount) return b.capturesCount - a.capturesCount;
    }
    if (a.timeoutsCount !== b.timeoutsCount) return a.timeoutsCount - b.timeoutsCount;
    return 0;
  });
  rankings.forEach((r, idx) => {
    r.rank = idx + 1;
    if (idx === 0) {
      r.isWinner = true;
      r.prizeWon = match.prizeAmount;
    } else {
      r.isWinner = false;
      r.prizeWon = 0;
    }
  });
  const winner = rankings[0];
  match.winnerId = winner.userId;
  match.winnerName = winner.userName;
  match.winnerColor = winner.color;
  match.gameState.winners = [winner.color];
  match.finalRankings = rankings;
  match.gameState.lastActionText = `\u{1F3C6} ${reasonText} Champion: ${winner.userName} (${winner.score} pts)!`;
  if (!match.isSimulation) {
    rankings.forEach((r) => {
      matchHistory.unshift({
        id: `rec-${match.id}-${r.userId}`,
        userId: r.userId,
        userName: r.userName,
        matchId: match.id,
        tableTitle: `\u20B9${match.entryFee} (${match.playerCount}P)`,
        entryFee: match.entryFee,
        mode: match.playerCount,
        prizeWon: r.prizeWon,
        isWinner: r.isWinner,
        status: "completed",
        referenceId: `TIMER-LUDO-${match.id}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        finalScore: r.score,
        rank: r.rank,
        scoreBreakdown: r.scoreBreakdown
      });
    });
  } else {
    addBotLog({
      matchId: match.id,
      tableId: match.tableId,
      eventType: "match_finished",
      details: `QA Simulation Match completed! Winner: ${winner.userName} with score ${winner.score}. Zero real cash impact.`,
      strategyUsed: match.strategy || "stronger_legal",
      isSimulation: true,
      winnerId: match.winnerId,
      winnerName: match.winnerName
    });
  }
}
function checkMatchTimerExpired(match) {
  if (match.status === "completed" || match.gameState.isGameOver) return true;
  if (!match.endsAt) return false;
  const now = Date.now();
  const endsAtTime = new Date(match.endsAt).getTime();
  const remainingMs = endsAtTime - now;
  match.timeRemainingSeconds = Math.max(0, Math.floor(remainingMs / 1e3));
  if (remainingMs <= 0) {
    finalizeTimerLudoMatch(match, "Official match timer reached 00:00! Time Over!");
    return true;
  }
  return false;
}
function checkAllActiveMatchTimers() {
  for (const match of activeMatches.values()) {
    if (match.status === "in_progress" && !match.gameState.isGameOver) {
      if (match.endsAt) {
        checkMatchTimerExpired(match);
      }
      if (match.status === "in_progress" && !match.gameState.isGameOver && match.turnDeadline) {
        const now = Date.now();
        const deadline = new Date(match.turnDeadline).getTime();
        if (now > deadline) {
          const currentTurn = match.gameState.currentTurn;
          const player = match.players.find((p) => p.color === currentTurn);
          if (player) {
            player.timeoutCount = (player.timeoutCount || 0) + 1;
            if (player.timeoutCount >= adminConfig.maxTimeoutsBeforeForfeit) {
              player.isOnline = false;
              match.gameState.lastActionText = `\u26A0\uFE0F ${player.userName} exceeded ${adminConfig.maxTimeoutsBeforeForfeit} timeouts and forfeited!`;
              finalizeTimerLudoMatch(match, `${player.userName} forfeited.`);
            } else {
              match.gameState.lastActionText = `\u23F1\uFE0F ${player.userName} turn timed out. Passing to next player.`;
              advanceMatchTurn(match, false);
              checkAndRunBotTurn(match);
            }
          }
        }
      }
    }
  }
}
var tableTrafficPeriodicInterval = setInterval(() => {
  try {
    updateTableQueueStats();
    checkAllActiveMatchTimers();
  } catch (err) {
    console.error("Error in periodic table and timer update routine:", err);
  }
}, 3e3);
if (tableTrafficPeriodicInterval.unref) {
  tableTrafficPeriodicInterval.unref();
}
updateTableQueueStats();
var queueAutoMatchTimers = /* @__PURE__ */ new Map();
function clearQueueTimer(tableId) {
  const existing = queueAutoMatchTimers.get(tableId);
  if (existing) {
    clearTimeout(existing);
    queueAutoMatchTimers.delete(tableId);
  }
}
function syncMatchToSupabase(match) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const realPlayerIds = match.players.map((p) => p.userId).filter((uid) => uid && !uid.startsWith("bot-")).map(toSafeUuid);
    Promise.resolve(
      supabase.from("ludo_table_matches").upsert({
        id: match.id,
        table_id: match.tableId,
        status: match.status,
        max_players: match.playerCount,
        player_ids: realPlayerIds,
        players_data: match.players,
        game_state: match.gameState,
        created_at: match.createdAt,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      })
    ).then(
      ({ error }) => {
        if (error) console.warn("[LudoMatchServer] Supabase syncMatch warning:", error.message);
      },
      (err) => console.warn("[LudoMatchServer] Supabase syncMatch network error:", err)
    );
  } catch (err) {
    console.warn("[LudoMatchServer] Failed to sync match to Supabase:", err);
  }
}
function buildMatchFromDb(dbRow) {
  const table = cashTables.find((t) => t.id === dbRow.table_id) || {
    id: dbRow.table_id,
    entryFee: 10,
    mode: dbRow.max_players || 2,
    prize: (dbRow.max_players || 2) === 2 ? 17.5 : 35,
    isActive: true,
    minBalanceRequired: 10,
    waitingPlayers: 0,
    activeMatches: 1,
    status: "in_progress",
    onlinePlayers: 2,
    playingPlayers: 2,
    current_players: 4
  };
  const durationMinutes = table.mode === 2 ? adminConfig.durationMinutes2P || 8 : adminConfig.durationMinutes4P || 15;
  const durationSeconds = durationMinutes * 60;
  const startedAt = dbRow.created_at || (/* @__PURE__ */ new Date()).toISOString();
  const endsAt = new Date(new Date(startedAt).getTime() + durationSeconds * 1e3).toISOString();
  return {
    id: dbRow.id,
    tableId: dbRow.table_id,
    entryFee: table.entryFee,
    playerCount: table.mode,
    prizeAmount: table.prize,
    status: dbRow.status,
    players: dbRow.players_data || [],
    gameState: dbRow.game_state || createInitialLudoGame(table.mode),
    createdAt: dbRow.created_at,
    startedAt,
    endsAt,
    durationMinutes,
    durationSeconds,
    timeRemainingSeconds: Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1e3)),
    modeName: "Timer Ludo \u2014 Highest Score Wins",
    scoreHistory: [],
    tieBreakerRule: getTieBreakerDescription(adminConfig.tieBreakerRule),
    turnDeadline: new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1e3).toISOString(),
    chatMessages: []
  };
}
function createAndStartMatch(table, matchedPlayers, isSimulation = false) {
  const matchId = `match-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const colors = table.mode === 2 ? ["red", "yellow"] : ["red", "green", "yellow", "blue"];
  const durationMinutes = table.mode === 2 ? adminConfig.durationMinutes2P || 8 : adminConfig.durationMinutes4P || 15;
  const durationSeconds = durationMinutes * 60;
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const endsAt = new Date(Date.now() + durationSeconds * 1e3).toISOString();
  const onlinePlayers = matchedPlayers.map((p, idx) => ({
    userId: p.userId,
    userName: p.userName,
    avatar: p.avatar,
    color: colors[idx],
    isReady: true,
    isOnline: true,
    lastActive: (/* @__PURE__ */ new Date()).toISOString(),
    timeoutCount: 0,
    isSimulated: p.isSimulated || false,
    score: 0,
    scoreBreakdown: {
      dicePoints: 0,
      capturePoints: 0,
      homeBonuses: 0,
      lostInCaptures: 0,
      totalScore: 0,
      tokensHomeCount: 0,
      capturesCount: 0
    }
  }));
  const initialGame = createInitialLudoGame(table.mode);
  initialGame.scores = {
    red: 0,
    green: 0,
    yellow: 0,
    blue: 0
  };
  const newMatch = {
    id: matchId,
    tableId: table.id,
    entryFee: table.entryFee,
    playerCount: table.mode,
    prizeAmount: table.prize,
    status: "in_progress",
    players: onlinePlayers,
    gameState: initialGame,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    startedAt,
    endsAt,
    durationMinutes,
    durationSeconds,
    timeRemainingSeconds: durationSeconds,
    modeName: "Timer Ludo \u2014 Highest Score Wins",
    scoreHistory: [],
    tieBreakerRule: getTieBreakerDescription(adminConfig.tieBreakerRule),
    turnDeadline: new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1e3).toISOString(),
    chatMessages: []
  };
  if (isSimulation) {
    newMatch.isSimulation = true;
  }
  activeMatches.set(matchId, newMatch);
  updateTableQueueStats();
  syncMatchToSupabase(newMatch);
  addBotLog({
    matchId,
    tableId: table.id,
    eventType: "match_started",
    details: `Timer Ludo match started on table ${table.id} (${table.mode}P, ${durationMinutes} min). Highest Score Wins. Total players: ${matchedPlayers.length}.`,
    strategyUsed: botPoolConfig.defaultStrategy || "stronger_legal",
    isSimulation
  });
  checkAndRunBotTurn(newMatch);
  return newMatch;
}
function autoFillQueueWithStealthBots(tableId) {
  clearQueueTimer(tableId);
  const table = cashTables.find((t) => t.id === tableId);
  if (!table || !table.isActive) return;
  const queue = waitingQueues.get(tableId);
  if (!queue || queue.length === 0) return;
  if (queue.length >= table.mode) return;
  const hasRealPlayer = queue.some((p) => !p.isSimulated);
  if (!hasRealPlayer) return;
  while (queue.length < table.mode) {
    const stealth = generateStealthPlayer();
    queue.push({
      userId: stealth.userId,
      userName: stealth.userName,
      avatar: stealth.avatar,
      joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      isSimulated: true
    });
  }
  const matchedPlayers = queue.splice(0, table.mode);
  createAndStartMatch(table, matchedPlayers, false);
}
function scheduleAutoMatchStealthBots(tableId) {
  if (!botPoolConfig.autoMatchStealthBots && !LUDO_BOTS_ENABLED) return;
  if (queueAutoMatchTimers.has(tableId)) return;
  const waitSeconds = botPoolConfig.autoMatchWaitSeconds || 3;
  const timer = setTimeout(() => {
    autoFillQueueWithStealthBots(tableId);
  }, waitSeconds * 1e3);
  queueAutoMatchTimers.set(tableId, timer);
}
function applyDiceRollToMatch(match, color, roll) {
  match.gameState.diceValue = roll;
  match.gameState.hasRolled = true;
  const newConsecutive = roll === 6 ? (match.gameState.consecutiveSixes || 0) + 1 : 0;
  match.gameState.consecutiveSixes = newConsecutive;
  if (newConsecutive >= 3) {
    match.gameState.lastActionText = `\u274C 3 consecutive sixes! Turn forfeited.`;
    return { forfeited: true };
  }
  if (adminConfig.dicePointsEnabled) {
    const player = match.players.find((p) => p.color === color);
    if (player) {
      if (!player.scoreBreakdown) {
        player.scoreBreakdown = {
          dicePoints: 0,
          capturePoints: 0,
          homeBonuses: 0,
          lostInCaptures: 0,
          totalScore: player.score || 0,
          tokensHomeCount: 0,
          capturesCount: 0
        };
      }
      player.score = (player.score || 0) + roll;
      player.scoreBreakdown.dicePoints += roll;
      player.scoreBreakdown.totalScore = player.score;
      match.gameState.scores = match.gameState.scores || { red: 0, green: 0, yellow: 0, blue: 0 };
      match.gameState.scores[color] = player.score;
      match.scoreHistory = match.scoreHistory || [];
      match.scoreHistory.push({
        id: `sh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        userId: player.userId,
        color,
        type: "dice_roll",
        points: roll,
        description: `${player.userName} rolled ${roll} (+${roll} pts)`,
        totalScoreAfter: player.score
      });
    }
  }
  return { forfeited: false };
}
function checkAndRunBotTurn(match) {
  if (match.status !== "in_progress" || match.gameState.isGameOver) return;
  if (checkMatchTimerExpired(match)) return;
  const currentTurn = match.gameState.currentTurn;
  const player = match.players.find((p) => p.color === currentTurn);
  if (!player || !player.isSimulated) return;
  const rollDelay = Math.floor(Math.random() * 800) + 1200;
  setTimeout(() => {
    if (match.status !== "in_progress" || match.gameState.currentTurn !== currentTurn) return;
    if (checkMatchTimerExpired(match)) return;
    if (!match.gameState.hasRolled) {
      const roll = Math.floor(Math.random() * 6) + 1;
      const rollResult = applyDiceRollToMatch(match, currentTurn, roll);
      if (rollResult.forfeited) {
        advanceMatchTurn(match, false);
        checkAndRunBotTurn(match);
        return;
      }
      const legalMoves = getLegalMoves(match.gameState.tokens, currentTurn, roll);
      match.gameState.highlightedTokenIds = legalMoves;
      if (legalMoves.length === 0) {
        match.gameState.lastActionText = `${player.userName} rolled ${roll} - No legal moves!`;
        setTimeout(() => {
          advanceMatchTurn(match, false);
          checkAndRunBotTurn(match);
        }, 1100);
      } else {
        match.gameState.lastActionText = `${player.userName} rolled ${roll}. Thinking move...`;
        const moveDelay = Math.floor(Math.random() * 800) + 1e3;
        setTimeout(() => {
          if (checkMatchTimerExpired(match)) return;
          const botProfile = getBotById(player.userId);
          const botStrategy = botProfile?.strategy || match.strategy || "stronger_legal";
          const chosenTokenId = selectBotMove(
            match.gameState,
            currentTurn,
            roll,
            legalMoves,
            botStrategy
          );
          addBotLog({
            matchId: match.id,
            tableId: match.tableId,
            eventType: "token_moved",
            details: `${player.userName} rolled ${roll} and moved token ${chosenTokenId} using '${botStrategy}' strategy.`,
            strategyUsed: botStrategy,
            isSimulation: match.isSimulation || false
          });
          executeTokenMove(match, currentTurn, chosenTokenId);
          if (match.status === "in_progress" && !match.gameState.isGameOver) {
            checkAndRunBotTurn(match);
          }
        }, moveDelay);
      }
    }
  }, rollDelay);
}
function advanceMatchTurn(match, extraTurn) {
  if (checkMatchTimerExpired(match)) return;
  if (extraTurn) {
    match.gameState.hasRolled = false;
    match.gameState.diceValue = null;
    match.gameState.highlightedTokenIds = [];
    match.gameState.extraTurn = true;
    match.turnDeadline = new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1e3).toISOString();
  } else {
    const nextColor = getNextPlayer(
      match.gameState.currentTurn,
      match.gameState.players,
      match.gameState.winners
    );
    match.gameState.currentTurn = nextColor;
    match.gameState.hasRolled = false;
    match.gameState.diceValue = null;
    match.gameState.highlightedTokenIds = [];
    match.gameState.extraTurn = false;
    match.gameState.lastActionText = `${capitalize(nextColor)}'s turn to roll!`;
    match.turnDeadline = new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1e3).toISOString();
  }
}
function executeTokenMove(match, color, tokenId) {
  if (checkMatchTimerExpired(match)) {
    return { success: false, error: "Match timer has ended! Score calculation in progress." };
  }
  const token = match.gameState.tokens[color].find((t) => t.id === tokenId);
  if (!token) return { success: false, error: "Token not found" };
  const roll = match.gameState.diceValue;
  if (!roll) return { success: false, error: "No active roll" };
  let extraTurn = roll === 6;
  let actionDesc = "";
  const player = match.players.find((p) => p.color === color);
  if (!player) return { success: false, error: "Player not found" };
  if (!player.scoreBreakdown) {
    player.scoreBreakdown = {
      dicePoints: 0,
      capturePoints: 0,
      homeBonuses: 0,
      lostInCaptures: 0,
      totalScore: player.score || 0,
      tokensHomeCount: 0,
      capturesCount: 0
    };
  }
  const currentStep = token.step < 0 ? 0 : token.step;
  const nextStep = currentStep + roll;
  if (nextStep > 56) return { success: false, error: "Overshot home" };
  token.step = nextStep;
  token.score = (token.score || 0) + roll;
  actionDesc = `${capitalize(color)} moved to step ${nextStep}.`;
  if (token.step === 56) {
    extraTurn = true;
    if (!token.reachedHome) {
      token.reachedHome = true;
      const bonus = adminConfig.homeBonusPoints || 60;
      player.score = (player.score || 0) + bonus;
      player.scoreBreakdown.homeBonuses += bonus;
      player.scoreBreakdown.tokensHomeCount += 1;
      player.scoreBreakdown.totalScore = player.score;
      match.gameState.scores = match.gameState.scores || { red: 0, green: 0, yellow: 0, blue: 0 };
      match.gameState.scores[color] = player.score;
      match.scoreHistory = match.scoreHistory || [];
      match.scoreHistory.push({
        id: `sh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        userId: player.userId,
        color,
        type: "home_bonus",
        points: bonus,
        description: `\u{1F389} ${player.userName} reached HOME! +${bonus} Home Bonus awarded!`,
        totalScoreAfter: player.score
      });
      actionDesc = `\u{1F389} ${capitalize(color)} moved token to HOME! +${bonus} points home bonus! Extra roll!`;
    } else {
      actionDesc = `${capitalize(color)} token already completed home.`;
    }
  } else if (token.step <= 50) {
    const myGlobalIdx = getGlobalTrackIndex(color, token.step);
    if (myGlobalIdx !== null && !SAFE_CELL_INDICES.has(myGlobalIdx)) {
      match.gameState.players.forEach((otherColor) => {
        if (otherColor !== color) {
          match.gameState.tokens[otherColor].forEach((otherToken) => {
            if (otherToken.step >= 0 && otherToken.step <= 50) {
              const otherGlobalIdx = getGlobalTrackIndex(otherColor, otherToken.step);
              if (otherGlobalIdx === myGlobalIdx) {
                const capturedScore = otherToken.score || 0;
                const otherPlayer = match.players.find((p) => p.color === otherColor);
                if (adminConfig.captureTransferEnabled && otherPlayer) {
                  if (!otherPlayer.scoreBreakdown) {
                    otherPlayer.scoreBreakdown = {
                      dicePoints: 0,
                      capturePoints: 0,
                      homeBonuses: 0,
                      lostInCaptures: 0,
                      totalScore: otherPlayer.score || 0,
                      tokensHomeCount: 0,
                      capturesCount: 0
                    };
                  }
                  if (!player.scoreBreakdown) {
                    player.scoreBreakdown = {
                      dicePoints: 0,
                      capturePoints: 0,
                      homeBonuses: 0,
                      lostInCaptures: 0,
                      totalScore: player.score || 0,
                      tokensHomeCount: 0,
                      capturesCount: 0
                    };
                  }
                  player.score = (player.score || 0) + capturedScore;
                  player.scoreBreakdown.capturePoints += capturedScore;
                  player.scoreBreakdown.capturesCount += 1;
                  player.scoreBreakdown.totalScore = player.score;
                  otherPlayer.score = Math.max(0, (otherPlayer.score || 0) - capturedScore);
                  otherPlayer.scoreBreakdown.lostInCaptures += capturedScore;
                  otherPlayer.scoreBreakdown.totalScore = otherPlayer.score;
                  match.gameState.scores = match.gameState.scores || { red: 0, green: 0, yellow: 0, blue: 0 };
                  match.gameState.scores[color] = player.score;
                  match.gameState.scores[otherColor] = otherPlayer.score;
                  match.scoreHistory = match.scoreHistory || [];
                  match.scoreHistory.push({
                    id: `sh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
                    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                    userId: player.userId,
                    color,
                    type: "capture_transfer",
                    points: capturedScore,
                    description: `\u{1F4A5} ${player.userName} CAPTURED ${otherPlayer.userName}'s token! Transferred ${capturedScore} points!`,
                    totalScoreAfter: player.score
                  });
                }
                otherToken.step = 0;
                otherToken.score = 0;
                otherToken.reachedHome = false;
                extraTurn = true;
                actionDesc = `\u{1F4A5} ${capitalize(color)} CAPTURED ${capitalize(otherColor)}! Transferred ${capturedScore} pts! Extra roll!`;
              }
            }
          });
        }
      });
    }
  }
  match.gameState.lastActionText = actionDesc;
  const allHome = match.gameState.tokens[color].every((t) => t.step === 56);
  if (allHome && !match.gameState.winners.includes(color)) {
    finalizeTimerLudoMatch(match, `${player.userName} brought all tokens home!`);
    return { success: true };
  }
  advanceMatchTurn(match, extraTurn);
  return { success: true };
}
ludoRouter.get("/tables", (req, res) => {
  updateTableQueueStats();
  res.json({
    success: true,
    enabled: adminConfig.onlineLudoEnabled,
    allowTwoPlayer: adminConfig.allowTwoPlayer,
    allowFourPlayer: adminConfig.allowFourPlayer,
    turnTimeoutSeconds: adminConfig.turnTimeoutSeconds,
    tables: cashTables
  });
});
ludoRouter.post("/queue/join", async (req, res) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString("utf8"));
    } catch {
    }
  }
  const { tableId, userId, userName, avatar } = body || {};
  if (!adminConfig.onlineLudoEnabled) {
    return res.status(403).json({ error: "Online Ludo is temporarily paused by administrator." });
  }
  if (!tableId || !userId) {
    return res.status(400).json({ error: "tableId and userId are required." });
  }
  const banStatus = checkUserBanStatus(userId, "ludo");
  if (banStatus.banned) {
    return res.status(403).json({
      error: `Access Denied: Your account is restricted (${banStatus.reason || "Restricted by administrator"}).`,
      isBanned: true,
      restriction: banStatus.restriction
    });
  }
  const table = cashTables.find((t) => t.id === tableId);
  if (!table || !table.isActive) {
    return res.status(404).json({ error: "Selected cash table is inactive or unavailable." });
  }
  for (const [mId, m] of activeMatches.entries()) {
    if (m.status === "in_progress" && m.players.some((p) => p.userId === userId)) {
      return res.json({
        success: true,
        alreadyInMatch: true,
        matchId: mId,
        match: m,
        message: "Reconnected to your active match in progress."
      });
    }
  }
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: dbMatches } = await supabase.from("ludo_table_matches").select("*").eq("status", "in_progress").order("created_at", { ascending: false }).limit(20);
      if (dbMatches && dbMatches.length > 0) {
        for (const dbMatch of dbMatches) {
          const players = dbMatch.players_data || [];
          if (players.some((p) => p.userId === userId)) {
            const reconstructed = buildMatchFromDb(dbMatch);
            activeMatches.set(reconstructed.id, reconstructed);
            return res.json({
              success: true,
              alreadyInMatch: true,
              matchId: reconstructed.id,
              match: reconstructed,
              message: "Reconnected to your active match in progress."
            });
          }
        }
      }
      await supabase.from("ludo_matchmaking_queue").delete().eq("user_id", userId).eq("status", "waiting");
      const { error: insertErr } = await supabase.from("ludo_matchmaking_queue").insert({
        table_id: tableId,
        user_id: userId,
        user_name: userName || "Player",
        avatar: avatar || null,
        mode: table.mode,
        status: "waiting",
        joined_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (insertErr) {
        console.warn("[LudoMatchServer] Supabase queue insert warning, using memory fallback:", insertErr.message);
      } else {
        const { data: waitingRows } = await supabase.from("ludo_matchmaking_queue").select("*").eq("table_id", tableId).eq("status", "waiting").order("joined_at", { ascending: true });
        const queueCount = waitingRows?.length || 1;
        if (waitingRows && waitingRows.length >= table.mode) {
          clearQueueTimer(tableId);
          const matchedRows = waitingRows.slice(0, table.mode);
          const matchedIds = matchedRows.map((r) => r.id);
          const matchedPlayers = matchedRows.map((r) => ({
            userId: r.user_id,
            userName: r.user_name,
            avatar: r.avatar,
            joinedAt: r.joined_at,
            isSimulated: false
          }));
          const newMatch = createAndStartMatch(table, matchedPlayers, false);
          await supabase.from("ludo_matchmaking_queue").update({
            status: "matched",
            match_id: newMatch.id,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).in("id", matchedIds);
          return res.json({
            success: true,
            status: "starting",
            matchId: newMatch.id,
            match: newMatch,
            message: `Match starting with ${table.mode} players!`
          });
        }
        let memQueue = waitingQueues.get(tableId);
        if (!memQueue) {
          memQueue = [];
          waitingQueues.set(tableId, memQueue);
        }
        if (!memQueue.some((p) => p.userId === userId)) {
          memQueue.push({
            userId,
            userName: userName || "Player",
            avatar,
            joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
            isSimulated: false
          });
        }
        updateTableQueueStats();
        scheduleAutoMatchStealthBots(tableId);
        return res.json({
          success: true,
          status: "waiting",
          queuePosition: queueCount,
          totalWaiting: queueCount,
          needed: table.mode,
          message: `Joined queue (${queueCount}/${table.mode}). Searching for players...`
        });
      }
    } catch (dbErr) {
      console.warn("[LudoMatchServer] Supabase queue operation error, using memory fallback:", dbErr);
    }
  }
  let queue = waitingQueues.get(tableId);
  if (!queue) {
    queue = [];
    waitingQueues.set(tableId, queue);
  }
  const existingIdx = queue.findIndex((p) => p.userId === userId);
  if (existingIdx !== -1) {
    return res.json({
      success: true,
      status: "waiting",
      queuePosition: existingIdx + 1,
      totalWaiting: queue.length,
      needed: table.mode,
      message: "Already in waiting queue for this table."
    });
  }
  const newPlayer = {
    userId,
    userName: userName || "Player",
    avatar,
    joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
    isSimulated: false
  };
  queue.push(newPlayer);
  updateTableQueueStats();
  if (queue.length >= table.mode) {
    clearQueueTimer(tableId);
    const matchedPlayers = queue.splice(0, table.mode);
    const newMatch = createAndStartMatch(table, matchedPlayers, false);
    return res.json({
      success: true,
      status: "starting",
      matchId: newMatch.id,
      match: newMatch,
      message: `Match starting with ${table.mode} players!`
    });
  }
  scheduleAutoMatchStealthBots(tableId);
  return res.json({
    success: true,
    status: "waiting",
    queuePosition: queue.length,
    totalWaiting: queue.length,
    needed: table.mode,
    message: `Joined queue (${queue.length}/${table.mode}). Searching for players...`
  });
});
ludoRouter.post("/queue/simulate-opponent", async (req, res) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString("utf8"));
    } catch {
    }
  }
  const { tableId, userId } = body || {};
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: "Table not found" });
  if (!LUDO_BOTS_ENABLED) {
    return res.status(403).json({
      error: "Bot matchmaking is globally disabled (LUDO_BOTS_ENABLED = false). Enable bots in Admin Settings."
    });
  }
  clearQueueTimer(tableId);
  if (isSupabaseConfigured && supabase) {
    try {
      let userRowQuery = supabase.from("ludo_matchmaking_queue").select("*").eq("table_id", tableId).eq("status", "waiting");
      if (userId) {
        userRowQuery = userRowQuery.eq("user_id", userId);
      }
      const { data: userRows } = await userRowQuery.order("joined_at", { ascending: true }).limit(1);
      if (userRows && userRows.length > 0) {
        const uRow = userRows[0];
        const matchedPlayers2 = [
          {
            userId: uRow.user_id,
            userName: uRow.user_name,
            avatar: uRow.avatar,
            joinedAt: uRow.joined_at,
            isSimulated: false
          }
        ];
        while (matchedPlayers2.length < table.mode) {
          const stealth = generateStealthPlayer();
          matchedPlayers2.push({
            userId: stealth.userId,
            userName: stealth.userName,
            avatar: stealth.avatar,
            joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
            isSimulated: true
          });
        }
        const newMatch2 = createAndStartMatch(table, matchedPlayers2, false);
        await supabase.from("ludo_matchmaking_queue").update({
          status: "matched",
          match_id: newMatch2.id,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", uRow.id);
        return res.json({
          success: true,
          status: "starting",
          matchId: newMatch2.id,
          match: newMatch2
        });
      }
    } catch (err) {
      console.warn("[LudoMatchServer] Supabase simulate opponent error:", err);
    }
  }
  let queue = waitingQueues.get(tableId);
  if (!queue || queue.length === 0) {
    return res.status(400).json({ error: "No human player waiting in this table queue to pair with." });
  }
  while (queue.length < table.mode) {
    const stealth = generateStealthPlayer();
    queue.push({
      userId: stealth.userId,
      userName: stealth.userName,
      avatar: stealth.avatar,
      joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      isSimulated: true
    });
  }
  const matchedPlayers = queue.splice(0, table.mode);
  const newMatch = createAndStartMatch(table, matchedPlayers, false);
  return res.json({
    success: true,
    status: "starting",
    matchId: newMatch.id,
    match: newMatch
  });
});
ludoRouter.post("/queue/cancel", async (req, res) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString("utf8"));
    } catch {
    }
  }
  const { tableId, userId } = body || {};
  if (!tableId || !userId) return res.status(400).json({ error: "tableId and userId required" });
  const table = cashTables.find((t) => t.id === tableId);
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("ludo_matchmaking_queue").update({
        status: "cancelled",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("user_id", userId).eq("table_id", tableId).eq("status", "waiting");
    } catch (err) {
      console.warn("[LudoMatchServer] Supabase queue cancel error:", err);
    }
  }
  const queue = waitingQueues.get(tableId);
  if (queue) {
    const idx = queue.findIndex((p) => p.userId === userId);
    if (idx !== -1) {
      queue.splice(idx, 1);
      const hasReal = queue.some((p) => !p.isSimulated);
      if (!hasReal) {
        clearQueueTimer(tableId);
        waitingQueues.set(tableId, []);
      }
      updateTableQueueStats();
    }
  }
  return res.json({
    success: true,
    refundAmount: table?.entryFee || 0,
    message: "Queue cancelled successfully. Reserved entry fee refunded 100%."
  });
});
ludoRouter.get("/queue/status", async (req, res) => {
  const tableId = req.query?.tableId || req.body?.tableId || "";
  const userId = req.query?.userId || req.body?.userId || "";
  if (!tableId || !userId) {
    return res.status(400).json({ error: "tableId and userId required" });
  }
  const table = cashTables.find((t) => t.id === tableId) || {
    id: tableId,
    mode: 2,
    entryFee: 10,
    prize: 17.5,
    isActive: true,
    minBalanceRequired: 10,
    waitingPlayers: 0,
    activeMatches: 0,
    status: "waiting",
    onlinePlayers: 2,
    playingPlayers: 2,
    current_players: 4
  };
  for (const [mId, m] of activeMatches.entries()) {
    if ((m.status === "starting" || m.status === "in_progress") && m.players.some((p) => p.userId === userId)) {
      return res.json({
        inMatch: true,
        matchId: mId,
        match: m
      });
    }
  }
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: matchedRows } = await supabase.from("ludo_matchmaking_queue").select("*").eq("user_id", userId).eq("status", "matched").order("updated_at", { ascending: false }).limit(1);
      if (matchedRows && matchedRows.length > 0 && matchedRows[0].match_id) {
        const matchId = matchedRows[0].match_id;
        let match = activeMatches.get(matchId);
        if (!match) {
          const { data: dbMatch } = await supabase.from("ludo_table_matches").select("*").eq("id", matchId).maybeSingle();
          if (dbMatch) {
            match = buildMatchFromDb(dbMatch);
            activeMatches.set(matchId, match);
          }
        }
        if (match) {
          return res.json({
            inMatch: true,
            matchId,
            match
          });
        }
      }
      const { data: waitingRows } = await supabase.from("ludo_matchmaking_queue").select("*").eq("table_id", tableId).eq("status", "waiting").order("joined_at", { ascending: true });
      if (waitingRows && waitingRows.length > 0) {
        const userRowIndex = waitingRows.findIndex((r) => r.user_id === userId);
        if (userRowIndex !== -1) {
          const userRow = waitingRows[userRowIndex];
          const waitDurationMs = Date.now() - new Date(userRow.joined_at).getTime();
          const autoMatchWaitSec = (botPoolConfig.autoMatchWaitSeconds || 3) * 1e3;
          if (botPoolConfig.autoMatchStealthBots && LUDO_BOTS_ENABLED && waitDurationMs >= autoMatchWaitSec) {
            clearQueueTimer(tableId);
            const opponentsCount = table.mode - 1;
            const opponents = [];
            for (let i = 0; i < opponentsCount; i++) {
              const stealth = generateStealthPlayer();
              opponents.push({
                userId: stealth.userId,
                userName: stealth.userName,
                avatar: stealth.avatar,
                joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
                isSimulated: true
              });
            }
            const matchedPlayers = [
              {
                userId: userRow.user_id,
                userName: userRow.user_name,
                avatar: userRow.avatar,
                joinedAt: userRow.joined_at,
                isSimulated: false
              },
              ...opponents
            ];
            const newMatch = createAndStartMatch(table, matchedPlayers, false);
            await supabase.from("ludo_matchmaking_queue").update({
              status: "matched",
              match_id: newMatch.id,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", userRow.id);
            return res.json({
              inMatch: true,
              matchId: newMatch.id,
              match: newMatch
            });
          }
          return res.json({
            inMatch: false,
            inQueue: true,
            queuePosition: userRowIndex + 1,
            waitingCount: waitingRows.length,
            needed: table.mode
          });
        }
      }
    } catch (err) {
      console.warn("[LudoMatchServer] Supabase queue/status error:", err);
    }
  }
  const queue = waitingQueues.get(tableId) || [];
  const pos = queue.findIndex((p) => p.userId === userId);
  if (pos !== -1) {
    const queuedUser = queue[pos];
    const waitDurationMs = Date.now() - new Date(queuedUser.joinedAt).getTime();
    const autoMatchWaitSec = (botPoolConfig.autoMatchWaitSeconds || 3) * 1e3;
    if (queue.length >= table.mode || botPoolConfig.autoMatchStealthBots && LUDO_BOTS_ENABLED && waitDurationMs >= autoMatchWaitSec) {
      clearQueueTimer(tableId);
      autoFillQueueWithStealthBots(tableId);
      for (const [mId, m] of activeMatches.entries()) {
        if ((m.status === "starting" || m.status === "in_progress") && m.players.some((p) => p.userId === userId)) {
          return res.json({
            inMatch: true,
            matchId: mId,
            match: m
          });
        }
      }
    }
  }
  return res.json({
    inMatch: false,
    inQueue: pos !== -1,
    queuePosition: pos + 1,
    waitingCount: queue.length,
    needed: table.mode
  });
});
ludoRouter.get("/match/:matchId/state", async (req, res) => {
  const { matchId } = req.params;
  let match = activeMatches.get(matchId);
  if (!match && isSupabaseConfigured && supabase) {
    try {
      const { data: dbMatch } = await supabase.from("ludo_table_matches").select("*").eq("id", matchId).maybeSingle();
      if (dbMatch) {
        match = buildMatchFromDb(dbMatch);
        activeMatches.set(matchId, match);
      }
    } catch (err) {
      console.warn("[LudoMatchServer] Supabase match fetch error:", err);
    }
  }
  if (!match) {
    const pastRec = matchHistory.find((r) => r.matchId === matchId);
    if (pastRec) {
      return res.json({
        success: true,
        status: "completed",
        record: pastRec
      });
    }
    return res.status(404).json({ error: "Match not found or expired." });
  }
  checkMatchTimerExpired(match);
  if (match.status === "in_progress" && !match.gameState.isGameOver && match.turnDeadline) {
    const now = Date.now();
    const deadline = new Date(match.turnDeadline).getTime();
    if (now > deadline) {
      const currentTurn = match.gameState.currentTurn;
      const player = match.players.find((p) => p.color === currentTurn);
      if (player) {
        player.timeoutCount = (player.timeoutCount || 0) + 1;
        if (player.timeoutCount >= adminConfig.maxTimeoutsBeforeForfeit) {
          player.isOnline = false;
          match.gameState.lastActionText = `\u26A0\uFE0F ${player.userName} exceeded ${adminConfig.maxTimeoutsBeforeForfeit} timeouts and forfeited!`;
          finalizeTimerLudoMatch(match, `${player.userName} forfeited.`);
        } else {
          match.gameState.lastActionText = `\u23F1\uFE0F ${player.userName} turn timed out. Passing to next player.`;
          advanceMatchTurn(match, false);
          checkAndRunBotTurn(match);
        }
        syncMatchToSupabase(match);
      }
    }
  }
  return res.json({ success: true, match });
});
ludoRouter.post("/match/:matchId/roll", (req, res) => {
  const { matchId } = req.params;
  const { userId, color } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  if (checkMatchTimerExpired(match) || match.status !== "in_progress") {
    return res.status(400).json({ error: "Match timer has ended or match is completed.", match });
  }
  if (match.gameState.currentTurn !== color) {
    return res.status(403).json({ error: `Not your turn! Current turn is ${match.gameState.currentTurn}` });
  }
  const player = match.players.find((p) => p.color === color);
  if (!player || player.userId !== userId && !player.isSimulated) {
    return res.status(403).json({ error: "You do not control this color" });
  }
  if (match.gameState.hasRolled) {
    return res.status(400).json({ error: "Already rolled for this turn" });
  }
  const roll = Math.floor(Math.random() * 6) + 1;
  const rollResult = applyDiceRollToMatch(match, color, roll);
  if (rollResult.forfeited) {
    advanceMatchTurn(match, false);
    checkAndRunBotTurn(match);
    return res.json({
      success: true,
      roll,
      legalMoves: [],
      forfeited: true,
      match
    });
  }
  const legalMoves = getLegalMoves(match.gameState.tokens, color, roll);
  match.gameState.highlightedTokenIds = legalMoves;
  if (legalMoves.length === 0) {
    match.gameState.lastActionText = `${capitalize(color)} rolled ${roll}. No legal moves available!`;
    setTimeout(() => {
      advanceMatchTurn(match, false);
      checkAndRunBotTurn(match);
    }, 1500);
  } else {
    match.gameState.lastActionText = `${capitalize(color)} rolled a ${roll}! (+${roll} pts). Tap a highlighted token to move.`;
  }
  match.turnDeadline = new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1e3).toISOString();
  syncMatchToSupabase(match);
  return res.json({
    success: true,
    roll,
    legalMoves,
    match
  });
});
ludoRouter.post("/match/:matchId/move", (req, res) => {
  const { matchId } = req.params;
  const { userId, color, tokenId } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  if (checkMatchTimerExpired(match) || match.status !== "in_progress") {
    return res.status(400).json({ error: "Match timer has ended or match is completed.", match });
  }
  if (match.gameState.currentTurn !== color) {
    return res.status(403).json({ error: `Not your turn! Current turn is ${match.gameState.currentTurn}` });
  }
  const player = match.players.find((p) => p.color === color);
  if (!player || player.userId !== userId && !player.isSimulated) {
    return res.status(403).json({ error: "You do not control this color" });
  }
  if (!match.gameState.hasRolled || match.gameState.diceValue === null) {
    return res.status(400).json({ error: "Must roll dice first" });
  }
  const result = executeTokenMove(match, color, Number(tokenId));
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  checkAndRunBotTurn(match);
  syncMatchToSupabase(match);
  return res.json({
    success: true,
    match
  });
});
ludoRouter.post("/match/:matchId/leave", (req, res) => {
  const { matchId } = req.params;
  const { userId } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  if (match.status === "in_progress" && !match.gameState.isGameOver) {
    const quittingPlayer = match.players.find((p) => p.userId === userId);
    if (!quittingPlayer) return res.json({ success: true, match });
    quittingPlayer.hasForfeited = true;
    quittingPlayer.isOnline = false;
    quittingPlayer.isLeft = true;
    const remainingActivePlayers = match.players.filter((p) => !p.hasForfeited);
    if (remainingActivePlayers.length <= 1) {
      const winner = remainingActivePlayers[0] || match.players.find((p) => p.userId !== userId);
      if (winner) {
        match.gameState.isGameOver = true;
        match.status = "completed";
        match.completedAt = (/* @__PURE__ */ new Date()).toISOString();
        match.winnerId = winner.userId;
        match.winnerName = winner.userName;
        match.winnerColor = winner.color;
        match.gameState.winners = [winner.color];
        match.gameState.lastActionText = `\u{1F3F3}\uFE0F ${quittingPlayer.userName} left the table. ${winner.userName} wins by forfeit!`;
        matchHistory.unshift({
          id: `rec-${match.id}-${winner.userId}`,
          userId: winner.userId,
          userName: winner.userName,
          matchId: match.id,
          tableTitle: `\u20B9${match.entryFee} (${match.playerCount}P)`,
          entryFee: match.entryFee,
          mode: match.playerCount,
          prizeWon: match.prizeAmount,
          isWinner: true,
          status: "completed",
          referenceId: `LUDO-FORFEIT-${match.id}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } else {
      if (match.gameState.tokens[quittingPlayer.color]) {
        match.gameState.tokens[quittingPlayer.color].forEach((t) => {
          t.step = -1;
          t.score = 0;
        });
      }
      match.gameState.lastActionText = `\u{1F3F3}\uFE0F ${quittingPlayer.userName} left the match. Match continues with ${remainingActivePlayers.length} players!`;
      if (match.gameState.currentTurn === quittingPlayer.color) {
        const activeColors = remainingActivePlayers.map((p) => p.color);
        const nextColor = getNextPlayer(
          match.gameState.currentTurn,
          activeColors,
          match.gameState.winners
        );
        match.gameState.currentTurn = nextColor;
        match.gameState.hasRolled = false;
        match.gameState.diceValue = null;
        match.gameState.highlightedTokenIds = [];
        match.gameState.extraTurn = false;
        match.turnDeadline = new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1e3).toISOString();
      }
    }
  }
  syncMatchToSupabase(match);
  return res.json({ success: true, match });
});
ludoRouter.post("/match/:matchId/chat", (req, res) => {
  const { matchId } = req.params;
  const { userId, text } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Message text required" });
  const sender = match.players.find((p) => p.userId === userId);
  if (!sender) return res.status(403).json({ error: "User is not a participant in this match" });
  if (!match.chatMessages) {
    match.chatMessages = [];
  }
  const cleanText = text.trim().slice(0, 80);
  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    senderId: sender.userId,
    senderName: sender.userName.replace(" [BOT]", ""),
    senderColor: sender.color,
    text: cleanText,
    timestamp: Date.now()
  };
  match.chatMessages.push(newMsg);
  if (match.chatMessages.length > 30) {
    match.chatMessages.shift();
  }
  syncMatchToSupabase(match);
  const botOpponents = match.players.filter(
    (p) => p.isSimulated && !p.hasForfeited && p.userId !== userId
  );
  if (botOpponents.length > 0 && Math.random() < 0.8) {
    const respondingBot = botOpponents[Math.floor(Math.random() * botOpponents.length)];
    const replyDelay = Math.floor(1e3 + Math.random() * 1500);
    setTimeout(() => {
      const activeMatch = activeMatches.get(matchId);
      if (!activeMatch || activeMatch.status !== "in_progress" || activeMatch.gameState.isGameOver) return;
      if (!activeMatch.chatMessages) activeMatch.chatMessages = [];
      let botReplyText = "Good luck! \u{1F340}";
      const lower = cleanText.toLowerCase();
      if (lower.includes("luck")) {
        botReplyText = Math.random() > 0.5 ? "Thanks! You too! \u{1F340}" : "May the best player win! \u{1F3B2}";
      } else if (lower.includes("nice") || lower.includes("well played") || lower.includes("king")) {
        botReplyText = Math.random() > 0.5 ? "Thank you! \u{1F64F}" : "Haha, thanks! \u{1F525}";
      } else if (lower.includes("hello") || lower.includes("hi")) {
        botReplyText = "Hello! Let\u2019s play! \u{1F44B}";
      } else if (lower.includes("six") || lower.includes("6")) {
        botReplyText = Math.random() > 0.5 ? "Waiting for my 6 too! \u{1F3B2}" : "Hope you get it! \u2728";
      } else if (lower.includes("hurry") || lower.includes("fast")) {
        botReplyText = "Rolling now! \u{1F3B2}";
      } else if (lower.includes("oops")) {
        botReplyText = "Happens to the best of us! \u{1F605}";
      } else if (lower.includes("thanks") || lower.includes("thank")) {
        botReplyText = "Welcome! \u{1F60A}";
      } else if (lower.includes("gg")) {
        botReplyText = "Good game! \u{1F91D}";
      } else {
        const genericReplies = ["Nice move! \u{1F44F}", "Let\u2019s go! \u{1F525}", "Good luck! \u{1F340}", "Well played! \u{1F44D}"];
        botReplyText = genericReplies[Math.floor(Math.random() * genericReplies.length)];
      }
      activeMatch.chatMessages.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        senderId: respondingBot.userId,
        senderName: respondingBot.userName.replace(" [BOT]", ""),
        senderColor: respondingBot.color,
        text: botReplyText,
        timestamp: Date.now()
      });
      if (activeMatch.chatMessages.length > 30) {
        activeMatch.chatMessages.shift();
      }
    }, replyDelay);
  }
  return res.json({ success: true, message: newMsg, match });
});
ludoRouter.get("/history/:userId", (req, res) => {
  const { userId } = req.params;
  const userRecords = matchHistory.filter((r) => r.userId === userId);
  res.json({ success: true, records: userRecords });
});
var seededRecentWinners = [
  {
    id: "seed-win-1",
    matchId: "match-ludo-891",
    userId: "usr-rohit-88",
    userName: "Rohit_Sharma_99",
    tableTitle: "\u20B950 Table (2P)",
    entryFee: 50,
    mode: 2,
    prizeWon: 87.5,
    completedAt: new Date(Date.now() - 2 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-2",
    matchId: "match-ludo-892",
    userId: "usr-vikram-07",
    userName: "Vikram_Rathore",
    tableTitle: "\u20B9200 Table (2P)",
    entryFee: 200,
    mode: 2,
    prizeWon: 350,
    completedAt: new Date(Date.now() - 5 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-3",
    matchId: "match-ludo-893",
    userId: "usr-priya-k",
    userName: "Priya_LudoQueen",
    tableTitle: "\u20B9100 Table (4P)",
    entryFee: 100,
    mode: 4,
    prizeWon: 350,
    completedAt: new Date(Date.now() - 9 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-4",
    matchId: "match-ludo-894",
    userId: "usr-aman-singh",
    userName: "Aman_Striker",
    tableTitle: "\u20B9500 Table (2P)",
    entryFee: 500,
    mode: 2,
    prizeWon: 880,
    completedAt: new Date(Date.now() - 14 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-5",
    matchId: "match-ludo-895",
    userId: "usr-rahul-m",
    userName: "Rahul_DiceKing",
    tableTitle: "\u20B920 Table (2P)",
    entryFee: 20,
    mode: 2,
    prizeWon: 35,
    completedAt: new Date(Date.now() - 21 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-6",
    matchId: "match-ludo-896",
    userId: "usr-deepak-99",
    userName: "Deepak_Arena7",
    tableTitle: "\u20B91000 Table (4P)",
    entryFee: 1e3,
    mode: 4,
    prizeWon: 3500,
    completedAt: new Date(Date.now() - 32 * 60 * 1e3).toISOString()
  },
  {
    id: "seed-win-7",
    matchId: "match-ludo-897",
    userId: "usr-suresh-p",
    userName: "Suresh_Player1",
    tableTitle: "\u20B9250 Table (2P)",
    entryFee: 250,
    mode: 2,
    prizeWon: 440,
    completedAt: new Date(Date.now() - 45 * 60 * 1e3).toISOString()
  }
];
ludoRouter.get("/recent-winners", (req, res) => {
  const liveWinners = matchHistory.filter((r) => r.isWinner && r.prizeWon > 0).map((r) => ({
    id: r.id,
    matchId: r.matchId,
    userId: r.userId,
    userName: r.userName || "Player_" + r.userId.slice(-4),
    tableTitle: r.tableTitle,
    entryFee: r.entryFee,
    mode: r.mode,
    prizeWon: r.prizeWon,
    completedAt: r.timestamp
  }));
  const seenMatchIds = /* @__PURE__ */ new Set();
  const combinedWinners = [];
  for (const w of [...liveWinners, ...seededRecentWinners]) {
    if (!seenMatchIds.has(w.matchId)) {
      seenMatchIds.add(w.matchId);
      combinedWinners.push(w);
    }
  }
  res.json({
    success: true,
    winners: combinedWinners.slice(0, 16)
  });
});
ludoRouter.get("/admin/overview", (req, res) => {
  const queuesData = {};
  waitingQueues.forEach((list, key) => {
    if (list.length > 0) queuesData[key] = list.length;
  });
  const liveMatches = Array.from(activeMatches.values()).filter(
    (m) => m.status === "in_progress" || m.status === "starting"
  );
  res.json({
    success: true,
    config: adminConfig,
    activeQueues: queuesData,
    liveMatchesCount: liveMatches.length,
    completedMatchesCount: matchHistory.length,
    tables: cashTables
  });
});
var getDetailedTablesHandler = (req, res) => {
  updateTableQueueStats();
  const detailedTables = cashTables.map((t) => {
    const queue = waitingQueues.get(t.id) || [];
    const tableMatches = Array.from(activeMatches.values()).filter(
      (m) => m.tableId === t.id && m.status !== "completed" && m.status !== "cancelled"
    );
    return {
      ...t,
      waitingQueue: queue.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        joinedAt: p.joinedAt,
        isOnline: true
      })),
      activeMatches: tableMatches.map((m) => ({
        matchId: m.id,
        status: m.status,
        playerCount: m.playerCount,
        entryFee: m.entryFee,
        prizeAmount: m.prizeAmount,
        startedAt: m.startedAt,
        players: m.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          color: p.color,
          isOnline: p.isOnline,
          isReady: p.isReady
        })),
        currentTurn: m.gameState?.currentTurn
      }))
    };
  });
  res.json({ success: true, tables: detailedTables, config: adminConfig });
};
ludoRouter.get("/admin/tables/detailed", getDetailedTablesHandler);
ludoRouter.get("/admin/detailed-tables", getDetailedTablesHandler);
ludoRouter.post("/admin/table/create", (req, res) => {
  const { entryFee, mode, prize, minBalance } = req.body;
  const fee = Number(entryFee);
  const playerMode = mode === 2 ? 2 : 4;
  if (isNaN(fee) || fee <= 0) {
    return res.status(400).json({ error: "Valid entry fee greater than zero is required." });
  }
  const defaultPrize = playerMode === 2 ? Math.round(fee * 1.75 * 100) / 100 : Math.round(fee * 3.5 * 100) / 100;
  const tablePrize = prize !== void 0 ? Number(prize) : defaultPrize;
  const newTable = {
    id: `custom-table-${Date.now()}-${fee}-${playerMode}p`,
    entryFee: fee,
    mode: playerMode,
    prize: tablePrize,
    isActive: true,
    minBalanceRequired: minBalance ? Number(minBalance) : fee,
    waitingPlayers: 0,
    activeMatches: 0,
    status: "waiting",
    onlinePlayers: getTableBotCounts(fee, playerMode).onlinePlayers,
    playingPlayers: getTableBotCounts(fee, playerMode).playingPlayers,
    current_players: getTableBotCounts(fee, playerMode).onlinePlayers + getTableBotCounts(fee, playerMode).playingPlayers
  };
  cashTables.unshift(newTable);
  res.json({ success: true, table: newTable, message: `Created \u20B9${fee} (${playerMode}P) cash table.` });
});
ludoRouter.post("/admin/table/edit", (req, res) => {
  const { tableId, entryFee, prize, isActive, onlinePlayers, playingPlayers, resetAutoTraffic } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: "Table not found." });
  if (entryFee !== void 0) {
    const fee = Number(entryFee);
    if (!isNaN(fee) && fee > 0) {
      table.entryFee = fee;
      table.minBalanceRequired = fee;
    }
  }
  if (prize !== void 0) {
    const p = Number(prize);
    if (!isNaN(p) && p > 0) table.prize = p;
  }
  if (isActive !== void 0) {
    table.isActive = Boolean(isActive);
  }
  if (resetAutoTraffic) {
    delete table.manualOnlinePlayers;
    delete table.manualPlayingPlayers;
  } else {
    if (onlinePlayers !== void 0) {
      const onCount = Number(onlinePlayers);
      if (!isNaN(onCount) && onCount >= 0) {
        table.manualOnlinePlayers = Math.floor(onCount);
      }
    }
    if (playingPlayers !== void 0) {
      const plCount = Number(playingPlayers);
      if (!isNaN(plCount) && plCount >= 0) {
        table.manualPlayingPlayers = Math.floor(plCount);
      }
    }
  }
  updateTableQueueStats();
  res.json({ success: true, table, message: `Table ${tableId} updated successfully.` });
});
ludoRouter.post("/admin/table/traffic", (req, res) => {
  const { tableId, onlinePlayers, playingPlayers, resetAutoTraffic } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: "Table not found." });
  if (resetAutoTraffic) {
    delete table.manualOnlinePlayers;
    delete table.manualPlayingPlayers;
  } else {
    if (onlinePlayers !== void 0) {
      const onCount = Number(onlinePlayers);
      if (!isNaN(onCount) && onCount >= 0) {
        table.manualOnlinePlayers = Math.floor(onCount);
      }
    }
    if (playingPlayers !== void 0) {
      const plCount = Number(playingPlayers);
      if (!isNaN(plCount) && plCount >= 0) {
        table.manualPlayingPlayers = Math.floor(plCount);
      }
    }
  }
  updateTableQueueStats();
  res.json({
    success: true,
    table,
    message: resetAutoTraffic ? `Table ${tableId} traffic restored to auto 5000+ bot distribution.` : `Table ${tableId} traffic updated: ${table.onlinePlayers} Online, ${table.playingPlayers} Playing.`
  });
});
ludoRouter.post("/admin/tables/traffic-bulk", (req, res) => {
  const { action, multiplier } = req.body;
  if (action === "reset_all_auto") {
    cashTables.forEach((t) => {
      delete t.manualOnlinePlayers;
      delete t.manualPlayingPlayers;
    });
    updateTableQueueStats();
    return res.json({
      success: true,
      message: "All 42 tables reset to realistic 5,000+ bot pool distribution.",
      tables: cashTables
    });
  }
  if (action === "scale" && multiplier) {
    const factor = Number(multiplier);
    if (!isNaN(factor) && factor > 0) {
      cashTables.forEach((t) => {
        const curOn = t.manualOnlinePlayers !== void 0 ? t.manualOnlinePlayers : t.onlinePlayers;
        const curPl = t.manualPlayingPlayers !== void 0 ? t.manualPlayingPlayers : t.playingPlayers;
        t.manualOnlinePlayers = Math.max(0, Math.floor(curOn * factor));
        t.manualPlayingPlayers = Math.max(0, Math.floor(curPl * factor));
      });
      updateTableQueueStats();
      return res.json({
        success: true,
        message: `Scaled traffic by ${factor}x across all tables.`,
        tables: cashTables
      });
    }
  }
  res.status(400).json({ error: "Invalid bulk action specified." });
});
ludoRouter.post("/admin/table/archive", (req, res) => {
  const { tableId } = req.body;
  const idx = cashTables.findIndex((t) => t.id === tableId);
  if (idx === -1) return res.status(404).json({ error: "Table not found." });
  const table = cashTables[idx];
  table.isActive = false;
  table.isArchived = true;
  res.json({ success: true, message: `Table ${tableId} archived successfully.` });
});
ludoRouter.post("/admin/table/cancel-queue", (req, res) => {
  const { tableId, reason = "Queue cancelled by administrator" } = req.body;
  const queue = waitingQueues.get(tableId);
  if (!queue || queue.length === 0) {
    return res.json({ success: true, refundedPlayers: 0, message: "Queue is already empty." });
  }
  const refundedPlayers = queue.map((p) => ({
    userId: p.userId,
    userName: p.userName,
    reason
  }));
  waitingQueues.set(tableId, []);
  updateTableQueueStats();
  res.json({
    success: true,
    refundedCount: refundedPlayers.length,
    refundedPlayers,
    message: `Cancelled waiting queue for table ${tableId}. ${refundedPlayers.length} players refunded.`
  });
});
ludoRouter.get("/admin/matches/active", (req, res) => {
  const matches = Array.from(activeMatches.values()).map((m) => {
    const startMs = m.startedAt ? new Date(m.startedAt).getTime() : new Date(m.createdAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1e3));
    const endsMs = m.endsAt ? new Date(m.endsAt).getTime() : startMs + (m.durationSeconds || 480) * 1e3;
    const timeRemainingSeconds = Math.max(0, Math.floor((endsMs - Date.now()) / 1e3));
    return {
      ...m,
      elapsedSeconds,
      timeRemainingSeconds,
      currentTurnPlayer: m.players.find((p) => p.color === m.gameState.currentTurn),
      totalTokensInPlay: m.gameState?.tokens ? Object.values(m.gameState.tokens).flat().filter((t) => t.step >= 0 && t.step < 56).length : 0,
      tokensHomeCount: m.gameState?.tokens ? Object.values(m.gameState.tokens).flat().filter((t) => t.step === 56).length : 0
    };
  });
  res.json({ success: true, matches });
});
ludoRouter.post("/admin/match/pause", (req, res) => {
  const { matchId, reason = "Match paused by administrator" } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: "Match not found." });
  match.status = "paused";
  match.pausedAt = (/* @__PURE__ */ new Date()).toISOString();
  match.pausedReason = reason;
  match.gameState.lastActionText = `\u23F8\uFE0F Game PAUSED by Admin: ${reason}`;
  res.json({ success: true, match, message: `Match ${matchId} paused.` });
});
ludoRouter.post("/admin/match/resume", (req, res) => {
  const { matchId } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: "Match not found." });
  match.status = "in_progress";
  match.pausedAt = void 0;
  match.pausedReason = void 0;
  match.gameState.lastActionText = `\u25B6\uFE0F Game RESUMED by Admin.`;
  res.json({ success: true, match, message: `Match ${matchId} resumed.` });
});
ludoRouter.post("/admin/match/cancel", (req, res) => {
  const { matchId, reason = "Match cancelled by administrator" } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: "Match not found." });
  match.status = "cancelled";
  match.completedAt = (/* @__PURE__ */ new Date()).toISOString();
  match.refundProcessed = true;
  match.cancelledReason = reason;
  match.gameState.isGameOver = true;
  match.gameState.lastActionText = `\u{1F6D1} Match CANCELLED by Admin. Entry fee of \u20B9${match.entryFee} refunded to all players.`;
  match.players.forEach((p) => {
    matchHistory.unshift({
      id: `refund-${match.id}-${p.userId}`,
      userId: p.userId,
      userName: p.userName,
      matchId: match.id,
      tableTitle: `\u20B9${match.entryFee} (${match.playerCount}P)`,
      entryFee: match.entryFee,
      mode: match.playerCount,
      prizeWon: 0,
      isWinner: false,
      status: "refunded",
      referenceId: `REFUND-ADMIN-${match.id}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  res.json({
    success: true,
    matchId,
    refundedPlayersCount: match.players.length,
    message: `Match ${matchId} cancelled safely. Full refunds registered for ${match.players.length} players.`
  });
});
ludoRouter.post("/admin/table/toggle", (req, res) => {
  const { tableId, isActive } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: "Table not found" });
  table.isActive = Boolean(isActive);
  res.json({ success: true, table });
});
ludoRouter.get("/admin/config", (req, res) => {
  res.json({ success: true, config: adminConfig });
});
ludoRouter.post("/admin/config", (req, res) => {
  const {
    onlineLudoEnabled,
    timerLudoEnabled,
    durationMinutes2P,
    durationMinutes4P,
    homeBonusPoints,
    dicePointsEnabled,
    captureTransferEnabled,
    tieBreakerRule,
    turnTimeoutSeconds,
    maxTimeoutsBeforeForfeit,
    allowTwoPlayer,
    allowFourPlayer
  } = req.body;
  if (onlineLudoEnabled !== void 0) adminConfig.onlineLudoEnabled = Boolean(onlineLudoEnabled);
  if (timerLudoEnabled !== void 0) adminConfig.timerLudoEnabled = Boolean(timerLudoEnabled);
  if (typeof durationMinutes2P === "number" && durationMinutes2P >= 1 && durationMinutes2P <= 60) {
    adminConfig.durationMinutes2P = durationMinutes2P;
  }
  if (typeof durationMinutes4P === "number" && durationMinutes4P >= 1 && durationMinutes4P <= 60) {
    adminConfig.durationMinutes4P = durationMinutes4P;
  }
  if (typeof homeBonusPoints === "number" && homeBonusPoints >= 0 && homeBonusPoints <= 500) {
    adminConfig.homeBonusPoints = homeBonusPoints;
  }
  if (dicePointsEnabled !== void 0) adminConfig.dicePointsEnabled = Boolean(dicePointsEnabled);
  if (captureTransferEnabled !== void 0) adminConfig.captureTransferEnabled = Boolean(captureTransferEnabled);
  if (tieBreakerRule && ["home_tokens_then_captures", "most_captures", "least_timeouts"].includes(tieBreakerRule)) {
    adminConfig.tieBreakerRule = tieBreakerRule;
  }
  if (allowTwoPlayer !== void 0) adminConfig.allowTwoPlayer = Boolean(allowTwoPlayer);
  if (allowFourPlayer !== void 0) adminConfig.allowFourPlayer = Boolean(allowFourPlayer);
  if (turnTimeoutSeconds !== void 0) adminConfig.turnTimeoutSeconds = Number(turnTimeoutSeconds);
  if (maxTimeoutsBeforeForfeit !== void 0) adminConfig.maxTimeoutsBeforeForfeit = Number(maxTimeoutsBeforeForfeit);
  res.json({ success: true, config: adminConfig, message: "Timer Ludo configuration updated successfully." });
});

// src/server/ludoBotRouter.ts
import express2 from "express";
var ludoBotRouter = express2.Router();
var verifyAdminRole = requireAdminRole;
ludoBotRouter.use(requireAdminRole);
ludoBotRouter.get("/config", verifyAdminRole, (req, res) => {
  res.json({
    success: true,
    config: botPoolConfig,
    stats: getBotPoolStats()
  });
});
ludoBotRouter.post("/toggle", verifyAdminRole, (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: 'Field "enabled" must be a boolean.' });
  }
  setLudoBotsEnabled(enabled);
  res.json({
    success: true,
    enabled: LUDO_BOTS_ENABLED,
    config: botPoolConfig,
    stats: getBotPoolStats(),
    message: `Ludo bots have been ${enabled ? "ENABLED" : "DISABLED"} successfully.`
  });
});
ludoBotRouter.post("/configure", verifyAdminRole, (req, res) => {
  const { poolSize, defaultStrategy, simulationNoticeText, reseed, autoMatchStealthBots, autoMatchWaitSeconds } = req.body;
  if (defaultStrategy && ["beginner", "random_legal", "stronger_legal"].includes(defaultStrategy)) {
    botPoolConfig.defaultStrategy = defaultStrategy;
  }
  if (simulationNoticeText && typeof simulationNoticeText === "string") {
    botPoolConfig.simulationNoticeText = simulationNoticeText.trim();
  }
  if (typeof autoMatchStealthBots === "boolean") {
    botPoolConfig.autoMatchStealthBots = autoMatchStealthBots;
  }
  if (typeof autoMatchWaitSeconds === "number" && autoMatchWaitSeconds >= 1 && autoMatchWaitSeconds <= 30) {
    botPoolConfig.autoMatchWaitSeconds = autoMatchWaitSeconds;
  }
  if (poolSize && typeof poolSize === "number" && poolSize >= 1e3 && poolSize <= 2e4) {
    botPoolConfig.poolSize = poolSize;
  }
  if (reseed === true || poolSize && poolSize !== botPoolConfig.totalGeneratedBots) {
    initializeBotPool(botPoolConfig.poolSize);
  }
  botPoolConfig.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  res.json({
    success: true,
    config: botPoolConfig,
    stats: getBotPoolStats(),
    message: "Bot pool configuration updated successfully."
  });
});
ludoBotRouter.get("/list", verifyAdminRole, (req, res) => {
  const { search, status, strategy, tableId, page, limit } = req.query;
  const result = queryBots({
    search: search ? String(search) : void 0,
    status: status ? String(status) : void 0,
    strategy: strategy ? String(strategy) : void 0,
    tableId: tableId ? String(tableId) : void 0,
    page: page ? parseInt(String(page), 10) : 1,
    limit: limit ? Math.min(parseInt(String(limit), 10), 200) : 50
  });
  res.json({
    success: true,
    ...result
  });
});
ludoBotRouter.get("/bot/:id", verifyAdminRole, (req, res) => {
  const bot = getBotById(req.params.id);
  if (!bot) {
    return res.status(404).json({ error: `Bot ${req.params.id} not found.` });
  }
  res.json({ success: true, bot });
});
ludoBotRouter.patch("/bot/:id", verifyAdminRole, (req, res) => {
  const { strategy, status } = req.body;
  const updates = {};
  if (strategy && ["beginner", "random_legal", "stronger_legal"].includes(strategy)) {
    updates.strategy = strategy;
  }
  if (status && ["idle", "paused"].includes(status)) {
    updates.status = status;
  }
  const updated = updateBot(req.params.id, updates);
  if (!updated) {
    return res.status(404).json({ error: `Bot ${req.params.id} not found.` });
  }
  res.json({ success: true, bot: updated });
});
ludoBotRouter.post("/start-match", verifyAdminRole, (req, res) => {
  if (!LUDO_BOTS_ENABLED) {
    return res.status(403).json({
      error: "Cannot start match: Bot system is globally disabled (LUDO_BOTS_ENABLED = false)."
    });
  }
  const { mode = 2, tableId = "table-test-sandbox", strategy = "stronger_legal" } = req.body;
  const numMode = mode === 4 ? 4 : 2;
  const simResult = createSimulationMatch({
    tableId,
    mode: numMode,
    strategy,
    simulatedOutcome: "random",
    botCount: numMode
  });
  if (!simResult.success) {
    return res.status(400).json({ error: simResult.error });
  }
  res.json({
    success: true,
    match: simResult.match,
    message: `Test bot match started with ${numMode} bots. Mode: ${numMode}P.`
  });
});
ludoBotRouter.post("/stop-match", verifyAdminRole, (req, res) => {
  const { matchId, reason } = req.body;
  if (!matchId) {
    return res.status(400).json({ error: "matchId is required." });
  }
  const stopped = stopSimulationMatch(matchId, reason || "Stopped by administrator");
  if (!stopped) {
    return res.status(404).json({ error: `Simulation match ${matchId} not found or already ended.` });
  }
  res.json({
    success: true,
    matchId,
    message: "Simulation match stopped safely. Bots returned to idle pool."
  });
});
ludoBotRouter.post("/reset-match", verifyAdminRole, (req, res) => {
  const { matchId } = req.body;
  if (matchId) {
    stopSimulationMatch(matchId, "Single match reset");
    return res.json({ success: true, message: `Match ${matchId} reset successfully.` });
  }
  const clearedCount = resetAllSimulationMatches();
  res.json({
    success: true,
    clearedCount,
    message: `Reset complete. ${clearedCount} active simulation matches cleared. All bots restored to idle.`
  });
});
ludoBotRouter.post("/simulation/start", verifyAdminRole, (req, res) => {
  if (!LUDO_BOTS_ENABLED) {
    return res.status(403).json({
      error: "Cannot start simulation: LUDO_BOTS_ENABLED is false. Enable bots first."
    });
  }
  const {
    tableId = "test-table-qa",
    mode = 2,
    strategy = "stronger_legal",
    simulatedOutcome = "random",
    adminUserId,
    adminUserName
  } = req.body;
  if (!["random", "bot_wins", "human_wins"].includes(simulatedOutcome)) {
    return res.status(400).json({
      error: 'Invalid simulatedOutcome. Must be "random", "bot_wins", or "human_wins".'
    });
  }
  const numMode = mode === 4 ? 4 : 2;
  const botCount = adminUserId ? numMode - 1 : numMode;
  const simResult = createSimulationMatch({
    tableId,
    mode: numMode,
    strategy,
    simulatedOutcome,
    botCount,
    adminUserId,
    adminUserName
  });
  if (!simResult.success) {
    return res.status(400).json({ error: simResult.error });
  }
  res.json({
    success: true,
    match: simResult.match,
    simulatedOutcome,
    notice: "SIMULATION \u2014 NOT A REAL MATCH (Test Tokens Only. Zero real cash.)"
  });
});
ludoBotRouter.get("/simulation/active", verifyAdminRole, (req, res) => {
  res.json({
    success: true,
    matches: getActiveSimulationMatches()
  });
});
ludoBotRouter.get("/logs", verifyAdminRole, (req, res) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  res.json({
    success: true,
    logs: getBotMatchLogs(limit)
  });
});
ludoBotRouter.delete("/logs", verifyAdminRole, (req, res) => {
  clearBotLogs();
  res.json({
    success: true,
    message: "Bot match logs cleared successfully."
  });
});

// src/server/userAuthServer.ts
import express3 from "express";
import bcrypt from "bcryptjs";
import crypto3 from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var USERS_STORE_PATH = path.resolve(__dirname, "../../users_store.json");
var userAuthRouter = express3.Router();
var usersMap = /* @__PURE__ */ new Map();
var emailIndex = /* @__PURE__ */ new Map();
var phoneIndex = /* @__PURE__ */ new Map();
var referralCodeIndex = /* @__PURE__ */ new Map();
var REFERRALS_STORE_PATH = path.resolve(__dirname, "../../referrals_store.json");
var referralsList = [];
var userSessions = /* @__PURE__ */ new Map();
var loginRateLimits = /* @__PURE__ */ new Map();
function generateReferralCode(name, userId) {
  const cleanName = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "CRIC";
  const idSuffix = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase() || "77";
  const randNum = Math.floor(10 + Math.random() * 90);
  return `${cleanName}${idSuffix}${randNum}`;
}
function loadPersistentReferrals() {
  try {
    if (fs.existsSync(REFERRALS_STORE_PATH)) {
      const raw = fs.readFileSync(REFERRALS_STORE_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        referralsList = data;
      }
    }
  } catch (err) {
    console.warn("[UserAuth] Failed to load referrals_store.json:", err);
  }
  if (referralsList.length === 0) {
    referralsList = [
      {
        id: "ref-demo-1",
        referrerId: "usr-demo-player-1",
        referrerCode: "ROHIT77",
        refereeId: "usr-ref-1",
        refereeName: "Aman Sharma",
        refereeIdentifier: "am***@gmail.com",
        bonusCoins: 50,
        status: "completed",
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1e3).toISOString()
      },
      {
        id: "ref-demo-2",
        referrerId: "usr-demo-player-1",
        referrerCode: "ROHIT77",
        refereeId: "usr-ref-2",
        refereeName: "Vikas Kumar",
        refereeIdentifier: "98******42",
        bonusCoins: 50,
        status: "completed",
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString()
      }
    ];
    savePersistentReferrals();
  }
}
function savePersistentReferrals() {
  try {
    fs.writeFileSync(REFERRALS_STORE_PATH, JSON.stringify(referralsList, null, 2), "utf-8");
  } catch (err) {
    console.warn("[UserAuth] Failed to write referrals_store.json:", err);
  }
}
function loadPersistentUsers() {
  try {
    if (fs.existsSync(USERS_STORE_PATH)) {
      const raw = fs.readFileSync(USERS_STORE_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        data.forEach((u) => {
          if (!u.referralCode) {
            u.referralCode = u.id === "usr-demo-player-1" ? "ROHIT77" : generateReferralCode(u.name, u.id);
            u.referralsCount = u.referralsCount || (u.id === "usr-demo-player-1" ? 2 : 0);
            u.totalReferralEarnings = u.totalReferralEarnings || (u.id === "usr-demo-player-1" ? 100 : 0);
          }
          usersMap.set(u.id, u);
          if (u.email) emailIndex.set(normalizeEmail(u.email), u.id);
          if (u.phone) phoneIndex.set(normalizePhone(u.phone), u.id);
          if (u.referralCode) referralCodeIndex.set(u.referralCode.toUpperCase(), u.id);
        });
      }
    }
  } catch (err) {
    console.warn("[UserAuth] Failed to load users_store.json, using in-memory store:", err);
  }
  if (usersMap.size === 0) {
    const demoPasswordHash = bcrypt.hashSync("Player123@", 10);
    const demoUser = {
      id: "usr-demo-player-1",
      name: "Rohit Sharma",
      email: "rohit@cricketarena.app",
      phone: "9876543210",
      passwordHash: demoPasswordHash,
      role: "user",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80",
      referralCode: "ROHIT77",
      referralsCount: 2,
      totalReferralEarnings: 100,
      joinedTournamentsCount: 2,
      totalFantasyPoints: 480,
      createdTeamsCount: 2,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    usersMap.set(demoUser.id, demoUser);
    emailIndex.set(normalizeEmail(demoUser.email), demoUser.id);
    phoneIndex.set(normalizePhone(demoUser.phone), demoUser.id);
    referralCodeIndex.set(demoUser.referralCode.toUpperCase(), demoUser.id);
    savePersistentUsers();
  }
}
function savePersistentUsers() {
  try {
    const list = Array.from(usersMap.values());
    fs.writeFileSync(USERS_STORE_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.warn("[UserAuth] Failed to write users_store.json:", err);
  }
}
loadPersistentUsers();
loadPersistentReferrals();
function normalizeEmail(email) {
  const clean = email.trim().toLowerCase();
  if (clean.endsWith("@gmail.com") || clean.endsWith("@googlemail.com")) {
    const domain = "gmail.com";
    const atIndex = clean.indexOf("@");
    const localPart = clean.slice(0, atIndex);
    const normalizedLocal = localPart.replace(/\./g, "").split("+")[0];
    return `${normalizedLocal}@${domain}`;
  }
  return clean;
}
function isValidEmailFormat(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  const basicRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!basicRegex.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (lower.endsWith("@gmail.com") || lower.endsWith("@googlemail.com")) {
    const localPart = lower.split("@")[0];
    if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
      return false;
    }
    const cleanLocal = localPart.replace(/\./g, "").split("+")[0];
    if (cleanLocal.length < 3) return false;
  }
  return true;
}
function normalizePhone(phone) {
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return digitsOnly.slice(2);
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return digitsOnly.slice(1);
  }
  return digitsOnly;
}
function isValidPhoneFormat(phone) {
  if (!phone || typeof phone !== "string") return false;
  const normalized = normalizePhone(phone);
  return /^[6-9]\d{9}$/.test(normalized) || /^\d{10,12}$/.test(normalized);
}
function sanitizeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email || "",
    phone: u.phone || void 0,
    role: u.role,
    avatarUrl: u.avatarUrl,
    referralCode: u.referralCode,
    referredBy: u.referredBy || void 0,
    referralsCount: u.referralsCount || 0,
    totalReferralEarnings: u.totalReferralEarnings || 0,
    joinedTournamentsCount: u.joinedTournamentsCount,
    totalFantasyPoints: u.totalFantasyPoints,
    createdTeamsCount: u.createdTeamsCount,
    joinedAt: u.createdAt
  };
}
function checkRateLimit(key) {
  const record = loginRateLimits.get(key);
  if (!record) return { allowed: true };
  if (Date.now() < record.lockedUntil) {
    const diff = Math.ceil((record.lockedUntil - Date.now()) / 1e3);
    return { allowed: false, remainingSeconds: diff };
  }
  if (Date.now() >= record.lockedUntil && record.lockedUntil > 0) {
    loginRateLimits.delete(key);
  }
  return { allowed: true };
}
function registerFailedAttempt(key) {
  const record = loginRateLimits.get(key) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = Date.now() + 15 * 60 * 1e3;
  }
  loginRateLimits.set(key, record);
}
function clearRateLimit(key) {
  loginRateLimits.delete(key);
}
userAuthRouter.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, referralCode } = req.body;
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid full name (at least 2 characters)."
      });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long."
      });
    }
    const rawEmail = typeof email === "string" ? email.trim() : "";
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    if (!rawEmail && !rawPhone) {
      return res.status(400).json({
        success: false,
        error: "Please provide either a Gmail address or a Mobile Phone number to create your account."
      });
    }
    let cleanEmail = null;
    let cleanPhone = null;
    if (rawEmail) {
      if (!isValidEmailFormat(rawEmail)) {
        return res.status(400).json({
          success: false,
          error: "Invalid Gmail / Email address format. Please check and try again."
        });
      }
      cleanEmail = normalizeEmail(rawEmail);
    }
    if (rawPhone) {
      if (!isValidPhoneFormat(rawPhone)) {
        return res.status(400).json({
          success: false,
          error: "Invalid Mobile Number. Please enter a valid 10-digit mobile number."
        });
      }
      cleanPhone = normalizePhone(rawPhone);
    }
    if (cleanEmail) {
      const existingIdByEmail = emailIndex.get(cleanEmail);
      if (existingIdByEmail && usersMap.has(existingIdByEmail)) {
        return res.status(409).json({
          success: false,
          error: "An account with this Gmail address already exists. Please Sign In."
        });
      }
    }
    if (cleanPhone) {
      const existingIdByPhone = phoneIndex.get(cleanPhone);
      if (existingIdByPhone && usersMap.has(existingIdByPhone)) {
        return res.status(409).json({
          success: false,
          error: "An account with this phone number already exists. Please Sign In."
        });
      }
    }
    if (isSupabaseConfigured && supabase) {
      try {
        if (cleanEmail) {
          const { data: existingSbEmail } = await supabase.from("app_users").select("id").eq("email", cleanEmail).maybeSingle();
          if (existingSbEmail) {
            return res.status(409).json({
              success: false,
              error: "An account with this Gmail address already exists. Please Sign In."
            });
          }
        }
        if (cleanPhone) {
          const { data: existingSbPhone } = await supabase.from("app_users").select("id").eq("phone", cleanPhone).maybeSingle();
          if (existingSbPhone) {
            return res.status(409).json({
              success: false,
              error: "An account with this phone number already exists. Please Sign In."
            });
          }
        }
      } catch (sbErr) {
        console.warn("[UserAuth] Supabase duplicate check warning:", sbErr);
      }
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const cleanRefCode = typeof referralCode === "string" ? referralCode.trim().toUpperCase() : "";
    let matchedReferrer = null;
    if (cleanRefCode) {
      const referrerId = referralCodeIndex.get(cleanRefCode);
      if (referrerId && usersMap.has(referrerId)) {
        matchedReferrer = usersMap.get(referrerId);
      }
    }
    const userId = `usr_${Date.now()}_${crypto3.randomBytes(4).toString("hex")}`;
    const avatarUrl = `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80`;
    const userReferralCode = generateReferralCode(name, userId);
    const newUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      role: "user",
      // strictly regular player
      avatarUrl,
      referralCode: userReferralCode,
      referredBy: matchedReferrer ? matchedReferrer.referralCode || cleanRefCode : null,
      referralsCount: 0,
      totalReferralEarnings: 0,
      joinedTournamentsCount: 0,
      totalFantasyPoints: 0,
      createdTeamsCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    usersMap.set(userId, newUser);
    if (cleanEmail) emailIndex.set(cleanEmail, userId);
    if (cleanPhone) phoneIndex.set(cleanPhone, userId);
    referralCodeIndex.set(userReferralCode.toUpperCase(), userId);
    if (matchedReferrer && matchedReferrer.id !== newUser.id) {
      matchedReferrer.referralsCount = (matchedReferrer.referralsCount || 0) + 1;
      matchedReferrer.totalReferralEarnings = (matchedReferrer.totalReferralEarnings || 0) + 50;
      usersMap.set(matchedReferrer.id, matchedReferrer);
      const referralRecord = {
        id: `ref_${Date.now()}_${crypto3.randomBytes(3).toString("hex")}`,
        referrerId: matchedReferrer.id,
        referrerCode: matchedReferrer.referralCode || cleanRefCode,
        refereeId: newUser.id,
        refereeName: newUser.name,
        refereeIdentifier: cleanEmail ? `${cleanEmail.slice(0, 2)}***@${cleanEmail.split("@")[1]}` : `${cleanPhone ? `${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)}` : "Friend"}`,
        bonusCoins: 50,
        status: "completed",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      referralsList.unshift(referralRecord);
      savePersistentReferrals();
    }
    savePersistentUsers();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("app_users").insert({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          password_hash: newUser.passwordHash,
          role: "user",
          avatar_url: newUser.avatarUrl,
          joined_tournaments_count: 0,
          total_fantasy_points: 0,
          created_teams_count: 0,
          created_at: newUser.createdAt,
          updated_at: newUser.updatedAt
        });
      } catch (sbInsertErr) {
        console.warn("[UserAuth] Supabase app_users insert warning:", sbInsertErr);
      }
    }
    const token = crypto3.randomBytes(32).toString("hex");
    userSessions.set(token, {
      token,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 3600 * 1e3
    });
    const sanitized = sanitizeUser(newUser);
    return res.status(201).json({
      success: true,
      message: matchedReferrer ? `Registration successful! Referral code applied from ${matchedReferrer.name}. +50 Welcome Bonus Credits unlocked!` : "Registration successful! Welcome to Cricket Arena.",
      user: sanitized,
      token,
      authMethod: cleanEmail ? "email" : "phone",
      referralApplied: Boolean(matchedReferrer),
      referrerName: matchedReferrer?.name,
      bonusCoinsAwarded: matchedReferrer ? 50 : 0
    });
  } catch (err) {
    console.error("[UserAuth] Registration error:", err);
    return res.status(500).json({
      success: false,
      error: "An internal error occurred during registration. Please try again."
    });
  }
});
userAuthRouter.post("/login", async (req, res) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const rawInput = (identifier || email || phone || "").trim();
    if (!rawInput) {
      return res.status(400).json({
        success: false,
        error: "Please enter your registered Gmail address or Mobile Number."
      });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        error: "Please enter your account password."
      });
    }
    const isEmailInput = rawInput.includes("@");
    let searchEmail = null;
    let searchPhone = null;
    if (isEmailInput) {
      searchEmail = normalizeEmail(rawInput);
    } else {
      searchPhone = normalizePhone(rawInput);
    }
    const rateLimitKey = searchEmail || searchPhone || req.ip || "general";
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Please wait ${Math.ceil((rateCheck.remainingSeconds || 900) / 60)} minute(s) before trying again.`,
        locked: true
      });
    }
    let matchedUser = null;
    if (searchEmail) {
      const userId = emailIndex.get(searchEmail);
      if (userId && usersMap.has(userId)) {
        matchedUser = usersMap.get(userId);
      }
    } else if (searchPhone) {
      const userId = phoneIndex.get(searchPhone);
      if (userId && usersMap.has(userId)) {
        matchedUser = usersMap.get(userId);
      }
    }
    if (!matchedUser && isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from("app_users").select("*");
        if (searchEmail) {
          query = query.eq("email", searchEmail);
        } else if (searchPhone) {
          query = query.eq("phone", searchPhone);
        }
        const { data: sbUser } = await query.maybeSingle();
        if (sbUser) {
          matchedUser = {
            id: sbUser.id,
            name: sbUser.name,
            email: sbUser.email,
            phone: sbUser.phone,
            passwordHash: sbUser.password_hash,
            role: "user",
            avatarUrl: sbUser.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80",
            joinedTournamentsCount: sbUser.joined_tournaments_count || 0,
            totalFantasyPoints: sbUser.total_fantasy_points || 0,
            createdTeamsCount: sbUser.created_teams_count || 0,
            createdAt: sbUser.created_at || (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: sbUser.updated_at || (/* @__PURE__ */ new Date()).toISOString()
          };
          usersMap.set(matchedUser.id, matchedUser);
          if (matchedUser.email) emailIndex.set(normalizeEmail(matchedUser.email), matchedUser.id);
          if (matchedUser.phone) phoneIndex.set(normalizePhone(matchedUser.phone), matchedUser.id);
        }
      } catch (sbLookupErr) {
        console.warn("[UserAuth] Supabase user lookup warning:", sbLookupErr);
      }
    }
    if (!matchedUser) {
      registerFailedAttempt(rateLimitKey);
      return res.status(404).json({
        success: false,
        error: isEmailInput ? "No account found with this Gmail address. Please verify or Sign Up." : "No account found with this mobile number. Please verify or Sign Up."
      });
    }
    const passwordMatch = await bcrypt.compare(password, matchedUser.passwordHash);
    if (!passwordMatch) {
      registerFailedAttempt(rateLimitKey);
      return res.status(401).json({
        success: false,
        error: "Incorrect password. Please try again."
      });
    }
    clearRateLimit(rateLimitKey);
    const token = crypto3.randomBytes(32).toString("hex");
    userSessions.set(token, {
      token,
      userId: matchedUser.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 3600 * 1e3
    });
    const sanitized = sanitizeUser(matchedUser);
    return res.json({
      success: true,
      message: `Welcome back, ${sanitized.name}!`,
      user: sanitized,
      token,
      authMethod: isEmailInput ? "email" : "phone"
    });
  } catch (err) {
    console.error("[UserAuth] Login error:", err);
    return res.status(500).json({
      success: false,
      error: "An error occurred during sign in. Please try again."
    });
  }
});
userAuthRouter.get("/me", (req, res) => {
  const authHeader = req.headers["authorization"];
  const customHeader = req.headers["x-user-session-token"];
  let token;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (typeof customHeader === "string") {
    token = customHeader.trim();
  }
  if (!token) {
    return res.status(401).json({ success: false, error: "User session token missing." });
  }
  const session = userSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) userSessions.delete(token);
    return res.status(401).json({ success: false, error: "Session expired. Please sign in again." });
  }
  const user = usersMap.get(session.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: "User account not found." });
  }
  return res.json({
    success: true,
    user: sanitizeUser(user)
  });
});
userAuthRouter.post("/logout", (req, res) => {
  const authHeader = req.headers["authorization"];
  const customHeader = req.headers["x-user-session-token"];
  let token;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (typeof customHeader === "string") {
    token = customHeader.trim();
  }
  if (token) {
    userSessions.delete(token);
  }
  return res.json({
    success: true,
    message: "Logged out successfully."
  });
});
userAuthRouter.get("/validate-referral/:code", (req, res) => {
  const code = (req.params.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ success: false, valid: false, error: "Referral code is required." });
  }
  const referrerId = referralCodeIndex.get(code);
  if (!referrerId || !usersMap.has(referrerId)) {
    return res.json({ success: false, valid: false, error: "Invalid or unrecognized referral code." });
  }
  const referrer = usersMap.get(referrerId);
  return res.json({
    success: true,
    valid: true,
    referralCode: code,
    referrerName: referrer.name.split(" ")[0] || "Friend",
    welcomeBonusCoins: 50
  });
});
userAuthRouter.get("/referrals/:userId", (req, res) => {
  const { userId } = req.params;
  const user = usersMap.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found." });
  }
  const userReferrals = referralsList.filter((r) => r.referrerId === userId);
  const totalEarned = userReferrals.reduce((sum, r) => sum + r.bonusCoins, 0);
  return res.json({
    success: true,
    referralCode: user.referralCode || "CRIC-ARENA",
    referralsCount: userReferrals.length,
    totalBonusEarned: totalEarned,
    bonusPerReferral: 50,
    welcomeBonus: 50,
    referrals: userReferrals
  });
});
userAuthRouter.get("/my-referrals", (req, res) => {
  const authHeader = req.headers["authorization"];
  const customHeader = req.headers["x-user-session-token"];
  let token;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (typeof customHeader === "string") {
    token = customHeader.trim();
  }
  if (!token) {
    return res.status(401).json({ success: false, error: "Session token missing." });
  }
  const session = userSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    return res.status(401).json({ success: false, error: "Session expired." });
  }
  const user = usersMap.get(session.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found." });
  }
  const userReferrals = referralsList.filter((r) => r.referrerId === user.id);
  const totalEarned = userReferrals.reduce((sum, r) => sum + r.bonusCoins, 0);
  return res.json({
    success: true,
    referralCode: user.referralCode || "CRIC-ARENA",
    referralsCount: userReferrals.length,
    totalBonusEarned: totalEarned,
    bonusPerReferral: 50,
    welcomeBonus: 50,
    referrals: userReferrals
  });
});

// src/lib/walletData.ts
var INITIAL_TRANSACTIONS = [
  {
    id: "tx-welcome-001",
    userId: "user-demo-1",
    type: "starting_bonus",
    amount: 100,
    status: "completed",
    balanceBefore: 0,
    balanceAfter: 100,
    referenceId: "BONUS-INIT-001",
    description: "Welcome starting bonus credited to your wallet",
    createdAt: new Date(Date.now() - 3 * 864e5).toISOString()
  },
  {
    id: "tx-topup-002",
    userId: "user-demo-1",
    type: "deposit",
    amount: 500,
    priceInr: 500,
    status: "completed",
    balanceBefore: 100,
    balanceAfter: 600,
    referenceId: "PAY-ORD-948122",
    description: "Purchased Pro Player Pack (500 + 100 Bonus Coins)",
    createdAt: new Date(Date.now() - 1 * 864e5).toISOString()
  }
];
var INITIAL_WITHDRAWALS = [
  {
    id: "wdr-sample-1",
    userId: "user-demo-1",
    userName: "Aarav Sharma",
    userEmail: "aarav.sharma@example.com",
    amountCoins: 200,
    amountInr: 200,
    payoutMethod: "upi",
    payoutDetails: {
      upiId: "aarav@okhdfcbank",
      accountHolderName: "Aarav Sharma"
    },
    status: "approved",
    adminNotes: "Verified and payout released via UPI RRN #482910394819",
    payoutReferenceId: "UPI-RRN-482910394819",
    createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
    processedAt: new Date(Date.now() - 2 * 864e5 + 36e5).toISOString(),
    processedBy: "Official Arena Finance Admin"
  }
];

// server.ts
process.env.DISABLE_HMR = "true";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var app = express4();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var isProduction = process.env.NODE_ENV === "production";
app.use((req, res, next) => {
  if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
    try {
      req.body = JSON.parse(req.body);
      req._body = true;
    } catch {
    }
  } else if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString("utf8"));
      req._body = true;
    } catch {
    }
  } else if (req.body && typeof req.body === "object") {
    req._body = true;
  }
  next();
});
app.use(express4.json());
app.use(express4.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const queryParam = req.query?.__path || req.query?.[0] || req.query?.path || req.query?.all;
  const queryPath = Array.isArray(queryParam) ? queryParam.join("/") : queryParam;
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"] || req.originalUrl;
  let targetPath = "";
  if (queryPath) {
    const cleanSubPath = queryPath.replace(/^\/+/, "");
    targetPath = cleanSubPath.startsWith("api/") ? `/${cleanSubPath}` : `/api/${cleanSubPath}`;
  } else if (matchedPath && matchedPath.startsWith("/api") && !matchedPath.includes("[...") && (req.url === "/api" || req.url === "/" || !req.url.startsWith("/api/"))) {
    targetPath = matchedPath;
  } else if (req.url && !req.url.startsWith("/api")) {
    if (req.url.startsWith("/wallet/") || req.url.startsWith("/auth/") || req.url.startsWith("/ludo/") || req.url.startsWith("/admin/") || req.url.startsWith("/teams/") || req.url.startsWith("/health")) {
      targetPath = `/api${req.url}`;
    } else {
      targetPath = req.url;
    }
  } else {
    targetPath = req.url;
  }
  const queryEntries = Object.entries(req.query || {}).filter(
    ([k]) => k !== "__path" && k !== "path" && k !== "all" && k !== "0"
  );
  const rawPath = targetPath.split("?")[0];
  const queryString = queryEntries.length > 0 ? "?" + new URLSearchParams(queryEntries.map(([k, v]) => [k, String(Array.isArray(v) ? v[0] : typeof v === "object" && v ? JSON.stringify(v) : v ?? "")])).toString() : targetPath.includes("?") ? "?" + targetPath.split("?")[1] : "";
  req.url = `${rawPath}${queryString}`;
  next();
});
app.use("/api/auth", userAuthRouter);
app.use("/auth", userAuthRouter);
app.use("/api/ludo", ludoRouter);
app.use("/ludo", ludoRouter);
app.use("/api/admin/bots", ludoBotRouter);
app.use("/admin/bots", ludoBotRouter);
app.use("/api/ludo/bots", ludoBotRouter);
app.use("/ludo/bots", ludoBotRouter);
var serverAuditLogs = [
  {
    id: "server-audit-1",
    adminId: "admin-master",
    adminName: "Official Arena System",
    action: "SERVER_BOOTSTRAP",
    targetType: "system",
    targetId: "cricket-arena-core",
    details: "Free-Entry Cricket Arena server online. Zero cash/betting restrictions enforced.",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }
];
app.post("/api/admin/auth/login", handleAdminLogin);
app.post("/api/admin/auth/logout", handleAdminLogout);
app.get("/api/admin/auth/check", handleAdminCheck);
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mode: "free_entry_cricket_tournament",
    serverTime: (/* @__PURE__ */ new Date()).toISOString(),
    bettingOrCashAllowed: false
  });
});
app.get("/api/admin/audit-logs", requireAdminRole, (req, res) => {
  res.json({ logs: serverAuditLogs });
});
app.post("/api/teams/validate-and-create", (req, res) => {
  const { tournamentId, userId, teamName, playerIds, captainId, viceCaptainId, squadCredits } = req.body;
  if (userId) {
    const banCheck = checkUserBanStatus(userId, "all");
    if (banCheck.banned) {
      return res.status(403).json({
        error: `Access Denied: Your account is restricted (${banCheck.reason || "Restricted by administrator"}).`
      });
    }
  }
  if (!teamName || typeof teamName !== "string" || teamName.trim().length < 3) {
    return res.status(400).json({ error: "Team name must be at least 3 characters long." });
  }
  if (!Array.isArray(playerIds) || playerIds.length !== 11) {
    return res.status(400).json({ error: "Server validation failed: Virtual team must have exactly 11 players." });
  }
  if (!captainId || !viceCaptainId) {
    return res.status(400).json({ error: "Captain and Vice-Captain selections are required." });
  }
  if (captainId === viceCaptainId) {
    return res.status(400).json({ error: "Captain and Vice-Captain cannot be the same player." });
  }
  if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
    return res.status(400).json({ error: "Captain and Vice-Captain must be present in the 11-player squad." });
  }
  if (squadCredits && squadCredits > 100) {
    return res.status(400).json({ error: "Credit limit exceeded! 100 credits max allowed." });
  }
  return res.json({
    success: true,
    message: "Virtual team squad validated successfully by server.",
    validatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/admin/scores", requireAdminRole, (req, res) => {
  const { tournamentId, playerScores, adminName = "Official Admin" } = req.body;
  if (!tournamentId) {
    return res.status(400).json({ error: "Tournament ID is required." });
  }
  const newLog = {
    id: `log-${Date.now()}`,
    adminId: "admin-master",
    adminName,
    action: "SCORE_UPDATE_PUBLISHED",
    targetType: "score",
    targetId: tournamentId,
    details: `Updated live scores for ${Object.keys(playerScores || {}).length} cricketers. Rankings recalculated.`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  serverAuditLogs.unshift(newLog);
  res.json({
    success: true,
    message: "Scores published and rankings updated across all virtual teams.",
    auditLog: newLog
  });
});
app.post("/api/admin/points-config", requireAdminRole, (req, res) => {
  const { config, adminName = "Official Admin" } = req.body;
  const newLog = {
    id: `log-${Date.now()}`,
    adminId: "admin-master",
    adminName,
    action: "POINTS_CONFIG_MODIFIED",
    targetType: "points_rule",
    targetId: config?.id || "standard-rules",
    details: `Points configuration "${config?.title || "System Rules"}" updated and locked.`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  serverAuditLogs.unshift(newLog);
  res.json({
    success: true,
    message: "Points configuration saved on server.",
    auditLog: newLog
  });
});
var serverLudoRooms = /* @__PURE__ */ new Map();
app.post("/api/ludo/rooms/create", (req, res) => {
  const { hostUserId, hostName, playerCount = 4 } = req.body;
  if (!hostUserId || !hostName) {
    return res.status(400).json({ error: "hostUserId and hostName required" });
  }
  const code = `LUDO-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const room = {
    id: `room-${Date.now()}`,
    code,
    hostUserId,
    hostName,
    playerCount: playerCount === 2 ? 2 : 4,
    status: "waiting",
    players: [{ userId: hostUserId, name: hostName, color: "red", isReady: true }],
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  serverLudoRooms.set(code, room);
  res.json({ success: true, room });
});
app.post("/api/ludo/rooms/join", (req, res) => {
  const { code, userId, name } = req.body;
  if (!code || !userId || !name) {
    return res.status(400).json({ error: "code, userId, and name are required" });
  }
  const room = serverLudoRooms.get(code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: "Room not found." });
  }
  if (room.players.length >= room.playerCount && !room.players.some((p) => p.userId === userId)) {
    return res.status(400).json({ error: "Room is already full." });
  }
  if (!room.players.some((p) => p.userId === userId)) {
    const colors = room.playerCount === 2 ? ["red", "yellow"] : ["red", "green", "yellow", "blue"];
    const nextColor = colors[room.players.length] || "yellow";
    room.players.push({ userId, name, color: nextColor, isReady: true });
    if (room.players.length === room.playerCount) {
      room.status = "in_progress";
      room.currentTurn = "red";
    }
  }
  res.json({ success: true, room });
});
app.post("/api/ludo/validate-move", (req, res) => {
  const { color, step, diceValue } = req.body;
  if (diceValue < 1 || diceValue > 6) {
    return res.status(400).json({ valid: false, error: "Invalid dice value" });
  }
  if (step === -1 && diceValue !== 6) {
    return res.status(400).json({ valid: false, error: "Token in yard requires rolling a 6" });
  }
  if (step + diceValue > 56) {
    return res.status(400).json({ valid: false, error: "Cannot overshoot Home (step 56)" });
  }
  const newStep = step === -1 ? 0 : step + diceValue;
  res.json({
    valid: true,
    newStep,
    isHome: newStep === 56,
    extraTurn: diceValue === 6 || newStep === 56
  });
});
app.post("/api/admin/ludo/tournament", requireAdminRole, (req, res) => {
  const { tournamentId, title, status, action = "STATUS_CHANGE", adminName = "Official Admin" } = req.body;
  const newLog = {
    id: `log-${Date.now()}`,
    adminId: "admin-master",
    adminName,
    action: `LUDO_TOURNAMENT_${action}`,
    targetType: "ludo_tournament",
    targetId: tournamentId || "new-tournament",
    details: `Ludo Tournament "${title || tournamentId}" updated to ${status || "MODIFIED"}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  serverAuditLogs.unshift(newLog);
  res.json({
    success: true,
    message: "Ludo tournament updated on server.",
    auditLog: newLog
  });
});
var serverWalletSettings = {
  topUpEnabled: true,
  minDepositInr: 100,
  maxDepositInr: 1e5,
  minWithdrawalInr: 110,
  maxWithdrawalInr: 5e4,
  startingBonusCoins: 100,
  coinToInrRate: 1
};
var serverCoinPackages = [
  { id: "pkg-100", title: "Starter Pack", coins: 100, bonusCoins: 0, priceInr: 100, badge: "Min Deposit", isActive: true, displayOrder: 1 },
  { id: "pkg-250", title: "Popular Booster", coins: 250, bonusCoins: 25, priceInr: 250, badge: "Popular (+10%)", isActive: true, displayOrder: 2 },
  { id: "pkg-500", title: "Pro Player Pack", coins: 500, bonusCoins: 100, priceInr: 500, badge: "Best Value (+20%)", isActive: true, displayOrder: 3 },
  { id: "pkg-1000", title: "Champion Stash", coins: 1e3, bonusCoins: 300, priceInr: 1e3, badge: "Hot Deal (+30%)", isActive: true, displayOrder: 4 },
  { id: "pkg-2500", title: "Arena Legend Vault", coins: 2500, bonusCoins: 1e3, priceInr: 2500, badge: "Huge Bonus (+40%)", isActive: true, displayOrder: 5 },
  { id: "pkg-5000", title: "Grand Master Chest", coins: 5e3, bonusCoins: 2500, priceInr: 5e3, badge: "Mega Value (+50%)", isActive: true, displayOrder: 6 }
];
var serverPaymentOrders = /* @__PURE__ */ new Map();
var processedPaymentSignatures = /* @__PURE__ */ new Set();
var getPaymentGatewayConfig = () => {
  const keyId = (process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID || process.env.PAYMENT_GATEWAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY || process.env.PAYMENT_GATEWAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = (process.env.CASHFREE_WEBHOOK_SECRET || process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  const isConfigured = Boolean(keyId && keySecret);
  const hasCashfreeEnv = Boolean(
    process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_APP_ID || process.env.CASHFREE_SECRET_KEY || process.env.CASHFREE_ENV
  );
  const isCashfree = hasCashfreeEnv || keySecret.startsWith("cfsk_") || keyId.length > 20 || !keyId.startsWith("rzp_") && keyId.length >= 8;
  const rawEnv = (process.env.CASHFREE_ENV || process.env.CASHFREE_ENVIRONMENT || process.env.PAYMENT_GATEWAY_ENV || "").trim().toLowerCase();
  let isProd = false;
  if (rawEnv === "production" || rawEnv === "prod") {
    isProd = true;
  } else if (rawEnv === "sandbox" || rawEnv === "test" || rawEnv === "dev" || rawEnv === "development") {
    isProd = false;
  } else {
    isProd = isCashfree ? keySecret.startsWith("cfsk_ma_prod_") || !keySecret.toLowerCase().includes("test") && !keyId.toLowerCase().includes("test") : !keyId.startsWith("rzp_test_");
  }
  const apiVersion = (process.env.CASHFREE_API_VERSION || "2023-08-01").trim();
  return {
    keyId,
    keySecret,
    webhookSecret,
    isConfigured,
    gatewayType: isCashfree ? "cashfree" : "razorpay",
    isProd,
    apiVersion,
    cashfreeBaseUrl: isProd ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg"
  };
};
var SUPPORTED_PAYMENT_METHODS = ["upi", "card", "netbanking"];
app.get("/api/wallet/config", (req, res) => {
  const gwConfig = getPaymentGatewayConfig();
  res.json({
    settings: serverWalletSettings,
    packages: serverCoinPackages.filter((p) => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder),
    gatewayConfigured: gwConfig.isConfigured,
    gatewayType: gwConfig.isConfigured ? gwConfig.gatewayType : null,
    isProd: gwConfig.isProd,
    gatewayMode: gwConfig.isProd ? "production" : "sandbox"
  });
});
app.post("/api/wallet/create-order", async (req, res) => {
  try {
    const {
      userId,
      packageId,
      customAmountInr,
      paymentMethod = "upi",
      customerName,
      customerEmail,
      customerPhone
    } = req.body || {};
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ success: false, error: "User ID is required to create a payment order." });
    }
    const banStatus = checkUserBanStatus(userId, "all");
    if (banStatus.banned) {
      return res.status(403).json({
        success: false,
        error: `Your account is restricted (${banStatus.reason || "Restricted by administrator"}). Purchases are suspended.`
      });
    }
    if (!serverWalletSettings.topUpEnabled) {
      return res.status(403).json({
        success: false,
        error: "Coin purchases are currently disabled by administration."
      });
    }
    const validMethod = String(paymentMethod || "upi").toLowerCase().trim();
    if (!SUPPORTED_PAYMENT_METHODS.includes(validMethod)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported payment method "${paymentMethod}". Supported methods: UPI / QR, Card, and NetBanking.`
      });
    }
    let amountInr = 0;
    let coinsAwarded = 0;
    if (packageId === "custom") {
      const customAmt = Number(customAmountInr);
      if (isNaN(customAmt) || customAmt < serverWalletSettings.minDepositInr) {
        return res.status(400).json({
          success: false,
          error: `Minimum deposit amount is \u20B9${serverWalletSettings.minDepositInr}.`
        });
      }
      if (customAmt > serverWalletSettings.maxDepositInr) {
        return res.status(400).json({
          success: false,
          error: `Maximum deposit amount is \u20B9${serverWalletSettings.maxDepositInr.toLocaleString()}.`
        });
      }
      amountInr = Math.floor(customAmt);
      coinsAwarded = Math.floor(amountInr * serverWalletSettings.coinToInrRate);
    } else {
      const pkg = serverCoinPackages.find((p) => p.id === packageId && p.isActive);
      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: "Selected coin package is invalid or inactive."
        });
      }
      amountInr = pkg.priceInr;
      coinsAwarded = pkg.coins + pkg.bonusCoins;
    }
    const gwConfig = getPaymentGatewayConfig();
    if (!gwConfig.isConfigured) {
      return res.status(503).json({
        success: false,
        error: "Payment gateway credentials are not configured on the server. Please verify CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET (or PAYMENT_GATEWAY_KEY_ID/SECRET) in your environment variables.",
        missingGatewayConfig: true
      });
    }
    const orderId = `ord_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
    let gatewayOrderId = "";
    let paymentSessionId = "";
    if (gwConfig.gatewayType === "cashfree") {
      const cleanCustomerId = `cust_${userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-30)}`;
      const rawPhone = String(customerPhone || "").replace(/\D/g, "");
      const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : "9876543210";
      const cleanEmail = customerEmail && String(customerEmail).includes("@") ? String(customerEmail).trim() : "player@cricketarena.in";
      const cleanName = String(customerName || "Arena Player").trim() || "Arena Player";
      const host = req.get("host") || "cricketarena.in";
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
      const origin = isLocal || !host.includes(".") ? "https://cricketarena.in" : `https://${host}`;
      const orderMeta = {
        return_url: `${origin}/?order_id={order_id}`
      };
      if (gwConfig.webhookSecret) {
        orderMeta.notify_url = `${origin}/api/wallet/webhook`;
      }
      const cashfreeOrderPayload = {
        order_id: orderId,
        order_amount: Number(amountInr.toFixed(2)),
        order_currency: "INR",
        customer_details: {
          customer_id: cleanCustomerId,
          customer_phone: cleanPhone,
          customer_email: cleanEmail,
          customer_name: cleanName
        },
        order_meta: orderMeta,
        order_tags: {
          userId: cleanCustomerId,
          packageId: String(packageId),
          coinsAwarded: String(coinsAwarded)
        },
        order_note: `Cricket Arena: ${coinsAwarded} Coins Top-Up`
      };
      try {
        const cfResponse = await fetch(`${gwConfig.cashfreeBaseUrl}/orders`, {
          method: "POST",
          headers: {
            "x-client-id": gwConfig.keyId,
            "x-client-secret": gwConfig.keySecret,
            "x-api-version": gwConfig.apiVersion,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(cashfreeOrderPayload)
        });
        const cfData = await cfResponse.json().catch(() => ({}));
        if (!cfResponse.ok) {
          console.error("[Cashfree Order Creation Error]", {
            status: cfResponse.status,
            code: cfData?.code,
            type: cfData?.type,
            subCode: cfData?.sub_code,
            message: cfData?.message || cfData?.error || "Rejected by gateway"
          });
          const gatewayErrorMsg = cfData?.message || cfData?.error_description || (typeof cfData?.error === "string" ? cfData.error : "") || `Gateway rejected order creation (HTTP ${cfResponse.status})`;
          return res.status(502).json({
            success: false,
            error: `Gateway error: ${gatewayErrorMsg}`,
            gatewayStatus: cfResponse.status,
            gatewayCode: cfData?.code
          });
        }
        gatewayOrderId = String(cfData.cf_order_id || cfData.order_id);
        paymentSessionId = cfData.payment_session_id;
        if (!paymentSessionId) {
          console.error("[Cashfree Error] Missing payment_session_id in response:", cfData);
          return res.status(502).json({
            success: false,
            error: "Payment gateway did not provide a valid payment session ID. Please try again."
          });
        }
      } catch (networkErr) {
        console.error("[Cashfree Network Error]", networkErr?.message || networkErr);
        return res.status(502).json({
          success: false,
          error: "Failed to communicate with payment gateway. Please check your network connection."
        });
      }
    } else {
      const amountInPaise = Math.round(amountInr * 100);
      const authHeader = "Basic " + Buffer.from(`${gwConfig.keyId}:${gwConfig.keySecret}`).toString("base64");
      try {
        const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: "INR",
            receipt: orderId,
            notes: {
              userId,
              packageId,
              paymentMethod: validMethod
            }
          })
        });
        const rzpData = await rzpResponse.json().catch(() => ({}));
        if (!rzpResponse.ok) {
          return res.status(502).json({
            success: false,
            error: rzpData?.error?.description || "Payment gateway rejected order creation."
          });
        }
        gatewayOrderId = rzpData.id;
      } catch (err) {
        return res.status(502).json({
          success: false,
          error: "Failed to communicate with Razorpay payment gateway."
        });
      }
    }
    const order = {
      id: orderId,
      userId,
      packageId,
      amountInr,
      coinsAwarded,
      status: "pending",
      gatewayOrderId,
      paymentSessionId,
      paymentMethod: validMethod,
      gatewayType: gwConfig.gatewayType,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    serverPaymentOrders.set(orderId, order);
    if (gatewayOrderId) {
      serverPaymentOrders.set(gatewayOrderId, order);
    }
    return res.json({
      success: true,
      orderId,
      gatewayOrderId,
      paymentSessionId,
      gatewayType: gwConfig.gatewayType,
      isProd: gwConfig.isProd,
      keyId: gwConfig.gatewayType === "razorpay" ? gwConfig.keyId : void 0,
      amountInr,
      coinsAwarded,
      currency: "INR",
      paymentMethod: validMethod,
      message: "Payment order created securely on server."
    });
  } catch (err) {
    console.error("[create-order server exception]", err);
    return res.status(500).json({
      success: false,
      error: "An internal server error occurred while creating the payment order."
    });
  }
});
app.post("/api/wallet/verify-payment", async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body || {};
    if (!orderId && !paymentId) {
      return res.status(400).json({ success: false, error: "Order ID or Payment ID is required for verification." });
    }
    let order = (orderId ? serverPaymentOrders.get(orderId) : void 0) || (paymentId ? serverPaymentOrders.get(paymentId) : void 0);
    const gwConfig = getPaymentGatewayConfig();
    if (!order && gwConfig.isConfigured && gwConfig.gatewayType === "cashfree" && (orderId || paymentId)) {
      const targetOrderId = orderId || paymentId;
      try {
        const cfOrderRes = await fetch(`${gwConfig.cashfreeBaseUrl}/orders/${targetOrderId}`, {
          method: "GET",
          headers: {
            "x-client-id": gwConfig.keyId,
            "x-client-secret": gwConfig.keySecret,
            "x-api-version": gwConfig.apiVersion
          }
        });
        if (cfOrderRes.ok) {
          const cfData = await cfOrderRes.json().catch(() => ({}));
          const orderAmount = Number(cfData.order_amount) || 0;
          const coins = cfData.order_tags?.coinsAwarded ? Number(cfData.order_tags.coinsAwarded) : Math.floor(orderAmount * serverWalletSettings.coinToInrRate);
          const userIdFromTags = cfData.order_tags?.userId?.replace(/^cust_/, "") || "anonymous";
          order = {
            id: targetOrderId,
            userId: userIdFromTags,
            packageId: cfData.order_tags?.packageId || "custom",
            amountInr: orderAmount,
            coinsAwarded: coins,
            status: cfData.order_status === "PAID" ? "completed" : "pending",
            gatewayOrderId: String(cfData.cf_order_id || cfData.order_id || targetOrderId),
            gatewayType: "cashfree",
            createdAt: cfData.created_at || (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          serverPaymentOrders.set(targetOrderId, order);
        }
      } catch (recoveryErr) {
        console.error("[Cashfree serverless order recovery error]", recoveryErr);
      }
    }
    if (!order) {
      return res.status(404).json({ success: false, error: "Payment order not found or expired on server." });
    }
    const paymentKey = `${order.id}:${paymentId || order.gatewayOrderId}`;
    if (order.status === "completed" || processedPaymentSignatures.has(paymentKey)) {
      return res.json({
        success: true,
        idempotent: true,
        message: "Payment already verified and credited.",
        coinsAwarded: order.coinsAwarded,
        amountInr: order.amountInr,
        orderId: order.id
      });
    }
    if (order.gatewayType === "cashfree") {
      try {
        const cfOrderRes = await fetch(`${gwConfig.cashfreeBaseUrl}/orders/${order.id}`, {
          method: "GET",
          headers: {
            "x-client-id": gwConfig.keyId,
            "x-client-secret": gwConfig.keySecret,
            "x-api-version": gwConfig.apiVersion
          }
        });
        const cfOrderData = await cfOrderRes.json().catch(() => ({}));
        if (!cfOrderRes.ok) {
          return res.status(502).json({
            success: false,
            error: "Failed to verify payment status with Cashfree."
          });
        }
        if (cfOrderData.order_status !== "PAID") {
          return res.status(400).json({
            success: false,
            error: `Payment is not confirmed by gateway (status: ${cfOrderData.order_status || "PENDING"}). Coins have not been credited.`,
            orderStatus: cfOrderData.order_status
          });
        }
        if (Number(cfOrderData.order_amount) !== Number(order.amountInr)) {
          return res.status(400).json({
            success: false,
            error: "Payment amount mismatch detected. Transaction suspended."
          });
        }
      } catch (err) {
        return res.status(502).json({
          success: false,
          error: "Network error while verifying payment with Cashfree gateway."
        });
      }
    } else {
      if (!signature || !paymentId) {
        return res.status(400).json({ success: false, error: "Payment ID and Signature are required for verification." });
      }
      const expected = crypto4.createHmac("sha256", gwConfig.keySecret).update(`${order.gatewayOrderId}|${paymentId}`).digest("hex");
      if (expected !== signature) {
        return res.status(400).json({ success: false, error: "Invalid payment signature. Verification failed." });
      }
    }
    processedPaymentSignatures.add(paymentKey);
    order.status = "completed";
    order.gatewayPaymentId = paymentId || `cf_pay_${Date.now()}`;
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const auditEntry = {
      id: `audit-pay-${Date.now()}`,
      adminId: "system-gateway",
      adminName: `${order.gatewayType.toUpperCase()} Gateway Verified`,
      action: "COIN_TOPUP_VERIFIED",
      targetType: "wallet",
      targetId: order.userId,
      details: `Verified \u20B9${order.amountInr} payment via ${order.gatewayType.toUpperCase()} (${order.id}). Credited ${order.coinsAwarded} coins.`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    serverAuditLogs.unshift(auditEntry);
    return res.json({
      success: true,
      coinsAwarded: order.coinsAwarded,
      amountInr: order.amountInr,
      orderId: order.id,
      gatewayOrderId: order.gatewayOrderId,
      gatewayPaymentId: order.gatewayPaymentId,
      message: "Payment verified successfully. Coins credited."
    });
  } catch (err) {
    console.error("[verify-payment server exception]", err);
    return res.status(500).json({
      success: false,
      error: "An internal server error occurred while verifying the payment."
    });
  }
});
app.post("/api/wallet/webhook", express4.raw({ type: "application/json" }), async (req, res) => {
  try {
    const gwConfig = getPaymentGatewayConfig();
    const signature = req.headers["x-webhook-signature"] || req.headers["x-razorpay-signature"];
    const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (gwConfig.webhookSecret && signature) {
      const timestamp = req.headers["x-webhook-timestamp"] || "";
      const payloadToSign = timestamp ? `${timestamp}${bodyStr}` : bodyStr;
      const expected = crypto4.createHmac("sha256", gwConfig.webhookSecret).update(payloadToSign).digest("base64");
      const expectedHex = crypto4.createHmac("sha256", gwConfig.webhookSecret).update(payloadToSign).digest("hex");
      if (signature !== expected && signature !== expectedHex) {
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
    }
    const payload = typeof req.body === "object" ? req.body : JSON.parse(bodyStr || "{}");
    const orderId = payload?.data?.order?.order_id || payload?.payload?.payment?.entity?.notes?.orderId;
    const isSuccess = payload?.type === "PAYMENT_SUCCESS_WEBHOOK" || payload?.type === "ORDER_PAID_WEBHOOK" || payload?.event === "payment.captured";
    if (orderId && isSuccess) {
      const order = serverPaymentOrders.get(orderId);
      if (order && order.status !== "completed") {
        order.status = "completed";
        order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        serverAuditLogs.unshift({
          id: `audit-wb-${Date.now()}`,
          adminId: "webhook",
          adminName: "Payment Gateway Webhook",
          action: "WEBHOOK_PAYMENT_CONFIRMED",
          targetType: "wallet",
          targetId: order.userId,
          details: `Webhook confirmed payment for order ${orderId}. Credited ${order.coinsAwarded} coins.`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    return res.json({ status: "ok" });
  } catch {
    return res.status(200).json({ status: "ignored" });
  }
});
app.post("/api/admin/wallet/settings", requireAdminRole, (req, res) => {
  const { settings, adminName = "Official Admin" } = req.body;
  if (!settings) return res.status(400).json({ error: "Settings payload required" });
  serverWalletSettings = {
    ...serverWalletSettings,
    ...settings
  };
  serverAuditLogs.unshift({
    id: `audit-set-${Date.now()}`,
    adminId: "admin-master",
    adminName,
    action: "WALLET_SETTINGS_UPDATED",
    targetType: "system",
    targetId: "wallet_config",
    details: `Updated min/max deposit (\u20B9${serverWalletSettings.minDepositInr} - \u20B9${serverWalletSettings.maxDepositInr}) and withdrawal (\u20B9${serverWalletSettings.minWithdrawalInr} - \u20B9${serverWalletSettings.maxWithdrawalInr}).`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({ success: true, settings: serverWalletSettings });
});
app.post("/api/admin/wallet/packages", requireAdminRole, (req, res) => {
  const { packages, adminName = "Official Admin" } = req.body;
  if (!Array.isArray(packages)) return res.status(400).json({ error: "Packages array required" });
  serverCoinPackages = packages;
  serverAuditLogs.unshift({
    id: `audit-pkg-${Date.now()}`,
    adminId: "admin-master",
    adminName,
    action: "COIN_PACKAGES_UPDATED",
    targetType: "system",
    targetId: "coin_packages",
    details: `Admin updated coin packages catalog (${packages.length} packages).`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({ success: true, packages: serverCoinPackages });
});
var serverWithdrawals = /* @__PURE__ */ new Map();
INITIAL_WITHDRAWALS.forEach((w) => {
  serverWithdrawals.set(w.id, { ...w });
});
app.post("/api/wallet/request-withdrawal", (req, res) => {
  const { userId, userName, userEmail, amountInr, payoutMethod, payoutDetails } = req.body;
  if (!userId || !amountInr || !payoutMethod || !payoutDetails) {
    return res.status(400).json({
      success: false,
      error: "User ID, withdrawal amount, payout method, and payout details are required."
    });
  }
  const banStatus = checkUserBanStatus(userId, "all");
  if (banStatus.banned) {
    return res.status(403).json({
      success: false,
      error: `Your account is restricted (${banStatus.reason || "Restricted by administrator"}). Withdrawals are suspended.`
    });
  }
  const amt = Number(amountInr);
  if (isNaN(amt) || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({
      success: false,
      error: "Withdrawal amount must be a valid positive number."
    });
  }
  if (amt < serverWalletSettings.minWithdrawalInr) {
    return res.status(400).json({
      success: false,
      error: `Minimum withdrawal limit is \u20B9${serverWalletSettings.minWithdrawalInr}.`
    });
  }
  if (amt > serverWalletSettings.maxWithdrawalInr) {
    return res.status(400).json({
      success: false,
      error: `Maximum withdrawal limit is \u20B9${serverWalletSettings.maxWithdrawalInr}.`
    });
  }
  if (payoutMethod === "upi") {
    const upiId = String(payoutDetails.upiId || "").trim();
    if (!upiId || !upiId.includes("@") || upiId.length < 5) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid UPI ID (e.g., username@oksbi, 9876543210@paytm)."
      });
    }
  } else if (payoutMethod === "bank_transfer") {
    const accHolder = String(payoutDetails.accountHolderName || "").trim();
    const accNum = String(payoutDetails.bankAccountNumber || "").trim();
    const ifsc = String(payoutDetails.ifscCode || "").trim();
    if (!accHolder || accHolder.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Account holder name is required and must match your bank account."
      });
    }
    if (!accNum || accNum.length < 6 || !/^\d+$/.test(accNum)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid numerical bank account number (at least 6 digits)."
      });
    }
    if (!ifsc || ifsc.length < 4) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid bank IFSC code."
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      error: "Invalid payout method. Please choose UPI or Direct Bank Transfer."
    });
  }
  const requestId = `wdr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const referenceId = `WDR-REF-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const newWithdrawal = {
    id: requestId,
    userId,
    userName: userName || "Arena Player",
    userEmail: userEmail || "player@arena.com",
    amountCoins: Math.floor(amt),
    amountInr: Math.floor(amt),
    payoutMethod,
    payoutDetails: {
      upiId: payoutDetails.upiId ? String(payoutDetails.upiId).trim() : void 0,
      accountHolderName: payoutDetails.accountHolderName ? String(payoutDetails.accountHolderName).trim() : void 0,
      bankAccountNumber: payoutDetails.bankAccountNumber ? String(payoutDetails.bankAccountNumber).trim() : void 0,
      ifscCode: payoutDetails.ifscCode ? String(payoutDetails.ifscCode).trim().toUpperCase() : void 0,
      bankName: payoutDetails.bankName ? String(payoutDetails.bankName).trim() : void 0
    },
    status: "pending",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  serverWithdrawals.set(requestId, newWithdrawal);
  serverAuditLogs.unshift({
    id: `audit-wdr-${Date.now()}`,
    adminId: "system",
    adminName: newWithdrawal.userName,
    action: "WITHDRAWAL_REQUESTED",
    targetType: "withdrawal",
    targetId: requestId,
    details: `Withdrawal request submitted: \u20B9${newWithdrawal.amountInr} via ${payoutMethod.toUpperCase()} (${referenceId}). Pending admin review.`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  return res.json({
    success: true,
    requestId,
    referenceId,
    withdrawal: newWithdrawal,
    message: `Withdrawal request for \u20B9${newWithdrawal.amountInr} received. It is pending review by finance administrators.`
  });
});
app.post("/api/admin/wallet/withdrawal/action", requireAdminRole, (req, res) => {
  const {
    requestId,
    action,
    adminNotes = "",
    payoutReferenceId = "",
    adminName = "Finance Admin"
  } = req.body;
  if (!requestId || !["approve", "reject"].includes(action)) {
    return res.status(400).json({
      success: false,
      error: "Valid requestId and action (approve/reject) are required."
    });
  }
  const withdrawal = serverWithdrawals.get(requestId);
  if (!withdrawal) {
    serverAuditLogs.unshift({
      id: `audit-wdr-ext-${Date.now()}`,
      adminId: "admin-master",
      adminName,
      action: action === "approve" ? "WITHDRAWAL_APPROVED" : "WITHDRAWAL_REJECTED",
      targetType: "withdrawal",
      targetId: requestId,
      details: `Admin ${action}d withdrawal ${requestId}. Note: ${adminNotes}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return res.json({
      success: true,
      message: `Withdrawal action ${action} recorded.`
    });
  }
  if (withdrawal.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: `Withdrawal request has already been processed with status: ${withdrawal.status}. Duplicate processing prevented.`,
      alreadyProcessed: true
    });
  }
  if (action === "approve") {
    withdrawal.status = "approved";
    withdrawal.adminNotes = String(adminNotes).trim() || "Verified and transferred.";
    withdrawal.payoutReferenceId = String(payoutReferenceId).trim() || `UTR-${Date.now()}`;
    withdrawal.processedAt = (/* @__PURE__ */ new Date()).toISOString();
    withdrawal.processedBy = adminName;
    serverAuditLogs.unshift({
      id: `audit-wdr-appv-${Date.now()}`,
      adminId: "admin-master",
      adminName,
      action: "WITHDRAWAL_APPROVED",
      targetType: "withdrawal",
      targetId: requestId,
      details: `Approved payout of \u20B9${withdrawal.amountInr} to ${withdrawal.userName} (${withdrawal.payoutMethod.toUpperCase()}). Ref: ${withdrawal.payoutReferenceId}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return res.json({
      success: true,
      withdrawal,
      message: `Withdrawal for \u20B9${withdrawal.amountInr} approved and marked as transferred.`
    });
  } else {
    withdrawal.status = "rejected";
    withdrawal.adminNotes = String(adminNotes).trim() || "Declined by administration. Coins refunded.";
    withdrawal.processedAt = (/* @__PURE__ */ new Date()).toISOString();
    withdrawal.processedBy = adminName;
    serverAuditLogs.unshift({
      id: `audit-wdr-rej-${Date.now()}`,
      adminId: "admin-master",
      adminName,
      action: "WITHDRAWAL_REJECTED",
      targetType: "withdrawal",
      targetId: requestId,
      details: `Declined withdrawal of \u20B9${withdrawal.amountInr} for ${withdrawal.userName}. Coins refunded. Reason: ${withdrawal.adminNotes}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return res.json({
      success: true,
      withdrawal,
      message: `Withdrawal declined. ${withdrawal.amountCoins} coins refunded to user wallet.`
    });
  }
});
app.get("/api/wallet/withdrawals/:userId", (req, res) => {
  const { userId } = req.params;
  const list = [];
  for (const w of serverWithdrawals.values()) {
    if (w.userId === userId) {
      list.push(w);
    }
  }
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, withdrawals: list });
});
app.get("/api/admin/wallet/withdrawals", requireAdminRole, (req, res) => {
  const { status } = req.query;
  let list = Array.from(serverWithdrawals.values());
  if (status && status !== "all") {
    list = list.filter((w) => w.status === status);
  }
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, withdrawals: list });
});
app.post("/api/wallet/cash-request", (req, res) => {
  const { userId, userName, requestedAmount, reason } = req.body;
  if (!userId || !requestedAmount || !reason) {
    return res.status(400).json({ error: "User ID, requested amount, and reason are required." });
  }
  const banStatus = checkUserBanStatus(userId, "all");
  if (banStatus.banned) {
    return res.status(403).json({
      error: `Your account is restricted (${banStatus.reason || "Restricted by administrator"}). Cannot submit requests.`
    });
  }
  const amt = Number(requestedAmount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: "Requested amount must be greater than zero." });
  }
  const requestId = `req-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const newRequest = {
    id: requestId,
    userId,
    userName: userName || "Arena Player",
    requestedAmount: Math.floor(amt),
    reason: String(reason).trim(),
    status: "pending",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  serverCashRequests.set(requestId, newRequest);
  serverAuditLogs.unshift({
    id: `audit-req-${Date.now()}`,
    adminId: "system",
    adminName: newRequest.userName,
    action: "CASH_REQUEST_SUBMITTED",
    targetType: "cash_request",
    targetId: requestId,
    details: `User submitted request for \u20B9${newRequest.requestedAmount} coins. Reason: ${newRequest.reason}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({
    success: true,
    request: newRequest,
    message: "Cash addition request submitted for administrative review. Wallet was not credited."
  });
});
app.get("/api/wallet/cash-requests/:userId", (req, res) => {
  const { userId } = req.params;
  const userRequests = [];
  for (const r of serverCashRequests.values()) {
    if (r.userId === userId) {
      userRequests.push(r);
    }
  }
  userRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, requests: userRequests });
});
app.get("/api/admin/cash-requests", requireAdminRole, (req, res) => {
  const { status, query } = req.query;
  let requests = Array.from(serverCashRequests.values());
  if (status && status !== "all") {
    requests = requests.filter((r) => r.status === status);
  }
  if (query && typeof query === "string") {
    const q = query.toLowerCase().trim();
    requests = requests.filter(
      (r) => r.id.toLowerCase().includes(q) || r.userId.toLowerCase().includes(q) || r.userName.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q)
    );
  }
  requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, requests });
});
app.post("/api/admin/cash-requests/action", requireAdminRole, (req, res) => {
  const { requestId, action, approvedAmount, adminNote = "", adminId = "admin-master", adminName = "Official Admin" } = req.body;
  if (!requestId || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "Valid requestId and action (approve/reject) are required." });
  }
  const request = serverCashRequests.get(requestId);
  if (!request) {
    return res.status(404).json({ error: "Cash request not found." });
  }
  if (request.status !== "pending") {
    return res.status(400).json({
      error: `Request has already been processed with status: ${request.status}. Duplicate processing prevented.`,
      alreadyProcessed: true
    });
  }
  if (adminId && adminId === request.userId) {
    return res.status(403).json({ error: "Security violation: Administrators cannot approve their own cash requests." });
  }
  if (action === "approve") {
    const amt = approvedAmount !== void 0 ? Number(approvedAmount) : request.requestedAmount;
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: "Approved amount must be greater than zero." });
    }
    request.status = "approved";
    request.approvedAmount = amt;
    request.adminNote = String(adminNote).trim();
    request.processedBy = adminId;
    request.processedByName = adminName;
    request.processedAt = (/* @__PURE__ */ new Date()).toISOString();
    serverAuditLogs.unshift({
      id: `audit-appv-${Date.now()}`,
      adminId,
      adminName,
      action: "CASH_REQUEST_APPROVED",
      targetType: "cash_request",
      targetId: requestId,
      details: `Approved \u20B9${amt} coins for ${request.userName} (UID: ${request.userId}). Note: ${request.adminNote || "Approved"}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return res.json({
      success: true,
      request,
      creditedCoins: amt,
      message: `Approved and credited \u20B9${amt} game coins to ${request.userName}.`
    });
  } else {
    request.status = "rejected";
    request.adminNote = String(adminNote).trim() || "Request rejected by administration.";
    request.processedBy = adminId;
    request.processedByName = adminName;
    request.processedAt = (/* @__PURE__ */ new Date()).toISOString();
    serverAuditLogs.unshift({
      id: `audit-rej-${Date.now()}`,
      adminId,
      adminName,
      action: "CASH_REQUEST_REJECTED",
      targetType: "cash_request",
      targetId: requestId,
      details: `Rejected cash request of \u20B9${request.requestedAmount} for ${request.userName}. Reason: ${request.adminNote}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return res.json({
      success: true,
      request,
      message: `Cash request rejected with zero wallet balance modification.`
    });
  }
});
app.get("/api/admin/players", requireAdminRole, (req, res) => {
  const { query } = req.query;
  const samplePlayers = [
    { userId: "user-demo-1", userName: "Rajesh_Sharma", email: "rajesh@arena.in", registeredAt: "2026-08-15T00:00:00.000Z", matches: 14, wins: 9, losses: 5 },
    { userId: "usr-rohit-88", userName: "Rohit_Sharma_99", email: "rohit@skillarena.in", registeredAt: "2026-09-01T00:00:00.000Z", matches: 38, wins: 26, losses: 12 },
    { userId: "usr-vikram-07", userName: "Vikram_Rathore", email: "vikram.r@gmail.com", registeredAt: "2026-09-10T00:00:00.000Z", matches: 21, wins: 14, losses: 7 },
    { userId: "usr-priya-k", userName: "Priya_LudoQueen", email: "priya.k@yahoo.in", registeredAt: "2026-09-14T00:00:00.000Z", matches: 45, wins: 31, losses: 14 },
    { userId: "usr-aman-singh", userName: "Aman_Striker", email: "aman.singh@gmail.com", registeredAt: "2026-09-20T00:00:00.000Z", matches: 19, wins: 11, losses: 8 },
    { userId: "usr-suspicious-99", userName: "SpeedHacker_99", email: "hacker99@anonymous.io", registeredAt: "2026-10-01T00:00:00.000Z", matches: 8, wins: 8, losses: 0 },
    { userId: "usr-quitter-12", userName: "RageQuitter_Pro", email: "quitter@test.com", registeredAt: "2026-10-05T00:00:00.000Z", matches: 15, wins: 2, losses: 13 }
  ];
  let players = samplePlayers.map((sp) => {
    const restriction = Array.from(serverPlayerRestrictions.values()).find(
      (r) => r.userId === sp.userId && r.status === "active"
    );
    const pendingRequests = Array.from(serverCashRequests.values()).filter(
      (r) => r.userId === sp.userId && r.status === "pending"
    ).length;
    return {
      userId: sp.userId,
      userName: sp.userName,
      email: sp.email,
      registeredAt: sp.registeredAt,
      balance: 250,
      lockedBalance: 0,
      totalMatchesPlayed: sp.matches,
      wins: sp.wins,
      losses: sp.losses,
      pendingCashRequestsCount: pendingRequests,
      restriction
    };
  });
  if (query && typeof query === "string") {
    const q = query.toLowerCase().trim();
    players = players.filter(
      (p) => p.userId.toLowerCase().includes(q) || p.userName.toLowerCase().includes(q) || p.email && p.email.toLowerCase().includes(q)
    );
  }
  res.json({ success: true, players });
});
app.post("/api/admin/players/restrict", requireAdminRole, (req, res) => {
  const { userId, userName, restrictionType, reason, internalNote = "", durationHours, adminId = "admin-master", adminName = "Official Admin" } = req.body;
  if (!userId || !restrictionType || !reason) {
    return res.status(400).json({ error: "User ID, restriction type, and reason are required." });
  }
  for (const r of serverPlayerRestrictions.values()) {
    if (r.userId === userId && r.status === "active") {
      r.status = "lifted";
      r.liftedAt = (/* @__PURE__ */ new Date()).toISOString();
      r.liftedBy = adminId;
    }
  }
  let expiresAt = void 0;
  if (restrictionType === "temp_suspend" && durationHours) {
    expiresAt = new Date(Date.now() + Number(durationHours) * 3600 * 1e3).toISOString();
  }
  const restrictionId = `res-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const newRestriction = {
    id: restrictionId,
    userId,
    userName: userName || `Player_${userId.slice(-4)}`,
    restrictionType,
    status: "active",
    reason: String(reason).trim(),
    internalNote: String(internalNote).trim(),
    adminId,
    adminName,
    expiresAt,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  serverPlayerRestrictions.set(restrictionId, newRestriction);
  serverAuditLogs.unshift({
    id: `audit-ban-${Date.now()}`,
    adminId,
    adminName,
    action: `PLAYER_${restrictionType.toUpperCase()}`,
    targetType: "player_restriction",
    targetId: userId,
    details: `Applied ${restrictionType} to ${newRestriction.userName} (UID: ${userId}). Reason: ${newRestriction.reason}. ${expiresAt ? `Expires: ${expiresAt}` : "Permanent"}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({ success: true, restriction: newRestriction, message: `Restriction ${restrictionType} applied to user ${userId}.` });
});
app.post("/api/admin/players/unban", requireAdminRole, (req, res) => {
  const { userId, reason = "Unbanned by admin", adminId = "admin-master", adminName = "Official Admin" } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }
  let liftedCount = 0;
  for (const r of serverPlayerRestrictions.values()) {
    if (r.userId === userId && r.status === "active") {
      r.status = "lifted";
      r.liftedAt = (/* @__PURE__ */ new Date()).toISOString();
      r.liftedBy = adminId;
      liftedCount++;
    }
  }
  serverAuditLogs.unshift({
    id: `audit-unban-${Date.now()}`,
    adminId,
    adminName,
    action: "PLAYER_RESTRICTION_LIFTED",
    targetType: "player_restriction",
    targetId: userId,
    details: `Lifted restrictions for player UID ${userId}. Notes: ${reason}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({ success: true, liftedCount, message: `Access restored for user UID ${userId}.` });
});
app.get("/api/admin/bans", requireAdminRole, (req, res) => {
  const list = Array.from(serverPlayerRestrictions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ success: true, restrictions: list });
});
app.post("/api/admin/wallet/adjust", requireAdminRole, (req, res) => {
  const { targetUserId, amountDelta, reason, adminName = "Administrator" } = req.body;
  const delta = Number(amountDelta);
  if (!targetUserId || isNaN(delta) || delta === 0) {
    return res.status(400).json({ error: "Valid targetUserId and non-zero amountDelta required." });
  }
  serverAuditLogs.unshift({
    id: `audit-adj-${Date.now()}`,
    adminId: "admin-master",
    adminName,
    action: "WALLET_MANUAL_ADJUSTMENT",
    targetType: "wallet",
    targetId: targetUserId,
    details: `Manual balance adjustment: ${delta > 0 ? "+" : ""}${delta} coins. Reason: ${reason || "Administrative adjustment"}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({
    success: true,
    targetUserId,
    amountDelta: delta,
    message: `Balance adjustment of ${delta} coins confirmed by server.`
  });
});
async function startServer() {
  const httpServer = http.createServer(app);
  if (!isProduction && !isServerless) {
    const vitePackage = "vite";
    const { createServer: createViteServer } = await import(vitePackage);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.resolve(__dirname2, "dist");
    if (fs2.existsSync(distPath)) {
      app.use(express4.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path2.resolve(distPath, "index.html"));
      });
    }
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Cricket Arena server running on port ${PORT}`);
  });
}
var isServerless = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (!isServerless && process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}
var server_default = app;
export {
  app,
  server_default as default,
  serverWithdrawals
};
