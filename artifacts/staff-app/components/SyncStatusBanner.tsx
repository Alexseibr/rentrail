import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useNetwork } from "@/services/network";
import { useSync } from "@/contexts/SyncContext";

export function SyncStatusBanner() {
  const colors = useColors();
  const { isConnected } = useNetwork();
  const { pendingCount, isSyncing, syncNow } = useSync();

  if (isConnected && pendingCount === 0) return null;

  const isOffline = !isConnected;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: isOffline ? colors.offline : colors.syncing },
      ]}
    >
      <Feather
        name={isOffline ? "wifi-off" : "refresh-cw"}
        size={14}
        color="#fff"
      />
      <Text style={styles.text}>
        {isOffline
          ? "Offline mode"
          : isSyncing
            ? "Syncing..."
            : `${pendingCount} pending action${pendingCount !== 1 ? "s" : ""}`}
      </Text>
      {!isOffline && pendingCount > 0 && !isSyncing && (
        <TouchableOpacity onPress={syncNow} style={styles.syncBtn}>
          <Text style={styles.syncText}>Sync Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  syncBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
