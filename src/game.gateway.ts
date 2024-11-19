import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000', // Permitir sólo el origen del frontend
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class GameGateway {
  @WebSocketServer()
  server: Server;

  private rooms: Record<
    string,
    { participants: Record<string, string>; votes: Record<string, string>; chat: Array<{ user: string; message: string }> }
  > = {};

  // Unirse a una sala
  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() data: { roomId: string; user: string }) {
    const { roomId, user } = data;
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = { participants: {}, chat: [], votes: {} };
    }
    this.rooms[roomId].participants[user] = 'not-voted';
    this.server.to(roomId).emit('updateParticipants', this.rooms[roomId]);
    this.server.socketsJoin(roomId);
    console.log(`User ${user} joined room ${roomId}`);
  
    // Enviar el historial del chat a todos los usuarios actuales de la sala
    this.server.to(roomId).emit('updateChat', this.rooms[roomId].chat);
    return { success: true };
  }

  // Enviar un voto
  @SubscribeMessage('sendVote')
  handleSendVote(@MessageBody() data: { roomId: string; user: string; vote: string }) {
    const { roomId, user, vote } = data;
    if (this.rooms[roomId]) {
      this.rooms[roomId].votes[user] = vote;
      this.rooms[roomId].participants[user] = 'voted';
      this.server.to(roomId).emit('updateParticipants', this.rooms[roomId]);
      this.server.to(roomId).emit('updateVotes', this.rooms[roomId].votes);
      console.log(`User ${user} voted ${vote} in room ${roomId}`);
    }
    return { success: true };
  }

  // Resetear votos
  @SubscribeMessage('resetVotes')
  handleResetVotes(@MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    if (this.rooms[roomId]) {
      this.rooms[roomId].votes = {};
      for (const user in this.rooms[roomId].participants) {
        this.rooms[roomId].participants[user] = 'not-voted';
      }
      this.server.to(roomId).emit('updateParticipants', this.rooms[roomId]);
      this.server.to(roomId).emit('updateVotes', {});
      console.log(`Votes reset in room ${roomId}`);
    }
    return { success: true };
  }

  // Revelar votos
  @SubscribeMessage('revealVotes')
  handleRevealVotes(@MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    if (this.rooms[roomId]) {
      const votes = this.rooms[roomId].votes;  // Obtener los votos actuales
      this.server.to(roomId).emit('votesRevealed', { votes });
      console.log(`Votes revealed in room ${roomId}`, votes);
    }
  }

  // Enviar mensaje al chat
  @SubscribeMessage('sendMessage')
  handleSendMessage(@MessageBody() data: { roomId: string; user: string; message: string }) {
    const { roomId, user, message } = data;
    if (this.rooms[roomId]) {
      const chatMessage = { user, message };
      this.rooms[roomId].chat.push(chatMessage);
      this.server.to(roomId).emit('updateChat', [chatMessage]);
      console.log(`User ${user} sent message: ${message} in room ${roomId}`);
    }
  }

}