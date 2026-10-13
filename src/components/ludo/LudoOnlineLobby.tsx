import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Plus,
  Play,
  Key,
  Info,
  Clock,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { LudoRoom } from '../../types';
import { LudoDataStore } from '../../lib/ludoStorage';
import { useAuth } from '../../context/AuthContext';

interface LudoOnlineLobbyProps {
  onStartOfflineMatch: () => void;
}

export const LudoOnlineLobby: React.FC<LudoOnlineLobbyProps> = ({ onStartOfflineMatch }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<LudoRoom[]>(() => LudoDataStore.getRooms());
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [activeRoom, setActiveRoom] = useState<LudoRoom | null>(null);

  const handleCreateRoom = (count: 2 | 4) => {
    if (!user) {
      setStatusMsg({ text: 'Please log in to host an online room.', error: true });
      return;
    }
    const newRoom = LudoDataStore.createRoom(user.id, user.name, count);
    setRooms(LudoDataStore.getRooms());
    setActiveRoom(newRoom);
    setStatusMsg({ text: `Room ${newRoom.code} created! Share this code with friends.` });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setStatusMsg({ text: 'Please log in to join a room.', error: true });
      return;
    }
    const res = LudoDataStore.joinRoom(roomCodeInput, user.id, user.name);
    if (res.success && res.room) {
      setActiveRoom(res.room);
      setRooms(LudoDataStore.getRooms());
      setStatusMsg({ text: `Joined Room ${res.room.code} successfully!` });
      setRoomCodeInput('');
    } else {
      setStatusMsg({ text: res.error || 'Failed to join room.', error: true });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Top Banner */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40">
            ONLINE PREPARATION
          </span>
          <span className="text-xs text-slate-400 font-medium">Room Codes &amp; Lobbies</span>
        </div>
        <h2 className="text-base font-bold text-white">Online Multiplayer Lobby</h2>
        <p className="text-xs text-slate-300 mt-1">
          Create a private table with a room code, invite friends to join the lobby, or test local Pass &amp; Play offline.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs ${
            statusMsg.error
              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Active Room View (if in room) */}
      {activeRoom ? (
        <div className="bg-[#0f172a] rounded-2xl border border-blue-500/40 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <p className="text-[11px] text-slate-400">Private Match Lobby</p>
              <h3 className="text-lg font-black text-white font-mono flex items-center gap-2">
                <span>{activeRoom.code}</span>
                <button
                  onClick={() => handleCopyCode(activeRoom.code)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Copy Room Code"
                >
                  {copiedCode === activeRoom.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </h3>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold">
              {activeRoom.players.length} / {activeRoom.playerCount} Players
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {activeRoom.players.map((p, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full bg-${p.color === 'yellow' ? 'amber-400' : p.color === 'green' ? 'emerald-500' : p.color === 'red' ? 'rose-500' : 'blue-500'}`} />
                  <span className="font-bold text-white">{p.name}</span>
                  {p.userId === activeRoom.hostUserId && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded">Host</span>
                  )}
                </div>
                <span className="text-emerald-400 font-semibold text-[11px]">Ready ✓</span>
              </div>
            ))}
          </div>

          <div className="pt-2 flex gap-2">
            <button
              onClick={() => setActiveRoom(null)}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Leave Room
            </button>
            <button
              onClick={onStartOfflineMatch}
              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
            >
              Start Local Match
            </button>
          </div>
        </div>
      ) : (
        /* Create & Join Controls */
        <div className="space-y-3">
          {/* Create Room Box */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" />
              Create A Private Online Table
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleCreateRoom(2)}
                className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition"
              >
                <span className="text-xs font-bold text-white block">2-Player Room</span>
                <span className="text-[10px] text-slate-400">Head to head 1v1</span>
              </button>
              <button
                onClick={() => handleCreateRoom(4)}
                className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition"
              >
                <span className="text-xs font-bold text-white block">4-Player Room</span>
                <span className="text-[10px] text-slate-400">Full 4-way battle</span>
              </button>
            </div>
          </div>

          {/* Join with Code */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-400" />
              Join Table with Room Code
            </h3>
            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. LUDO-7021"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs px-4 py-2 rounded-xl transition"
              >
                Join
              </button>
            </form>
          </div>

          {/* Active Waiting Rooms List */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              Open Tables ({rooms.length})
            </h3>
            {rooms.map((room) => (
              <div
                key={room.id}
                className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-emerald-400">{room.code}</span>
                  <p className="text-[11px] text-slate-400">Host: {room.hostName} • {room.playerCount}P</p>
                </div>
                <button
                  onClick={() => {
                    setRoomCodeInput(room.code);
                    handleJoinRoom({ preventDefault: () => {} } as any);
                  }}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold"
                >
                  Enter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clarification banner */}
      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p>
          <strong>Notice:</strong> Local Pass &amp; Play matches run 100% offline on this device. Online rooms provide room code lobbies and membership management.
        </p>
      </div>
    </div>
  );
};
