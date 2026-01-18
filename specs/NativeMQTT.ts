import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';


export interface MQTTConfig {
    clientId: string;
    host: string;
    port: number;
    protocol: 'tcp' | 'ssl' | 'ws' | 'wss';
    username?: string;
    password?: string;
    keepAlive?: number; // seconds, default: 60
    cleanSession?: boolean; // default: true
    reconnect?: boolean; // default: true
    reconnectPeriod?: number; // milliseconds, default: 1000
    connectTimeout?: number; // seconds, default: 30
}

export interface MQTTSSLConfig {
    ca?: string; // CA certificate
    cert?: string; // Client certificate
    key?: string; // Client key
    rejectUnauthorized?: boolean;
}

export interface MQTTWillConfig {
    topic?: string;
    payload?: string;
    qos?: number; // 0, 1, or 2
    retained?: boolean;
}

export interface MQTTPublishOptions {
    qos?: number; // 0, 1, or 2
    retained?: boolean;
}

export interface MQTTSubscribeOptions {
    qos?: number; // 0, 1, or 2
}

export type ConnectEvent = {
    serverUri: string;
    clientId: string;
};

export type MessageEvent = {
    topic: string;
    message: string;
    qos: number;
    retained: boolean;
};

export type ErrorEvent = {
    message: string;
};

export type TopicEvent = {
    topic: string;
};

export type SubscribeEvent = {
    topic: string;
    qos: number;
};

/**
 * Native MQTT TurboModule
 * Provides MQTT client functionality for iOS and Android
 */
export interface Spec extends TurboModule {
    /**
     * Initialize MQTT client with configuration
     * @param config - MQTT connection configuration
     * @param sslConfig - Optional SSL/TLS configuration
     * @param willConfig - Optional Last Will and Testament configuration
     * @returns Promise that resolves when initialization is complete
     */
    initialize(
        config: MQTTConfig,
        sslConfig?: MQTTSSLConfig,
        willConfig?: MQTTWillConfig,
    ): Promise<void>;

    /**
     * Connect to MQTT broker
     * @returns Promise that resolves when connected
     */
    connect(): Promise<void>;

    /**
     * Disconnect from MQTT broker
     * @returns Promise that resolves when disconnected
     */
    disconnect(): Promise<void>;

    /**
     * Reconnect to MQTT broker (must be initialized first)
     * @returns Promise that resolves when reconnected
     */
    reconnect(): Promise<void>;

    /**
     * Check if currently connected to broker
     * @returns Promise that resolves with connection status
     */
    isConnected(): Promise<boolean>;

    /**
     * Get current connection status
     * @returns Promise that resolves with status string
     */
    getConnectionStatus(): Promise<string>;

    /**
     * Publish a message to a topic
     * @param topic - MQTT topic
     * @param message - Message payload (string)
     * @param options - Optional publish options (QoS, retained)
     * @returns Promise that resolves when message is published
     */
    publish(
        topic: string,
        message: string,
        options?: MQTTPublishOptions,
    ): Promise<void>;

    /**
     * Subscribe to a topic
     * @param topic - MQTT topic (supports wildcards)
     * @param options - Optional subscribe options (QoS)
     * @returns Promise that resolves when subscribed
     */
    subscribe(topic: string, options?: MQTTSubscribeOptions): Promise<void>;

    /**
     * Unsubscribe from a topic
     * @param topic - MQTT topic
     * @returns Promise that resolves when unsubscribed
     */
    unsubscribe(topic: string): Promise<void>;

    /**
     * Destroy the MQTT client and clean up resources
     * @returns Promise that resolves when cleanup is complete
     */
    destroy(): Promise<void>;

    // ----------- EVENTS (NEW ARCH) -------------
    readonly onConnect: EventEmitter<ConnectEvent>;
    readonly onConnectFailure: EventEmitter<ErrorEvent>;
    readonly onConnectionLost: EventEmitter<ErrorEvent>;
    readonly onDisconnect: EventEmitter<void>;
    readonly onReconnect: EventEmitter<void>;
    readonly onMessageReceived: EventEmitter<MessageEvent>;
    readonly onPublishSuccess: EventEmitter<TopicEvent>;
    readonly onSubscribeSuccess: EventEmitter<SubscribeEvent>;
    readonly onUnsubscribeSuccess: EventEmitter<TopicEvent>;
    readonly onDeliveryComplete: EventEmitter<void>;
    readonly onDestroy: EventEmitter<void>;

    // Required by TurboModules (must exist)
    addListener(eventType: string): void;
    removeListeners(count: number): void;
}


export default TurboModuleRegistry.getEnforcing<Spec>('NativeMQTT');
