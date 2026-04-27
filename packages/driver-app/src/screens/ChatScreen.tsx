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
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { colors as staticColors, spacing, radii, fonts } from "../theme";
import { useThemeColors } from "../context/ThemeContext";
import type { Message } from "../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

export default function ChatScreen({ route }: Props) {
  const { rideId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();
  const colors = useThemeColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();

    const socket = getSocket();
    if (socket) {
      socket.emit("join:ride", rideId);

      const handleNewMessage = (msg: Message) => {
        if (msg.ride_id === rideId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
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
      const res = await api.get(`/api/messages/${rideId}`);
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
      const res = await api.post(`/api/messages/${rideId}`, { body });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    } catch {
      // Failed to send
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View
        style={[
          styles.bubble,
          isMine
            ? styles.bubbleMine
            : [styles.bubbleTheirs, { backgroundColor: colors.white }],
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isMine ? styles.bubbleTextMine : { color: colors.dark },
          ]}
        >
          {item.body}
        </Text>
        <Text
          style={[
            styles.time,
            isMine ? styles.timeMine : { color: colors.bodyText },
          ]}
        >
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
      style={[styles.container, { backgroundColor: colors.lightBg }]}
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
            <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.bodyText }]}>
              {t("chat.empty")}
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.inputBar,
          { backgroundColor: colors.white, borderTopColor: colors.border },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: colors.dark,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
            },
          ]}
          value={text}
          onChangeText={setText}
          placeholder={t("chat.placeholder")}
          placeholderTextColor={colors.bodyText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim()}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: staticColors.lightBg },
  list: { padding: spacing.md, flexGrow: 1 },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { color: staticColors.bodyText, fontSize: fonts.body },
  bubble: {
    maxWidth: "80%",
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: staticColors.primaryBlue,
    alignSelf: "flex-end",
    borderBottomRightRadius: spacing.xs,
  },
  bubbleTheirs: {
    backgroundColor: staticColors.white,
    alignSelf: "flex-start",
    borderBottomLeftRadius: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleText: { fontSize: fonts.body, color: staticColors.dark },
  bubbleTextMine: { color: "#FFF" },
  time: {
    fontSize: 11,
    color: staticColors.bodyText,
    marginTop: spacing.xs,
    alignSelf: "flex-end",
  },
  timeMine: { color: "rgba(255,255,255,0.7)" },
  inputBar: {
    flexDirection: "row",
    padding: spacing.md,
    backgroundColor: staticColors.white,
    borderTopWidth: 1,
    borderTopColor: staticColors.border,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: staticColors.border,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fonts.body,
    color: staticColors.dark,
    maxHeight: 100,
    backgroundColor: staticColors.inputBg,
  },
  sendBtn: {
    backgroundColor: staticColors.primaryBlue,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
