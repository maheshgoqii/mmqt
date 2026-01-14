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
  senderId?: string;
  isMe: boolean;
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

  // 1. Stabilize options - Only handle connection/status here
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
    onError: (error: any) => {
      console.error('❌ MQTT Error:', error);
      setStatus('error');
    },
  }), []);

  // 2. Use the stable hook
  const mqttManager = useMQTTConnectionManager(mqttOptions);

  // 3. Setup structured listeners for Chat Logic
  useEffect(() => {
    if (!mqttManager) return;

    mqttManager.onMessage = (data: any) => {
      console.log('📨 Message Arrived:', data.case, '-', data.message);
      setLastEvent(`${new Date().toLocaleTimeString()} - ${data.topic}`);

      setMessages((prev: Message[]) => [{
        topic: data.topic || 'Unknown',
        message: data.message || JSON.stringify(data),
        timestamp: new Date(),
        senderId: data.senderId,
        isMe: data.senderId === mqttConfig.userId,
      }, ...prev].slice(0, 50));
    };

    mqttManager.onRawEvent = (payload: any) => {
      console.log('❔ Raw Event:', payload);
    };
  }, [mqttManager, mqttConfig.userId]);

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
    if (status !== 'connected') return;

    try {
      console.log('Sending message to:', friendId);
      await mqttManager.sendFriendMessage(friendId, friendMessage);

      // We explicitly add it to the list if we don't get our own echo back
      // (GOQii clients usually get their own messages back if subscribed, 
      // but adding locally gives instant feedback)
      setFriendMessage('');
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
        <Text style={styles.headerTitle}>GOQii Chat Listen</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Connection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.infoText}>My User ID: {mqttConfig.userId}</Text>
          <Text style={[styles.infoText, { fontWeight: 'bold', color: '#2196F3' }]}>Last Received: {lastEvent}</Text>

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

        {/* Listen / Send Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat with Friend</Text>

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

          <View style={styles.buttonGrid}>
            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: '#2196F3' }]}
              onPress={() => mqttManager.subscribeFriendChat(friendId)}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>STEP 1: Listen to Friend</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, { marginTop: 15 }]}>
            <TextInput
              style={[styles.smallInput, styles.messageInput]}
              value={friendMessage}
              onChangeText={setFriendMessage}
              placeholder="Type a message..."
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, { opacity: status === 'connected' ? 1 : 0.5 }]}
              onPress={handleSendFriendMsg}
              disabled={status !== 'connected'}
            >
              <Text style={styles.buttonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages List - Chat Styled */}
        <View style={styles.section}>
          <View style={styles.messagesHeader}>
            <Text style={styles.sectionTitle}>Conversation</Text>
            <TouchableOpacity onPress={() => setMessages([])}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>

          {messages.length === 0 ? (
            <Text style={styles.emptyText}>No messages yet. Subscribe and wait for a message!</Text>
          ) : (
            <View style={styles.chatContainer}>
              {messages.map((msg, index) => (
                <View
                  key={index}
                  style={[
                    styles.messageBubble,
                    msg.isMe ? styles.myBubble : styles.friendBubble
                  ]}
                >
                  {!msg.isMe && <Text style={styles.senderLabel}>Friend ({msg.senderId}):</Text>}
                  <Text style={styles.messageText}>{msg.message}</Text>
                  <Text style={styles.timestampLabel}>{msg.timestamp.toLocaleTimeString()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5DDD5' }, // WhatsApp-like background
  header: {
    backgroundColor: '#075E54',
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
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#128C7E', marginBottom: 12 },
  infoText: { fontSize: 13, color: '#666', marginBottom: 4 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { fontSize: 14, color: '#333', width: 80 },
  smallInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f9f9f9',
    color: '#333'
  },
  messageInput: { minHeight: 45, maxHeight: 100, textAlignVertical: 'center' },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 5 },
  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  button: { flex: 1, padding: 12, borderRadius: 6, alignItems: 'center' },
  smallButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sendButton: { backgroundColor: '#128C7E', padding: 12, borderRadius: 25, width: 70, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  connectButton: { backgroundColor: '#25D366' },
  disconnectButton: { backgroundColor: '#757575' },
  messagesHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  clearButton: { color: '#F44336', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#999', padding: 20, fontStyle: 'italic' },

  // Chat Bubble Styles
  chatContainer: { flexDirection: 'column' },
  messageBubble: {
    maxWidth: '85%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 2,
  },
  friendBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderTopLeftRadius: 2,
  },
  senderLabel: { fontSize: 10, fontWeight: 'bold', color: '#128C7E', marginBottom: 2 },
  messageText: { fontSize: 15, color: '#333' },
  timestampLabel: { fontSize: 9, color: '#999', alignSelf: 'flex-end', marginTop: 4 },
});

export default App;
