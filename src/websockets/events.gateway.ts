import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Server, Socket } from 'socket.io';

interface ChatMessage {
  author: string;
  text: string;
  date: Date;
}

interface IdentityMessage {
  username: string;
}
type SocketClient = {
  username: string;
  socket?: Socket;
};

@WebSocketGateway({ transports: ['polling'] })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  clients: SocketClient[] = [];

  private logger: Logger = new Logger('AppGateway');

  @SubscribeMessage('events')
  findAll(@MessageBody() data: any): Observable<WsResponse<number>> {
    console.log('EVENTS');
    return from([1, 2, 3, 4, 5]).pipe(
      map(item => ({ event: 'events', data: item })),
    );
  }

  @SubscribeMessage('identify')
  async identify(
    @MessageBody() data: IdentityMessage,
    @ConnectedSocket() socket: Socket,
  ): Promise<IdentityMessage> {
    console.log('User identified : ', data.username);
    this.clients.push({ username: data.username, socket });
    return { username: data.username };
  }

  @SubscribeMessage('message')
  async message(@MessageBody() data: ChatMessage): Promise<ChatMessage> {
    console.log('Message received : ', data);
    //broadcast the message to all the clients
    this.clients
      .filter(client => data.author !== client.username)
      .forEach(function(client) {
        client.socket?.emit('message', data);
      });
    return {
      author: 'Server',
      text: `Merci pour ton "${data.text}", ${data.author}.`,
      date: new Date(),
    };
  }

  afterInit(server: Server) {
    this.logger.log('Init');
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
    this.clients = this.clients.filter(
      client => client.socket.id !== socket.id,
    );
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }
}
