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

interface ChatClient {
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
    @MessageBody() username: string,
    @ConnectedSocket() socket: Socket,
  ): Promise<IdentityMessage> {
    console.log('User identified : ', username);

    // Register Client in clients list
    this.clients.push({ username: username, socket });

    const currentDate = new Date();
    this.broadcastMessage(
      {
        author: 'Server',
        text: `User "${username}" has arrived.`,
        date: currentDate,
      },
      [username],
    );

    return { username, date: currentDate } as IdentityMessage;
  }

  findClientBySocketId(socketId: string) {
    const currentClient = this.clients.find(
      (client: SocketClient) => client.socket.id === socketId,
    );
    if (!!currentClient) {
      return currentClient;
    } else {
      throw new Error(`Client not found for socker ID: ${socketId}`);
    }
  }

  @SubscribeMessage('list-clients')
  async listClients(
    @MessageBody() filter: string,
    @ConnectedSocket() socket,
  ): Promise<ChatClient[]> {
    console.log(
      `Client ${socket.id} asked for clients list with filter=${filter}`,
    );

    return this.clients.map((client: SocketClient) => {
      return { username: client.username };
    });
  }

  @SubscribeMessage('message')
  async message(@MessageBody() data: ChatMessage): Promise<void> {
    console.log('Message received : ', data);

    // Broadcast the message to all the clients except the sender
    this.broadcastMessage(data, [data.author]);
  }

  // Sends a broadcast message to all clients
  // To exclude clients, add their usernames to excludeClients
  private broadcastMessage(data: ChatMessage, excludeClients: string[] = []) {
    this.clients
      .filter(client => !this.isExcludedClient(excludeClients, client))
      .forEach(function(client) {
        client.socket?.emit('message', data);
      });
  }

  private isExcludedClient(excludeClients: string[], client: SocketClient) {
    return excludeClients.some(
      (excludedClientUsername: string) =>
        excludedClientUsername === client.username,
    );
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
