const express = require('express');
const http = require("http");
const cors = require('cors');
const { Server } = require("socket.io");
require('dotenv').config();
const Redis = require('redis');

const redisClient = Redis.createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

redisClient.connect().catch(console.error);

if (!redisClient.isOpen) {
  redisClient.connect().catch(console.error);
};

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3040", "https://my-social-network-umber.vercel.app"],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {

  socket.on('online', async (user) => {
    socket.join(user.id);
    io.sockets.emit("connected", user.id);
    let user1 = await redisClient.get(`account-${user.id}`);

    if (user1) {
      await redisClient.del(`account-${user.id}`);
      await redisClient.SET(`account-${user.id}`, JSON.stringify({ online: true }));
    }

    socket.on("disconnect", async () => {
      socket.leave(user.id);
      io.sockets.emit('disconnected', user.id);
      let user2 = await redisClient.get(`account-${user.id}`);

      if (user2) {
        await redisClient.del(`account-${user.id}`);
        await redisClient.SET(`account-${user.id}`, JSON.stringify({ online: false }));
      }
    });

  });

  socket.on("notification", async (data) => {
    io.sockets.to(data.receiver).emit("notification", data);
  });

  socket.on("join_room", (data) => {
    socket.join(data);
  });

  socket.on("typing", (data) => {
    socket.in(data.room).emit("typing")
  });
  socket.on("stop typing", (data) => {
    socket.in(data.room).emit("stop typing")
  });

  socket.on("send_message", (data) => {
    socket.to(data.receiver).emit(`receiver`, data);
    socket.to(data.room).emit("receive_message", data);
  });

});

server.listen(4040, () => {
  console.log("SERVER RUNNING");
});