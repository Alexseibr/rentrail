import { Stack } from "expo-router";

export default function ServiceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="work-orders" />
      <Stack.Screen name="spare-parts" />
      <Stack.Screen name="work-order/[id]" />
    </Stack>
  );
}
