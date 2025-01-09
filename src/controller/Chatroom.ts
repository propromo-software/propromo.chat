import { type WSContext, Redis, v5 } from "../../deps.ts";
import { CHAT_STORAGE_URL, CHAT_STORAGE_TOKEN } from "../environment.ts";

const { generate } = v5;

const redis = new Redis({
    url: CHAT_STORAGE_URL,
    token: CHAT_STORAGE_TOKEN,
})

export class ChatRoom {
    constructor(monitor_id: string) {
        this.monitor_id = monitor_id;
        this.clients = new Set<WSContext>();
        this.messagesKey = `chatroom:${monitor_id}:messages`;
    }

    monitor_id: string;
    clients: Set<WSContext>;
    messagesKey: string;

    async createMessage(email: string, message: string) {
        const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
        const messageBytes = new TextEncoder().encode(message);
        const messageId = await generate(NAMESPACE, messageBytes);
        const messageData = {
            email,
            timestamp: new Date().toISOString(),
            text: message,
        };

        return {
            messageId: messageId.toString(),
            ...messageData
        }
    }

    async persistMessage(
        messageId: string,
        messageData: {
            email: string;
            timestamp: string;
            text: string;
        }) {
        
        await redis.set(`${this.messagesKey}:${messageId}`, JSON.stringify(messageData));
    }

    async loadMessages(): Promise<{ id: string; email: string; timestamp: string; text: string }[]> {
        const keys = await redis.keys(`${this.messagesKey}:*`);
        const messages: { id: string; email: string; timestamp: string; text: string }[] = [];

        for (const key of keys) {
            const messageJson = await redis.get(key);
            const messageId = key.split(':').pop() || '';

            if (messageJson) {
                const messageData = JSON.parse(JSON.stringify(messageJson));
                messages.push({ id: messageId, ...messageData });
            }
        }
        return messages;
    }

    broadcast(data: string, _sender?: { email: string | undefined, ws: WSContext }): void {
        for (const client of this.clients) {
            if (/* client !== sender?.ws &&  */typeof client?.send === 'function') { // send to all websockets, so that the client has the id and timestamp of his message for editing of the message for example
                client.send(data);
            }
        }
    }

    async onMessage(event: MessageEvent, sender?: { email: string | undefined, ws: WSContext }): Promise<void> {
        const message = event.data;

        const messageWithoutSpaces = message.replace(/\s+/g, '');
        if (messageWithoutSpaces === 'propromo.chat({event:"ping",action:"pong"})') {
            sender?.ws?.send("pong");
            return;
        } else if (messageWithoutSpaces === 'propromo.chat({event:"pong",action:"ping"})') {
            sender?.ws?.send("ping");
            return;
        }

        const messageData = await this.createMessage(sender?.email ?? 'unknown@unknown.tld', message);
        const broadcastMessage = JSON.stringify(messageData);
        this.broadcast(broadcastMessage/* , sender */);

        /* PERSIST */
        await this.persistMessage(
            messageData.messageId,
            {
                email: messageData.email,
                timestamp: messageData.timestamp,
                text: messageData.text
            }
        );
    }

    async onOpen(ws: WSContext): Promise<void> {
        this.clients.add(ws);
        console.log(`Connection opened for chat room ${this.monitor_id}`);

        /* PERSIST */
        const messages = await this.loadMessages();
        for (const message of messages) {
            ws.send(JSON.stringify(message));
        }
    }

    onClose(): void {
        console.log(`Connection closed for chat room ${this.monitor_id}`);
    }

    onError(): void {
        console.log(`Connection errored for chat room ${this.monitor_id}`);
    }
}
