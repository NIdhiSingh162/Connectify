import { useRef, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function Whiteboard({ roomId }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";

    socket.emit("join-whiteboard", roomId);

    socket.off("whiteboard-draw");
    socket.off("whiteboard-clear");

    socket.on("whiteboard-draw", (data) => {
      drawLine(data.x1, data.y1, data.x2, data.y2, false);
    });

    socket.on("whiteboard-clear", () => {
      clearCanvasOnly();
    });

    return () => {
      socket.off("whiteboard-draw");
      socket.off("whiteboard-clear");
    };
  }, [roomId]);

  const drawLine = (x1, y1, x2, y2, emit = true) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (emit) {
      socket.emit("whiteboard-draw", {
        roomId,
        data: { x1, y1, x2, y2 },
      });
    }
  };

  const startDrawing = (e) => {
    isDrawing.current = true;
    lastPoint.current = {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
    };
  };

  const draw = (e) => {
    if (!isDrawing.current) return;

    const currentPoint = {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
    };

    drawLine(
      lastPoint.current.x,
      lastPoint.current.y,
      currentPoint.x,
      currentPoint.y,
      true
    );

    lastPoint.current = currentPoint;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvasOnly = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const clearBoard = () => {
    clearCanvasOnly();
    socket.emit("whiteboard-clear", roomId);
  };

  return (
    <div className="bg-white/10 border border-white/10 rounded-3xl p-6 backdrop-blur">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white">Whiteboard</h2>
        </div>

        <button
          onClick={clearBoard}
          className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-2xl font-semibold transition"
        >
          Clear Board
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={400}
        className="w-full bg-white rounded-2xl border-4 border-slate-700 shadow-inner cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
    </div>
  );
}

export default Whiteboard;