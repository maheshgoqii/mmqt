# Native MQTT Module for React Native

A fully functional MQTT TurboModule implementation for React Native with Android support.

## ✨ Features

- ✅ **TurboModule Architecture** - Uses React Native's new architecture for better performance
- ✅ **Full MQTT Support** - Connect, publish, subscribe, and manage MQTT connections
- ✅ **Event-Driven** - Real-time message receiving with event callbacks
- ✅ **Eclipse Paho** - Built on the reliable Eclipse Paho MQTT client
- ✅ **React Hook API** - Clean, easy-to-use React hook wrapper (`useMQTT`)
- ✅ **TypeScript Support** - Fully typed interfaces  
- ✅ **SSL/TLS Ready** - Infrastructure for secure connections
- ✅ **Last Will & Testament** - Configurable LWT messages
- ✅ **QoS Levels** - Support for QoS 0, 1, and 2
- ✅ **Wildcards** - Full support for topic wildcards (+, #)

## 📦 Implementation Status

### Android ✅
- **Status**: Fully Implemented
- **Library**: Eclipse Paho MQTT Android Client
- **Features**: All methods implemented with callbacks

### iOS ⏳
- **Status**: Not Yet Implemented
- **Next Step**: Add CocoaMQTT dependency and implementation

## 🚀 Quick Start

### 1. Initialize and Connect

```typescript
import { useMQTT } from './useMQTT';

const mqtt = useMQTT({
  onConnect: () => console.log('Connected!'),
  onMessageReceived: (data) => console.log('Message:', data),
});

// Configure and connect
await mqtt.initialize({
  clientId: 'my-client-id',
  host: 'broker.hivemq.com',
  port: 1883,
  protocol: 'tcp',
});

await mqtt.connect();
```

### 2. Publish Messages

```typescript
await mqtt.publish('my/topic', 'Hello MQTT!', {
  qos: 0,
  retained: false,
});
```

### 3. Subscribe to Topics

```typescript
// Simple topic
await mqtt.subscribe('sensors/temperature', { qos: 0 });

// Wildcard subscriptions
await mqtt.subscribe('sensors/#', { qos: 0 });  // All sensors
await mqtt.subscribe('sensors/+/status', { qos: 0 });  // All sensor statuses
```

## 📖 API Reference

### Configuration Options

```typescript
interface MQTTConfig {
  clientId: string;
  host: string;
  port: number;
  protocol: 'tcp' | 'ssl' | 'ws' | 'wss';
  username?: string;
  password?: string;
  keepAlive?: number;        // default: 60 seconds
  cleanSession?: boolean;     // default: true
  reconnect?: boolean;        // default: true
  reconnectPeriod?: number;   // default: 1000ms
  connectTimeout?: number;    // default: 30 seconds
}
```

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `initialize(config, sslConfig?, willConfig?)` | Initialize MQTT client | `Promise<void>` |
| `connect()` | Connect to broker | `Promise<void>` |
| `disconnect()` | Disconnect from broker | `Promise<void>` |
| `reconnect()` | Reconnect to broker | `Promise<void>` |
| `isConnected()` | Check connection status | `Promise<boolean>` |
| `getConnectionStatus()` | Get status string | `Promise<string>` |
| `publish(topic, message, options?)` | Publish message | `Promise<void>` |
| `subscribe(topic, options?)` | Subscribe to topic | `Promise<void>` |
| `unsubscribe(topic)` | Unsubscribe from topic | `Promise<void>` |
| `destroy()` | Clean up resources | `Promise<void>` |

### Events

The `useMQTT` hook provides callback options for these events:

- `onConnect` - Fired when connected to broker
- `onDisconnect` - Fired when disconnected
- `onConnectionLost` - Fired when connection is lost unexpectedly
- `onMessageReceived` - Fired when a message arrives
- `onError` - Fired on errors

Additional events emitted:
- `onReconnect` - Reconnection successful
- `onPublishSuccess` - Message published successfully
- `onSubscribeSuccess` - Subscription successful
- `onUnsubscribeSuccess` - Unsubscription successful
- `onDeliveryComplete` - Message delivery confirmed

## 🛠️ Testing

The app includes a comprehensive test UI with:
- Connection management
- Publish/subscribe controls
- Real-time message display
- Pre-configured public test broker

### Test Broker (Included)
- **Broker**: `broker.hivemq.com`
- **Port**: 1883
- **Protocol**: TCP
- **No authentication required**

## 📱 Running the Demo

```bash
# Install dependencies
npm install

# Run on Android
npm run android

# The app will launch with the MQTT test UI
```

## 🔧 Android Setup

### Dependencies Added
```gradle
implementation("org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5")
implementation("org.eclipse.paho:org.eclipse.paho.android.service:1.1.1")
```

### Permissions Added
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Service Registered
```xml
<service android:name="org.eclipse.paho.android.service.MqttService" />
```

## 📝 Architecture

```
┌─────────────────┐
│   React/TS      │  App.tsx (Demo UI)
│   useMQTT Hook  │  useMQTT.ts (React Hook)
└────────┬────────┘
         │
┌────────▼────────┐
│  TurboModule    │  specs/NativeMQTT.ts (Codegen Spec)
│  Interface      │
└────────┬────────┘
         │
┌────────▼───────────────────┐
│  Native Implementation     │
│  ┌──────────────────────┐  │
│  │ NativeMQTTModule.kt  │  │  Android (Kotlin)
│  │ Eclipse Paho Client  │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

## 🔐 SSL/TLS Support

SSL configuration is scaffolded but requires additional setup:

```typescript
const sslConfig = {
  ca: '...certificate...',
  cert: '...client cert...',
  key: '...client key...',
  rejectUnauthorized: true,
};

await mqtt.initialize(mqttConfig, sslConfig);
```

**Note**: SSL socket factory implementation needs to be completed in `NativeMQTTModule.kt`.

## 🎯 Example Use Cases

### IoT Sensor Data
```typescript
// Subscribe to all temperature sensors
await mqtt.subscribe('home/sensors/+/temperature');

// Publish sensor reading
await mqtt.publish('home/sensors/living-room/temperature', '22.5');
```

### Chat Application
```typescript
// Subscribe to chat room
await mqtt.subscribe(`chat/room/${roomId}/#`);

// Send message
await mqtt.publish(`chat/room/${roomId}/messages`, JSON.stringify({
  user: 'Alice',
  message: 'Hello!',
  timestamp: Date.now(),
}));
```

### Real-time Notifications
```typescript
await mqtt.subscribe(`notifications/${userId}`);

mqtt.useMQTT({
  onMessageReceived: (data) => {
    showNotification(data.message);
  },
});
```

## 🐛 Debugging

Enable verbose logging in Android:
```kotlin
// In NativeMQTTModule.kt
Log.d(TAG, "Your debug message")
```

Check Android Logcat:
```bash
adb logcat | grep NativeMQTT
```

## 📋 TODO

- [ ] iOS implementation
- [ ] Complete SSL/TLS socket factory
- [ ] Add unit tests
- [ ] Add example app with real-world scenarios
- [ ] Publish as npm package
- [ ] Add offline message queueing
- [ ] Add connection retry strategies
- [ ] WebSocket support optimization

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ using React Native TurboModules**
# mmqt
