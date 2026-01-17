/**
 * MQTT Demo App
 * Tests the Native MQTT TurboModule implementation with GOQii specialized logic.
 * Now with separate Friend Chat and Group Chat components.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { useMQTTConnectionManager, MQTTDynamicConfig } from './MQTTConnectionManager';
import { FriendChat } from './components/FriendChat';
import { GroupChat } from './components/GroupChat';

interface Message {
  topic: string;
  message: any;
  timestamp: Date;
  senderId?: string;
  senderName?: string;
  isMe: boolean;
}

type ChatMode = 'friend' | 'group';

function App() {
  const [status, setStatus] = useState('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastEvent, setLastEvent] = useState<string>('None');
  const [chatMode, setChatMode] = useState<ChatMode>('friend');

  const mqttConfig: MQTTDynamicConfig = useMemo(
    // () => ({
    //   brokerUrl: 'wss://vernmq.goqii.com:9002',
    //   userId: `6163344`,
    //   authId: 'bWFoZXNobWVzdHJpNzNAZ21haWwuY29t',
    //   authPassword: 'MzFlZTcxMTliNzYyYWMxYjMxZWU0MDRmNWZlNTVkZTQ',
    // }),
    () => ({
      brokerUrl: 'tcp://vernmq.goqii.com:1883',
      userId: `6163344`,
      authId: 'bWFoZXNobWVzdHJpNzNAZ21haWwuY29t',
      authPassword: 'MzFlZTcxMTliNzYyYWMxYjMxZWU0MDRmNWZlNTVkZTQ',
    }),
    []
  );

  // 1. Stabilize options - Only handle connection/status here
  const mqttOptions = useMemo(
    () => ({
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
    }),
    []
  );

  // 2. Use the stable hook
  const mqttManager = useMQTTConnectionManager(mqttOptions);

  // 3. Setup structured listeners for Chat Logic
  useEffect(() => {
    if (!mqttManager) return;

    mqttManager.onMessage = (data: any) => {
      console.log('📨 Message Arrived:', data.case, '-', data.message);
      setLastEvent(`${new Date().toLocaleTimeString()} - ${data.topic}`);

      setMessages((prev: Message[]) =>
        [
          {
            topic: data.topic || 'Unknown',
            message: data.message || JSON.stringify(data),
            timestamp: new Date(),
            senderId: data.senderId,
            senderName: data.senderName,
            isMe: data.senderId === mqttConfig.userId,
          },
          ...prev,
        ].slice(0, 50)
      );
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

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#4CAF50';
      case 'disconnected':
        return '#757575';
      case 'connecting...':
        return '#FF9800';
      case 'connection_lost':
        return '#F44336';
      case 'error':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1976D2" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat Listen</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Connection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.infoText}>My User ID: {mqttConfig.userId}</Text>
          <Text style={[styles.infoText, { fontWeight: 'bold', color: '#2196F3' }]}>
            Last Received: {lastEvent}
          </Text>

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

        {/* Chat Mode Toggle */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleLabel}>Chat Mode:</Text>
          <View style={styles.toggleButtons}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                chatMode === 'friend' && styles.toggleButtonActive,
              ]}
              onPress={() => setChatMode('friend')}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  chatMode === 'friend' && styles.toggleButtonTextActive,
                ]}
              >
                Friend Chat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleButton,
                chatMode === 'group' && styles.toggleButtonActive,
              ]}
              onPress={() => setChatMode('group')}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  chatMode === 'group' && styles.toggleButtonTextActive,
                ]}
              >
                Group Chat
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Conditional Chat Component Rendering */}
        {chatMode === 'friend' ? (
          <FriendChat
            mqttManager={mqttManager}
            status={status}
            messages={messages}
            myUserId={mqttConfig.userId}
          />
        ) : (
          <GroupChat
            mqttManager={mqttManager}
            status={status}
            messages={messages}
            myUserId={mqttConfig.userId}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5DDD5' },
  header: {
    backgroundColor: '#075E54',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#128C7E',
    marginBottom: 12,
  },
  infoText: { fontSize: 13, color: '#666', marginBottom: 4 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 5 },
  button: { flex: 1, padding: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  connectButton: { backgroundColor: '#25D366' },
  disconnectButton: { backgroundColor: '#757575' },

  // Toggle Section
  toggleSection: {
    backgroundColor: '#fff',
    margin: 10,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    elevation: 3,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  toggleButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  toggleButtonActive: {
    backgroundColor: '#075E54',
    borderColor: '#075E54',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
});

export default App;
