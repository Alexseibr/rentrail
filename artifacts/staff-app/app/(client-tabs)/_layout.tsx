import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";

export default function ClientTabLayout() {
  const { t } = useTranslation();
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.dark,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 17,
        },
        tabBarStyle: {
          position: "absolute" as const,
          backgroundColor: isIOS ? "transparent" : colors.dark,
          borderTopWidth: 0,
          elevation: 0,
          ...(isWeb ? { height: 84 } : { height: Platform.OS === "android" ? 64 : 88 }),
          paddingBottom: Platform.OS === "android" ? 8 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.dark }]} />
          ) : null,
        tabBarItemStyle: { paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="vehicles"
        options={{
          title: t("clientNav.vehicles"),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIconWrap : undefined}>
              <Feather name="map-pin" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="my-rentals"
        options={{
          title: t("clientNav.myRentals"),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIconWrap : undefined}>
              <Feather name="clock" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("clientNav.profile"),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIconWrap : undefined}>
              <Feather name="user" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="vehicle-detail"
        options={{
          title: t("vehicleDetail.title"),
          href: null,
        }}
      />
      <Tabs.Screen
        name="rental-detail"
        options={{
          title: t("rentalDetail.title"),
          href: null,
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  activeIconWrap: {
    backgroundColor: "rgba(245, 197, 24, 0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
