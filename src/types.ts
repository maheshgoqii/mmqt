/**
 * GOQii MQTT Event Types
 * Definitions based on FriendChatDetailActivityNew.kt implementation
 */

export type MQTTEventCase =
    | 'chatv2'          // Standard friend chat
    | 'clanchat'        // Group/Clan chat
    | 'clipshare'       // Content sharing
    | 'add_reaction'    // Adding an emoji reaction
    | 'remove_reaction' // Removing an emoji reaction
    | 'update_edit'     // Message edited
    | 'update_delete'   // Message deleted
    | 'presence';       // User online/offline status

export interface BaseMQTTMessage {
    case: MQTTEventCase;
    id?: string | number;
    topic: string;
    senderId?: string;
}

export interface ChatMessagePayload extends BaseMQTTMessage {
    case: 'chatv2' | 'clanchat' | 'clipshare';
    message: string;
    senderName?: string;
    receiverId?: string;
    image?: string;
    type: 'txt' | 'img' | 'clipshare';
    referenceMessage?: any;
    isDelivered?: boolean;
    isFromServer?: boolean;
}

export interface ReactionPayload extends BaseMQTTMessage {
    case: 'add_reaction' | 'remove_reaction';
    messageId: string;
    reactionId: number;
    userName: string;
    senderId: string;
}

export interface MessageUpdatePayload extends BaseMQTTMessage {
    case: 'update_edit' | 'update_delete';
    messageId: number | string;
    newMessage?: string;
    action?: string;
    actionIdentifier?: string;
}

export type GOQIIMQTTEvent =
    | { type: 'message', data: ChatMessagePayload }
    | { type: 'reaction', data: ReactionPayload }
    | { type: 'update', data: MessageUpdatePayload }
    | { type: 'raw', data: any };
