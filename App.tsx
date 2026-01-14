/**
 * MQTT Demo App
 * Tests the Native MQTT TurboModule implementation with GOQii specialized logic.
 */

import React, { useState, useEffect, useMemo } from 'react';
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

interface Message {
  topic: string;
  message: any;
  timestamp: Date;
}

function App() {
  const [status, setStatus] = useState('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastEvent, setLastEvent] = useState<string>('None');

  // Chat State
  const [friendId, setFriendId] = useState('6174846');
  const [friendMessage, setFriendMessage] = useState('Hello from React Native!');
  const [clanId, setClanId] = useState('999');

  const mqttConfig: MQTTDynamicConfig = useMemo(() => ({
    brokerUrl: 'wss://vernmq.goqii.com:9002',
    userId: `6163344`,
    authId: 'bWFoZXNobWVzdHJpNzNAZ21haWwuY29t',
    authPassword: 'MzFlZTcxMTliNzYyYWMxYjMxZWU0MDRmNWZlNTVkZTQ',
  }), []);

  // 1. Stabilize options
  const mqttOptions = useMemo(() => ({
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
        // Not JSON
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
  }), []);

  // 2. Use the stable hook (now memoized internally)
  const mqttManager = useMQTTConnectionManager(mqttOptions);

  // Setup structured listeners
  useEffect(() => {
    if (!mqttManager) return;

    mqttManager.onMessage = (data: any) => {
      console.log('📨 Structured Message Arrival:', data.case);
      setMessages((prev: Message[]) => [{
        topic: `[STRUCTURED] ${data.topic || 'Event'}`,
        message: data,
        timestamp: new Date(),
      }, ...prev].slice(0, 50));
    };
  }, [mqttManager]);

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

  const handleSendFriendMsg = async () => {
    if (status !== 'connected') {
      console.warn('Cannot send: Not connected');
      return;
    }

    try {
      console.log('Attempting to send friend message...');
      // The manager now handles the JSON wrapping internally!
      await mqttManager.sendFriendMessage(friendId, friendMessage);
    } catch (e: any) {
      console.error('Send Error:', e.message);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1976D2" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GOQii MQTT Demo</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Connection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Control</Text>
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

        {/* Friend Messaging Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friend Chat Logic</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Friend ID:</Text>
            <TextInput
              style={styles.smallInput}
              value={friendId}
              onChangeText={setFriendId}
              placeholder="Friend ID"
              keyboardType="numeric"
            />
          </View>

          <TextInput
            style={[styles.input, styles.messageInput]}
            value={friendMessage}
            onChangeText={setFriendMessage}
            placeholder="Type private message..."
            multiline
          />

          <View style={styles.buttonGrid}>
            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: '#2196F3' }]}
              onPress={() => mqttManager.subscribeFriendChat(friendId)}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>1. Subscribe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: '#4CAF50' }]}
              onPress={handleSendFriendMsg}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>2. Send JSON</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Global & Clan Operations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Operations</Text>

          <View style={styles.buttonGrid}>
            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: '#FF5722' }]}
              onPress={() => mqttManager.subscribeNotifications()}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: '#3F51B5' }]}
              onPress={() => mqttManager.subscribeGroupChat(clanId)}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Clan Chat ({clanId})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: '#607D8B' }]}
              onPress={() => mqttManager.publishPresence('online')}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Set Online</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages List */}
        <View style={styles.section}>
          <View style={styles.messagesHeader}>
            <Text style={styles.sectionTitle}>Message History ({messages.length})</Text>
            <TouchableOpacity onPress={() => setMessages([])}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>

          {messages.length === 0 ? (
            <Text style={styles.emptyText}>Standing by for messages...</Text>
          ) : (
            messages.map((msg, index) => (
              <View key={index} style={styles.messageCard}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageTopic}>{msg.topic}</Text>
                  <Text style={styles.messageTime}>{msg.timestamp.toLocaleTimeString()}</Text>
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
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  header: {
    backgroundColor: '#1976D2',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  content: { flex: 1 },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1976D2', marginBottom: 12 },
  infoText: { fontSize: 13, color: '#666', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    color: '#333'
  },
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { fontSize: 14, color: '#333', width: 80 },
  smallInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#f9f9f9',
    color: '#333'
  },
  messageInput: { minHeight: 60, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 5 },
  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  button: { flex: 1, padding: 12, borderRadius: 6, alignItems: 'center' },
  smallButton: { flex: 1, minWidth: '40%', padding: 10, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  connectButton: { backgroundColor: '#4CAF50' },
  disconnectButton: { backgroundColor: '#757575' },
  messagesHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  clearButton: { color: '#F44336', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#bbb', padding: 20, fontStyle: 'italic' },
  messageCard: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2'
  },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  messageTopic: { fontSize: 11, fontWeight: 'bold', color: '#1976D2' },
  messageTime: { fontSize: 10, color: '#999' },
  messageText: { fontSize: 13, color: '#333' },
});

export default App;
