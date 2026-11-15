import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory room store: roomId -> roomState
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Create Room
  socket.on('create_room', ({ roomId, password, config }, callback) => {
    const cleanRoomId = (roomId || `GAME-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase().trim();

    if (rooms.has(cleanRoomId)) {
      if (callback) callback({ success: false, error: 'Room ID already exists. Please choose a different code.' });
      return;
    }

    const roomState = {
      roomId: cleanRoomId,
      password: password || '',
      p1SocketId: socket.id,
      p2SocketId: null,
      status: 'setup',
      config: config || {},
      models: [],
      p1Drafted: [],
      p2Drafted: [],
      currentRound: 1,
    };

    rooms.set(cleanRoomId, roomState);
    socket.join(cleanRoomId);
    socket.roomId = cleanRoomId;
    socket.role = 'player1';

    console.log(`[Room Created] ${cleanRoomId} by P1 (${socket.id})`);
    if (callback) callback({ success: true, roomId: cleanRoomId, role: 'player1', roomState });
  });

  // Join Room
  socket.on('join_room', ({ roomId, password }, callback) => {
    const cleanRoomId = (roomId || '').toUpperCase().trim();
    const roomState = rooms.get(cleanRoomId);

    if (!roomState) {
      if (callback) callback({ success: false, error: 'Room not found. Check your Room Code.' });
      return;
    }

    if (roomState.password && roomState.password !== password) {
      if (callback) callback({ success: false, error: 'Incorrect Password.' });
      return;
    }

    socket.join(cleanRoomId);
    socket.roomId = cleanRoomId;

    let role = 'spectator';
    if (!roomState.p2SocketId && roomState.p1SocketId !== socket.id) {
      roomState.p2SocketId = socket.id;
      role = 'player2';
    }
    socket.role = role;

    console.log(`[Room Joined] ${cleanRoomId} by ${role} (${socket.id})`);

    // Notify host that player 2 has joined
    io.to(cleanRoomId).emit('player_joined', { role, socketId: socket.id, roomState });

    if (callback) callback({ success: true, roomId: cleanRoomId, role, roomState });
  });

  // Setup Config Update
  socket.on('update_setup', (config) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (room) {
      room.config = { ...room.config, ...config };
      socket.to(socket.roomId).emit('setup_updated', room.config);
    }
  });

  // Start Draft / Start Battle
  socket.on('start_draft', (data) => {
    if (!socket.roomId) return;
    io.to(socket.roomId).emit('draft_started', data);
  });

  socket.on('draft_step_action', (data) => {
    if (!socket.roomId) return;
    io.to(socket.roomId).emit('draft_step_synced', data);
  });

  socket.on('start_battle', (data) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (room) {
      room.status = 'battle';
      room.models = data.models || [];
    }
    io.to(socket.roomId).emit('battle_started', data);
  });

  // Real-Time Board Actions
  socket.on('model_move_confirm', (data) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit('model_moved_remote', data);
  });

  socket.on('model_update', (data) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit('model_updated_remote', data);
  });

  socket.on('ability_execute', (data) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit('ability_executed_remote', data);
  });

  socket.on('dice_roll', (data) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit('dice_rolled_remote', data);
  });

  socket.on('next_round', (data) => {
    if (!socket.roomId) return;
    io.to(socket.roomId).emit('next_round_remote', data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ${socket.id}`);
    if (socket.roomId) {
      io.to(socket.roomId).emit('player_left', { socketId: socket.id, role: socket.role });
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 HOOLM War Table Server listening on http://localhost:${PORT}`);
});
