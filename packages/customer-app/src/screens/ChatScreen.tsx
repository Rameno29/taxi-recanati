import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import type { Message } from "../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

export default function ChatScreen({ route }: Props) {
  const { rideId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();

    const socket = getSocket();
    if (socket) {
      const handleNewMessage = (msg: Message) => {
        if (msg.ride_id === rideId) {
          setMessages((prev) => [...prev, msg]);
        }
      };
      socket.on("chat:message", handleNewMessage);
      return () => {
        socket.off("chat:message", handleNewMessage);
      };
    }
  }, [rideId]);

  const loadMessages = async () => {
    try {
      const res = await api.get(`/api/messages/ride/${rideId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // Network error
    }
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");

    try {
      const res = await api.post(`/api/messages/ride/${rideId}`, { body });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
      }
    } catch {
      // Failed to send
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
          {item.body}
        </Text>
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("chat.empty")}</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={t("chat.placeholder")}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Text style={styles.sendText}>{t("chat.send")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  list: { padding: 16, flexGrow: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#999", fontSize: 16 },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleMine: {
    backgroundColor: "#FFC107",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 16, color: "#333" },
  bubbleTextMine: { color: "#000" },
  time: { fontSize: 11, color: "#999", marginTop: 4, alignSelf: "flex-end" },
  inputBar: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: "#FFC107",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { fontWeight: "bold", fontSize: 16 },
});
