const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();
require("./db");

const authRoutes = require("./routes/authRoutes");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://10.52.129.168:5173",
  "http://10.52.129.168:5174",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Connectify Backend Running");
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

const roomParticipants = new Map();

const getParticipants = (roomId) => {
  const room = roomParticipants.get(roomId);
  if (!room) return [];

  return Array.from(room.entries()).map(([socketId, user]) => ({
    socketId,
    name: user.name,
    isHost: user.isHost,
  }));
};

const getCurrentTime = () => {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName || "Guest";

    let isHost = false;

    if (!roomParticipants.has(roomId)) {
      roomParticipants.set(roomId, new Map());
      isHost = true;
    }

    socket.isHost = isHost;

    roomParticipants.get(roomId).set(socket.id, {
      name: socket.userName,
      isHost,
    });

    const usersInRoom = Array.from(
      io.sockets.adapter.rooms.get(roomId) || []
    ).filter((id) => id !== socket.id);

    socket.emit("all-users", usersInRoom);
    socket.to(roomId).emit("user-joined", socket.id);

    io.to(roomId).emit("participants-updated", getParticipants(roomId));

    socket.to(roomId).emit("meeting-notification", {
      message: `${socket.userName} joined the meeting`,
      time: getCurrentTime(),
    });

    console.log(
      `${socket.id} joined room ${roomId} as ${isHost ? "Host" : "Participant"}`
    );
  });

  socket.on("send-signal", ({ userToSignal, signal, callerId }) => {
    io.to(userToSignal).emit("user-signal", { signal, callerId });
  });

  socket.on("return-signal", ({ signal, callerId }) => {
    io.to(callerId).emit("receiving-returned-signal", {
      signal,
      id: socket.id,
    });
  });

  socket.on("send-message", ({ roomId, message, sender }) => {
    io.to(roomId).emit("receive-message", {
      sender,
      message,
      time: getCurrentTime(),
    });
  });

  socket.on("join-whiteboard", (roomId) => {
    socket.join(`whiteboard-${roomId}`);
  });

  socket.on("whiteboard-draw", ({ roomId, data }) => {
    socket.to(`whiteboard-${roomId}`).emit("whiteboard-draw", data);
  });

  socket.on("whiteboard-clear", (roomId) => {
    socket.to(`whiteboard-${roomId}`).emit("whiteboard-clear");
  });

  socket.on("leave-room", (roomId) => {
    const userName = socket.userName || "Guest";

    if (roomParticipants.has(roomId)) {
      roomParticipants.get(roomId).delete(socket.id);

      if (roomParticipants.get(roomId).size === 0) {
        roomParticipants.delete(roomId);
      } else {
        const participants = getParticipants(roomId);

        const hasHost = participants.some((user) => user.isHost);

        if (!hasHost && participants.length > 0) {
          const room = roomParticipants.get(roomId);
          const firstUserId = participants[0].socketId;
          const firstUser = room.get(firstUserId);

          room.set(firstUserId, {
            ...firstUser,
            isHost: true,
          });
        }
      }

      io.to(roomId).emit("participants-updated", getParticipants(roomId));
      socket.to(roomId).emit("user-left", socket.id);

      socket.to(roomId).emit("meeting-notification", {
        message: `${userName} left the meeting`,
        time: getCurrentTime(),
      });
    }

    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    const userName = socket.userName || "Guest";

    if (roomId && roomParticipants.has(roomId)) {
      roomParticipants.get(roomId).delete(socket.id);

      if (roomParticipants.get(roomId).size === 0) {
        roomParticipants.delete(roomId);
      } else {
        const participants = getParticipants(roomId);
        const hasHost = participants.some((user) => user.isHost);

        if (!hasHost && participants.length > 0) {
          const room = roomParticipants.get(roomId);
          const firstUserId = participants[0].socketId;
          const firstUser = room.get(firstUserId);

          room.set(firstUserId, {
            ...firstUser,
            isHost: true,
          });
        }
      }

      io.to(roomId).emit("participants-updated", getParticipants(roomId));
      socket.to(roomId).emit("user-left", socket.id);

      socket.to(roomId).emit("meeting-notification", {
        message: `${userName} left the meeting`,
        time: getCurrentTime(),
      });
    }

    console.log("User Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});