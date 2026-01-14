import { NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';
import NativeMQTT from '../specs/NativeMQTT';
import type {
    MQTTConfig,
    MQTTSSLConfig,
    MQTTWillConfig,
    MQTTPublishOptions,
    MQTTSubscribeOptions,
    ConnectEvent,
    MessageEvent,
    ErrorEvent,
    TopicEvent,
    SubscribeEvent,
} from '../specs/NativeMQTT';

// Create event emitter from the native module
// For TurboModules, we pass the module instance to NativeEventEmitter.
const eventEmitter = new NativeEventEmitter(
    Platform.OS === 'ios' ? undefined : (NativeMQTT as any)
);

// Re-export all spec types so consumers don't have to import from specs directly
export type {
    MQTTConfig,
    MQTTSSLConfig,
    MQTTWillConfig,
    MQTTPublishOptions,
    MQTTSubscribeOptions,
    ConnectEvent,
    MessageEvent,
    ErrorEvent,
    TopicEvent,
    SubscribeEvent,
};

/**
 * Initialize the MQTT client with provided configuration.
 * @param config - MQTT connection configuration
 * @param sslConfig - Optional SSL/TLS configuration
 * @param willConfig - Optional Last Will and Testament configuration
 */
export async function initialize(
    config: MQTTConfig,
    sslConfig?: MQTTSSLConfig,
    willConfig?: MQTTWillConfig
): Promise<void> {
    return await NativeMQTT.initialize(config, sslConfig, willConfig);
}

/**
 * Connect to the MQTT broker using the configuration provided in initialize.
 */
export async function connect(): Promise<void> {
    return await NativeMQTT.connect();
}

/**
 * Disconnect gracefully from the MQTT broker.
 */
export async function disconnect(): Promise<void> {
    return await NativeMQTT.disconnect();
}

/**
 * Attempt to reconnect to the MQTT broker using existing configuration.
 */
export async function reconnect(): Promise<void> {
    return await NativeMQTT.reconnect();
}

/**
 * Check if the client is currently connected.
 */
export async function isConnected(): Promise<boolean> {
    return await NativeMQTT.isConnected();
}

/**
 * Get the current connection status as a string.
 */
export async function getConnectionStatus(): Promise<string> {
    return await NativeMQTT.getConnectionStatus();
}

/**
 * Publish a message to a specific topic.
 * @param topic - MQTT topic
 * @param message - Message payload (string)
 * @param options - Optional publish options (QoS, retained)
 */
export async function publish(
    topic: string,
    message: string,
    options?: MQTTPublishOptions
): Promise<void> {
    return await NativeMQTT.publish(topic, message, options);
}

/**
 * Subscribe to a topic or topic pattern.
 * @param topic - MQTT topic (supports wildcards + and #)
 * @param options - Optional subscribe options (QoS)
 */
export async function subscribe(
    topic: string,
    options?: MQTTSubscribeOptions
): Promise<void> {
    return await NativeMQTT.subscribe(topic, options);
}

/**
 * Unsubscribe from a topic.
 */
export async function unsubscribe(topic: string): Promise<void> {
    return await NativeMQTT.unsubscribe(topic);
}

/**
 * Clean up all native resources and destroy the client.
 */
export async function destroy(): Promise<void> {
    return await NativeMQTT.destroy();
}

/**
 * Map of MQTT events and their respective payload types.
 */
export interface MQTTEventMap {
    onConnect: ConnectEvent;
    onConnectFailure: ErrorEvent;
    onConnectionLost: ErrorEvent;
    onDisconnect: void;
    onReconnect: void;
    onMessageReceived: MessageEvent;
    onPublishSuccess: TopicEvent;
    onSubscribeSuccess: SubscribeEvent;
    onUnsubscribeSuccess: TopicEvent;
    onDeliveryComplete: void;
    onDestroy: void;
}

/**
 * Add a listener for MQTT events.
 * @param event - Event name from MQTTEventMap
 * @param callback - Function called when event is received
 * @returns EmitterSubscription to allow removing the listener
 */
export function addListener<T extends keyof MQTTEventMap>(
    event: T,
    callback: (data: MQTTEventMap[T]) => void
): EmitterSubscription {
    return eventEmitter.addListener(event, callback);
}

/**
 * Export default object containing all MQTT methods.
 */
const MQTT = {
    initialize,
    connect,
    disconnect,
    reconnect,
    isConnected,
    getConnectionStatus,
    publish,
    subscribe,
    unsubscribe,
    destroy,
    addListener,
};

export default MQTT;
