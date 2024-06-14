import { type WSContext, parseURL, connect, v5 } from "../../deps.ts";
import { CHAT_STORAGE_URL } from "../environment.ts";

const { generate } = v5;
const redisOptions = parseURL(CHAT_STORAGE_URL as string);
const redis = await connect(redisOptions);

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
        const NAMESPACE_URL = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
        // The UUID RFC pre-defines four namespaces: https://www.rfc-editor.org/rfc/rfc4122
        // NameSpace_DNS: {6ba7b810-9dad-11d1-80b4-00c04fd430c8}
        // NameSpace_URL: {6ba7b811-9dad-11d1-80b4-00c04fd430c8}
        // NameSpace_OID: {6ba7b812-9dad-11d1-80b4-00c04fd430c8}
        // NameSpace_X500:{6ba7b814-9dad-11d1-80b4-00c04fd430c8}

        const messageBytes = new TextEncoder().encode(message);
        const messageId = await generate(NAMESPACE_URL, messageBytes);
        const messageData = {
            email,
            timestamp: new Date().toISOString(),
            text: message,
        };

        return {
            messageId,
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

        await redis.hset(this.messagesKey, messageId, JSON.stringify(messageData));
    }

    async loadMessages(): Promise<{ id: string; email: string; timestamp: string; text: string }[]> {
        const messageIds = await redis.hkeys(this.messagesKey);
        const messages: { id: string; email: string; timestamp: string; text: string }[] = [];

        for (const messageId of messageIds) {
            const messageJson = await redis.hget(this.messagesKey, messageId);

            if (messageJson) {
                const messageData = JSON.parse(messageJson);
                messages.push(messageData);
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
