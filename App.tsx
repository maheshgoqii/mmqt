/**
 * MQTT Demo App
 * Tests the Native MQTT TurboModule implementation
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { useMQTTConnectionManager, MQTTDynamicConfig } from './MQTTConnectionManager';
import * as MQTT from './src/index';

interface Message {
  topic: string;
  message: any;
  timestamp: Date;
}

function App() {
  const [status, setStatus] = useState('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [publishTopic, setPublishTopic] = useState('test/topic');
  const [publishMessage, setPublishMessage] = useState('Hello MQTT!');
  const [subscribeTopic, setSubscribeTopic] = useState('test/#');
  const [lastEvent, setLastEvent] = useState<string>('None');

  const mqttConfig: MQTTDynamicConfig = {
    brokerUrl: 'wss://vernmq.goqii.com:9002',
    userId: `6163344`,
    authId: 'bWFoZXNobWVzdHJpNzNAZ21haWwuY29t',
    authPassword: 'MzFlZTcxMTliNzYyYWMxYjMxZWU0MDRmNWZlNTVkZTQ',
  };

  const mqttManager = useMQTTConnectionManager({
    onConnect: () => {
      console.log('✅ Connected to broker');
      setStatus('connected');
    },
    onDisconnect: () => {
      console.log('❌ Disconnected from broker');
      setStatus('disconnected');
    },
    onConnectionLost: (error: any) => {
      console.log('⚠️ Connection lost:', error);
      setStatus('connection_lost');
    },
    onMessageReceived: (data: any) => {
      console.log('📨 Message received:', data);
      setLastEvent(`${new Date().toLocaleTimeString()} - ${data.topic}`);

      let parsedMessage = data.message;
      try {
        parsedMessage = JSON.parse(data.message);
      } catch (e) {
        // Not JSON, keep as string
      }

      setMessages((prev: Message[]) => [{
        topic: data.topic,
        message: parsedMessage,
        timestamp: new Date(),
      }, ...prev].slice(0, 50));
    },
    onError: (error: any) => {
      console.error('❌ MQTT Error:', error);
      setStatus('error');
    },
  });

  const handleConnect = async () => {
    try {
      setStatus('connecting...');
      await mqttManager.connect(mqttConfig);
    } catch (error) {
      console.error('Connection error:', error);
      setStatus('error');
    }
  };

  const handleDisconnect = async () => {
    try {
      await mqttManager.disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const handlePublish = async () => {
    try {
      // Use the internal mqtt instance for generic publishing if needed, 
      // or use specialized methods from manager
      await mqttManager.mqtt.publish(publishTopic, publishMessage, { qos: 0, retained: false });
      console.log('Message published');
    } catch (error) {
      console.error('Publish error:', error);
    }
  };

  const handleSubscribe = async () => {
    try {
      await mqttManager.mqtt.subscribe(subscribeTopic, { qos: 0 });
      console.log('Subscribed to topic');
    } catch (error) {
      console.error('Subscribe error:', error);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      await mqttManager.mqtt.unsubscribe(subscribeTopic);
      console.log('Unsubscribed from topic');
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'disconnected': return '#757575';
      case 'connecting...': return '#FF9800';
      case 'connection_lost': return '#F44336';
      case 'error': return '#F44336';
      default: return '#757575';
    }
  };

  // Setup structured listeners on mount
  useEffect(() => {
    // 1. Listen for standard chat messages
    mqttManager.onMessage = (data) => {
      console.log('📨 Structured Message Case:', data.case, data);
      setMessages((prev: Message[]) => [{
        topic: data.topic,
        message: data.message || (data.type === 'img' ? '[Image Message]' : '[Clip Share]'),
        timestamp: new Date(),
      }, ...prev].slice(0, 50));
    };

    // 2. Listen for reactions
    mqttManager.onReaction = (data) => {
      console.log('😀 Reaction Event:', data.case, 'on msg:', data.messageId);
      // Example: show a temporary notification for the reaction
    };

    // 3. Listen for edits/deletes
    mqttManager.onUpdate = (data) => {
      console.log('🔄 Update/Delete Event:', data.case, 'on msg:', data.messageId);
    };

    // 4. Fallback for events not matching known cases
    mqttManager.onRawEvent = (payload) => {
      console.log('❓ Unknown/Raw Event:', payload);
    };
  }, [mqttManager]);

  // Global event listener demo using the new addListener API
  useEffect(() => {
    console.log('--- Setting up global MQTT listeners ---');

    // Demonstrate using the new type-safe addListener
    const subscriptions = [
      MQTT.addListener('onConnect', (data) => {
        console.log('[Global Listener] Connected to:', data.serverUri);
      }),
      MQTT.addListener('onMessageReceived', (data) => {
        console.log('[Global Listener] New message on:', data.topic);
      }),
      MQTT.addListener('onConnectFailure', (error) => {
        console.error('[Global Listener] Connection failed:', error.message);
      }),
      MQTT.addListener('onConnectionLost', (error) => {
        console.warn('[Global Listener] Connection lost:', error.message);
      }),
      MQTT.addListener('onReconnect', () => {
        console.log('[Global Listener] Reconnecting...');
      }),
    ];

    return () => {
      console.log('--- Cleaning up global MQTT listeners ---');
      subscriptions.forEach(sub => sub.remove());
      mqttManager.destroy();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1976D2" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MQTT Test Client</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Connection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <Text style={styles.infoText}>Broker: {mqttConfig.brokerUrl}</Text>
          <Text style={styles.infoText}>User ID: {mqttConfig.userId}</Text>
          <Text style={[styles.infoText, { fontWeight: 'bold', color: '#2196F3' }]}>Last Event: {lastEvent}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.connectButton]}
              onPress={handleConnect}
              disabled={status === 'connected'}
            >
              <Text style={styles.buttonText}>Connect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={handleDisconnect}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscribe Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscribe</Text>
          <TextInput
            style={styles.input}
            value={subscribeTopic}
            onChangeText={setSubscribeTopic}
            placeholder="Enter topic (supports wildcards: +, #)"
            placeholderTextColor="#999"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.subscribeButton]}
              onPress={handleSubscribe}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Subscribe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.unsubscribeButton]}
              onPress={handleUnsubscribe}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Unsubscribe</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Publish Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Publish</Text>
          <TextInput
            style={styles.input}
            value={publishTopic}
            onChangeText={setPublishTopic}
            placeholder="Topic"
            placeholderTextColor="#999"
          />
          <TextInput
            style={[styles.input, styles.messageInput]}
            value={publishMessage}
            onChangeText={setPublishMessage}
            placeholder="Message"
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity
            style={[styles.button, styles.publishButton]}
            onPress={handlePublish}
            disabled={status !== 'connected'}
          >
            <Text style={styles.buttonText}>Publish Message</Text>
          </TouchableOpacity>
        </View>

        {/* Specialized Operations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialized Operations</Text>

          <View style={styles.buttonGrid}>
            <TouchableOpacity
              style={[styles.smallButton, styles.specialButton, { backgroundColor: '#FF5722' }]}
              onPress={() => mqttManager.subscribeNotifications()}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>My Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallButton, styles.specialButton]}
              onPress={() => mqttManager.subscribeFriendChat('friend_789')}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Sub Friend Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallButton, styles.specialButton]}
              onPress={() => mqttManager.sendFriendMessage('friend_789', 'Hello from App!')}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Send to Friend</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallButton, styles.specialButton]}
              onPress={() => mqttManager.publishPresence('online')}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Set Online</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages Section */}
        <View style={styles.section}>
          <View style={styles.messagesHeader}>
            <Text style={styles.sectionTitle}>Received Messages ({messages.length})</Text>
            <TouchableOpacity onPress={clearMessages}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>

          {messages.length === 0 ? (
            <Text style={styles.emptyText}>No messages yet</Text>
          ) : (
            messages.map((msg, index) => (
              <View key={index} style={styles.messageCard}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageTopic}>{msg.topic}</Text>
                  <Text style={styles.messageTime}>
                    {msg.timestamp.toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={styles.messageText}>
                  {typeof msg.message === 'object'
                    ? JSON.stringify(msg.message, null, 2)
                    : String(msg.message)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1976D2',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    color: '#333',
  },
  messageInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    flex: 1,
    minWidth: '45%',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#757575',
  },
  subscribeButton: {
    backgroundColor: '#2196F3',
  },
  unsubscribeButton: {
    backgroundColor: '#FF9800',
  },
  publishButton: {
    backgroundColor: '#9C27B0',
  },
  specialButton: {
    backgroundColor: '#607D8B',
  },
  messagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    padding: 20,
    fontStyle: 'italic',
  },
  messageCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  messageTopic: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
    flex: 1,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
  },
});

export default App;

