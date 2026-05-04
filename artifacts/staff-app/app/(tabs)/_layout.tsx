import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useTranslation } from "react-i18next";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { canAccessTab } from "@/utils/permissions";

function NativeTabLayout() {
  const { t } = useTranslation();
  const { user, companyId } = useAuth();
  const memberships = user?.memberships || user?.companies;
  const roleCode = memberships?.find((c) => c.companyId === companyId)?.roleCode || memberships?.[0]?.roleCode;

  return (
    <NativeTabs>
      {canAccessTab(roleCode, "index") && (
        <NativeTabs.Trigger name="index">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>{t("nav.home")}</Label>
        </NativeTabs.Trigger>
      )}
      {canAccessTab(roleCode, "my-shift") && (
        <NativeTabs.Trigger name="my-shift">
          <Icon sf={{ default: "clipboard", selected: "clipboard.fill" }} />
          <Label>{t("nav.myShift")}</Label>
        </NativeTabs.Trigger>
      )}
      {canAccessTab(roleCode, "assets") && (
        <NativeTabs.Trigger name="assets">
          <Icon sf={{ default: "bicycle", selected: "bicycle" }} />
          <Label>{t("nav.assets")}</Label>
        </NativeTabs.Trigger>
      )}
      {canAccessTab(roleCode, "rentals") && (
        <NativeTabs.Trigger name="rentals">
          <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
          <Label>{t("nav.rentals")}</Label>
        </NativeTabs.Trigger>
      )}
      {canAccessTab(roleCode, "operations") && (
        <NativeTabs.Trigger name="operations">
          <Icon sf={{ default: "wrench.and.screwdriver", selected: "wrench.and.screwdriver.fill" }} />
          <Label>{t("nav.ops")}</Label>
        </NativeTabs.Trigger>
      )}
      {canAccessTab(roleCode, "settings") && (
        <NativeTabs.Trigger name="settings">
          <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
          <Label>{t("nav.settings")}</Label>
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const { t } = useTranslation();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { user, companyId } = useAuth();
  const { pendingCount } = useSync();
  const memberships = user?.memberships || user?.companies;
  const roleCode = memberships?.find((c) => c.companyId === companyId)?.roleCode || memberships?.[0]?.roleCode;

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
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.dark },
              ]}
            />
          ) : null,
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.dashboard"),
          href: canAccessTab(roleCode, "index") ? undefined : null,
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "house.fill" : "house"} tintColor={color} size={24} />
            ) : (
              <View style={focused ? tabStyles.activeIconWrap : undefined}>
                <Feather name="home" size={22} color={color} />
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="my-shift"
        options={{
          title: t("nav.myShift"),
          href: canAccessTab(roleCode, "my-shift") ? undefined : null,
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "clipboard.fill" : "clipboard"} tintColor={color} size={24} />
            ) : (
              <View style={focused ? tabStyles.activeIconWrap : undefined}>
                <Feather name="clipboard" size={22} color={color} />
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: t("nav.assets"),
          href: canAccessTab(roleCode, "assets") ? undefined : null,
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="bicycle" tintColor={color} size={24} />
            ) : (
              <View style={focused ? tabStyles.activeIconWrap : undefined}>
                <Feather name="grid" size={22} color={color} />
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="rentals"
        options={{
          title: t("nav.rentals"),
          href: canAccessTab(roleCode, "rentals") ? undefined : null,
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "doc.text.fill" : "doc.text"} tintColor={color} size={24} />
            ) : (
              <View style={focused ? tabStyles.activeIconWrap : undefined}>
                <Feather name="file-text" size={22} color={color} />
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: t("nav.ops"),
          href: canAccessTab(roleCode, "operations") ? undefined : null,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#f59e0b", fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "wrench.and.screwdriver.fill" : "wrench.and.screwdriver"} tintColor={color} size={24} />
            ) : (
              <View style={focused ? tabStyles.activeIconWrap : undefined}>
                <Feather name="settings" size={22} color={color} />
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav.settings"),
          href: canAccessTab(roleCode, "settings") ? undefined : null,
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "gearshape.fill" : "gearshape"} tintColor={color} size={24} />
            ) : (
              <View style={focused ? tabStyles.activeIconWrap : undefined}>
                <Feather name="user" size={22} color={color} />
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          href: null,
          headerShown: false,
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

export default function TabLayout() {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
