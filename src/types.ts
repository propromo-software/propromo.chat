export type ChatInfo = {
    monitor_hash: string;
    organization_name: string;
    type: string;
    title: string;
    short_description: string;
    public: boolean;
    created_at: Date;
    updated_at: Date;
    project_url: string;
}

export type JWT_PAYLOAD = {
    chats: ChatInfo[];
    email: string;
    exp: number;
    nbf: number;
    iat: number;
    iss: string;
};
