import { WSContext } from "https://deno.land/x/hono@v4.2.5/helper/websocket/index.ts";

export class ChatRoom {
    constructor(monitor_id: string) {
        this.monitor_id = monitor_id;
        this.clients = new Set<WSContext>();
    }

    monitor_id: string;
    clients: Set<WSContext>;

    broadcast(data: string): void {
        for (const client of this.clients) {
            client.send(data);
        }
    }

    onMessage(event: MessageEvent): void {
        const message = `${event.data} in ${this.monitor_id}`;
        this.broadcast(message);
    }

    onOpen(ws: WSContext): void {
        this.clients.add(ws);
        console.log(`Connection opened for chat room ${this.monitor_id}`);
    }

    onClose(): void {
        console.log(`Connection closed for chat room ${this.monitor_id}`);
    }

    onError(): void {
        console.log(`Connection errored for chat room ${this.monitor_id}`);
    }
}
