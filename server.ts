import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
    maxHttpBufferSize: 1e8, // 100MB for video/image data
  });

  const PORT = 3000;

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("broadcast-start", (data) => {
      console.log("Broadcast started by:", socket.id);
      socket.broadcast.emit("broadcast-started", { id: socket.id, ...data });
    });

    socket.on("broadcast-stream", (data) => {
      // data contains { video: base64, audio: base64, image: base64 }
      socket.broadcast.emit("broadcast-received", { id: socket.id, ...data });
    });

    socket.on("broadcast-stop", () => {
      console.log("Broadcast stopped by:", socket.id);
      socket.broadcast.emit("broadcast-stopped", { id: socket.id });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      socket.broadcast.emit("broadcast-stopped", { id: socket.id });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
