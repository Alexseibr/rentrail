import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

type SnackbarType = "success" | "error";

interface SnackbarContextValue {
  showSnackbar: (message: string, type?: SnackbarType) => void;
}

const SnackbarContext = createContext<SnackbarContextValue>({
  showSnackbar: () => {},
});

export function useSnackbar() {
  return useContext(SnackbarContext);
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<SnackbarType>("success");
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSnackbar = useCallback((msg: string, t: SnackbarType = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    setType(t);
    setVisible(true);
    translateY.setValue(100);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 100, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }, 3000);
  }, [translateY, opacity]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const bgColor = type === "success" ? "#2E7D32" : "#C62828";
  const iconName = type === "success" ? "check-circle" : "alert-circle";

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: bgColor, bottom: insets.bottom + 16, transform: [{ translateY }], opacity },
          ]}
          pointerEvents="none"
        >
          <Feather name={iconName as any} size={18} color="#fff" />
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </SnackbarContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  text: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
