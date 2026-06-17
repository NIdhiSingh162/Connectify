import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import Whiteboard from "../components/Whiteboard";

const socket = io("http://localhost:5000");

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());

  const [peers, setPeers] = useState([]);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [meetingTime, setMeetingTime] = useState(0);

  useEffect(() => {
    let currentStream;

    const timer = setInterval(() => {
      setMeetingTime((prev) => prev + 1);
    }, 1000);

    const startMedia = async () => {
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        localStreamRef.current = currentStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = currentStream;
        }

        socket.removeAllListeners();

        socket.emit("join-room", {
          roomId,
          userName: user?.name || "Guest",
        });

        socket.on("all-users", (users) => {
          users.forEach((userId) => {
            if (peersRef.current.has(userId)) return;

            const peer = createPeer(userId, socket.id, currentStream);
            peersRef.current.set(userId, peer);
            setPeers(Array.from(peersRef.current.entries()));
          });
        });

        socket.on("user-signal", ({ signal, callerId }) => {
          if (peersRef.current.has(callerId)) return;

          const peer = addPeer(callerId, currentStream);
          peersRef.current.set(callerId, peer);
          peer.signal(signal);
          setPeers(Array.from(peersRef.current.entries()));
        });

        socket.on("receiving-returned-signal", ({ signal, id }) => {
          const peer = peersRef.current.get(id);
          if (peer) peer.signal(signal);
        });

        socket.on("receive-message", (data) => {
          setChat((prev) => [...prev, data]);
        });

        socket.on("participants-updated", (list) => {
          setParticipants(list);
        });

        socket.on("meeting-notification", (data) => {
          setNotifications((prev) => [...prev, data]);
        });

        socket.on("user-left", (userId) => {
          const peer = peersRef.current.get(userId);
          if (peer) {
            peer.destroy();
            peersRef.current.delete(userId);
            setPeers(Array.from(peersRef.current.entries()));
          }
        });
      } catch (error) {
        console.log("MEDIA ERROR =>", error);
        alert(error.message);
      }
    };

    startMedia();

    return () => {
      clearInterval(timer);
      socket.emit("leave-room", roomId);
      socket.removeAllListeners();

      peersRef.current.forEach((peer) => peer.destroy());
      peersRef.current.clear();

      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId]);

  function createPeer(userToSignal, callerId, stream) {
    const peer = new Peer({ initiator: true, trickle: false, stream });

    peer.on("signal", (signal) => {
      socket.emit("send-signal", { userToSignal, callerId, signal });
    });

    return peer;
  }

  function addPeer(callerId, stream) {
    const peer = new Peer({ initiator: false, trickle: false, stream });

    peer.on("signal", (signal) => {
      socket.emit("return-signal", { signal, callerId });
    });

    return peer;
  }

  const formatTime = (seconds) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Room code copy nahi ho paya");
    }
  };

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];

      peersRef.current.forEach((peer) => {
        const sender = peer._pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");

        if (sender) sender.replaceTrack(screenTrack);
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      screenTrack.onended = () => {
        peersRef.current.forEach((peer) => {
          const sender = peer._pc
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");

          if (sender && oldVideoTrack) sender.replaceTrack(oldVideoTrack);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      };
    } catch (error) {
      console.log("SCREEN SHARE ERROR =>", error);
    }
  };

  const leaveMeeting = () => {
    socket.emit("leave-room", roomId);
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peersRef.current.forEach((peer) => peer.destroy());
    peersRef.current.clear();
    navigate("/dashboard");
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("send-message", {
      roomId,
      message,
      sender: user?.name || "Guest",
    });

    setMessage("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Connectify</h1>
            <p className="text-slate-400 text-sm">
              Real-time video conferencing & collaboration
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 border border-white/10 px-4 py-2 rounded-2xl">
              <p className="text-xs text-slate-400">Duration</p>
              <p className="font-bold text-lg text-cyan-300">
                {formatTime(meetingTime)}
              </p>
            </div>

            <div className="bg-white/10 border border-white/10 px-4 py-2 rounded-2xl">
              <p className="text-xs text-slate-400">Room Code</p>
              <p className="font-bold text-lg">{roomId}</p>
            </div>

            <button
              onClick={copyRoomCode}
              className="px-5 py-3 rounded-2xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
            >
              Copy Code
            </button>

            {copied && (
              <span className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Copied!
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/10 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Your Video</h2>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full">
                  Live
                </span>
              </div>

              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-80 bg-black rounded-2xl object-cover border border-white/10"
              />

              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  onClick={toggleMic}
                  className={`px-5 py-3 rounded-2xl font-bold transition ${
                    micOn
                      ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      : "bg-rose-500 text-white hover:bg-rose-400"
                  }`}
                >
                  {micOn ? "🎤 Mic On" : "🔇 Mic Off"}
                </button>

                <button
                  onClick={toggleCamera}
                  className={`px-5 py-3 rounded-2xl font-bold transition ${
                    cameraOn
                      ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      : "bg-rose-500 text-white hover:bg-rose-400"
                  }`}
                >
                  {cameraOn ? "📷 Camera On" : "🚫 Camera Off"}
                </button>

                <button
                  onClick={shareScreen}
                  className="px-5 py-3 rounded-2xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition"
                >
                  🖥️ Share
                </button>

                <button
                  onClick={leaveMeeting}
                  className="px-5 py-3 rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-500 transition"
                >
                  Leave
                </button>
              </div>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur">
              <h2 className="text-xl font-bold mb-4">Remote Videos</h2>

              {peers.length === 0 ? (
                <div className="w-full h-80 bg-slate-950 rounded-2xl flex items-center justify-center text-slate-400 border border-white/10">
                  Waiting for another user...
                </div>
              ) : (
                peers.map(([peerId, peer]) => (
                  <RemoteVideo key={peerId} peer={peer} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
            <Whiteboard roomId={roomId} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white/10 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur">
            <h2 className="text-xl font-bold mb-4">
              Participants ({participants.length})
            </h2>

            {participants.length === 0 ? (
              <p className="text-slate-400">No participants yet</p>
            ) : (
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div
                    key={participant.socketId}
                    className="flex items-center gap-3 bg-white/10 border border-white/10 p-3 rounded-2xl"
                  >
                    <div className="w-9 h-9 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-bold">
                      {participant.name?.charAt(0)?.toUpperCase() || "G"}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {participant.name}

                        {participant.isHost && (
                          <span className="ml-2 text-xs bg-yellow-400 text-slate-950 px-2 py-1 rounded-full">
                            Host
                          </span>
                        )}

                        {participant.socketId === socket.id && (
                          <span className="ml-2 text-xs bg-cyan-400 text-slate-950 px-2 py-1 rounded-full">
                            You
                          </span>
                        )}
                      </p>

                      <p className="text-xs text-emerald-300">Online</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/10 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur">
            <h2 className="text-xl font-bold mb-4">Notifications</h2>

            {notifications.length === 0 ? (
              <p className="text-slate-400">No notifications yet</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {notifications.map((item, index) => (
                  <div
                    key={index}
                    className="bg-amber-400/10 border border-amber-300/20 p-3 rounded-2xl"
                  >
                    <p className="font-medium text-amber-200">
                      🔔 {item.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{item.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/10 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur">
            <h2 className="text-xl font-bold mb-4">Live Chat</h2>

            <div className="h-72 overflow-y-auto mb-4 space-y-3 pr-1">
              {chat.length === 0 ? (
                <p className="text-slate-400">No messages yet</p>
              ) : (
                chat.map((msg, index) => (
                  <div
                    key={index}
                    className="bg-white/10 border border-white/10 p-3 rounded-2xl"
                  >
                    <div className="flex justify-between gap-2">
                      <b className="text-cyan-300">{msg.sender}</b>
                      <span className="text-xs text-slate-400">{msg.time}</span>
                    </div>
                    <p className="mt-1 text-slate-100">{msg.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                className="bg-white/10 border border-white/10 p-3 rounded-2xl w-full outline-none focus:border-cyan-400"
              />

              <button
                onClick={sendMessage}
                className="bg-cyan-500 text-slate-950 px-5 rounded-2xl font-bold hover:bg-cyan-400 transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoteVideo({ peer }) {
  const ref = useRef(null);

  useEffect(() => {
    peer.on("stream", (stream) => {
      if (ref.current) ref.current.srcObject = stream;
    });

    return () => {
      peer.removeAllListeners("stream");
    };
  }, [peer]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="w-full h-80 bg-black rounded-2xl mb-4 object-cover border border-white/10"
    />
  );
}

export default Room;