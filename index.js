const express = require('express');
const http = require("http");
const cors = require('cors');
const { Server } = require("socket.io");
require('dotenv').config();

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
  console.log(`User Connected: ${socket.id}, ${socket}`);

  socket.on("join_room", (data) => {
    socket.join(data);
    console.log(`User with ID: ${socket.id} joined room: ${JSON.stringify(data)}`);
  });

  socket.on("send_message", (data) => {
    socket.to(data.room).emit("receive_message", data);
    console.log(data);
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });
});

server.listen(4040, () => {
  console.log("SERVER RUNNING");
});