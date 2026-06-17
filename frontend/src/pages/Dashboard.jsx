import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));

  const createRoom = () => {
    const newRoom = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    navigate(`/room/${newRoom}`);
  };

  const joinRoom = () => {
    if (!roomCode.trim()) {
      alert("Please enter room code");
      return;
    }

    navigate(`/room/${roomCode.toUpperCase()}`);
  };

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white/10 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-cyan-300 mb-3">
            Connectify
          </h1>

          <p className="text-slate-400">
            Real-time video conferencing & collaboration
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-center">
          <h2 className="text-2xl text-white font-semibold">
            Welcome, {user?.name} 👋
          </h2>

          <p className="text-slate-400 mt-2">
            Start a meeting or join an existing room
          </p>
        </div>

        <button
          onClick={createRoom}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-2xl transition mb-5"
        >
          🚀 Create New Meeting
        </button>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white placeholder-slate-400 outline-none focus:border-cyan-400"
          />
        </div>

        <button
          onClick={joinRoom}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-4 rounded-2xl transition"
        >
          🎥 Join Meeting
        </button>

        <div className="border-t border-white/10 mt-8 pt-6">
          <button
            onClick={logout}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 rounded-2xl transition"
          >
            🚪 Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;