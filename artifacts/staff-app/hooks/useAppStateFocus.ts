import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

export function useAppStateFocus(onFocus: () => void) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        const prev = appState.current;
        appState.current = next;

        if (
          next === "active" &&
          (prev === "background" || prev === "inactive")
        ) {
          onFocusRef.current();
        }
      },
    );

    return () => subscription.remove();
  }, []);
}
