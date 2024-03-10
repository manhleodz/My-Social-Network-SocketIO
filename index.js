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
    socket.emit("connected");
    console.log(user.username + " connected");


    socket.on("disconnect", () => {
      socket.leave(user.id);
      console.log(user.username + " USER DISCONNECTED");
      io.sockets.emit('joined');
    });

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
    socket.to(data.receiver).emit(`receiver`);
    socket.to(data.room).emit("receive_message", data);
  });

});

server.listen(4040, () => {
  console.log("SERVER RUNNING");
});