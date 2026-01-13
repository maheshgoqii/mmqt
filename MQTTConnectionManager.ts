import { useMQTT } from './useMQTT';
import {
    GOQIIMQTTEvent,
    ChatMessagePayload,
    ReactionPayload,
    MessageUpdatePayload
} from './src/types';
import * as MQTT from './src/index';

export interface MQTTDynamicConfig {
    // Dynamic values - fetch these from your API/storage
    brokerUrl: string;      // From API: LambdaEndPoint.getLamdaUrls()
    userId: string;         // From ProfileData.getUserId()
    authId: string;         // From CommonMethods.getPreferences()
    authPassword: string;   // From CommonMethods.getPreferences()
    deviceId?: string;      // Optional device identifier
}

export interface MQTTTopicConfig {
    friendChatPattern: (userId: string, friendId: string) => string;
    groupChatPattern: (clanId: string) => string;
}

/**
 * Parse broker URL to extract host, port, and protocol
 */
export const parseBrokerUrl = (brokerUrl: string): {
    host: string;
    port: number;
    protocol: 'tcp' | 'ssl' | 'ws' | 'wss';
} => {
    try {
        // Handle different URL formats
        // Examples: 
        // - tcp://broker.example.com:1883
        // - ssl://broker.example.com:8883
        // - ws://broker.example.com:8080
        // - wss://broker.example.com:8443

        let url = brokerUrl.trim();

        // Check if URL has protocol prefix
        const protocolMatch = url.match(/^(tcp|ssl|ws|wss):\/\//);
        const protocol = protocolMatch ? protocolMatch[1] as 'tcp' | 'ssl' | 'ws' | 'wss' : 'tcp';

        // Remove protocol if present
        url = url.replace(/^(tcp|ssl|ws|wss):\/\//, '');

        // Split host and port
        const parts = url.split(':');
        const host = parts[0];
        const port = parts[1] ? parseInt(parts[1], 10) : (protocol === 'ssl' ? 8883 : 1883);

        return { host, port, protocol };
    } catch (error) {
        console.error('Error parsing broker URL:', error);
        throw new Error(`Invalid broker URL: ${brokerUrl}`);
    }
};

/**
 * Create MQTT configuration from dynamic values
 */
export const createMQTTConfig = (config: MQTTDynamicConfig) => {
    const { host, port, protocol } = parseBrokerUrl(config.brokerUrl);

    // Create client ID (can append device ID if needed)
    const clientId = config.deviceId
        ? `${config.userId}_${config.deviceId}`
        : config.userId;

    return {
        clientId,
        host,
        port,
        protocol,
        username: config.authId,
        password: config.authPassword,
        keepAlive: 60,
        cleanSession: true,
        reconnect: true,
        reconnectPeriod: 1000,
        connectTimeout: 30,
    };
};

/**
 * Topic Pattern Helpers
 */
export const MQTTTopics = {
    /**
     * Friend chat topic pattern
     * @param userId - Current user ID
     * @param friendId - Friend user ID
     * @returns Topic string like "123456_789012"
     */
    friendChat: (userId: string, friendId: string): string => {
        // GOQii Logic: Sort IDs to ensure consistent topic name for both users
        const id1 = parseInt(userId, 10);
        const id2 = parseInt(friendId, 10);

        if (isNaN(id1) || isNaN(id2)) {
            return `${userId}_${friendId}`; // Fallback for non-numeric IDs
        }

        return id1 < id2 ? `${userId}_${friendId}` : `${friendId}_${userId}`;
    },

    /**
     * Group chat topic pattern
     * @param clanId - Clan/Group ID
     * @returns Topic string like "clan/123/#" for subscription
     */
    groupChat: (clanId: string): string => {
        return `clan/${clanId}/#`;
    },

    /**
     * Group chat publish topic
     * @param clanId - Clan/Group ID
     * @param subTopic - Subtopic (e.g., 'messages', 'notifications')
     * @returns Topic string like "clan/123/messages"
     */
    groupChatPublish: (clanId: string, subTopic: string = 'messages'): string => {
        return `clan/${clanId}/${subTopic}`;
    },

    /**
     * User-specific notification topic
     * @param userId - User ID
     * @returns Topic string like "notifications/123456"
     */
    userNotifications: (userId: string): string => {
        return `notifications/${userId}`;
    },

    /**
     * Presence topic
     * @param userId - User ID
     * @returns Topic string like "presence/123456"
     */
    userPresence: (userId: string): string => {
        return `presence/${userId}`;
    },
};

/**
 * MQTT Connection Manager Class
 * Provides a higher-level API for managing MQTT connections
 */
export class MQTTConnectionManager {
    private config: MQTTDynamicConfig | null = null;
    public mqtt: any = null;
    private isInitialized = false;
    private eventSubscriptions: any[] = [];

    // Callbacks for structured events
    public onMessage?: (payload: ChatMessagePayload) => void;
    public onReaction?: (payload: ReactionPayload) => void;
    public onUpdate?: (payload: MessageUpdatePayload) => void;
    public onRawEvent?: (payload: any) => void;

    constructor(private mqttHook: ReturnType<typeof useMQTT>) {
        this.mqtt = mqttHook;
        this.setupEventDispatcher();
    }

    /**
     * Internal dispatcher that translates raw MQTT messages 
     * into structured GOQii events
     */
    private setupEventDispatcher() {
        // Clear previous subscriptions if any
        this.eventSubscriptions.forEach(sub => sub.remove());

        const messageSub = MQTT.addListener('onMessageReceived', (data) => {
            try {
                console.warn("data on onMessageReceive=>", data)
                const payload = JSON.parse(data.message);

                // Route based on the "case" field from production logic
                switch (payload.case) {
                    case 'chatv2':
                    case 'clanchat':
                    case 'clipshare':
                        this.onMessage?.(payload as ChatMessagePayload);
                        break;

                    case 'add_reaction':
                    case 'remove_reaction':
                        this.onReaction?.(payload as ReactionPayload);
                        break;

                    case 'update_edit':
                    case 'update_delete':
                        this.onUpdate?.(payload as MessageUpdatePayload);
                        break;

                    default:
                        this.onRawEvent?.(payload);
                }
            } catch (error) {
                // If not JSON, it's a simple raw message
                this.onRawEvent?.({
                    message: data.message,
                    topic: data.topic,
                    error: 'Unparsed'
                });
            }
        });

        this.eventSubscriptions = [messageSub];
    }

    /**
     * Initialize and connect to MQTT broker
     */
    async connect(config: MQTTDynamicConfig): Promise<void> {
        this.config = config;

        try {
            console.log('[MQTTManager] Connecting with config:', {
                brokerUrl: config.brokerUrl,
                userId: config.userId,
                hasAuth: !!config.authId,
            });

            // Create MQTT configuration
            const mqttConfig = createMQTTConfig(config);

            console.log('[MQTTManager] Parsed config:', mqttConfig);

            // Initialize MQTT client
            await this.mqtt.initialize(mqttConfig);

            // Connect to broker
            await this.mqtt.connect();

            this.isInitialized = true;
            console.log('[MQTTManager] Connected successfully');
        } catch (error) {
            console.error('[MQTTManager] Connection failed:', error);
            throw error;
        }
    }

    /**
     * Disconnect from MQTT broker
     */
    async disconnect(): Promise<void> {
        try {
            await this.mqtt.disconnect();
            this.isInitialized = false;
            console.log('[MQTTManager] Disconnected');
        } catch (error) {
            console.error('[MQTTManager] Disconnect failed:', error);
            throw error;
        }
    }

    /**
     * Subscribe to friend chat
     */
    async subscribeFriendChat(friendId: string): Promise<void> {
        if (!this.config?.userId) {
            throw new Error('Not connected. Call connect() first.');
        }

        const topic = MQTTTopics.friendChat(this.config.userId, friendId);
        await this.mqtt.subscribe(topic, { qos: 1 });
        console.log('[MQTTManager] Subscribed to friend chat:', topic);
    }

    /**
     * Subscribe to group chat
     */
    async subscribeGroupChat(clanId: string): Promise<void> {
        const topic = MQTTTopics.groupChat(clanId);
        await this.mqtt.subscribe(topic, { qos: 1 });
        console.log('[MQTTManager] Subscribed to group chat:', topic);
    }

    /**
     * Subscribe to user notifications
     */
    async subscribeNotifications(): Promise<void> {
        if (!this.config?.userId) {
            throw new Error('Not connected. Call connect() first.');
        }

        const topic = MQTTTopics.userNotifications(this.config.userId);
        await this.mqtt.subscribe(topic, { qos: 1 });
        console.log('[MQTTManager] Subscribed to notifications:', topic);
    }

    /**
     * Send message to friend
     */
    async sendFriendMessage(friendId: string, message: string): Promise<void> {
        if (!this.config?.userId) {
            throw new Error('Not connected. Call connect() first.');
        }

        const topic = MQTTTopics.friendChat(this.config.userId, friendId);
        await this.mqtt.publish(topic, message, { qos: 1, retained: false });
        console.log('[MQTTManager] Message sent to friend:', friendId);
    }

    /**
     * Send message to group
     */
    async sendGroupMessage(clanId: string, message: string, subTopic: string = 'messages'): Promise<void> {
        const topic = MQTTTopics.groupChatPublish(clanId, subTopic);
        await this.mqtt.publish(topic, message, { qos: 1, retained: false });
        console.log('[MQTTManager] Message sent to group:', clanId);
    }

    /**
     * Publish user presence
     */
    async publishPresence(status: 'online' | 'offline' | 'away'): Promise<void> {
        if (!this.config?.userId) {
            throw new Error('Not connected. Call connect() first.');
        }

        const topic = MQTTTopics.userPresence(this.config.userId);
        const payload = JSON.stringify({
            userId: this.config.userId,
            status,
            timestamp: Date.now(),
        });

        await this.mqtt.publish(topic, payload, { qos: 0, retained: true });
        console.log('[MQTTManager] Presence updated:', status);
    }

    /**
     * Unsubscribe from friend chat
     */
    async unsubscribeFriendChat(friendId: string): Promise<void> {
        if (!this.config?.userId) return;

        const topic = MQTTTopics.friendChat(this.config.userId, friendId);
        await this.mqtt.unsubscribe(topic);
        console.log('[MQTTManager] Unsubscribed from friend chat:', topic);
    }

    /**
     * Unsubscribe from group chat
     */
    async unsubscribeGroupChat(clanId: string): Promise<void> {
        const topic = MQTTTopics.groupChat(clanId);
        await this.mqtt.unsubscribe(topic);
        console.log('[MQTTManager] Unsubscribed from group chat:', topic);
    }

    /**
     * Check if connected
     */
    async isConnected(): Promise<boolean> {
        return await this.mqtt.isConnected();
    }

    /**
     * Get connection status
     */
    async getStatus(): Promise<string> {
        return await this.mqtt.getConnectionStatus();
    }

    /**
     * Cleanup and destroy connection
     */
    async destroy(): Promise<void> {
        this.eventSubscriptions.forEach(sub => sub.remove());
        this.eventSubscriptions = [];
        await this.mqtt.destroy();
        this.isInitialized = false;
        this.config = null;
        console.log('[MQTTManager] Destroyed');
    }
}

/**
 * Hook to use MQTT Connection Manager
 */
export const useMQTTConnectionManager = (options?: any) => {
    const mqtt = useMQTT(options);
    return new MQTTConnectionManager(mqtt);
};
