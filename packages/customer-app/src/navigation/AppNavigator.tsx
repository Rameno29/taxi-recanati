import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { colors } from "../theme";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import TrackingScreen from "../screens/TrackingScreen";
import ChatScreen from "../screens/ChatScreen";
import HistoryScreen from "../screens/HistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import PaymentMethodsScreen from "../screens/PaymentMethodsScreen";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Tracking: undefined;
  History: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Chat: { rideId: string };
  PaymentMethods: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }> = {
  Home: { focused: "home", unfocused: "home-outline" },
  Tracking: { focused: "car", unfocused: "car-outline" },
  History: { focused: "time", unfocused: "time-outline" },
  Profile: { focused: "person", unfocused: "person-outline" },
};

function MainTabs() {
  const { t } = useTranslation();
  const { colors: c } = useTheme();

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: c.primaryBlue },
        headerTintColor: "#FFF",
        headerTitleStyle: { fontWeight: "bold" },
        tabBarActiveTintColor: c.primaryBlue,
        tabBarInactiveTintColor: c.bodyText,
        tabBarStyle: {
          backgroundColor: c.white,
          borderTopColor: c.border,
          paddingBottom: 30,
          paddingTop: 10,
          height: 92,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <MainTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false, tabBarLabel: t("tabs.home") }}
      />
      <MainTab.Screen
        name="Tracking"
        component={TrackingScreen}
        options={{ title: t("tabs.tracking"), tabBarLabel: t("tabs.tracking") }}
      />
      <MainTab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: t("tabs.history"), tabBarLabel: t("tabs.history") }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t("tabs.profile"), tabBarLabel: t("tabs.profile") }}
      />
    </MainTab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: "Chat",
          headerStyle: { backgroundColor: colors.primaryBlue },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: "bold" },
        }}
      />
      <RootStack.Screen
        name="PaymentMethods"
        component={PaymentMethodsScreen}
        options={{
          title: "Metodi di pagamento",
          headerStyle: { backgroundColor: colors.primaryBlue },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: "bold" },
        }}
      />
    </RootStack.Navigator>
  );
}

const CustomDarkTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: colors.primaryBlue, card: "#1E1E1E", background: "#121212" },
};
const CustomLightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primaryBlue, card: colors.white, background: colors.lightBg },
};

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.lightBg }}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={isDark ? CustomDarkTheme : CustomLightTheme}>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
