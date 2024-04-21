import type { WSContext } from "./deps.ts";

export class ChatRoom {
    constructor(monitor_id: string) {
        this.monitor_id = monitor_id;
        this.clients = new Set<WSContext>();
    }

    monitor_id: string;
    clients: Set<WSContext>;

    broadcast(data: string, sender?: WSContext): void {
        for (const client of this.clients) {
            if (client !== sender) {
                client.send(data);
            }
        }
    }

    onMessage(event: MessageEvent, sender?: WSContext): void {
        const message = event.data;
        this.broadcast(message, sender);
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
