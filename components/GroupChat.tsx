/**
 * Group Chat Component
 * Handles group/clan messaging via MQTT
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';

interface Message {
    topic: string;
    message: any;
    timestamp: Date;
    senderId?: string;
    senderName?: string;
    isMe: boolean;
}

interface GroupChatProps {
    mqttManager: any;
    status: string;
    messages: Message[];
    myUserId: string;
}

export const GroupChat: React.FC<GroupChatProps> = ({
    mqttManager,
    status,
    messages,
    myUserId,
}) => {
    const [clanId, setClanId] = useState('23821');
    const [groupMessage, setGroupMessage] = useState('');

    const handleSendGroupMsg = async () => {
        if (status !== 'connected' || !groupMessage.trim()) return;

        try {
            console.log('Sending message to group:', clanId);
            await mqttManager.sendGroupMessage(clanId, groupMessage);
            setGroupMessage('');
        } catch (e: any) {
            console.error('Send Error:', e.message);
        }
    };

    const handleSubscribe = async () => {
        if (status !== 'connected') return;
        try {
            await mqttManager.subscribeGroupChat(clanId);
        } catch (e: any) {
            console.error('Subscribe Error:', e.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Group Chat</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Clan ID:</Text>
                <TextInput
                    style={styles.smallInput}
                    value={clanId}
                    onChangeText={setClanId}
                    placeholder="Clan/Group ID"
                    keyboardType="numeric"
                />
            </View>

            <View style={styles.buttonGrid}>
                <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: '#FF9800' }]}
                    onPress={handleSubscribe}
                    disabled={status !== 'connected'}
                >
                    <Text style={styles.buttonText}>Listen to Group</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.inputGroup, { marginTop: 15 }]}>
                <TextInput
                    style={[styles.smallInput, styles.messageInput]}
                    value={groupMessage}
                    onChangeText={setGroupMessage}
                    placeholder="Type a group message..."
                    multiline
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        { opacity: status === 'connected' && groupMessage.trim() ? 1 : 0.5 },
                    ]}
                    onPress={handleSendGroupMsg}
                    disabled={status !== 'connected' || !groupMessage.trim()}
                >
                    <Text style={styles.buttonText}>Send</Text>
                </TouchableOpacity>
            </View>

            {/* Messages List */}
            <View style={styles.messagesSection}>
                <Text style={styles.sectionTitle}>Group Conversation</Text>
                {messages.length === 0 ? (
                    <Text style={styles.emptyText}>
                        No group messages yet. Subscribe and wait for messages!
                    </Text>
                ) : (
                    <ScrollView style={styles.chatContainer}>
                        {messages.map((msg, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.messageBubble,
                                    msg.isMe ? styles.myBubble : styles.groupBubble,
                                ]}
                            >
                                {!msg.isMe && (
                                    <Text style={styles.senderLabel}>
                                        {msg.senderName || `User ${msg.senderId}`}:
                                    </Text>
                                )}
                                <Text style={styles.messageText}>{msg.message}</Text>
                                <Text style={styles.timestampLabel}>
                                    {msg.timestamp.toLocaleTimeString()}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        margin: 10,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF6F00',
        marginBottom: 12,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    label: { fontSize: 14, color: '#333', width: 80 },
    smallInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        backgroundColor: '#f9f9f9',
        color: '#333',
    },
    messageInput: {
        minHeight: 45,
        maxHeight: 100,
        textAlignVertical: 'center',
    },
    buttonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 5,
    },
    smallButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButton: {
        backgroundColor: '#FF6F00',
        padding: 12,
        borderRadius: 25,
        width: 70,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    messagesSection: {
        marginTop: 20,
        flex: 1,
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        padding: 20,
        fontStyle: 'italic',
    },
    chatContainer: {
        flexDirection: 'column',
        maxHeight: 400,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: 10,
        borderRadius: 12,
        marginBottom: 10,
        elevation: 1,
    },
    myBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#FFE0B2',
        borderTopRightRadius: 2,
    },
    groupBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderTopLeftRadius: 2,
    },
    senderLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FF6F00',
        marginBottom: 2,
    },
    messageText: { fontSize: 15, color: '#333' },
    timestampLabel: {
        fontSize: 9,
        color: '#999',
        alignSelf: 'flex-end',
        marginTop: 4,
    },
});
