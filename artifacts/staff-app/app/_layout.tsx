import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, AppState, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { SnackbarProvider } from "@/contexts/SnackbarContext";
import { setupNotificationHandler } from "@/services/push";
import "../i18n/i18n";

SplashScreen.preventAutoHideAsync();
setupNotificationHandler();

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (state) => {
    handleFocus(state === "active");
  });
  return () => subscription.remove();
});

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, isClient } = useAuth();
  const segments = useSegments();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a1a" }}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    );
  }

  const inAuthGroup = segments[0] === "login";
  const inStaffTabs = segments[0] === "(tabs)";
  const inClientTabs = segments[0] === "(client-tabs)";

  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/login" />;
  }

  if (isAuthenticated && inAuthGroup) {
    if (isClient) {
      return <Redirect href="/(client-tabs)/vehicles" />;
    }
    return <Redirect href="/" />;
  }

  if (isAuthenticated && isClient && inStaffTabs) {
    return <Redirect href="/(client-tabs)/vehicles" />;
  }

  if (isAuthenticated && !isClient && inClientTabs) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{
      headerBackTitle: t("common.back"),
      headerStyle: { backgroundColor: "#1a1a1a" },
      headerTintColor: "#ffffff",
      headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
      headerShadowVisible: false,
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(client-tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="scanner" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="create-incident" options={{ title: t("screens.newIncident") }} />
      <Stack.Screen name="create-maintenance" options={{ title: t("screens.newMaintenance") }} />
      <Stack.Screen name="sync-queue" options={{ title: t("screens.syncQueue") }} />
      <Stack.Screen name="notifications" options={{ title: t("screens.notifications") }} />
      <Stack.Screen name="asset/[id]" options={{ title: t("screens.asset") }} />
      <Stack.Screen name="rental/[id]" options={{ title: t("screens.rental") }} />
      <Stack.Screen name="incident/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="maintenance/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="maintenance/map" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="client-scanner" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="fleet-map" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AuthProvider>
                <SyncProvider>
                  <SnackbarProvider>
                    <RootLayoutNav />
                  </SnackbarProvider>
                </SyncProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
