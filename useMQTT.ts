import { useEffect, useCallback, useRef } from 'react';
import { NativeEventEmitter, Platform } from 'react-native';
import NativeMQTT from './specs/NativeMQTT';

const eventEmitter = new NativeEventEmitter(NativeMQTT as any);

export interface MQTTHookOptions {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onConnectionLost?: (error: { message: string }) => void;
    onMessageReceived?: (data: { topic: string; message: string; qos: number; retained: boolean }) => void;
    onError?: (error: any) => void;
}

export const useMQTT = (options?: MQTTHookOptions) => {
    const subscriptionsRef = useRef<any[]>([]);

    useEffect(() => {
        // Setup event listeners
        const connectListener = eventEmitter.addListener('onConnect', (data) => {
            console.log('[MQTT] Connected:', data);
            options?.onConnect?.();
        });

        const disconnectListener = eventEmitter.addListener('onDisconnect', () => {
            console.log('[MQTT] Disconnected');
            options?.onDisconnect?.();
        });

        const connectionLostListener = eventEmitter.addListener('onConnectionLost', (error) => {
            console.log('[MQTT] Connection lost:', error);
            options?.onConnectionLost?.(error);
        });

        const messageListener = eventEmitter.addListener('onMessageReceived', (data) => {
            console.log('[MQTT] Message received:', data);
            options?.onMessageReceived?.(data);
        });

        const reconnectListener = eventEmitter.addListener('onReconnect', () => {
            console.log('[MQTT] Reconnected');
        });

        subscriptionsRef.current = [
            connectListener,
            disconnectListener,
            connectionLostListener,
            messageListener,
            reconnectListener,
        ];

        // Cleanup on unmount
        return () => {
            subscriptionsRef.current.forEach(sub => sub.remove());
            subscriptionsRef.current = [];
        };
    }, [options]);

    const initialize = useCallback(async (config: any, sslConfig?: any, willConfig?: any) => {
        try {
            await NativeMQTT.initialize(config, sslConfig, willConfig);
            console.log('[MQTT] Initialized successfully');
        } catch (error) {
            console.error('[MQTT] Initialize error:', error);
            options?.onError?.(error);
            throw error;
        }
    }, [options]);

    const connect = useCallback(async () => {
        try {
            await NativeMQTT.connect();
            console.log('[MQTT] Connect called');
        } catch (error) {
            console.error('[MQTT] Connect error:', error);
            options?.onError?.(error);
            throw error;
        }
    }, [options]);

    const disconnect = useCallback(async () => {
        try {
            await NativeMQTT.disconnect();
            console.log('[MQTT] Disconnect called');
        } catch (error) {
            console.error('[MQTT] Disconnect error:', error);
            options?.onError?.(error);
            throw error;
        }
    }, [options]);

    const publish = useCallback(async (topic: string, message: string, opts?: { qos?: number; retained?: boolean }) => {
        try {
            await NativeMQTT.publish(topic, message, opts);
            console.log(`[MQTT] Published to ${topic}:`, message);
        } catch (error) {
            console.error('[MQTT] Publish error:', error);
            options?.onError?.(error);
            throw error;
        }
    }, [options]);

    const subscribe = useCallback(async (topic: string, opts?: { qos?: number }) => {
        try {
            await NativeMQTT.subscribe(topic, opts);
            console.log(`[MQTT] Subscribed to ${topic}`);
        } catch (error) {
            console.error('[MQTT] Subscribe error:', error);
            options?.onError?.(error);
            throw error;
        }
    }, [options]);

    const unsubscribe = useCallback(async (topic: string) => {
        try {
            await NativeMQTT.unsubscribe(topic);
            console.log(`[MQTT] Unsubscribed from ${topic}`);
        } catch (error) {
            console.error('[MQTT] Unsubscribe error:', error);
            options?.onError?.(error);
            throw error;
        }
    }, [options]);

    const isConnected = useCallback(async () => {
        try {
            return await NativeMQTT.isConnected();
        } catch (error) {
            console.error('[MQTT] isConnected error:', error);
            return false;
        }
    }, []);

    const getConnectionStatus = useCallback(async () => {
        try {
            return await NativeMQTT.getConnectionStatus();
        } catch (error) {
            console.error('[MQTT] getConnectionStatus error:', error);
            return 'error';
        }
    }, []);

    const destroy = useCallback(async () => {
        try {
            await NativeMQTT.destroy();
            console.log('[MQTT] Client destroyed');
        } catch (error) {
            console.error('[MQTT] Destroy error:', error);
            options?.onError?.(error);
            throw error;
        }
    }, [options]);

    return {
        initialize,
        connect,
        disconnect,
        publish,
        subscribe,
        unsubscribe,
        isConnected,
        getConnectionStatus,
        destroy,
    };
};
