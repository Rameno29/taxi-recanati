import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";
import ActiveRideScreen from "../screens/ActiveRideScreen";
import ChatScreen from "../screens/ChatScreen";
import EarningsScreen from "../screens/EarningsScreen";
import ProfileScreen from "../screens/ProfileScreen";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  ActiveRide: undefined;
  Earnings: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Chat: { rideId: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { focused: "car-sport", unfocused: "car-sport-outline" },
  ActiveRide: { focused: "navigate", unfocused: "navigate-outline" },
  Earnings: { focused: "cash", unfocused: "cash-outline" },
  Profile: { focused: "person", unfocused: "person-outline" },
};

function MainTabs() {
  const { t } = useTranslation();

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primaryBlue },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: "bold" },
        tabBarActiveTintColor: colors.primaryBlue,
        tabBarInactiveTintColor: colors.bodyText,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          paddingBottom: 4,
          paddingTop: 4,
          height: 56,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t("tabs.dashboard"), tabBarLabel: t("tabs.dashboard") }}
      />
      <MainTab.Screen
        name="ActiveRide"
        component={ActiveRideScreen}
        options={{ title: t("tabs.ride"), tabBarLabel: t("tabs.ride") }}
      />
      <MainTab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ title: t("tabs.earnings"), tabBarLabel: t("tabs.earnings") }}
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
    </RootStack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
