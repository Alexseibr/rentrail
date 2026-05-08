import { useEffect, useState, useCallback } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";

type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
};

let _currentState: NetworkState = {
  isConnected: true,
  isInternetReachable: true,
};
const _listeners: Set<(state: NetworkState) => void> = new Set();

async function checkConnection(): Promise<boolean> {
  if (Platform.OS === "web") {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://clients3.google.com/generate_204", {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

async function updateNetworkState() {
  const online = await checkConnection();
  const newState: NetworkState = {
    isConnected: online,
    isInternetReachable: online,
  };
  if (newState.isConnected !== _currentState.isConnected) {
    _currentState = newState;
    _listeners.forEach((fn) => fn(newState));
  }
}

let _pollTimer: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (_pollTimer) return;
  updateNetworkState();
  _pollTimer = setInterval(updateNetworkState, 15000);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

export function useNetwork() {
  const [state, setState] = useState<NetworkState>(_currentState);

  useEffect(() => {
    _listeners.add(setState);
    startPolling();

    const sub = AppState.addEventListener(
      "change",
      (appState: AppStateStatus) => {
        if (appState === "active") {
          updateNetworkState();
        }
      },
    );

    return () => {
      _listeners.delete(setState);
      sub.remove();
      if (_listeners.size === 0) stopPolling();
    };
  }, []);

  const refresh = useCallback(() => {
    updateNetworkState();
  }, []);

  return { ...state, refresh };
}

export function getNetworkState(): NetworkState {
  return _currentState;
}

export function onNetworkChange(fn: (state: NetworkState) => void): () => void {
  _listeners.add(fn);
  startPolling();
  return () => {
    _listeners.delete(fn);
    if (_listeners.size === 0) stopPolling();
  };
}
