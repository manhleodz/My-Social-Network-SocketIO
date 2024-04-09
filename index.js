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
    origin: '*',
    methods: ["GET", "POST"],
    credentials: true
  },
});

app.get('/', (req, res) => {
  res.json("Hello, world!");
})

io.on("connection", (socket) => {

  socket.on('online', async (user) => {
    console.log(user.nickname + " is online");
    socket.join(user.id);
    socket.id = user.id;
    socket.username = user.nickname;
    socket.smallAvatar = user.smallAvatar;
    socket.nickname = user.nickname;

    io.sockets.emit("connected", user.id);
    let user1 = await redisClient.get(`account-${user.id}`);

    if (user1) {
      await redisClient.SET(`account-${user.id}`, JSON.stringify({ online: true }));
    }

    socket.on("disconnect", async () => {
      console.log(user.nickname + " is offline");
      socket.leave(user.id);
      io.sockets.emit('disconnected', user.id);
      let user2 = await redisClient.get(`account-${user.id}`);

      if (user2) {
        await redisClient.SET(`account-${user.id}`, JSON.stringify({ online: false }));
      }
    });
  });

  socket.on("notification", async (data) => {
    io.sockets.to(data.receiver).emit("notification", data);
  });

  socket.on("join_room", (data1) => {
    const { room } = data1;
    socket.leave(room);
    socket.join(room);

    console.log(socket.nickname + " joined " + room);
    // when the client emits 'new message', this listens and executes
    socket.on('send_group_message', (data) => {
      console.log(socket.nickname + " sent message in " + room);
      socket.broadcast.emit('receive_group_message', {
        username: socket.username,
        message: data
      });
    });

    // when the client emits 'add user', this listens and executes
    socket.on('add user', (username) => {
      if (addedUser) return;

      // we store the username in the socket session for this client
      socket.username = username;
      addedUser = true;
      // echo globally (all clients) that a person has connected
      socket.broadcast.emit('user joined', {
        username: socket.username,
      });
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', () => {
      socket.broadcast.emit('typing', {
        username: socket.username
      });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', () => {
      socket.broadcast.emit('stop typing', {
        username: socket.username
      });
    });

    // when the user disconnects.. perform this
    socket.on('leave_room', (data) => {
      socket.leave(data.room);
      console.log(socket.nickname + " left " + data.room);
      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
      });
    });
  });

  socket.on("join_conversation", (data) => {
    const { room, userId } = data;
    socket.join(room);

    socket.on("typing", (data) => {
      socket.in(data.room).emit("typing")
    });

    socket.on("stop typing", (data) => {
      socket.in(data.room).emit("stop typing")
    });

    socket.off("join_conversation", () => {
      console.log(userId + " leave_conversation " + room);
      socket.leave(data.room)
    });
  });

  socket.on("send_message", async (data) => {

    if (data.receiver !== undefined) {
      console.log(data.sender + " send message " + data.receiver + " in room " + data.room);
      socket.to(data.receiver).emit("receive_message", data);
    } else if (data.ChannelId !== undefined) {

      const options = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }

      try {
        let listUserId;

        await fetch(`${process.env.API_SERVER}/inbox/group/listUserId/${data.ChannelId}`, options)
          .then(response => response.json())
          .then(response => {
            listUserId = response.data;
          }).catch(err => {
            console.log(err);
          })

        listUserId = listUserId.map(user => user.UserId);
        console.log(data.sender + " send message" + " in room group-" + data.ChannelId);
        socket.to(listUserId).emit("receive_message", data);
      } catch (err) {
        console.log(err.message);
      }
    }
  });

  socket.on("delete_message", async (data) => {
    if (data.receiver !== undefined) {
      io.sockets.to(data.receiver).emit("delete_message_receiver", data);
    } else if (data.ChannelId !== undefined) {

      const options = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
      let listUserId;

      await fetch(`${process.env.API_SERVER}/inbox/group/listUserId/${data.ChannelId}`, options)
        .then(response => response.json())
        .then(res => {
          listUserId = res.data;
        }).catch(err => {
          console.log(err);
        })

      listUserId = listUserId.map(user => user.UserId);
      console.log("delete message in room group-" + data.ChannelId);
      io.sockets.to(listUserId).emit("delete_message_receiver", data);
    }
  });
});

server.listen(4040, () => {
  console.log("SERVER RUNNING");
});